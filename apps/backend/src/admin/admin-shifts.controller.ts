import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
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
import { AdminService } from './admin.service';

type AuthenticatedRequest = Request & {
  user: {
    id: number;
    role: UserRole;
  };
};

@Controller('admin/shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
export class AdminShiftsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get()
  getShifts() {
    return this.adminService.getShifts();
  }

  @Get(':id')
  getShiftById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getShiftById(id);
  }

  @Post(':id/close')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: 5,
      ttl: 10_000,
    },
  })
  closeShift(
    @Param('id', ParseIntPipe) id: number,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!idempotencyKey?.trim()) {
      return this.adminService.closeShift(id, request.user.id);
    }

    return this.idempotencyService.execute({
      idempotencyKey,
      userId: request.user.id,
      endpoint: `POST /admin/shifts/${id}/close`,
      action: () => this.adminService.closeShift(id, request.user.id),
    });
  }
}
