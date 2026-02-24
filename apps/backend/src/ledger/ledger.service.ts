import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const SYSTEM_ACCOUNT_CODES = {
  CASH: '1000',
  BANK: '1100',
  ACCOUNTS_RECEIVABLE: '1200',
  SALES_REVENUE: '4000',
  OPERATING_EXPENSE: '5000',
} as const;

export type JournalLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
};

type Tx = Prisma.TransactionClient;

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async postJournal(
    reference: string,
    description: string,
    lines: JournalLineInput[],
  ): Promise<{ journalEntryId: number }> {
    return this.prisma.$transaction((tx) =>
      this.postJournalInTx(tx, reference, description, lines),
    );
  }

  async postJournalInTx(
    tx: Tx,
    reference: string,
    description: string,
    lines: JournalLineInput[],
  ): Promise<{ journalEntryId: number }> {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new BadRequestException('At least two journal lines are required');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      const debit = line.debit ?? 0;
      const credit = line.credit ?? 0;

      if (!Number.isInteger(debit) || !Number.isInteger(credit)) {
        throw new BadRequestException(
          'Debit and credit amounts must be integers',
        );
      }

      if (debit < 0 || credit < 0) {
        throw new BadRequestException(
          'Debit and credit amounts must be positive',
        );
      }

      if ((debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
        throw new BadRequestException(
          'Each line must have either debit or credit amount',
        );
      }

      totalDebit += debit;
      totalCredit += credit;
    }

    if (totalDebit !== totalCredit) {
      throw new BadRequestException('Journal entry is not balanced');
    }

    const accountCodes = Array.from(
      new Set(lines.map((line) => line.accountCode.trim())),
    );

    const accounts = await tx.account.findMany({
      where: {
        code: { in: accountCodes },
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (accounts.length !== accountCodes.length) {
      const foundCodes = new Set(accounts.map((account) => account.code));
      const missing = accountCodes.filter((code) => !foundCodes.has(code));
      throw new BadRequestException(`Account not found: ${missing.join(', ')}`);
    }

    const accountIdByCode = new Map(
      accounts.map((account) => [account.code, account.id]),
    );

    let journal: { id: number };
    try {
      journal = await tx.journalEntry.create({
        data: {
          reference: reference || null,
          description: description || null,
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Duplicate journal reference: ${reference || '(null)'}`,
        );
      }
      throw error;
    }

    await tx.ledgerEntry.createMany({
      data: lines.map((line) => ({
        journalEntryId: journal.id,
        accountId: accountIdByCode.get(line.accountCode.trim()),
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
      })),
    });

    return {
      journalEntryId: journal.id,
    };
  }
}
