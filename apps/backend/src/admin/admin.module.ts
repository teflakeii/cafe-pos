import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { AdminExpensesController } from './admin-expenses.controller';
import { AdminExpensesService } from './admin-expenses.service';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';
import { AdminShiftsController } from './admin-shifts.controller';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [AuthModule, ShiftsModule, LedgerModule, AuditModule, IdempotencyModule],
  controllers: [
    AdminController,
    AdminShiftsController,
    AdminReportsController,
    AdminExpensesController,
    AdminUsersController,
    AdminSettingsController,
  ],
  providers: [
    AdminService,
    AdminReportsService,
    AdminExpensesService,
    AdminUsersService,
    AdminSettingsService,
  ],
})
export class AdminModule {}
