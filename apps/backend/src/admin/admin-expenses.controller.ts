import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { AdminExpensesService } from './admin-expenses.service';

type AuthenticatedRequest = Request & {
  user: {
    id: number;
    role: UserRole;
  };
};

@Controller('admin/expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
export class AdminExpensesController {
  constructor(
    private readonly adminExpensesService: AdminExpensesService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get()
  getExpenses(@Query('shiftId') shiftId?: string) {
    const parsedShiftId =
      shiftId === undefined ? undefined : Number.parseInt(shiftId, 10);
    return this.adminExpensesService.getExpenses(parsedShiftId);
  }

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: 5,
      ttl: 10_000,
    },
  })
  createExpense(
    @Body() body: CreateExpenseDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!idempotencyKey?.trim()) {
      return this.adminExpensesService.createExpense(body, request.user.id);
    }

    return this.idempotencyService.execute({
      idempotencyKey,
      userId: request.user.id,
      endpoint: 'POST /admin/expenses',
      action: () => this.adminExpensesService.createExpense(body, request.user.id),
    });
  }

  @Delete(':id')
  deleteExpense(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminExpensesService.voidExpense(id, request.user.id);
  }
}
