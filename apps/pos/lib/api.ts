import { getPosAccessToken } from "./pos-auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T;
  return data;
}

export async function getTables() {
  const res = await fetch(`${BASE_URL}/tables`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tables");
  }

  return res.json();
}

export async function getMenuItems() {
  const res = await fetch(`${BASE_URL}/menu-items`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch menu items");
  }
  return parseJson(res);
}

export async function getAllMenuItems() {
  const res = await fetch(`${BASE_URL}/menu-items/all`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch all menu items");
  }
  return parseJson(res);
}

export async function createMenuItem(body: {
  name: string;
  category: string;
  price: number;
}) {
  const res = await fetch(`${BASE_URL}/menu-items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("Failed to create menu item");
  }
  return parseJson(res);
}

export async function updateMenuItem(
  id: number,
  body: {
    name?: string;
    category?: string;
    price?: number;
  },
) {
  const res = await fetch(`${BASE_URL}/menu-items/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("Failed to update menu item");
  }
  return parseJson(res);
}

export async function toggleMenuItem(id: number) {
  const res = await fetch(`${BASE_URL}/menu-items/${id}/toggle`, {
    method: "PATCH",
  });
  if (!res.ok) {
    throw new Error("Failed to toggle menu item");
  }
  return parseJson(res);
}

export async function getTablePeople(tableId: number) {
  return fetch(`${BASE_URL}/tables/${tableId}/people`).then((r) => r.json());
}

