import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PersonType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TablePersonService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tableId: number, name: string, type: PersonType) {
    this.assertValidId(tableId, 'tableId');
    const normalizedName = this.normalizeName(name);

    const table = await this.prisma.cafeTable.findUnique({
      where: { id: tableId },
      select: { id: true },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    await this.assertNoSettlingOrderForTable(tableId);

    const joinedAt = await this.getDefaultJoinedAt(tableId);

    return this.prisma.tablePerson.create({
      data: {
        tableId,
        name: normalizedName,
        type,
        joinedAt,
      },
    });
  }

  async createByOrder(orderId: number, name: string, type: PersonType) {
    this.assertValidId(orderId, 'orderId');
    const normalizedName = this.normalizeName(name);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tableId: true,
        openedAt: true,
        status: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.tableId) {
      throw new BadRequestException('Order has no table');
    }

    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(
        'Cannot add participants after order entered settling',
      );
    }

    return this.prisma.tablePerson.create({
      data: {
        tableId: order.tableId,
        name: normalizedName,
        type,
        joinedAt: order.openedAt,
      },
    });
  }

  async findByTable(tableId: number) {
    this.assertValidId(tableId, 'tableId');

    const activeOrder = await this.prisma.order.findFirst({
      where: {
        tableId,
        status: {
          in: [OrderStatus.OPEN, OrderStatus.SETTLING],
        },
      },
      orderBy: { openedAt: 'desc' },
      select: {
        openedAt: true,
      },
    });

    if (!activeOrder) {
      return [];
    }

    return this.prisma.tablePerson.findMany({
      where: {
        tableId,
        joinedAt: { gte: activeOrder.openedAt },
        OR: [{ leftAt: null }, { leftAt: { gt: activeOrder.openedAt } }],
      },
      orderBy: { id: 'asc' },
    });
  }

  async findGlobalNames(): Promise<string[]> {
    const rows = await this.prisma.tablePerson.findMany({
      select: { name: true },
      distinct: ['name'],
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => row.name);
  }

  update(
    id: number,
    data: { name?: string; type?: PersonType; leftAt?: Date },
  ) {
    return this.prisma.tablePerson.update({
      where: { id },
      data,
    });
  }

  private async getDefaultJoinedAt(tableId: number): Promise<Date> {
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        tableId,
        status: {
          in: [OrderStatus.OPEN],
        },
      },
      orderBy: { openedAt: 'desc' },
      select: { openedAt: true },
    });

    if (activeOrder) {
      return activeOrder.openedAt;
    }

    return new Date();
  }

  private async assertNoSettlingOrderForTable(tableId: number): Promise<void> {
    const settlingOrder = await this.prisma.order.findFirst({
      where: {
        tableId,
        status: OrderStatus.SETTLING,
      },
      select: {
        id: true,
      },
    });

    if (settlingOrder) {
      throw new BadRequestException(
        'Cannot add participants after order entered settling',
      );
    }
  }

  private normalizeName(name: string): string {
    const normalized = name?.trim();
    if (!normalized) {
      throw new BadRequestException('name is required');
    }
    return normalized;
  }

  private assertValidId(id: number, field: 'tableId' | 'orderId'): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(`${field} is invalid`);
    }
  }
}
