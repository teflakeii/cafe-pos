import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TablesService } from './tables.service';

@Controller('tables')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.ACCOUNTANT)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  getTables(): Promise<
    Array<{
      tableId: number;
      tableNo: number;
      status: 'free' | 'busy';
      openOrderId?: number;
      openOrderTotal?: number;
      openOrderStatus?: 'OPEN' | 'SETTLING' | 'CLOSED' | 'VOID';
    }>
  > {
    return this.tablesService.getFloorView();
  }
}
