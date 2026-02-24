import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountType,
  AuditAction,
  PaymentMethod,
  Prisma,
  ShiftStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { LedgerService, SYSTEM_ACCOUNT_CODES } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

type ExpenseListItem = {
  id: number;
  shiftId: number;
  shiftStatus: ShiftStatus;
  amount: number;
  category: string;
  description: string;
  method: PaymentMethod;
  isVoided: boolean;
  createdAt: Date;
  createdBy: number | null;
  createdByEmail: string | null;
  voidedAt: Date | null;
  voidedBy: number | null;
  voidedByEmail: string | null;
};

@Injectable()
export class AdminExpensesService {
  private readonly logger = new Logger(AdminExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
  ) {}

  async getExpenses(shiftId?: number): Promise<ExpenseListItem[]> {
    if (shiftId !== undefined && (!Number.isInteger(shiftId) || shiftId <= 0)) {
      throw new BadRequestException('shiftId must be a positive integer');
    }

    const expenses = await this.prisma.expense.findMany({
      where: shiftId ? { shiftId } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        shiftId: true,
        shift: {
          select: {
            status: true,
          },
        },
        amount: true,
        category: true,
        description: true,
        method: true,
        isVoided: true,
        createdAt: true,
        createdBy: true,
        voidedAt: true,
        voidedBy: true,
        creator: {
          select: {
            email: true,
          },
        },
        voider: {
          select: {
            email: true,
          },
        },
      },
    });

