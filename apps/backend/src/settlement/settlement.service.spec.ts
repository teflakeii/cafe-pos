import { PrismaService } from '../prisma/prisma.service';
import { SettlementService } from './settlement.service';

/**
 * Unit tests for the per-person order-discount allocation.
 *
 * These run with `pnpm test` and need no database or environment: the method
 * under test is pure. The key invariant is that the per-person discounts always
 * sum to the *effective* discount (min(discountAmount, subtotalSum)) and never
 * exceed any single person's subtotal — which is exactly what keeps the
 * settlement integrity check (grandTotal === order.total) from ever tripping.
 */
describe('SettlementService.allocateOrderDiscount', () => {
  let service: SettlementService;

  // The allocation helper is private and does not touch Prisma, so a dummy
  // dependency is enough to instantiate the service for the unit under test.
  const allocate = (
    subtotals: Map<number, number>,
    sum: number,
    discount: number,
  ): Map<number, number> =>
    (
      service as unknown as {
        allocateOrderDiscount: (
          s: Map<number, number>,
          sum: number,
          d: number,
        ) => Map<number, number>;
      }
    ).allocateOrderDiscount(subtotals, sum, discount);

  const sumValues = (map: Map<number, number>): number =>
    Array.from(map.values()).reduce((total, value) => total + value, 0);

  beforeEach(() => {
    service = new SettlementService(undefined as unknown as PrismaService);
  });

  it('allocates nothing when the discount is zero', () => {
    const subtotals = new Map([
      [1, 100],
      [2, 200],
    ]);

    const result = allocate(subtotals, 300, 0);

    expect(result.get(1)).toBe(0);
    expect(result.get(2)).toBe(0);
    expect(sumValues(result)).toBe(0);
  });

  it('splits an even discount exactly', () => {
    const subtotals = new Map([
      [1, 100],
      [2, 100],
    ]);

    const result = allocate(subtotals, 200, 50);

    expect(result.get(1)).toBe(25);
    expect(result.get(2)).toBe(25);
    expect(sumValues(result)).toBe(50);
  });

  it('distributes the rounding remainder so the sum is exact', () => {
    const subtotals = new Map([
      [1, 100],
      [2, 100],
      [3, 100],
    ]);

    const result = allocate(subtotals, 300, 100);

    // 100 / 3 = 33.33 each -> two get 33, one gets 34, summing to exactly 100.
    expect(sumValues(result)).toBe(100);
    const values = Array.from(result.values()).sort();
    expect(values).toEqual([33, 33, 34]);
  });

  it('allocates proportionally for uneven subtotals', () => {
    const subtotals = new Map([
      [1, 150],
      [2, 50],
    ]);

    const result = allocate(subtotals, 200, 40);

    expect(result.get(1)).toBe(30); // 150/200 * 40
    expect(result.get(2)).toBe(10); // 50/200 * 40
    expect(sumValues(result)).toBe(40);
  });

  it('caps the effective discount at the subtotal sum (full discount)', () => {
    const subtotals = new Map([
      [1, 100],
      [2, 100],
    ]);

    const result = allocate(subtotals, 200, 500);

    // Discount exceeds the bill -> everyone is fully discounted, sum === subtotal.
    expect(result.get(1)).toBe(100);
    expect(result.get(2)).toBe(100);
    expect(sumValues(result)).toBe(200);
  });

  it('ignores participants with no order subtotal', () => {
    const subtotals = new Map([
      [1, 100],
      [2, 0],
    ]);

    const result = allocate(subtotals, 100, 30);

    expect(result.get(1)).toBe(30);
    expect(result.get(2)).toBe(0);
    expect(sumValues(result)).toBe(30);
  });

  it('always satisfies the settlement invariants for random inputs', () => {
    for (let iteration = 0; iteration < 500; iteration += 1) {
      const peopleCount = 1 + Math.floor(Math.random() * 6);
      const subtotals = new Map<number, number>();
      let subtotalSum = 0;
      for (let person = 1; person <= peopleCount; person += 1) {
        const subtotal = Math.floor(Math.random() * 100000);
        subtotals.set(person, subtotal);
        subtotalSum += subtotal;
      }
      const discount = Math.floor(Math.random() * 120000);

      const result = allocate(subtotals, subtotalSum, discount);
      const effectiveDiscount = Math.min(discount, subtotalSum);

      // 1) Per-person discounts sum to exactly the effective discount.
      expect(sumValues(result)).toBe(effectiveDiscount);

      // 2) No person is discounted below 0 or above their own subtotal,
      //    so orderFinal (subtotal - discount) is always >= 0.
      for (const [person, subtotal] of subtotals.entries()) {
        const personDiscount = result.get(person) ?? 0;
        expect(personDiscount).toBeGreaterThanOrEqual(0);
        expect(personDiscount).toBeLessThanOrEqual(subtotal);
      }

      // 3) sum(orderFinal) === max(subtotalSum - discount, 0) === order.total menu part.
      const grandFinal = Array.from(subtotals.entries()).reduce(
        (total, [person, subtotal]) => total + (subtotal - (result.get(person) ?? 0)),
        0,
      );
      expect(grandFinal).toBe(Math.max(subtotalSum - discount, 0));
    }
  });
});
