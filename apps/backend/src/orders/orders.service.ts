import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  FinancialEntryType,
  OrderItemType,
  OrderStatus,
  Prisma,
  ShiftStatus,
  TableStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { LedgerService, SYSTEM_ACCOUNT_CODES } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

type CreateOrderInput = {
  type: 'dine_in' | 'takeaway';
  tableId: number | null;
  openedByUserId: number;
};

type CreateOrderResponse = {
  id: number;
  orderNo: string;
  type: 'dine_in' | 'takeaway';
  tableId: number | null;
  status: OrderStatus;
  subtotal: number;
  total: number;
};

type AddOrderItemInput = {
  menuItemId: number;
  qty: number;
  note?: string;
  ownerType?: 'SHARED' | 'PERSON';
  ownerPersonId?: number;
};

type UpdateOrderItemInput = {
  qty?: number;
  note?: string;
};

type OrderItemResponse = {
  id: number;
  orderId: number;
  menuItemId: number | null;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
};

type OpenOrderContext = {
  id: number;
  tableId: number | null;
  discountAmount: number;
};

type LedgerSaleInput = {
  orderId: number;
  tableId: number | null;
  orderItemId: number;
  orderItemType: OrderItemType;
  amount: number;
  itemName: string;
  categoryName: string | null;
  quantity: number;
};