export async function createTablePerson(
  tableId: number,
  body: {
    name: string;
    type: "PLAY" | "ORDER" | "BOTH";
  },
) {
  return fetch(`${BASE_URL}/tables/${tableId}/people`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

export async function createOrder(payload: {
  type: "dine_in";
  tableId: number;
  openedByUserId: number;
}) {
  const res = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // 👇 این قسمت مهمه
  if (res.status === 409) {
    return { conflict: true };
  }

  if (!res.ok) {
    throw new Error("Failed to create order");
  }

  return res.json();
}

export async function addOrderItem(
  orderId: number,
  body: {
    menuItemId: number;
    quantity: number;
    ownerType: "SHARED" | "PERSON";
    ownerPersonName?: string;
  },
) {
  const res = await fetch(`${BASE_URL}/orders/${orderId}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: body.menuItemId,
      menuItemId: body.menuItemId,
      quantity: body.quantity,
      ownerType: body.ownerType,
      ownerPersonName: body.ownerPersonName,
      qty: body.quantity,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to add order item");
  }

  return res.json();
}

export async function deleteOrderItem(orderId: number, itemId: number) {
  const res = await fetch(`${BASE_URL}/orders/${orderId}/items/${itemId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Failed to delete order item");
  }

  return res.json();
}

export async function getSettlement(orderId: number) {
  return fetch(`${BASE_URL}/orders/${orderId}/settle`, {
    method: "POST",
  }).then((r) => r.json());
}

export async function createPayment(
  orderId: number,
  body: {
    payerPersonId: number;
    beneficiaryPersonId?: number;
    amount: number;
    method: "CASH" | "CARD" | "MANUAL";
  },
) {
  return fetch(`${BASE_URL}/orders/${orderId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type PosTableRow = {
  tableId: number;
  tableNo: number;
  status: "free" | "busy";
  openOrderId?: number;
  openOrderTotal?: number;
  openOrderStatus?: "OPEN" | "SETTLING" | "CLOSED" | "VOID";
};

export type PosTablePerson = {
  id: number;
  name: string;
  type: "PLAY" | "ORDER" | "BOTH";
  joinedAt?: string;
  leftAt?: string | null;
};

export type PosMenuItem = {
  id: number;
  name: string;
  price: number;
  category: string;
  isActive: boolean;
};

export type PosCreateOrderResponse = {
  id: number;
  orderNo: string;
  type: "dine_in" | "takeaway";
  tableId: number | null;
  status: string;
  subtotal: number;
  total: number;
};

export type PosOrderItemResponse = {
  id: number;
  orderId: number;
  menuItemId: number | null;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
};

export type PosPaymentResponse = {
  orderId: number;
  payments: Array<{
    id: number;
    payerPersonId: number;
    beneficiaryPersonId: number | null;
    amount: number;
    method: "CASH" | "CARD" | "MANUAL";
    paidAt: string;
  }>;
};

export type PosSettlementPerson = {
  personId: number;
  name: string;
  type?: "PLAY" | "ORDER" | "BOTH" | string;
  gameBase?: number;
  gameDiscount?: number;
  gameTotal?: number;
  paid?: number;
  debt?: number;
  remaining?: number;
  payable?: number;
};

export type PosSettlementResponse = {
  orderId: number;
  status?: "OPEN" | "SETTLING" | "CLOSED" | string;
  tableId?: number;
  people: PosSettlementPerson[];
  totalDebt?: number;
  summary?: {
    grandTotal?: number;
    gameDiscountTotal?: number;
    totalPayable?: number;
    totalPaid?: number;
    totalDebt?: number;
  };
};

export type PosStartGameResponse = {
  sessionId: number;
  startedAt: string;
};

export type PosStopGameResponse = {
  sessionId: number;
  endedAt: string;
};

function messageFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "خطای غیرمنتظره در ارتباط با سرور";
  }

  const maybeMessage = (payload as { message?: unknown }).message;
  if (Array.isArray(maybeMessage)) {
    return maybeMessage.map(localizeBackendMessage).join(" | ");
  }
  if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
    return localizeBackendMessage(maybeMessage);
  }

  return "خطای غیرمنتظره در ارتباط با سرور";
}

function localizeBackendMessage(message: string): string {
  const trimmed = message.trim();
  const normalized = trimmed.toLowerCase();

  if (normalized.includes("invalid credentials")) {
    return "ایمیل یا رمز عبور اشتباه است";
  }
  if (normalized.includes("unauthorized")) {
    return "دسترسی غیرمجاز";
  }
  if (normalized.includes("forbidden")) {
    return "شما دسترسی لازم برای این عملیات را ندارید";
  }
  if (normalized.includes("active shift") && normalized.includes("cannot create order")) {
    return "هیچ شیفت بازی وجود ندارد و ثبت سفارش ممکن نیست";
  }
  if (normalized.includes("no participants found")) {
    return "برای این سفارش هنوز نفری ثبت نشده است";
  }
  if (normalized.includes("cannot receive game charges")) {
    return "نوع این نفر برای هزینه بازی مجاز نیست";
  }
  if (normalized.includes("cannot receive order charges")) {
    return "نوع این نفر برای هزینه سفارش مجاز نیست";
  }
  if (normalized.includes("amount is greater than payer debt")) {
    return "مبلغ واردشده بیشتر از بدهی نفر است";
  }
  if (normalized.includes("settlement mismatch")) {
    return "عدم تطابق در محاسبات تسویه. لطفا سفارش را دوباره بررسی کنید";
  }
  if (normalized.includes("no play or both participants")) {
    return "هیچ نفر مجاز برای هزینه بازی پیدا نشد";
  }
  if (normalized.includes("no order or both participants")) {
    return "هیچ نفر مجاز برای تقسیم سفارش پیدا نشد";
  }
  if (normalized.includes("shift is closed")) {
    return "شیفت بسته است";
  }
  if (normalized === "order is closed") {
    return "سفارش بسته است";
  }
  if (normalized.includes("participant not found")) {
    return "نفر موردنظر پیدا نشد";
  }
  if (normalized.includes("no game charges")) {
    return "برای این نفر هزینه بازی ثبت نشده است";
  }
  if (normalized.includes("discountamount is greater than participant game debt")) {
    return "مبلغ تخفیف از بدهی بازی این نفر بیشتر است";
  }
  if (normalized.includes("session already stopped")) {
    return "این بازی قبلا پایان یافته است";
  }
  if (normalized.includes("open game session already exists")) {
    return "برای این میز یک بازی فعال وجود دارد";
  }
  if (normalized.includes("game session not found")) {
    return "جلسه بازی پیدا نشد";
  }
  if (normalized.includes("no active order for this table")) {
    return "برای این میز سفارش فعالی وجود ندارد";
  }
  if (normalized.includes("resolved order is not active")) {
    return "سفارش فعال برای ثبت هزینه بازی پیدا نشد";
  }
  if (normalized.includes("idempotency-key")) {
    return "کلید یکتای پرداخت ارسال نشده است";
  }

  if (/[a-z]/i.test(trimmed)) {
    return "خطا در انجام عملیات. لطفا دوباره تلاش کنید";
  }

  return trimmed;
}

function getStoredAccessToken(): string | null {
  return getPosAccessToken();
}

function buildIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(16).slice(2).padEnd(12, "0");
  return `00000000-0000-4000-8000-${random.slice(0, 12)}`;
}

async function posRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  const token = getStoredAccessToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, messageFromPayload(payload), payload);
  }

  return payload as T;
}

export async function posGetTables(): Promise<PosTableRow[]> {
  return posRequest<PosTableRow[]>("/tables");
}

export async function posLogin(email: string, password: string): Promise<{ accessToken: string }> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, messageFromPayload(payload), payload);
  }

  return payload as { accessToken: string };
}

export async function posGetMe(): Promise<{
  id: number;
  email: string;
  role: "OWNER" | "MANAGER" | "CASHIER" | "ACCOUNTANT";
  active: boolean;
}> {
  return posRequest("/auth/me");
}

export async function posOpenShift(openingCash: number): Promise<{
  id: number;
  status: "OPEN" | "CLOSED";
  openingCash: number;
}> {
  return posRequest("/shifts/open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      openingCash,
    }),
  });
}

export async function posCreateOrder(tableId: number): Promise<PosCreateOrderResponse> {
  return posRequest<PosCreateOrderResponse>("/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "dine_in",
      tableId,
    }),
  });
}

export async function posGetTablePeople(tableId: number): Promise<PosTablePerson[]> {
  return posRequest<PosTablePerson[]>(`/tables/${tableId}/people`);
}

export async function posGetParticipantNames(): Promise<string[]> {
  return posRequest<string[]>("/participants/names");
}

export async function posCreateParticipant(
  orderId: number,
  body: {
    name: string;
    type: "PLAY" | "ORDER" | "BOTH";
  },
): Promise<PosTablePerson> {
  return posRequest<PosTablePerson>(`/orders/${orderId}/participants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function posGetMenuItems(): Promise<PosMenuItem[]> {
  return posRequest<PosMenuItem[]>("/menu-items");
}

export async function posAddOrderItem(
  orderId: number,
  body: {
    menuItemId: number;
    qty: number;
  },
): Promise<PosOrderItemResponse> {
  return posRequest<PosOrderItemResponse>(`/orders/${orderId}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function posDeleteOrderItem(
  orderId: number,
  itemId: number,
): Promise<{ success: true }> {
  return posRequest<{ success: true }>(`/orders/${orderId}/items/${itemId}`, {
    method: "DELETE",
  });
}

export async function posSettleOrder(
  orderId: number,
): Promise<PosCreateOrderResponse> {
  return posRequest<PosCreateOrderResponse>(`/orders/${orderId}/settle`, {
    method: "POST",
  });
}

export async function posGetSettlement(
  orderId: number,
): Promise<PosSettlementResponse> {
  return posRequest<PosSettlementResponse>(`/settlement/${orderId}`);
}

export async function posStartGame(
  tableId: number,
): Promise<PosStartGameResponse> {
  return posRequest<PosStartGameResponse>(`/tables/${tableId}/game/start`, {
    method: "POST",
  });
}

export async function posStopGame(
  sessionId: number,
): Promise<PosStopGameResponse> {
  return posRequest<PosStopGameResponse>(`/game/${sessionId}/stop`, {
    method: "POST",
  });
}

export async function posCreatePayment(
  orderId: number,
  body: {
    payerPersonId: number;
    amount: number;
    method: "CASH" | "CARD" | "MANUAL";
  },
): Promise<PosPaymentResponse> {
  return posRequest<PosPaymentResponse>(`/orders/${orderId}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": buildIdempotencyKey(),
    },
    body: JSON.stringify({
      payerPersonId: body.payerPersonId,
      amount: body.amount,
      method: body.method,
    }),
  });
}

export async function posApplyGameDiscount(
  orderId: number,
  body: {
    personId: number;
    discountAmount: number;
  },
): Promise<{
  orderId: number;
  personId: number;
  discountApplied: number;
  gameBase: number;
  gameFinal: number;
  gameDiscount: number;
  orderTotal: number;
}> {
  return posRequest(`/orders/${orderId}/game-discounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personId: body.personId,
      discountAmount: body.discountAmount,
    }),
  });
}
