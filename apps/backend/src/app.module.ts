import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';
import { MenuModule } from './menu/menu.module';
import { LedgerModule } from './ledger/ledger.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentModule } from './payment/payment.module';
import { ReportModule } from './report/report.module';
import { SeedModule } from './seed/seed.module';
import { SettlementModule } from './settlement/settlement.module';
import { ShiftsModule } from './shifts/shifts.module';
import { TablePersonModule } from './table-person/table-person.module';
import { TablesModule } from './tables/tables.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        '.env',
      ],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 1_000,
      },
    ]),
    AdminModule,
    AuditModule,
    AuthModule,
    DashboardModule,
    HealthModule,
    SeedModule,
    MenuModule,
    LedgerModule,
    TablesModule,
    OrdersModule,
    TablePersonModule,
    GameModule,
    SettlementModule,
    ShiftsModule,
    PaymentModule,
    ReportModule,
  ],
})
export class AppModule {}
