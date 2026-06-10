import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MenuService } from './menu.service';

type CreateMenuItemBody = {
  name: string;
  category: string;
  price: number;
};

type UpdateMenuItemBody = {
  name?: string;
  category?: string;
  price?: number;
};

@Controller('menu-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  findActive() {
    return this.menuService.findActive();
  }

  @Get('all')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  findAll() {
    return this.menuService.findAll();
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  create(@Body() body: CreateMenuItemBody) {
    return this.menuService.create({
      name: body?.name,
      category: body?.category,
      price: body?.price,
    });
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMenuItemBody,
  ) {
    return this.menuService.update(id, {
      name: body?.name,
      category: body?.category,
      price: body?.price,
    });
  }

  @Patch(':id/toggle')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.toggle(id);
  }
}
