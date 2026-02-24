import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TableFloorViewItem = {
  tableId: number;
  tableNo: number;
  status: 'free' | 'busy';
  openOrderId?: number;
  openOrderTotal?: number;
  openOrderStatus?: OrderStatus;
};

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async getFloorView(): Promise<TableFloorViewItem[]> {
    const tables = await this.prisma.cafeTable.findMany({
      where: { isActive: true },
      orderBy: { tableNo: 'asc' },
      select: {
        id: true,
        tableNo: true,
        orders: {
          where: { status: { not: OrderStatus.CLOSED } },
          select: {
            id: true,
            total: true,
            status: true,
          },
        },
      },
    });

    return tables.map((table) => {
      if (table.orders.length === 0) {
        return {
          tableId: table.id,
          tableNo: table.tableNo,
          status: 'free' as const,
        };
      }

      if (table.orders.length === 1) {
        const openOrder = table.orders[0];
        return {
          tableId: table.id,
          tableNo: table.tableNo,
          status: 'busy' as const,
          openOrderId: openOrder.id,
          openOrderTotal: openOrder.total,
          openOrderStatus: openOrder.status,
        };
      }

      throw new InternalServerErrorException(
        `Table ${table.tableNo} has more than one open order`,
      );
    });
  }
}
