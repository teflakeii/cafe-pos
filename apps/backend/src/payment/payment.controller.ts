import {
  Body,
  Controller,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentMethod, UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentService } from './payment.service';

type CreatePaymentBody = {
  payerPersonId: number;
  beneficiaryPersonId?: number;
  amount: number;
  method: PaymentMethod;
};

type AuthenticatedRequest = Request & {
  user: {
    id: number;
    role: UserRole;
  };
};

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('orders/:orderId/payments')
  @Roles(UserRole.OWNER, UserRole.CASHIER, UserRole.MANAGER)
  createPayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: CreatePaymentBody,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentService.createPayment(
      orderId,
      body.payerPersonId,
      body.amount,
      body.method,
      body.beneficiaryPersonId,
      idempotencyKey,
      request.user.id,
    );
  }
}
