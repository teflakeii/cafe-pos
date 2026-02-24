import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/summary')
  getDashboardSummary() {
    return this.adminService.getDashboardSummary();
  }

  @Get('integrity')
  getIntegrityStatus() {
    return this.adminService.getIntegrityStatus();
  }
}
