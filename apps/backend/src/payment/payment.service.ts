import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  FinancialEntryType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  ShiftStatus,
  TableStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { LedgerService, SYSTEM_ACCOUNT_CODES } from '../ledger/ledger.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementService } from '../settlement/settlement.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PaymentRow = {
  id: number;
  orderId: number;
  payerPersonId: number;
  beneficiaryPersonId: number | null;
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  idempotencyKey: string | null;
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementService: SettlementService,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
    private readonly ordersService: OrdersService,
  ) {}

  async createPayment(
    orderId: number,
    payerPersonId: number,
    amount: number,
    method: PaymentMethod,
    beneficiaryPersonId?: number,
    idempotencyKey?: string,
    userId?: number,
  ): Promise<{
    orderId: number;
    payments: Array<{
      id: number;
      payerPersonId: number;
      beneficiaryPersonId: number | null;
      amount: number;
      method: PaymentMethod;
      paidAt: Date;
    }>;
  }> {
    const normalizedIdempotencyKey =
      this.normalizeIdempotencyKey(idempotencyKey);

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be positive integer');
    }

    let txResult: PaymentRow[] | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        txResult = await this.prisma.$transaction((tx) =>
          this.createPaymentInTx(tx, {
            orderId,
            payerPersonId,
            amount,
            method,
            beneficiaryPersonId,
            idempotencyKey: normalizedIdempotencyKey,
            userId,
          }),
        );
        break;
      } catch (error) {
        if (attempt === 0 && this.isIdempotencyConflictError(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!txResult) {
      throw new BadRequestException('Payment processing failed');
    }

    return {
      orderId,
      payments: this.toPaymentResponse(txResult),
    };
  }

  private async createPaymentInTx(
    tx: Prisma.TransactionClient,
    input: {
      orderId: number;
      payerPersonId: number;
      amount: number;
      method: PaymentMethod;
      beneficiaryPersonId?: number;
      idempotencyKey: string;
      userId?: number;
    },
  ): Promise<PaymentRow[]> {
    const {
      orderId,
      payerPersonId,
      amount,
      method,
      beneficiaryPersonId,
      idempotencyKey,
      userId,
    } = input;

    const existingInTx = await this.findPaymentGroupByIdempotencyKeyInTx(
      tx,
      idempotencyKey,
    );
    if (existingInTx.length > 0) {
      this.assertIdempotencyOrder(orderId, existingInTx);
      await this.autoFinalizeIfFullyPaidInTx(tx, orderId, userId);
      return existingInTx;
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        tableId: true,
        shift: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.CLOSED) {
      throw new BadRequestException('Cannot add payment to closed order');
    }

    if (order.shift?.status === ShiftStatus.CLOSED) {
      throw new BadRequestException('Shift is closed. Order is immutable');
    }

    if (order.status !== OrderStatus.SETTLING) {
      this.logger.warn(
        `Unexpected status transition for payment. orderId=${orderId}, status=${order.status}`,
      );
      throw new BadRequestException('Order not in settling state');
    }

    const settlement = await this.settlementService.getSettlement(orderId, tx);
    const payer = settlement.people.find(
      (person) => person.personId === payerPersonId,
    );
    if (!payer) {
      throw new NotFoundException('Payer not found');
    }

    const payerDebt = Math.max(payer.debt, 0);
    const plans = this.buildPaymentPlans(
      payerPersonId,
      payerDebt,
      amount,
      beneficiaryPersonId,
    );

    const result: PaymentRow[] = [];
    for (let index = 0; index < plans.length; index += 1) {
      const plan = plans[index];
      const currentIdempotencyKey = this.buildIdempotencyKey(
        idempotencyKey,
        index,
      );

      const created = await tx.payment.create({
        data: {
          orderId,
          payerPersonId,
          beneficiaryPersonId: plan.beneficiaryPersonId,
          amount: plan.amount,
          method,
          idempotencyKey: currentIdempotencyKey,
        },
        select: {
          id: true,
          orderId: true,
          payerPersonId: true,
          beneficiaryPersonId: true,
          amount: true,
          method: true,
          paidAt: true,
          idempotencyKey: true,
        },
      });

      await tx.financialEntry.create({
        data: {
          type: FinancialEntryType.PAYMENT,
          amount: created.amount,
          method: created.method,
          orderId,
          tableId: order.tableId,
          paymentId: created.id.toString(),
          source: 'PAYMENT',
          note: JSON.stringify({
            payerPersonId: created.payerPersonId,
            beneficiaryPersonId: created.beneficiaryPersonId,
          }),
        },
      });

      await this.ledgerService.postJournalInTx(
        tx,
        `PAYMENT-${created.id}`,
        `Payment for order ${orderId}`,
        [
          {
            accountCode: this.getPaymentAssetAccountCode(created.method),
            debit: created.amount,
          },
          {
            accountCode: SYSTEM_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
            credit: created.amount,
          },
        ],
      );

      await this.auditService.logInTx(tx, AuditAction.PAYMENT_CREATED, {
        entityType: 'Payment',
        entityId: created.id,
        userId,
        metadata: {
          amount: created.amount,
          method: created.method,
        },
      });

      result.push(created);
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SETTLING,
      },
    });

    if (order.tableId !== null) {
      await tx.cafeTable.update({
        where: { id: order.tableId },
        data: {
          status: TableStatus.SETTLING,
        },
      });
    }

    await this.autoFinalizeIfFullyPaidInTx(tx, orderId, userId);
    return result;
  }

  private async autoFinalizeIfFullyPaidInTx(
    tx: Prisma.TransactionClient,
    orderId: number,
    userId?: number,
  ): Promise<void> {
    const debtState = await this.ordersService.getOrderDebtStateInTx(
      tx,
      orderId,
    );

    if (debtState.totalDebt < 0) {
      this.logger.warn(
        `Negative debt detected before auto-finalize. orderId=${orderId}, totalDebt=${debtState.totalDebt}`,
      );
    }

    if (debtState.status !== OrderStatus.SETTLING) {
      return;
    }

    if (debtState.totalDebt !== 0) {
      return;
    }

    this.logger.debug(`Auto-finalizing order ${orderId} after full payment`);
    await this.ordersService.finalizeOrderInTx(tx, orderId, userId);
  }

  private buildPaymentPlans(
    payerPersonId: number,
    payerDebt: number,
    amount: number,
    beneficiaryPersonId?: number,
  ): Array<{ beneficiaryPersonId: number; amount: number }> {
    if (
      beneficiaryPersonId !== undefined &&
      beneficiaryPersonId !== payerPersonId
    ) {
      throw new BadRequestException(
        'beneficiaryPersonId must match payerPersonId',
      );
    }

    if (amount > payerDebt) {
      throw new BadRequestException('amount is greater than payer debt');
    }

    return [
      {
        beneficiaryPersonId: payerPersonId,
        amount,
      },
    ];
  }

  private normalizeIdempotencyKey(rawKey?: string): string {
    const value = rawKey?.trim();
    if (!value) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (!UUID_PATTERN.test(value)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID');
    }
    return value;
  }

  private buildIdempotencyKey(baseKey: string, index: number): string {
    if (index === 0) {
      return baseKey;
    }
    return `${baseKey}:${index + 1}`;
  }

  private async findPaymentGroupByIdempotencyKeyInTx(
    tx: Prisma.TransactionClient,
    idempotencyKey: string,
  ): Promise<PaymentRow[]> {
    return tx.payment.findMany({
      where: {
        OR: [
          { idempotencyKey },
          { idempotencyKey: { startsWith: `${idempotencyKey}:` } },
        ],
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        orderId: true,
        payerPersonId: true,
        beneficiaryPersonId: true,
        amount: true,
        method: true,
        paidAt: true,
        idempotencyKey: true,
      },
    });
  }

  private assertIdempotencyOrder(orderId: number, rows: PaymentRow[]): void {
    const wrongOrder = rows.find((row) => row.orderId !== orderId);
    if (wrongOrder) {
      throw new BadRequestException(
        'Idempotency-Key is already used for another order',
      );
    }
  }

  private toPaymentResponse(rows: PaymentRow[]): Array<{
    id: number;
    payerPersonId: number;
    beneficiaryPersonId: number | null;
    amount: number;
    method: PaymentMethod;
    paidAt: Date;
  }> {
    return rows.map((row) => ({
      id: row.id,
      payerPersonId: row.payerPersonId,
      beneficiaryPersonId: row.beneficiaryPersonId,
      amount: row.amount,
      method: row.method,
      paidAt: row.paidAt,
    }));
  }

  private isIdempotencyConflictError(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return target.includes('idempotencyKey');
    }

    if (typeof target === 'string') {
      return target.includes('idempotencyKey');
    }

    return false;
  }

  private getPaymentAssetAccountCode(method: PaymentMethod): string {
    if (method === PaymentMethod.CARD) {
      return SYSTEM_ACCOUNT_CODES.BANK;
    }

    return SYSTEM_ACCOUNT_CODES.CASH;
  }
}