type DbTx = Prisma.TransactionClient;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResponse> {
    const { type, tableId, openedByUserId } = input;

    const openShift = await this.prisma.shift.findFirst({
      where: { status: ShiftStatus.OPEN },
      select: { id: true },
    });

    if (!openShift) {
      throw new BadRequestException('No active shift. Cannot create order.');
    }

    if (type !== 'dine_in' && type !== 'takeaway') {
      throw new BadRequestException('Invalid order type');
    }

    if (type === 'dine_in') {
      if (tableId === null || tableId === undefined) {
        throw new BadRequestException('tableId is required for dine_in orders');
      }

      const table = await this.prisma.cafeTable.findFirst({
        where: {
          id: tableId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!table) {
        throw new NotFoundException('Active table not found');
      }

      const existing = await this.prisma.order.findFirst({
        where: {
          tableId,
          status: {
            not: OrderStatus.CLOSED,
          },
        },
        select: {
          id: true,
          orderNo: true,
          type: true,
          tableId: true,
          status: true,
          subtotal: true,
          total: true,
          shift: {
            select: {
              status: true,
            },
          },
        },
      });

      if (existing) {
        this.assertOrderShiftIsMutable(existing.shift);
        return {
          id: existing.id,
          orderNo: existing.orderNo,
          type: existing.type,
          tableId: existing.tableId,
          status: existing.status,
          subtotal: existing.subtotal,
          total: existing.total,
        };
      }
    }

    if (type === 'takeaway' && tableId !== null) {
      throw new BadRequestException('tableId must be null for takeaway orders');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: openedByUserId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const createdOrder = await this.prisma.order.create({
      data: {
        orderNo: this.generateOrderNo(),
        type,
        tableId: type === 'dine_in' ? tableId : null,
        openedByUserId,
        shiftId: openShift.id,
        status: OrderStatus.OPEN,
        openedAt: new Date(),
        subtotal: 0,
        total: 0,
      },
      select: {
        id: true,
        orderNo: true,
        type: true,
        tableId: true,
        status: true,
        openedAt: true,
        subtotal: true,
        total: true,
      },
    });

    if (type === 'dine_in' && tableId !== null) {
      await this.prisma.tablePerson.updateMany({
        where: {
          tableId,
          leftAt: null,
        },
        data: {
          leftAt: createdOrder.openedAt,
        },
      });

      await this.prisma.cafeTable.update({
        where: { id: tableId },
        data: { status: TableStatus.SETTLING },
      });
    }

    return {
      id: createdOrder.id,
      orderNo: createdOrder.orderNo,
      type: createdOrder.type,
      tableId: createdOrder.tableId,
      status: createdOrder.status,
      subtotal: createdOrder.subtotal,
      total: createdOrder.total,
    };
  }

  private generateOrderNo(): string {
    return `ORD-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  async addOrderItem(
    orderId: number,
    input: AddOrderItemInput,
  ): Promise<OrderItemResponse> {
    const order = await this.getOpenOrder(orderId);

    if (!Number.isInteger(input?.menuItemId) || input.menuItemId <= 0) {
      throw new BadRequestException('menuItemId is invalid');
    }

    this.assertValidQty(input?.qty);

    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id: input.menuItemId },
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    if (!menuItem.isActive) {
      throw new BadRequestException('Menu item is inactive');
    }

    const lineTotal = this.calculateLineTotal(menuItem.price, input.qty);

    return this.prisma.$transaction(async (tx) => {
      const createdItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          type: OrderItemType.MENU,
          finalPrice: lineTotal,
          menuItemId: menuItem.id,
          name: menuItem.name,
          qty: input.qty,
          unitPrice: menuItem.price,
          lineTotal,
          note: input.note ?? null,
          ownerType: input.ownerType ?? 'SHARED',
          ownerPersonId: input.ownerType === 'PERSON' ? (input.ownerPersonId ?? null) : null,
        },
        select: {
          id: true,
          orderId: true,
          menuItemId: true,
          name: true,
          qty: true,
          unitPrice: true,
          lineTotal: true,
          finalPrice: true,
          type: true,
          note: true,
        },
      });

      await this.upsertSaleEntry(tx, {
        orderId: createdItem.orderId,
        tableId: order.tableId,
        orderItemId: createdItem.id,
        orderItemType: createdItem.type,
        amount: createdItem.finalPrice,
        itemName: createdItem.name,
        categoryName: menuItem.category.name,
        quantity: createdItem.qty,
      });

      await this.recalculateOrderTotals(
        tx,
        order.id,
        order.tableId,
        order.discountAmount,
      );

      return {
        id: createdItem.id,
        orderId: createdItem.orderId,
        menuItemId: createdItem.menuItemId,
        name: createdItem.name,
        qty: createdItem.qty,
        unitPrice: createdItem.unitPrice,
        lineTotal: createdItem.lineTotal,
        note: createdItem.note,
      };
    });
  }

  async updateOrderItem(
    orderId: number,
    itemId: number,
    input: UpdateOrderItemInput,
  ): Promise<OrderItemResponse> {
    const order = await this.getOpenOrder(orderId);

    if (input?.qty === undefined && input?.note === undefined) {
      throw new BadRequestException('Nothing to update');
    }

    const existingItem = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId: order.id,
      },
      select: {
        id: true,
        qty: true,
        unitPrice: true,
        note: true,
      },
    });

    if (!existingItem) {
      throw new NotFoundException('Order item not found for this order');
    }

    const nextQty = input.qty ?? existingItem.qty;
    this.assertValidQty(nextQty);

    return this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.orderItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          qty: nextQty,
          note: input.note === undefined ? existingItem.note : input.note,
          lineTotal: this.calculateLineTotal(existingItem.unitPrice, nextQty),
          finalPrice: this.calculateLineTotal(existingItem.unitPrice, nextQty),
        },
        select: {
          id: true,
          orderId: true,
          menuItemId: true,
          name: true,
          qty: true,
          unitPrice: true,
          lineTotal: true,
          finalPrice: true,
          type: true,
          note: true,
          menuItem: {
            select: {
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      await this.upsertSaleEntry(tx, {
        orderId: updatedItem.orderId,
        tableId: order.tableId,
        orderItemId: updatedItem.id,
        orderItemType: updatedItem.type,
        amount: updatedItem.finalPrice,
        itemName: updatedItem.name,
        categoryName: updatedItem.menuItem?.category.name ?? null,
        quantity: updatedItem.qty,
      });

      await this.recalculateOrderTotals(
        tx,
        order.id,
        order.tableId,
        order.discountAmount,
      );

      return {
        id: updatedItem.id,
        orderId: updatedItem.orderId,
        menuItemId: updatedItem.menuItemId,
        name: updatedItem.name,
        qty: updatedItem.qty,
        unitPrice: updatedItem.unitPrice,
        lineTotal: updatedItem.lineTotal,
        note: updatedItem.note,
      };
    });
  }

  async deleteOrderItem(
    orderId: number,
    itemId: number,
  ): Promise<{ success: true }> {
    const order = await this.getOpenOrder(orderId);

    const existingItem = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId: order.id,
      },
      select: {
        id: true,
      },
    });

    if (!existingItem) {
      throw new NotFoundException('Order item not found for this order');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({
        where: {
          id: existingItem.id,
        },
      });

      await tx.financialEntry.deleteMany({
        where: {
          type: FinancialEntryType.SALE,
          orderItemId: existingItem.id.toString(),
        },
      });

      await this.recalculateOrderTotals(
        tx,
        order.id,
        order.tableId,
        order.discountAmount,
      );
    });

    return { success: true };
  }

  async settleOrder(orderId: number): Promise<CreateOrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNo: true,
        type: true,
        tableId: true,
        status: true,
        subtotal: true,
        total: true,
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
      throw new BadRequestException('Order is already closed');
    }

    this.assertOrderShiftIsMutable(order.shift);

    if (order.total === 0) {
      return this.prisma.$transaction(async (tx) => {
        if (order.status !== OrderStatus.SETTLING) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.SETTLING,
            },
          });

          if (order.tableId) {
            await tx.cafeTable.update({
              where: { id: order.tableId },
              data: {
                status: TableStatus.SETTLING,
              },
            });
          }
        }

        await this.finalizeOrderInTx(tx, order.id);

        const closedOrder = await tx.order.findUnique({
          where: { id: order.id },
          select: {
            id: true,
            orderNo: true,
            type: true,
            tableId: true,
            status: true,
            subtotal: true,
            total: true,
          },
        });

        if (!closedOrder) {
          throw new NotFoundException('Order not found');
        }

        return closedOrder;
      });
    }

    const settlingOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.SETTLING,
      },
      select: {
        id: true,
        orderNo: true,
        type: true,
        tableId: true,
        status: true,
        subtotal: true,
        total: true,
      },
    });

    if (settlingOrder.tableId) {
      await this.prisma.cafeTable.update({
        where: { id: settlingOrder.tableId },
        data: {
          status: TableStatus.SETTLING,
        },
      });
    }

    return settlingOrder;
  }

  async finalizeOrder(
    orderId: number,
    userId?: number,
  ): Promise<{ success: true; orderId: number; closedAt: Date }> {
    return this.prisma.$transaction((tx) =>
      this.finalizeOrderInTx(tx, orderId, userId),
    );
  }

  async finalizeOrderInTx(
    tx: DbTx,
    orderId: number,
    userId?: number,
  ): Promise<{ success: true; orderId: number; closedAt: Date }> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        sessions: true,
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

    this.assertOrderShiftIsMutable(order.shift);

    if (order.status === OrderStatus.CLOSED) {
      return {
        success: true as const,
        orderId,
        closedAt: order.closedAt ?? new Date(),
      };
    }

    if (order.status !== OrderStatus.SETTLING) {
      this.logger.warn(
        `Unexpected status transition for finalize. orderId=${orderId}, status=${order.status}`,
      );
      throw new BadRequestException('Order not in settling state');
    }

    const openShift = await tx.shift.findFirst({
      where: { status: ShiftStatus.OPEN },
      select: { id: true },
    });

    if (!openShift) {
      throw new BadRequestException('No active shift. Cannot finalize order.');
    }

    const debtState = await this.getOrderDebtStateInTx(
      tx,
      orderId,
      order.total,
    );
    if (debtState.totalDebt < 0) {
      this.logger.warn(
        `Negative debt detected before finalize. orderId=${orderId}, totalDebt=${debtState.totalDebt}`,
      );
    }

    if (debtState.totalDebt !== 0) {
      throw new ConflictException('Order debt integrity violation');
    }

    const closedAt = new Date();
    const closed = await tx.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.SETTLING,
      },
      data: {
        status: OrderStatus.CLOSED,
        closedAt,
      },
    });

    if (closed.count !== 1) {
      const latest = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, closedAt: true },
      });
      if (latest?.status === OrderStatus.CLOSED) {
        return {
          success: true as const,
          orderId,
          closedAt: latest.closedAt ?? closedAt,
        };
      }

      this.logger.warn(
        `Unexpected finalize update result. orderId=${orderId}, updatedCount=${closed.count}`,
      );
      throw new BadRequestException('Order state changed during finalize');
    }

    if (order.total > 0) {
      await this.ledgerService.postJournalInTx(
        tx,
        `ORDER-${orderId}`,
        `Order finalized: ${order.orderNo}`,
        [
          {
            accountCode: SYSTEM_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
            debit: order.total,
          },
          {
            accountCode: SYSTEM_ACCOUNT_CODES.SALES_REVENUE,
            credit: order.total,
          },
        ],
      );
    }

    if (order.tableId !== null) {
      await tx.cafeTable.update({
        where: {
          id: order.tableId,
        },
        data: {
          status: TableStatus.FREE,
        },
      });

      await tx.tablePerson.updateMany({
        where: {
          tableId: order.tableId,
          leftAt: null,
          joinedAt: {
            lte: closedAt,
          },
        },
        data: {
          leftAt: closedAt,
        },
      });
    }

    if (order.sessions.length > 0) {
      await tx.tableSession.updateMany({
        where: {
          orderId,
          endedAt: null,
        },
        data: {
          endedAt: closedAt,
        },
      });
    }

    await this.auditService.logInTx(tx, AuditAction.ORDER_FINALIZED, {
      entityType: 'Order',
      entityId: order.id,
      userId,
    });

    return {
      success: true as const,
      orderId,
      closedAt,
    };
  }

  async getOrderDebtStateInTx(
    tx: DbTx,
    orderId: number,
    knownTotal?: number,
  ): Promise<{
    status: OrderStatus;
    total: number;
    totalPaid: number;
    totalDebt: number;
  }> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        total: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const paidAggregate = await tx.payment.aggregate({
      where: { orderId },
      _sum: {
        amount: true,
      },
    });
    const totalPaid = paidAggregate._sum.amount ?? 0;
    const total = knownTotal ?? order.total;

    return {
      status: order.status,
      total,
      totalPaid,
      totalDebt: total - totalPaid,
    };
  }

  private async getOpenOrder(orderId: number): Promise<OpenOrderContext> {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        tableId: true,
        status: true,
        discountAmount: true,
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

    this.assertOrderShiftIsMutable(order.shift);

    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException('Order is not open');
    }

    return {
      id: order.id,
      tableId: order.tableId,
      discountAmount: order.discountAmount,
    };
  }

  private async upsertSaleEntry(
    tx: DbTx,
    input: LedgerSaleInput,
  ): Promise<void> {
    const source =
      input.orderItemType === OrderItemType.GAME
        ? 'ORDER_ITEM_GAME'
        : 'ORDER_ITEM_MENU';

    const note = JSON.stringify({
      itemName: input.itemName,
      category:
        input.categoryName ??
        (input.orderItemType === OrderItemType.GAME ? 'GAME' : 'UNCATEGORIZED'),
      quantity: input.quantity,
    });

    const existing = await tx.financialEntry.findFirst({
      where: {
        type: FinancialEntryType.SALE,
        orderItemId: input.orderItemId.toString(),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await tx.financialEntry.update({
        where: {
          id: existing.id,
        },
        data: {
          amount: input.amount,
          orderId: input.orderId,
          tableId: input.tableId,
          source,
          note,
        },
      });
      return;
    }

    await tx.financialEntry.create({
      data: {
        type: FinancialEntryType.SALE,
        amount: input.amount,
        orderId: input.orderId,
        tableId: input.tableId,
        orderItemId: input.orderItemId.toString(),
        source,
        note,
      },
    });
  }

  private async syncDiscountEntry(
    tx: DbTx,
    orderId: number,
    tableId: number | null,
    discountAmount: number,
  ): Promise<void> {
    const where = {
      type: FinancialEntryType.DISCOUNT,
      orderId,
      source: 'ORDER_DISCOUNT',
    };

    if (discountAmount <= 0) {
      await tx.financialEntry.deleteMany({ where });
      return;
    }

    const amount = -Math.abs(discountAmount);
    const existing = await tx.financialEntry.findFirst({
      where,
      select: {
        id: true,
      },
    });

    if (existing) {
      await tx.financialEntry.update({
        where: {
          id: existing.id,
        },
        data: {
          amount,
          tableId,
          note: 'Order-level discount',
        },
      });
      return;
    }

    await tx.financialEntry.create({
      data: {
        type: FinancialEntryType.DISCOUNT,
        amount,
        orderId,
        tableId,
        source: 'ORDER_DISCOUNT',
        note: 'Order-level discount',
      },
    });
  }

  private assertValidQty(qty: number): void {
    if (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('qty must be greater than 0');
    }

    if (!Number.isInteger(qty)) {
      throw new BadRequestException('qty must be an integer');
    }
  }

  private calculateLineTotal(unitPrice: number, qty: number): number {
    return unitPrice * qty;
  }

  private async recalculateOrderTotals(
    tx: DbTx,
    orderId: number,
    tableId: number | null,
    discountAmount: number,
  ): Promise<void> {
    const menuAggregate = await tx.orderItem.aggregate({
      where: {
        orderId,
      },
      _sum: {
        lineTotal: true,
      },
    });

    const gameAggregate = await tx.gameCharge.aggregate({
      where: {
        orderId,
      },
      _sum: {
        finalPrice: true,
      },
    });

    const subtotal = menuAggregate._sum.lineTotal ?? 0;
    const gameTotal = gameAggregate._sum.finalPrice ?? 0;
    const discountedMenuTotal = Math.max(subtotal - discountAmount, 0);
    const total = discountedMenuTotal + gameTotal;

    await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        subtotal,
        total,
      },
    });

    await this.syncDiscountEntry(tx, orderId, tableId, discountAmount);
  }

  private assertOrderShiftIsMutable(
    shift: { status: ShiftStatus } | null | undefined,
  ): void {
    if (shift?.status === ShiftStatus.CLOSED) {
      throw new BadRequestException('Shift is closed. Order is immutable');
    }
  }
}
