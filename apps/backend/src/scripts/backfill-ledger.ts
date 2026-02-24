import {
  FinancialEntryType,
  OrderItemType,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

async function upsertSaleEntry(
  orderItem: {
    id: number;
    orderId: number;
    type: OrderItemType;
    finalPrice: number;
    lineTotal: number;
    name: string;
    qty: number;
    order: { tableId: number | null };
    menuItem: { category: { name: string } } | null;
  },
  assumeEmpty: boolean,
): Promise<void> {
  const amount =
    orderItem.finalPrice > 0 ? orderItem.finalPrice : orderItem.lineTotal;
  const source =
    orderItem.type === OrderItemType.GAME
      ? 'ORDER_ITEM_GAME'
      : 'ORDER_ITEM_MENU';
  const note = JSON.stringify({
    itemName: orderItem.name,
    category:
      orderItem.menuItem?.category.name ??
      (orderItem.type === OrderItemType.GAME ? 'GAME' : 'UNCATEGORIZED'),
    quantity: orderItem.qty,
  });

  if (assumeEmpty) {
    await prisma.financialEntry.create({
      data: {
        type: FinancialEntryType.SALE,
        amount,
        orderId: orderItem.orderId,
        tableId: orderItem.order.tableId,
        orderItemId: orderItem.id.toString(),
        source,
        note,
      },
    });
    return;
  }

  const existing = await prisma.financialEntry.findFirst({
    where: {
      type: FinancialEntryType.SALE,
      orderItemId: orderItem.id.toString(),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    await prisma.financialEntry.update({
      where: {
        id: existing.id,
      },
      data: {
        amount,
        orderId: orderItem.orderId,
        tableId: orderItem.order.tableId,
        source,
        note,
      },
    });
    return;
  }

  await prisma.financialEntry.create({
    data: {
      type: FinancialEntryType.SALE,
      amount,
      orderId: orderItem.orderId,
      tableId: orderItem.order.tableId,
      orderItemId: orderItem.id.toString(),
      source,
      note,
    },
  });
}

async function upsertPaymentEntry(
  payment: {
    id: number;
    orderId: number;
    amount: number;
    method: 'CASH' | 'CARD' | 'MANUAL';
    payerPersonId: number;
    beneficiaryPersonId: number | null;
    order: { tableId: number | null };
  },
  assumeEmpty: boolean,
): Promise<void> {
  const note = JSON.stringify({
    payerPersonId: payment.payerPersonId,
    beneficiaryPersonId: payment.beneficiaryPersonId,
  });

  if (assumeEmpty) {
    await prisma.financialEntry.create({
      data: {
        type: FinancialEntryType.PAYMENT,
        amount: payment.amount,
        method: payment.method,
        orderId: payment.orderId,
        tableId: payment.order.tableId,
        paymentId: payment.id.toString(),
        source: 'PAYMENT',
        note,
      },
    });
    return;
  }

  const existing = await prisma.financialEntry.findFirst({
    where: {
      type: FinancialEntryType.PAYMENT,
      paymentId: payment.id.toString(),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    await prisma.financialEntry.update({
      where: {
        id: existing.id,
      },
      data: {
        amount: payment.amount,
        method: payment.method,
        orderId: payment.orderId,
        tableId: payment.order.tableId,
        source: 'PAYMENT',
        note,
      },
    });
    return;
  }

  await prisma.financialEntry.create({
    data: {
      type: FinancialEntryType.PAYMENT,
      amount: payment.amount,
      method: payment.method,
      orderId: payment.orderId,
      tableId: payment.order.tableId,
      paymentId: payment.id.toString(),
      source: 'PAYMENT',
      note,
    },
  });
}

async function upsertDiscountEntry(
  order: {
    id: number;
    tableId: number | null;
    discountAmount: number;
  },
  assumeEmpty: boolean,
): Promise<void> {
  const amount = -Math.abs(order.discountAmount);

  if (assumeEmpty) {
    await prisma.financialEntry.create({
      data: {
        type: FinancialEntryType.DISCOUNT,
        amount,
        orderId: order.id,
        tableId: order.tableId,
        source: 'ORDER_DISCOUNT',
        note: 'Order-level discount',
      },
    });
    return;
  }

  const existing = await prisma.financialEntry.findFirst({
    where: {
      type: FinancialEntryType.DISCOUNT,
      orderId: order.id,
      source: 'ORDER_DISCOUNT',
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    await prisma.financialEntry.update({
      where: {
        id: existing.id,
      },
      data: {
        amount,
        tableId: order.tableId,
        note: 'Order-level discount',
      },
    });
    return;
  }

  await prisma.financialEntry.create({
    data: {
      type: FinancialEntryType.DISCOUNT,
      amount,
      orderId: order.id,
      tableId: order.tableId,
      source: 'ORDER_DISCOUNT',
      note: 'Order-level discount',
    },
  });
}

async function main(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const assumeEmpty = !isProd;

  if (assumeEmpty) {
    await prisma.financialEntry.deleteMany();
  }

  const orderItems = await prisma.orderItem.findMany({
    select: {
      id: true,
      orderId: true,
      type: true,
      finalPrice: true,
      lineTotal: true,
      name: true,
      qty: true,
      order: {
        select: {
          tableId: true,
        },
      },
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

  for (const orderItem of orderItems) {
    await upsertSaleEntry(orderItem, assumeEmpty);
  }

  const payments = await prisma.payment.findMany({
    select: {
      id: true,
      orderId: true,
      amount: true,
      method: true,
      payerPersonId: true,
      beneficiaryPersonId: true,
      order: {
        select: {
          tableId: true,
        },
      },
    },
  });

  for (const payment of payments) {
    await upsertPaymentEntry(payment, assumeEmpty);
  }

  const discountedOrders = await prisma.order.findMany({
    where: {
      discountAmount: {
        gt: 0,
      },
    },
    select: {
      id: true,
      tableId: true,
      discountAmount: true,
    },
  });

  for (const order of discountedOrders) {
    await upsertDiscountEntry(order, assumeEmpty);
  }

  const ledgerCount = await prisma.financialEntry.count();

  console.log(
    `Ledger backfill completed. Entries=${ledgerCount}, sales=${orderItems.length}, payments=${payments.length}, discounts=${discountedOrders.length}`,
  );
}

main()
  .catch((error) => {
    console.error('Ledger backfill failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
