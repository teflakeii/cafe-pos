import {
  Body,
  Controller,
  Get,
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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ShiftsService } from './shifts.service';

type OpenShiftBody = {
  openingCash: number;
};

type CloseShiftBody = {
  countedCash: number;
};

type AuthenticatedRequest = Request & {
  user: {
    id: number;
    role: UserRole;
  };
};

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  openShift(@Body() body: OpenShiftBody, @Req() request: AuthenticatedRequest) {
    return this.shiftsService.openShift(body.openingCash, request.user.id);
  }

  @Post(':id/close')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: 5,
      ttl: 10_000,
    },
  })
  closeShift(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CloseShiftBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shiftsService.closeShift(id, body.countedCash, request.user.id);
  }

  @Get(':id/report')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT)
  getShiftReport(@Param('id', ParseIntPipe) id: number) {
    return this.shiftsService.getShiftReport(id);
  }
}
