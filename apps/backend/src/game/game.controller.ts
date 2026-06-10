import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { GameService } from './game.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('tables/:tableId/game/start')
  startSession(
    @Param('tableId', ParseIntPipe) tableId: number,
  ): Promise<{ sessionId: number; startedAt: Date }> {
    return this.gameService.startSession(tableId);
  }

  @Post('game/:sessionId/stop')
  stopSession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ): Promise<{ sessionId: number; endedAt: Date }> {
    return this.gameService.stopSession(sessionId);
  }

  @Post('orders/:orderId/game-discounts')
  applyGameDiscount(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: { personId: number; discountAmount: number },
  ): Promise<{
    orderId: number;
    personId: number;
    discountApplied: number;
    gameBase: number;
    gameFinal: number;
    gameDiscount: number;
    orderTotal: number;
  }> {
    return this.gameService.applyGameDiscount(
      orderId,
      body.personId,
      body.discountAmount,
    );
  }
}
