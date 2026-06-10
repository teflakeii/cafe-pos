import { Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SeedService } from './seed.service';

@Controller('seed')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('init')
  async init(): Promise<{ success: true }> {
    await this.seedService.init();
    return { success: true };
  }
}