    return expenses.map((expense) => ({
      id: expense.id,
      shiftId: expense.shiftId,
      shiftStatus: expense.shift.status,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      method: expense.method,
      isVoided: expense.isVoided,
      createdAt: expense.createdAt,
      createdBy: expense.createdBy,
      createdByEmail: expense.creator?.email ?? null,
      voidedAt: expense.voidedAt,
      voidedBy: expense.voidedBy,
      voidedByEmail: expense.voider?.email ?? null,
    }));
  }

  async createExpense(input: CreateExpenseDto, userId?: number): Promise<ExpenseListItem> {
    const category = input.category.trim();
    const description = input.description.trim();
    const method = input.method ?? PaymentMethod.CASH;

    if (!category) {
      throw new BadRequestException('category is required');
    }

    if (!description) {
      throw new BadRequestException('description is required');
    }

    const assetAccountCode = this.resolveAssetAccountCode(method);

    const createdExpense = await this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({
        where: { id: input.shiftId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      if (shift.status !== ShiftStatus.OPEN) {
        throw new ConflictException('Cannot create expense for closed shift');
      }

      await this.ensureExpenseAccountInTx(tx);

      const created = await tx.expense.create({
        data: {
          shiftId: shift.id,
          amount: input.amount,
          category,
          description,
          method,
          createdBy: userId,
        },
        select: {
          id: true,
          shiftId: true,
          shift: {
            select: {
              status: true,
            },
          },
          amount: true,
          category: true,
          description: true,
          method: true,
          isVoided: true,
          createdAt: true,
          createdBy: true,
          voidedAt: true,
          voidedBy: true,
        },
      });

      await this.ledgerService.postJournalInTx(
        tx,
        `EXPENSE-${created.id}`,
        `Expense #${created.id}: ${created.category}`,
        [
          {
            accountCode: SYSTEM_ACCOUNT_CODES.OPERATING_EXPENSE,
            debit: created.amount,
          },
          {
            accountCode: assetAccountCode,
            credit: created.amount,
          },
        ],
      );

      await this.auditService.logInTx(tx, AuditAction.EXPENSE_CREATED, {
        entityType: 'Expense',
        entityId: created.id,
        userId,
        metadata: {
          shiftId: created.shiftId,
          amount: created.amount,
          category: created.category,
          method: created.method,
        },
      });

      return {
        ...created,
        shiftStatus: created.shift.status,
        createdByEmail: null,
        voidedByEmail: null,
      };
    });

    this.logEvent('log', {
      action: 'EXPENSE_CREATE',
      userId,
      shiftId: createdExpense.shiftId,
      metadata: {
        expenseId: createdExpense.id,
        amount: createdExpense.amount,
        category: createdExpense.category,
        method: createdExpense.method,
      },
    });

    return createdExpense;
  }

  async voidExpense(id: number, userId?: number): Promise<ExpenseListItem> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Expense id is invalid');
    }

    const voidedExpense = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({
        where: { id },
        include: {
          shift: {
            select: {
              status: true,
            },
          },
          creator: {
            select: {
              email: true,
            },
          },
          voider: {
            select: {
              email: true,
            },
          },
        },
      });

      if (!expense) {
        throw new NotFoundException('Expense not found');
      }

      if (expense.isVoided) {
        throw new BadRequestException('Expense already voided');
      }

      if (expense.shift.status !== ShiftStatus.OPEN) {
        throw new ConflictException('Cannot void expense for closed shift');
      }

      await this.ensureExpenseAccountInTx(tx);

      const assetAccountCode = this.resolveAssetAccountCode(expense.method);
      const voidedAt = new Date();

      const voided = await tx.expense.update({
        where: { id: expense.id },
        data: {
          isVoided: true,
          voidedAt,
          voidedBy: userId,
        },
        select: {
          id: true,
          shiftId: true,
          shift: {
            select: {
              status: true,
            },
          },
          amount: true,
          category: true,
          description: true,
          method: true,
          isVoided: true,
          createdAt: true,
          createdBy: true,
          voidedAt: true,
          voidedBy: true,
          creator: {
            select: {
              email: true,
            },
          },
          voider: {
            select: {
              email: true,
            },
          },
        },
      });

      await this.ledgerService.postJournalInTx(
        tx,
        `EXPENSE-VOID-${expense.id}`,
        `Expense void #${expense.id}: ${expense.category}`,
        [
          {
            accountCode: assetAccountCode,
            debit: expense.amount,
          },
          {
            accountCode: SYSTEM_ACCOUNT_CODES.OPERATING_EXPENSE,
            credit: expense.amount,
          },
        ],
      );

      await this.auditService.logInTx(tx, AuditAction.EXPENSE_VOIDED, {
        entityType: 'Expense',
        entityId: expense.id,
        userId,
        metadata: {
          shiftId: expense.shiftId,
          amount: expense.amount,
          category: expense.category,
          method: expense.method,
        },
      });

      return {
        id: voided.id,
        shiftId: voided.shiftId,
        shiftStatus: voided.shift.status,
        amount: voided.amount,
        category: voided.category,
        description: voided.description,
        method: voided.method,
        isVoided: voided.isVoided,
        createdAt: voided.createdAt,
        createdBy: voided.createdBy,
        createdByEmail: voided.creator?.email ?? null,
        voidedAt: voided.voidedAt,
        voidedBy: voided.voidedBy,
        voidedByEmail: voided.voider?.email ?? null,
      };
    });

    this.logEvent('log', {
      action: 'EXPENSE_VOID',
      userId,
      shiftId: voidedExpense.shiftId,
      metadata: {
        expenseId: voidedExpense.id,
        amount: voidedExpense.amount,
        category: voidedExpense.category,
        method: voidedExpense.method,
      },
    });

    return voidedExpense;
  }

  private resolveAssetAccountCode(method: PaymentMethod): string {
    if (method === PaymentMethod.CASH) {
      return SYSTEM_ACCOUNT_CODES.CASH;
    }

    if (method === PaymentMethod.CARD) {
      return SYSTEM_ACCOUNT_CODES.BANK;
    }

    throw new BadRequestException('Expense method must be CASH or CARD');
  }

  private async ensureExpenseAccountInTx(
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.account.upsert({
      where: {
        code: SYSTEM_ACCOUNT_CODES.OPERATING_EXPENSE,
      },
      update: {},
      create: {
        code: SYSTEM_ACCOUNT_CODES.OPERATING_EXPENSE,
        name: 'Operating Expense',
        type: AccountType.EXPENSE,
      },
    });
  }

  private logEvent(
    level: 'error' | 'log' | 'warn',
    input: {
      action: string;
      userId?: number;
      shiftId?: number;
      metadata?: Record<string, unknown>;
    },
  ): void {
    const payload = JSON.stringify({
      level,
      context: AdminExpensesService.name,
      userId: input.userId ?? null,
      shiftId: input.shiftId ?? null,
      action: input.action,
      metadata: input.metadata ?? {},
    });

    if (level === 'warn') {
      this.logger.warn(payload);
      return;
    }

    if (level === 'error') {
      this.logger.error(payload);
      return;
    }

    this.logger.log(payload);
  }
}
