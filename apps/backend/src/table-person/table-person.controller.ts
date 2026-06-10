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
import { CreateTablePersonDto } from './dto/create-table-person.dto';
import { UpdateTablePersonDto } from './dto/update-table-person.dto';
import { TablePersonService } from './table-person.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
export class TablePersonController {
  constructor(private readonly tablePersonService: TablePersonService) {}

  @Post('tables/:tableId/people')
  createByTable(
    @Param('tableId', ParseIntPipe) tableId: number,
    @Body() body: CreateTablePersonDto,
  ) {
    return this.tablePersonService.create(tableId, body.name, body.type);
  }

  @Post('tables/:tableId/participants')
  createByTableAlias(
    @Param('tableId', ParseIntPipe) tableId: number,
    @Body() body: CreateTablePersonDto,
  ) {
    return this.tablePersonService.create(tableId, body.name, body.type);
  }

  @Post('orders/:orderId/participants')
  createByOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: CreateTablePersonDto,
  ) {
    return this.tablePersonService.createByOrder(orderId, body.name, body.type);
  }

  @Get('tables/:tableId/people')
  findByTable(@Param('tableId', ParseIntPipe) tableId: number) {
    return this.tablePersonService.findByTable(tableId);
  }

  @Get('participants/names')
  findGlobalNames() {
    return this.tablePersonService.findGlobalNames();
  }

  @Patch('people/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTablePersonDto,
  ) {
    return this.tablePersonService.update(id, {
      name: body.name,
      type: body.type,
      leftAt: body.leftAt ? new Date(body.leftAt) : undefined,
    });
  }
}
