import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminReportsService } from './admin-reports.service';

@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get('daily')
  getDailyReport(@Query('date') date?: string) {
    return this.adminReportsService.getDailyReport(date);
  }

  @Get('shift/:id')
  getShiftReport(@Param('id', ParseIntPipe) id: number) {
    return this.adminReportsService.getShiftReport(id);
  }

  @Get('range')
  getRangeReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.adminReportsService.getRangeReport(from, to);
  }

  @Get('daily/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportDailyReport(
    @Query('date') date?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    const report = await this.adminReportsService.getDailyReport(date);

    if (response) {
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="gozaresh-rozane-${report.date}.csv"`,
      );
    }

    return this.adminReportsService.toDailyCsv(report);
  }
}
