import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ShiftStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementService } from './settlement.service';

@Controller('settlement')
@UseGuards(JwtAuthGuard)
export class SettlementController {
  constructor(
    private readonly settlementService: SettlementService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':orderId')
  async getSettlement(@Param('orderId', ParseIntPipe) orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        shift: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!order?.shift || order.shift.status !== ShiftStatus.OPEN) {
      throw new ForbiddenException(
        'Settlement is available only for orders in active shifts',
      );
    }

    return this.settlementService.getSettlement(orderId);
  }
}
