import { Injectable } from '@nestjs/common';
import { AccountType, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeedService {
  constructor(private readonly prisma: PrismaService) {}

  async init(): Promise<void> {
    const tableCount = await this.prisma.cafeTable.count();
    if (tableCount === 0) {
      await this.prisma.cafeTable.createMany({
        data: Array.from({ length: 10 }, (_, index) => ({
          tableNo: index + 1,
          isActive: true,
        })),
      });
    }

    const defaultUsers: Array<{
      email: string;
      password: string;
      role: UserRole;
    }> = [
      {
        email: 'owner@cafe.local',
        password: 'Owner123!',
        role: UserRole.OWNER,
      },
      {
        email: 'manager@cafe.local',
        password: 'Manager123!',
        role: UserRole.MANAGER,
      },
      {
        email: 'cashier@cafe.local',
        password: 'Cashier123!',
        role: UserRole.CASHIER,
      },
      {
        email: 'accountant@cafe.local',
        password: 'Accountant123!',
        role: UserRole.ACCOUNTANT,
      },
    ];

    const seedProfile = (process.env.SEED_PROFILE ?? 'default').toLowerCase();
    const ownerEmail = process.env.SEED_OWNER_EMAIL ?? 'owner@cafe.local';
    const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? 'Owner123!';

    const usersToSeed =
      seedProfile === 'minimal'
        ? [
            {
              email: ownerEmail,
              password: ownerPassword,
              role: UserRole.OWNER,
            },
          ]
        : defaultUsers;

    for (const user of usersToSeed) {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      await this.prisma.user.upsert({
        where: {
          email: user.email,
        },
        update: {
          password: hashedPassword,
          role: user.role,
          isActive: true,
        },
        create: {
          email: user.email,
          password: hashedPassword,
          role: user.role,
          isActive: true,
        },
      });
    }

    await this.prisma.user.updateMany({
      where: {
        email: {
          endsWith: '@legacy.local',
        },
      },
      data: {
        isActive: false,
      },
    });

    const menuItems = [
      { name: 'اسپرسو', category: 'قهوه اسپرسو', price: 110000 },
      { name: 'آمریکانو', category: 'قهوه اسپرسو', price: 120000 },
      { name: 'لاته', category: 'قهوه اسپرسو', price: 130000 },
      { name: 'موکا', category: 'قهوه اسپرسو', price: 140000 },
      { name: 'کاپوچینو', category: 'قهوه اسپرسو', price: 130000 },
      { name: 'کارامل ماکیاتو', category: 'قهوه اسپرسو', price: 150000 },
      { name: 'چای کلاسیک', category: 'نوشیدنی گرم', price: 110000 },
      { name: 'چای زعفرانی', category: 'نوشیدنی گرم', price: 190000 },
      { name: 'چای لاته', category: 'نوشیدنی گرم', price: 160000 },
      { name: 'چای کارامل', category: 'نوشیدنی گرم', price: 160000 },
      { name: 'شیرکاکائو', category: 'نوشیدنی گرم', price: 160000 },
      { name: 'هات چاکلت', category: 'نوشیدنی گرم', price: 190000 },
      { name: 'آیس لاته', category: 'نوشیدنی سرد', price: 190000 },
      { name: 'آیس موکا', category: 'نوشیدنی سرد', price: 215000 },
      { name: 'آیس کارامل', category: 'نوشیدنی سرد', price: 215000 },
      { name: 'آیس آمریکانو', category: 'نوشیدنی سرد', price: 200000 },
      { name: 'آیس ماچا', category: 'نوشیدنی سرد', price: 200000 },
      { name: 'شیک شکلات', category: 'شیک', price: 230000 },
      { name: 'شیک وانیل', category: 'شیک', price: 230000 },
      { name: 'شیک موز', category: 'شیک', price: 230000 },
      { name: 'شیک موز شکلات', category: 'شیک', price: 250000 },
      { name: 'شیک کارامل', category: 'شیک', price: 240000 },
      { name: 'اسموتی موز توت‌فرنگی', category: 'اسموتی', price: 240000 },
      { name: 'اسموتی انبه', category: 'اسموتی', price: 250000 },
      { name: 'اسموتی جنگل', category: 'اسموتی', price: 250000 },
      { name: 'اسموتی موز', category: 'اسموتی', price: 190000 },
      { name: 'چیزکیک', category: 'کیک و دسر', price: 210000 },
      { name: 'کیک شکلاتی', category: 'کیک و دسر', price: 210000 },
      { name: 'کیک هویج', category: 'کیک و دسر', price: 210000 },
      { name: 'کوکی شکلاتی', category: 'کیک و دسر', price: 120000 },
      { name: 'املت ساده', category: 'صبحانه', price: 160000 },
      { name: 'املت قارچ', category: 'صبحانه', price: 180000 },
      { name: 'املت اسفناج', category: 'صبحانه', price: 200000 },
      { name: 'سوسیس تخم مرغ', category: 'صبحانه', price: 220000 },
      { name: 'صبحانه انگلیسی', category: 'صبحانه', price: 400000 },
      { name: 'پاستا چیکن آلفردو', category: 'غذا', price: 430000 },
      { name: 'پاستا بیف آلفردو', category: 'غذا', price: 530000 },
      { name: 'پاستا ماکاری', category: 'غذا', price: 430000 },
    ] as const;

    const categoryNames = Array.from(
      new Set(menuItems.map((item) => item.category)),
    );
    for (const categoryName of categoryNames) {
      await this.prisma.menuCategory.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
      });
    }

    const categories = await this.prisma.menuCategory.findMany({
      where: {
        name: { in: categoryNames },
      },
      select: {
        id: true,
        name: true,
      },
    });
    const categoryIdByName = new Map(
      categories.map((category) => [category.name, category.id]),
    );

    for (const item of menuItems) {
      const categoryId = categoryIdByName.get(item.category);
      if (!categoryId) {
        continue;
      }

      const existing = await this.prisma.menuItem.findFirst({
        where: {
          name: item.name,
          categoryId,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            price: item.price,
            isActive: true,
            categoryId,
          },
        });
        continue;
      }

      await this.prisma.menuItem.create({
        data: {
          name: item.name,
          price: item.price,
          isActive: true,
          categoryId,
        },
      });
    }

    const systemAccounts: Array<{
      code: string;
      name: string;
      type: AccountType;
    }> = [
      { code: '1000', name: 'Cash', type: AccountType.ASSET },
      { code: '1100', name: 'Bank', type: AccountType.ASSET },
      { code: '1200', name: 'Accounts Receivable', type: AccountType.ASSET },
      { code: '4000', name: 'Sales Revenue', type: AccountType.REVENUE },
      { code: '5000', name: 'Operating Expense', type: AccountType.EXPENSE },
    ];

    for (const account of systemAccounts) {
      await this.prisma.account.upsert({
        where: { code: account.code },
        update: {
          name: account.name,
          type: account.type,
        },
        create: account,
      });
    }
  }
}

async function runSeed(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const service = new SeedService(prisma as unknown as PrismaService);
    await service.init();
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runSeed()
    .then(() => {
      process.stdout.write('Seed completed\n');
    })
    .catch((error) => {
      process.stderr.write(`${String(error)}\n`);
      process.exit(1);
    });
}
