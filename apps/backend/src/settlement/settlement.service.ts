import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PersonType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type SettlementPerson = {
  personId: number;
  name: string;
  type: PersonType;
  personalOrder: number;
  sharedOrder: number;
  orderDiscount: number;
  orderFinal: number;
  gameBase: number;
  gameDiscount: number;
  gameTotal: number;
  payable: number;
  paid: number;
  debt: number;
};

type SettlementResponse = {
  orderId: number;
  tableId: number;
  globalDiscountPercent: number;
  people: SettlementPerson[];
  totalDebt: number;
  summary: {
    orderSubtotal: number;
    orderDiscountTotal: number;
    gameDiscountTotal: number;
    gameTotal: number;
    grandTotal: number;
    totalPayable: number;
    totalPaid: number;
    totalDebt: number;
  };
};

type OrderItemRow = {
  lineTotal: number;
  ownerType: 'PERSON' | 'SHARED';
  ownerPersonId: number | null;
};

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SettlementService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettlement(
    orderId: number,
    client: DbClient = this.prisma,
  ): Promise<SettlementResponse> {
    const order = await client.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tableId: true,
        openedAt: true,
        total: true,
        subtotal: true,
        discountAmount: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.tableId) {
      throw new NotFoundException('Table not found for order');
    }

    const table = await client.cafeTable.findUnique({
      where: { id: order.tableId },
      select: { id: true },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const orderItems = await this.getOrderItems(order.id, client);

    const participants = await client.tablePerson.findMany({
      where: {
        tableId: table.id,
        joinedAt: { gte: order.openedAt },
        OR: [{ leftAt: null }, { leftAt: { gt: order.openedAt } }],
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    if (participants.length === 0) {
      throw new BadRequestException('No participants found for this order');
    }

    const participantIds = participants.map((person) => person.id);

    const gameCharges = await client.gameCharge.findMany({
      where: {
        orderId: order.id,
        personId: { in: participantIds },
      },
      select: {
        personId: true,
        price: true,
        finalPrice: true,
      },
    });

    const gameBaseByPerson = new Map<number, number>();
    const gameTotalByPerson = new Map<number, number>();
    for (const charge of gameCharges) {
      gameBaseByPerson.set(
        charge.personId,
        (gameBaseByPerson.get(charge.personId) ?? 0) + charge.price,
      );
      gameTotalByPerson.set(
        charge.personId,
        (gameTotalByPerson.get(charge.personId) ?? 0) + charge.finalPrice,
      );
    }

    const paidRows = await client.payment.groupBy({
      by: ['payerPersonId'],
      where: {
        orderId: order.id,
        payerPersonId: {
          in: participantIds,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const paidByPerson = new Map<number, number>();
    paidRows.forEach((row) => {
      paidByPerson.set(row.payerPersonId, row._sum.amount ?? 0);
    });

    const globalDiscountPercent = this.deriveGlobalDiscountPercent(
      order.subtotal,
      order.discountAmount,
    );

    const participantById = new Map(
      participants.map((person) => [person.id, person]),
    );
    const orderEligibleParticipants = participants.filter((person) =>
      this.isOrderParticipant(person.type),
    );

    const personalOrderByPerson = new Map<number, number>();
    for (const item of orderItems) {
      if (item.ownerType !== 'PERSON' || item.ownerPersonId == null) {
        continue;
      }

      const owner = participantById.get(item.ownerPersonId);
      if (!owner) {
        throw new BadRequestException(
          'Order item owner is not an active participant',
        );
      }

      personalOrderByPerson.set(
        item.ownerPersonId,
        (personalOrderByPerson.get(item.ownerPersonId) ?? 0) + item.lineTotal,
      );
    }

    const sharedOrderPool = orderItems
      .filter((item) => item.ownerType === 'SHARED')
      .reduce((sum, item) => sum + item.lineTotal, 0);

    if (sharedOrderPool > 0 && orderEligibleParticipants.length === 0) {
      throw new BadRequestException(
        'No ORDER or BOTH participants available for order split',
      );
    }

    const sharedOrderByPerson = new Map<number, number>();
    const sharedBase =
      orderEligibleParticipants.length > 0
        ? Math.floor(sharedOrderPool / orderEligibleParticipants.length)
        : 0;
    const sharedRemainder =
      orderEligibleParticipants.length > 0
        ? sharedOrderPool % orderEligibleParticipants.length
        : 0;
    orderEligibleParticipants.forEach((person, index) => {
      sharedOrderByPerson.set(
        person.id,
        sharedBase + (index < sharedRemainder ? 1 : 0),
      );
    });

    // First pass: resolve each participant's order subtotal (personal + shared).
    const orderSubtotalByPerson = new Map<number, number>();
    let menuSubtotalSum = 0;
    participants.forEach((person) => {
      const isOrderParticipant = this.isOrderParticipant(person.type);

      const rawPersonalOrder = personalOrderByPerson.get(person.id) ?? 0;
      if (!isOrderParticipant && rawPersonalOrder > 0) {
        throw new BadRequestException(
          `Participant ${person.id} cannot receive order charges`,
        );
      }

      const personalOrder = isOrderParticipant ? rawPersonalOrder : 0;
      const sharedOrder = isOrderParticipant
        ? (sharedOrderByPerson.get(person.id) ?? 0)
        : 0;

      const orderSubtotal = personalOrder + sharedOrder;
      orderSubtotalByPerson.set(person.id, orderSubtotal);
      menuSubtotalSum += orderSubtotal;
    });

    // Allocate the absolute order-level discount with an exact largest-remainder
    // split so the per-person discounts always sum to the effective discount
    // (min(discountAmount, menuSubtotal)). This keeps sum(orderFinal) identical
    // to order.total regardless of how the discount divides, eliminating the
    // rounding drift that could otherwise trip the integrity check below.
    const orderDiscountByPerson = this.allocateOrderDiscount(
      orderSubtotalByPerson,
      menuSubtotalSum,
      order.discountAmount,
    );

    const people: SettlementPerson[] = [];
    let orderSubtotalSum = 0;
    let orderDiscountTotal = 0;
    let gameDiscountTotal = 0;
    let gameTotalSum = 0;
    let grandTotal = 0;
    let totalPaid = 0;
    let totalDebt = 0;

    participants.forEach((person) => {
      const isOrderParticipant = this.isOrderParticipant(person.type);
      const isPlayParticipant = this.isPlayParticipant(person.type);

      const personalOrder = isOrderParticipant
        ? (personalOrderByPerson.get(person.id) ?? 0)
        : 0;
      const sharedOrder = isOrderParticipant
        ? (sharedOrderByPerson.get(person.id) ?? 0)
        : 0;

      const orderSubtotal = orderSubtotalByPerson.get(person.id) ?? 0;
      const orderDiscount = orderDiscountByPerson.get(person.id) ?? 0;
      const orderFinal = orderSubtotal - orderDiscount;

      const rawGameBase = gameBaseByPerson.get(person.id) ?? 0;
      if (!isPlayParticipant && rawGameBase > 0) {
        throw new BadRequestException(
          `Participant ${person.id} cannot receive game charges`,
        );
      }

      const gameBase = isPlayParticipant ? rawGameBase : 0;
      const gameTotal = isPlayParticipant
        ? (gameTotalByPerson.get(person.id) ?? 0)
        : 0;
      const gameDiscount = Math.max(gameBase - gameTotal, 0);
      const payable = orderFinal + gameTotal;
      const paid = paidByPerson.get(person.id) ?? 0;
      const debt = Math.max(payable - paid, 0);

      people.push({
        personId: person.id,
        name: person.name,
        type: person.type,
        personalOrder,
        sharedOrder,
        orderDiscount,
        orderFinal,
        gameBase,
        gameDiscount,
        gameTotal,
        payable,
        paid,
        debt,
      });

      orderSubtotalSum += orderSubtotal;
      orderDiscountTotal += orderDiscount;
      gameDiscountTotal += gameDiscount;
      gameTotalSum += gameTotal;
      grandTotal += payable;
      totalPaid += paid;
      totalDebt += debt;
    });

    const delta = grandTotal - order.total;
    if (delta !== 0) {
      throw new ConflictException(
        `Settlement mismatch for order ${order.id}: delta=${delta}`,
      );
    }

    return {
      orderId: order.id,
      tableId: table.id,
      globalDiscountPercent,
      people,
      totalDebt,
      summary: {
        orderSubtotal: orderSubtotalSum,
        orderDiscountTotal,
        gameDiscountTotal,
        gameTotal: gameTotalSum,
        grandTotal,
        totalPayable: grandTotal,
        totalPaid,
        totalDebt,
      },
    };
  }

  private allocateOrderDiscount(
    subtotalByPerson: Map<number, number>,
    subtotalSum: number,
    discountAmount: number,
  ): Map<number, number> {
    const result = new Map<number, number>();
    for (const personId of subtotalByPerson.keys()) {
      result.set(personId, 0);
    }

    const effectiveDiscount = Math.max(
      0,
      Math.min(Math.trunc(discountAmount), subtotalSum),
    );
    if (effectiveDiscount === 0 || subtotalSum <= 0) {
      return result;
    }

    // Proportional apportionment by each person's order subtotal, then hand out
    // the rounding leftover one unit at a time to the largest fractional
    // remainders. Selected people always have remainder > 0, so base + 1 never
    // exceeds their subtotal.
    const remainders: Array<{ personId: number; remainder: number }> = [];
    let allocated = 0;
    for (const [personId, subtotal] of subtotalByPerson.entries()) {
      if (subtotal <= 0) {
        continue;
      }
      const exact = (subtotal * effectiveDiscount) / subtotalSum;
      const base = Math.floor(exact);
      result.set(personId, base);
      allocated += base;
      remainders.push({ personId, remainder: exact - base });
    }

    let leftover = effectiveDiscount - allocated;
    if (leftover > 0) {
      remainders.sort((a, b) => b.remainder - a.remainder);
      for (
        let index = 0;
        index < remainders.length && leftover > 0;
        index += 1
      ) {
        const { personId } = remainders[index];
        result.set(personId, (result.get(personId) ?? 0) + 1);
        leftover -= 1;
      }
    }

    return result;
  }

  private deriveGlobalDiscountPercent(
    subtotal: number,
    discountAmount: number,
  ): number {
    if (subtotal <= 0 || discountAmount <= 0) {
      return 0;
    }

    const percent = Math.round((discountAmount * 100) / subtotal);
    if (percent < 0) {
      return 0;
    }
    if (percent > 100) {
      return 100;
    }
    return percent;
  }

  private isOrderParticipant(type: PersonType): boolean {
    return type === PersonType.ORDER || type === PersonType.BOTH;
  }

  private isPlayParticipant(type: PersonType): boolean {
    return type === PersonType.PLAY || type === PersonType.BOTH;
  }

  private async getOrderItems(
    orderId: number,
    client: DbClient,
  ): Promise<OrderItemRow[]> {
    const columns = await client.$queryRawUnsafe<Array<{ name: string }>>(
      'PRAGMA table_info("OrderItem")',
    );

    const hasOwnerType = columns.some((column) => column.name === 'ownerType');
    const hasOwnerPersonId = columns.some(
      (column) => column.name === 'ownerPersonId',
    );

    if (hasOwnerType && hasOwnerPersonId) {
      const rows = await client.$queryRawUnsafe<
        Array<{
          lineTotal: number;
          ownerType: string | null;
          ownerPersonId: number | null;
        }>
      >(
        'SELECT lineTotal, ownerType, ownerPersonId FROM "OrderItem" WHERE orderId = ?',
        orderId,
      );

      return rows.map((row) => ({
        lineTotal: row.lineTotal,
        ownerType: row.ownerType === 'PERSON' ? 'PERSON' : 'SHARED',
        ownerPersonId: row.ownerPersonId,
      }));
    }

    const rows = await client.orderItem.findMany({
      where: { orderId },
      select: { lineTotal: true },
    });

    return rows.map((row) => ({
      lineTotal: row.lineTotal,
      ownerType: 'SHARED',
      ownerPersonId: null,
    }));
  }
}
