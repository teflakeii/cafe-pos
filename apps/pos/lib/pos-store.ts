export type PosOrderState = "OPEN" | "SETTLING";

export type PosOwnerType = "SHARED" | "PERSON";

export type PosStoredItem = {
  itemId: number;
  menuItemId: number;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  ownerType: PosOwnerType;
  ownerPersonId?: number;
  ownerPersonName?: string;
};

type OrderStateMap = Record<string, PosOrderState>;
type PaidByPersonMap = Record<string, number>;

const ORDER_STATE_KEY = "pos-order-state-map";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function itemKey(orderId: number): string {
  return `pos-order-items:${orderId}`;
}

function paidKey(orderId: number): string {
  return `pos-paid-by-person:${orderId}`;
}

export function getOrderStateMap(): OrderStateMap {
  if (!canUseStorage()) {
    return {};
  }
  return parseJson<OrderStateMap>(window.localStorage.getItem(ORDER_STATE_KEY), {});
}

export function getOrderState(orderId: number): PosOrderState | null {
  const map = getOrderStateMap();
  return map[String(orderId)] ?? null;
}

export function setOrderState(orderId: number, state: PosOrderState): void {
  if (!canUseStorage()) {
    return;
  }
  const map = getOrderStateMap();
  map[String(orderId)] = state;
  window.localStorage.setItem(ORDER_STATE_KEY, JSON.stringify(map));
}

export function removeOrderState(orderId: number): void {
  if (!canUseStorage()) {
    return;
  }
  const map = getOrderStateMap();
  delete map[String(orderId)];
  window.localStorage.setItem(ORDER_STATE_KEY, JSON.stringify(map));
}

export function loadOrderItems(orderId: number): PosStoredItem[] {
  if (!canUseStorage()) {
    return [];
  }
  return parseJson<PosStoredItem[]>(
    window.localStorage.getItem(itemKey(orderId)),
    [],
  );
}

export function saveOrderItems(orderId: number, items: PosStoredItem[]): void {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(itemKey(orderId), JSON.stringify(items));
}

export function loadPaidByPerson(orderId: number): Record<number, number> {
  if (!canUseStorage()) {
    return {};
  }
  const map = parseJson<PaidByPersonMap>(
    window.localStorage.getItem(paidKey(orderId)),
    {},
  );
  const result: Record<number, number> = {};
  for (const [key, value] of Object.entries(map)) {
    const personId = Number(key);
    if (Number.isInteger(personId) && typeof value === "number") {
      result[personId] = value;
    }
  }
  return result;
}

export function savePaidByPerson(
  orderId: number,
  paidByPerson: Record<number, number>,
): void {
  if (!canUseStorage()) {
    return;
  }
  const serialized: PaidByPersonMap = {};
  for (const [key, value] of Object.entries(paidByPerson)) {
    serialized[key] = value;
  }
  window.localStorage.setItem(paidKey(orderId), JSON.stringify(serialized));
}

export function addPaidByPerson(
  orderId: number,
  personId: number,
  amount: number,
): Record<number, number> {
  const current = loadPaidByPerson(orderId);
  current[personId] = (current[personId] ?? 0) + amount;
  savePaidByPerson(orderId, current);
  return current;
}

export function clearOrderLocalState(orderId: number): void {
  if (!canUseStorage()) {
    return;
  }
  removeOrderState(orderId);
  window.localStorage.removeItem(itemKey(orderId));
  window.localStorage.removeItem(paidKey(orderId));
}
