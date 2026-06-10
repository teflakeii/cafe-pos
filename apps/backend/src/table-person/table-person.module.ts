import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TablePersonController } from './table-person.controller';
import { TablePersonService } from './table-person.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TablePersonController],
  providers: [TablePersonService],
})
export class TablePersonModule {}
