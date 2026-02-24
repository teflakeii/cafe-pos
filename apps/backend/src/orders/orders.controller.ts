import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OrderStatus, UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrdersService } from './orders.service';

type CreateOrderBody = {
  type: 'dine_in' | 'takeaway';
  tableId: number | null;
};

type CreateOrderItemBody = {
  menuItemId: number;
  qty?: number;
  quantity?: number;
  note?: string;
  ownerType?: 'SHARED' | 'PERSON';
  ownerPersonName?: string;
};

type UpdateOrderItemBody = {
  qty?: number;
  note?: string;
};

type AuthenticatedRequest = Request & {
  user: {
    id: number;
    role: UserRole;
  };
};

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(
    @Body() body: CreateOrderBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<{
    id: number;
    orderNo: string;
    type: 'dine_in' | 'takeaway';
    tableId: number | null;
    status: OrderStatus;
    subtotal: number;
    total: number;
  }> {
    return this.ordersService.createOrder({
      type: body?.type,
      tableId: body?.tableId,
      openedByUserId: request.user.id,
    });
  }

  @Post(':orderId/items')
  addOrderItem(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: CreateOrderItemBody,
  ): Promise<{
    id: number;
    orderId: number;
    menuItemId: number | null;
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    note: string | null;
  }> {
    const qty = body?.qty ?? body?.quantity;

    return this.ordersService.addOrderItem(orderId, {
      menuItemId: body?.menuItemId,
      qty: qty,
      note: body?.note,
    });
  }

  @Patch(':orderId/items/:itemId')
  updateOrderItem(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: UpdateOrderItemBody,
  ): Promise<{
    id: number;
    orderId: number;
    menuItemId: number | null;
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    note: string | null;
  }> {
    return this.ordersService.updateOrderItem(orderId, itemId, {
      qty: body?.qty,
      note: body?.note,
    });
  }

  @Delete(':orderId/items/:itemId')
  deleteOrderItem(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ): Promise<{ success: true }> {
    return this.ordersService.deleteOrderItem(orderId, itemId);
  }

  @Post(':orderId/settle')
  @Roles(UserRole.OWNER, UserRole.CASHIER, UserRole.MANAGER)
  settleOrder(@Param('orderId', ParseIntPipe) orderId: number): Promise<{
    id: number;
    orderNo: string;
    type: 'dine_in' | 'takeaway';
    tableId: number | null;
    status: OrderStatus;
    subtotal: number;
    total: number;
  }> {
    return this.ordersService.settleOrder(orderId);
  }

  @Post(':id/finalize')
  @Roles(UserRole.OWNER, UserRole.CASHIER, UserRole.MANAGER)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
      getTracker: (request: Record<string, any>) => {
        const userId = request?.user?.id;
        if (typeof userId === 'number' || typeof userId === 'string') {
          return `user:${userId}`;
        }

        return request?.ip ?? 'anonymous';
      },
    },
  })
  finalize(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ success: true; orderId: number; closedAt: Date }> {
    return this.ordersService.finalizeOrder(id, request.user.id);
  }
}
