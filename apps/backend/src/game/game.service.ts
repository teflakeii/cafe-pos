import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ShiftStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const GAME_RATE_PER_HOUR = 50000;

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  async startSession(
    tableId: number,
  ): Promise<{ sessionId: number; startedAt: Date }> {
    return this.prisma.$transaction(async (tx) => {
      const table = await tx.cafeTable.findFirst({
        where: {
          id: tableId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!table) {
        throw new NotFoundException('Active table not found');
      }

      const openSession = await tx.gameSession.findFirst({
        where: {
          tableId,
          endedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (openSession) {
        throw new ConflictException(
          'Open game session already exists for this table',
        );
      }

      const activeOrder = await tx.order.findFirst({
        where: {
          tableId,
          status: {
            in: [OrderStatus.OPEN, OrderStatus.SETTLING],
          },
        },
        orderBy: { id: 'desc' },
        select: { id: true },
      });

      const createdSession = await tx.gameSession.create({
        data: {
          tableId,
          orderId: activeOrder?.id ?? null,
          startedAt: new Date(),
        },
        select: {
          id: true,
          startedAt: true,
        },
      });

      return {
        sessionId: createdSession.id,
        startedAt: createdSession.startedAt,
      };
    });
  }

  async stopSession(sessionId: number): Promise<{
    sessionId: number;
    endedAt: Date;
    durationMinutes: number;
    billedMinutes: number;
    amount: number;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          tableId: true,
          orderId: true,
          startedAt: true,
          endedAt: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Game session not found');
      }

      if (session.endedAt) {
        throw new BadRequestException('Session already stopped');
      }

      const endedAt = new Date();
      const rawMinutes =
        (endedAt.getTime() - session.startedAt.getTime()) / 60000;
      const durationMinutes = Math.max(1, Math.ceil(rawMinutes));
      const billedMinutes = this.roundUpToTenMinutes(durationMinutes);
      const amount = Math.round((GAME_RATE_PER_HOUR / 60) * billedMinutes);

      let resolvedOrderId = session.orderId ?? null;
      if (!resolvedOrderId) {
        const activeOrder = await tx.order.findFirst({
          where: {
            tableId: session.tableId,
            status: {
              in: [OrderStatus.OPEN, OrderStatus.SETTLING],
            },
          },
          orderBy: { id: 'desc' },
          select: { id: true },
        });

        if (!activeOrder) {
          throw new BadRequestException(
            'No active order for this table. Cannot stop session',
          );
        }

        resolvedOrderId = activeOrder.id;
      }

      const resolvedOrder = await tx.order.findUnique({
        where: {
          id: resolvedOrderId,
        },
        select: {
          id: true,
          openedAt: true,
          status: true,
        },
      });

      if (
        !resolvedOrder ||
        (resolvedOrder.status !== OrderStatus.OPEN &&
          resolvedOrder.status !== OrderStatus.SETTLING)
      ) {
        throw new BadRequestException(
          'Resolved order is not active. Cannot stop session',
        );
      }

      const activePeople = await tx.tablePerson.findMany({
        where: {
          tableId: session.tableId,
          joinedAt: {
            gte: resolvedOrder.openedAt,
          },
          OR: [{ leftAt: null }, { leftAt: { gt: resolvedOrder.openedAt } }],
        },
        select: {
          id: true,
          type: true,
        },
      });

      const gameEligiblePeople = activePeople.filter(
        (person) => person.type === 'PLAY' || person.type === 'BOTH',
      );

      if (gameEligiblePeople.length === 0) {
        throw new BadRequestException(
          'No PLAY or BOTH participants available for game charges',
        );
      }

      await tx.gameSession.update({
        where: { id: session.id },
        data: {
          endedAt,
          orderId: resolvedOrder.id,
        },
      });

      let appliedAmount = 0;
      if (gameEligiblePeople.length > 0) {
        const chargePerPerson = amount;
        const totalChargeAmount = chargePerPerson * gameEligiblePeople.length;

        await tx.gameCharge.createMany({
          data: gameEligiblePeople.map((person) => {
            return {
              gameSessionId: session.id,
              orderId: resolvedOrder.id,
              personId: person.id,
              minutes: billedMinutes,
              ratePerHour: GAME_RATE_PER_HOUR,
              price: chargePerPerson,
              discountPercent: 0,
              finalPrice: chargePerPerson,
            };
          }),
        });

        await tx.order.update({
          where: { id: resolvedOrder.id },
          data: {
            total: {
              increment: totalChargeAmount,
            },
          },
        });

        appliedAmount = totalChargeAmount;
      }

      return {
        sessionId: session.id,
        endedAt,
        durationMinutes,
        billedMinutes,
        amount: appliedAmount,
      };
    });
  }

  private roundUpToTenMinutes(minutes: number): number {
    if (minutes <= 0) {
      return 0;
    }

    return Math.ceil(minutes / 10) * 10;
  }

  async applyGameDiscount(
    orderId: number,
    personId: number,
    discountAmount: number,
  ): Promise<{
    orderId: number;
    personId: number;
    discountApplied: number;
    gameBase: number;
    gameFinal: number;
    gameDiscount: number;
    orderTotal: number;
  }> {
    if (!Number.isInteger(discountAmount) || discountAmount <= 0) {
      throw new BadRequestException('discountAmount must be positive integer');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          tableId: true,
          openedAt: true,
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

      if (!order.tableId) {
        throw new BadRequestException('Order has no table');
      }

      if (order.shift?.status === ShiftStatus.CLOSED) {
        throw new BadRequestException('Shift is closed. Order is immutable');
      }

      if (order.status === OrderStatus.CLOSED) {
        throw new BadRequestException('Order is closed');
      }

      const participant = await tx.tablePerson.findFirst({
        where: {
          id: personId,
          tableId: order.tableId,
          joinedAt: { gte: order.openedAt },
          OR: [{ leftAt: null }, { leftAt: { gt: order.openedAt } }],
        },
        select: {
          id: true,
        },
      });

      if (!participant) {
        throw new NotFoundException('Participant not found for this order');
      }

      const charges = await tx.gameCharge.findMany({
        where: {
          orderId: order.id,
          personId: participant.id,
        },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          price: true,
          finalPrice: true,
        },
      });

      if (charges.length === 0) {
        throw new BadRequestException('No game charges for this participant');
      }

      const currentFinalTotal = charges.reduce(
        (sum, charge) => sum + charge.finalPrice,
        0,
      );
      if (discountAmount > currentFinalTotal) {
        throw new BadRequestException(
          'discountAmount is greater than participant game debt',
        );
      }

      let remainingDiscount = discountAmount;
      for (const charge of charges) {
        if (remainingDiscount <= 0) {
          break;
        }

        const chargeDiscount = Math.min(charge.finalPrice, remainingDiscount);
        const nextFinalPrice = charge.finalPrice - chargeDiscount;
        const nextDiscountPercent =
          charge.price > 0
            ? Math.min(
                100,
                Math.max(
                  0,
                  Math.round(
                    ((charge.price - nextFinalPrice) * 100) / charge.price,
                  ),
                ),
              )
            : 0;

        await tx.gameCharge.update({
          where: {
            id: charge.id,
          },
          data: {
            finalPrice: nextFinalPrice,
            discountPercent: nextDiscountPercent,
          },
        });

        remainingDiscount -= chargeDiscount;
      }

      if (remainingDiscount !== 0) {
        throw new ConflictException('Game discount allocation failed');
      }

      const orderTotal = await this.recalculateOrderTotalInTx(
        tx,
        order.id,
        order.discountAmount,
      );

      const updated = await tx.gameCharge.aggregate({
        where: {
          orderId: order.id,
          personId: participant.id,
        },
        _sum: {
          price: true,
          finalPrice: true,
        },
      });

      const gameBase = updated._sum.price ?? 0;
      const gameFinal = updated._sum.finalPrice ?? 0;

      return {
        orderId: order.id,
        personId: participant.id,
        discountApplied: discountAmount,
        gameBase,
        gameFinal,
        gameDiscount: Math.max(gameBase - gameFinal, 0),
        orderTotal,
      };
    });
  }

  private async recalculateOrderTotalInTx(
    tx: Prisma.TransactionClient,
    orderId: number,
    discountAmount: number,
  ): Promise<number> {
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
    const total = Math.max(subtotal - discountAmount, 0) + gameTotal;

    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        total,
      },
    });

    return total;
  }
}
