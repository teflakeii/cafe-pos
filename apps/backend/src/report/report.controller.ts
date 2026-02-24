import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportService } from './report.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('daily')
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT)
  getDailyReport() {
    return this.reportService.getDailyReport();
  }

  @Get('trial-balance')
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT)
  trialBalance(@Query('from') from?: string, @Query('to') to?: string) {
    const { parsedFrom, parsedTo } = this.parseDateRange(from, to);

    return this.reportService.trialBalance(parsedFrom, parsedTo);
  }

  @Get('profit-loss')
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT)
  profitLoss(@Query('from') from?: string, @Query('to') to?: string) {
    const { parsedFrom, parsedTo } = this.parseDateRange(from, to);

    return this.reportService.profitLoss(parsedFrom, parsedTo);
  }

  private parseDateRange(
    from?: string,
    to?: string,
  ): {
    parsedFrom?: Date;
    parsedTo?: Date;
  } {
    const parsedFrom = this.parseDateQuery(from, 'from');
    const parsedTo = this.parseDateQuery(to, 'to');

    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      throw new BadRequestException(
        '"from" must be less than or equal to "to"',
      );
    }

    return {
      parsedFrom,
      parsedTo,
    };
  }

  private parseDateQuery(
    value: string | undefined,
    field: 'from' | 'to',
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid "${field}" date`);
    }

    return parsed;
  }
}
