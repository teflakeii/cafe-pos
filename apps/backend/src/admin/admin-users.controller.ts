import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateUserActiveDto } from './dto/update-user-active.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AdminUsersService } from './admin-users.service';

type AuthenticatedRequest = Request & {
  user: {
    id: number;
    role: UserRole;
  };
};

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  listUsers() {
    return this.adminUsersService.listUsers();
  }

  @Post()
  @Roles(UserRole.OWNER)
  createUser(@Body() body: CreateAdminUserDto) {
    return this.adminUsersService.createUser(body);
  }

  @Patch(':id/role')
  @Roles(UserRole.OWNER)
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserRoleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminUsersService.updateUserRole(id, body.role, request.user.id);
  }

  @Patch(':id/active')
  @Roles(UserRole.OWNER)
  updateActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserActiveDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminUsersService.setUserActive(id, body.active, request.user.id);
  }
}
