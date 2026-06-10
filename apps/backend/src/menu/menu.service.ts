import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateMenuItemInput = {
  name: string;
  category: string;
  price: number;
};

type UpdateMenuItemInput = {
  name?: string;
  category?: string;
  price?: number;
};

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findActive() {
    const rows = await this.prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category.name,
      price: row.price,
      isActive: row.isActive,
    }));
  }

  async findAll() {
    const rows = await this.prisma.menuItem.findMany({
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category.name,
      price: row.price,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async create(input: CreateMenuItemInput) {
    const name = input?.name?.trim();
    const category = input?.category?.trim();
    const price = input?.price;

    this.assertValidName(name);
    this.assertValidCategory(category);
    this.assertValidPrice(price);

    const categoryId = await this.findOrCreateCategoryId(category);
    await this.assertUniqueNameCategory(name, categoryId);

    const created = await this.prisma.menuItem.create({
      data: {
        name,
        price,
        categoryId,
      },
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      id: created.id,
      name: created.name,
      category: created.category.name,
      price: created.price,
      isActive: created.isActive,
    };
  }

  async update(id: number, input: UpdateMenuItemInput) {
    const existing = await this.ensureExists(id);

    const data: {
      name?: string;
      categoryId?: number;
      price?: number;
    } = {};

    if (input?.name !== undefined) {
      const name = input.name.trim();
      this.assertValidName(name);
      data.name = name;
    }

    if (input?.category !== undefined) {
      const category = input.category.trim();
      this.assertValidCategory(category);
      data.categoryId = await this.findOrCreateCategoryId(category);
    }

    if (input?.price !== undefined) {
      this.assertValidPrice(input.price);
      data.price = input.price;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const nextName = data.name ?? existing.name;
    const nextCategoryId = data.categoryId ?? existing.categoryId;

    if (nextName !== existing.name || nextCategoryId !== existing.categoryId) {
      await this.assertUniqueNameCategory(nextName, nextCategoryId, id);
    }

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      category: updated.category.name,
      price: updated.price,
      isActive: updated.isActive,
    };
  }

  async toggle(id: number) {
    const existing = await this.ensureExists(id);

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      category: updated.category.name,
      price: updated.price,
      isActive: updated.isActive,
    };
  }

  private async ensureExists(
    id: number,
  ): Promise<{ name: string; categoryId: number; isActive: boolean }> {
    const existing = await this.prisma.menuItem.findUnique({
      where: { id },
      select: { name: true, categoryId: true, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException('Menu item not found');
    }

    return existing;
  }

  private async assertUniqueNameCategory(
    name: string,
    categoryId: number,
    ignoreId?: number,
  ): Promise<void> {
    const existing = await this.prisma.menuItem.findFirst({
      where: {
        name,
        categoryId,
        NOT: ignoreId ? { id: ignoreId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        'Menu item already exists in this category',
      );
    }
  }

  private async findOrCreateCategoryId(categoryName: string): Promise<number> {
    const category = await this.prisma.menuCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
      select: { id: true },
    });
    return category.id;
  }

  private assertValidName(name: string | undefined): asserts name is string {
    if (!name) {
      throw new BadRequestException('name is required');
    }
  }

  private assertValidCategory(
    category: string | undefined,
  ): asserts category is string {
    if (!category) {
      throw new BadRequestException('category is required');
    }
  }

  private assertValidPrice(price: number | undefined): asserts price is number {
    if (
      typeof price !== 'number' ||
      !Number.isInteger(price) ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new BadRequestException('price must be a positive integer');
    }
  }
}
