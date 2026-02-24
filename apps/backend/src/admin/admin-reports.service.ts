import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

type DailyReport = {
  date: string;
  totalSales: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  totalPayments: number;
  totalDiscount: number;
  totalExpense: number;
  outstanding: number;
  profit: number;
  delta: number;
};

type ShiftReport = {
  shiftId: number;
  openedAt: Date;
  closedAt: Date | null;
  totalSales: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  totalPayments: number;
  totalDiscount: number;
  totalExpense: number;
  outstanding: number;
  profit: number;
  delta: number;
};

type RangeReport = {
  from: string;
  to: string;
  totalSales: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  totalPayments: number;
  totalDiscount: number;
  totalExpense: number;
  outstanding: number;
  profit: number;
};

type ReportTotals = {
  totalSales: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  totalPayments: number;
  totalDiscount: number;
  totalExpense: number;
  outstanding: number;
  profit: number;
};

@Injectable()
export class AdminReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  async getDailyReport(dateInput?: string): Promise<DailyReport> {
    const date = this.requireDate(dateInput, 'date');
    const { start, end } = this.getDateRange(date);

    const [totals, delta] = await Promise.all([
      this.computeClosedOrderTotals(start, end),
      this.computeLedgerDelta(start, end),
    ]);

    return {
      date,
      ...totals,
      delta,
    };
  }

  async getShiftReport(shiftId: number): Promise<ShiftReport> {
    const detail = await this.adminService.getShiftById(shiftId);

    return {
      shiftId: detail.id,
      openedAt: new Date(detail.openedAt),
      closedAt: detail.closedAt ? new Date(detail.closedAt) : null,
      totalSales: detail.totalSales,
      totalGameRevenue: detail.totalGameRevenue,
      totalOrderRevenue: detail.totalOrderRevenue,
      totalPayments: detail.totalPayments,
      totalDiscount: detail.totalDiscount,
      totalExpense: detail.totalExpense,
      outstanding: detail.outstandingAmount,
      profit: this.asInt(detail.totalSales - detail.totalExpense),
      delta: detail.delta,
    };
  }

  async getRangeReport(
    fromInput?: string,
    toInput?: string,
  ): Promise<RangeReport> {
    const from = this.requireDate(fromInput, 'from');
    const to = this.requireDate(toInput, 'to');

    const fromRange = this.getDateRange(from);
    const toRange = this.getDateRange(to);

    if (fromRange.start > toRange.end) {
      throw new BadRequestException(
        'پارامتر "from" باید کوچک‌تر یا مساوی "to" باشد',
      );
    }

    const totals = await this.computeClosedOrderTotals(
      fromRange.start,
      toRange.end,
    );

    return {
      from,
      to,
      ...totals,
    };
  }

  toDailyCsv(report: DailyReport): string {
    const rows: Array<[string, string | number]> = [
      ['تاریخ', report.date],
      ['فروش کل', report.totalSales],
      ['درآمد بازی', report.totalGameRevenue],
      ['درآمد سفارش', report.totalOrderRevenue],
      ['پرداخت‌ها', report.totalPayments],
      ['تخفیف', report.totalDiscount],
      ['هزینه', report.totalExpense],
      ['بدهی', report.outstanding],
      ['سود', report.profit],
      ['دلتا', report.delta],
    ];

    const header = 'شاخص,مقدار';
    const body = rows
      .map(
        ([metric, value]) =>
          `${this.escapeCsv(metric)},${this.escapeCsv(value)}`,
      )
      .join('\n');

    return `${header}\n${body}\n`;
  }

  private async computeClosedOrderTotals(
    start: Date,
    end: Date,
  ): Promise<ReportTotals> {
    const closedOrderScope = {
      status: OrderStatus.CLOSED,
      closedAt: {
        gte: start,
        lte: end,
      },
    } as const;

    const [orderAggregate, gameAggregate, paymentAggregate, expenseAggregate] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: closedOrderScope,
          _sum: {
            total: true,
            discountAmount: true,
          },
        }),
        this.prisma.gameCharge.aggregate({
          where: {
            order: {
              is: closedOrderScope,
            },
          },
          _sum: {
            finalPrice: true,
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            order: {
              is: closedOrderScope,
            },
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.expense.aggregate({
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
            isVoided: false,
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

    const totalSales = orderAggregate._sum.total ?? 0;
    const totalGameRevenue = gameAggregate._sum.finalPrice ?? 0;
    const totalOrderRevenue = Math.max(totalSales - totalGameRevenue, 0);
    const totalPayments = paymentAggregate._sum.amount ?? 0;
    const totalDiscount = orderAggregate._sum.discountAmount ?? 0;
    const totalExpense = expenseAggregate._sum.amount ?? 0;
    const outstanding = Math.max(totalSales - totalPayments, 0);
    const profit = totalSales - totalExpense;

    return {
      totalSales: this.asInt(totalSales),
      totalGameRevenue: this.asInt(totalGameRevenue),
      totalOrderRevenue: this.asInt(totalOrderRevenue),
      totalPayments: this.asInt(totalPayments),
      totalDiscount: this.asInt(totalDiscount),
      totalExpense: this.asInt(totalExpense),
      outstanding: this.asInt(outstanding),
      profit: this.asInt(profit),
    };
  }

  private async computeLedgerDelta(start: Date, end: Date): Promise<number> {
    const ledger = await this.prisma.ledgerEntry.aggregate({
      where: {
        journalEntry: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebit = ledger._sum.debit ?? 0;
    const totalCredit = ledger._sum.credit ?? 0;

    return this.asInt(totalDebit - totalCredit);
  }

  private requireDate(
    value: string | undefined,
    field: 'date' | 'from' | 'to',
  ): string {
    if (!value) {
      throw new BadRequestException(`پارامتر "${field}" الزامی است`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        `فرمت "${field}" نامعتبر است. قالب درست: YYYY-MM-DD`,
      );
    }

    const date = this.parseDate(value);
    if (!date) {
      throw new BadRequestException(`تاریخ "${field}" نامعتبر است`);
    }

    return value;
  }

  private parseDate(value: string): Date | null {
    const [year, month, day] = value.split('-').map(Number);

    const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }

    return parsed;
  }

  private getDateRange(value: string): { start: Date; end: Date } {
    const start = this.parseDate(value);

    if (!start) {
      throw new BadRequestException('تاریخ نامعتبر است');
    }

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    return {
      start,
      end,
    };
  }

  private escapeCsv(value: string | number): string {
    const stringValue = String(value);
    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  private asInt(value: number): number {
    return Number.isInteger(value) ? value : Math.round(value);
  }
}
