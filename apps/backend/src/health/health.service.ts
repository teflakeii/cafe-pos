import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<{
    status: 'ok';
    db: 'connected';
    ledgerBalanced: boolean;
  }> {
    await this.prisma.$queryRaw`SELECT 1`;

    const aggregate = await this.prisma.ledgerEntry.aggregate({
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebit = aggregate._sum.debit ?? 0;
    const totalCredit = aggregate._sum.credit ?? 0;

    return {
      status: 'ok',
      db: 'connected',
      ledgerBalanced: totalDebit === totalCredit,
    };
  }
}
