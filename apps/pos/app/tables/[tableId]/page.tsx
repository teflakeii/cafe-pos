"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addOrderItem,
  createTablePerson,
  createOrder,
  createPayment,
  deleteOrderItem,
  getMenuItems,
  getSettlement,
  getTablePeople,
  getTables,
} from "@/lib/api";
import { CustomerPreset } from "@/data/customers";
import { addCustomerPreset, getCustomerPresets } from "@/lib/customers";

type Table = {
  tableId: number;
  tableNo: number;
  status: "free" | "busy";
  openOrderId?: number;
};

type MenuItem = {
  id: number;
  name: string;
  category: string;
  price: number;
  isActive: boolean;
};

type SettlementPerson = {
  personId: number;
  name: string;
  personalOrder: number;
  sharedOrder: number;
  orderDiscount: number;
  orderFinal: number;
  gameTotal: number;
  payable: number;
};

type SettlementData = {
  orderId: number;
  tableId: number;
  globalDiscountPercent: number;
  people: SettlementPerson[];
  summary: {
    orderSubtotal: number;
    orderDiscountTotal: number;
    gameTotal: number;
    grandTotal: number;
  };
};

type TablePerson = {
  id: number;
  name: string;
  type: "PLAY" | "ORDER" | "BOTH";
  joinedAt?: string;
  leftAt?: string | null;
};

type PaymentMethod = "CASH" | "CARD" | "MANUAL";

type UiOrderItem = {
  itemId: number;
  productId: number;
  name: string;
  price?: number;
  quantity: number;
  lineTotal: number;
  ownerType: "SHARED" | "PERSON";
  ownerPersonId?: number;
  ownerName?: string;
};

type AddOrderItemResponse = {
  id: number;
  orderId: number;
  menuItemId: number | null;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
};

type SettleOrderResponse = {
  id: number;
  orderNo: string;
  type: "dine_in" | "takeaway";
  tableId: number | null;
  status: string;
  subtotal: number;
  total: number;
};

type CreateOrderResponse = {
  conflict?: boolean;
  id?: number;
  status?: string;
};

function orderItemsStorageKey(orderId: number): string {
  return `order-items:${orderId}`;
}

function paymentsStorageKey(orderId: number): string {
  return `paid-by-person:${orderId}`;
}

function loadStoredOrderItems(orderId: number): UiOrderItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(orderItemsStorageKey(orderId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<UiOrderItem & { price?: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const fallbackPrice =
        item.quantity > 0 ? Math.round(item.lineTotal / item.quantity) : 0;
      return {
        ...item,
        price: item.price ?? fallbackPrice,
      };
    });
  } catch {
    return [];
  }
}

function saveStoredOrderItems(orderId: number, items: UiOrderItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(orderItemsStorageKey(orderId), JSON.stringify(items));
}

function loadStoredPaidByPerson(orderId: number): Record<number, number> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(paymentsStorageKey(orderId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<number, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredPaidByPerson(
  orderId: number,
  paidByPerson: Record<number, number>,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    paymentsStorageKey(orderId),
    JSON.stringify(paidByPerson),
  );
}

function isOpenStatus(status: string | null): boolean {
  return (status ?? "").toUpperCase() === "OPEN";
}

function isSettlementData(value: unknown): value is SettlementData {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as { people?: unknown }).people);
}

function isSettleOrderResponse(value: unknown): value is SettleOrderResponse {
  if (!value || typeof value !== "object") return false;
  const row = value as { id?: unknown; status?: unknown };
  return typeof row.id === "number" && typeof row.status === "string";
}

export default function TablePage() {
  const params = useParams<{ tableId: string }>();
  const router = useRouter();

  const tableId = Number(params.tableId);

  const [table, setTable] = useState<Table | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [tablePeople, setTablePeople] = useState<TablePerson[]>([]);
  const [settlement, setSettlement] = useState<SettlementData | null>(null);
  const [loadingSettlement, setLoadingSettlement] = useState(false);
  const [payingPersonId, setPayingPersonId] = useState<number | null>(null);
  const [paidByPerson, setPaidByPerson] = useState<Record<number, number>>({});
  const [orderItems, setOrderItems] = useState<UiOrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ownerType, setOwnerType] = useState<"SHARED" | "PERSON">("SHARED");
  const [customers, setCustomers] = useState<CustomerPreset[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [itemQuantity, setItemQuantity] = useState<string>("1");
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
  const [gameRunning, setGameRunning] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [payerPersonId, setPayerPersonId] = useState<number | null>(null);
  const [beneficiaryMode, setBeneficiaryMode] = useState<"PERSON" | "ALL">(
    "PERSON",
  );
  const [beneficiaryPersonId, setBeneficiaryPersonId] = useState<number | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerKey = `game-timer-${tableId}`;

  const groupedProducts = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    for (const product of menuItems) {
      if (!grouped[product.category]) {
        grouped[product.category] = [];
      }
      grouped[product.category].push(product);
    }
    return grouped;
  }, [menuItems]);

  useEffect(() => {
    setCustomers(getCustomerPresets());
  }, []);

  useEffect(() => {
    if (ownerType === "SHARED") {
      setSelectedCustomerId(null);
      setCustomName("");
    }
  }, [ownerType]);

  useEffect(() => {
    const saved = localStorage.getItem(timerKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      setGameStartedAt(parsed.startedAt ?? null);
      setGameRunning(parsed.running ?? false);
    }
  }, [tableId, timerKey]);

  useEffect(() => {
    if (!gameRunning) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [gameRunning]);

  const startGame = () => {
    const startTime = Date.now();
    setNow(startTime);
    setGameStartedAt(startTime);
    setGameRunning(true);
    localStorage.setItem(
      timerKey,
      JSON.stringify({ startedAt: startTime, running: true }),
    );
  };

  const stopGame = () => {
    setGameRunning(false);
    localStorage.setItem(
      timerKey,
      JSON.stringify({ startedAt: gameStartedAt, running: false }),
    );
  };

  async function handleSettle(targetOrderId: number) {
    setLoadingSettlement(true);
    try {
      const data = (await getSettlement(targetOrderId)) as unknown;

      if (isSettleOrderResponse(data)) {
        setOrderStatus(data.status);
      }

      if (isSettlementData(data)) {
        setSettlement(data);
      } else {
        setSettlement(null);
      }

      router.push("/tables");
    } catch {
      alert("خطا در دریافت تسویه");
      setSettlement(null);
    } finally {
      setLoadingSettlement(false);
    }
  }

  async function refreshTablePeople() {
    try {
      const data = (await getTablePeople(tableId)) as TablePerson[];
      setTablePeople(Array.isArray(data) ? data : []);
    } catch {
      setTablePeople([]);
    }
  }

  async function refreshMenuItems() {
    try {
      const data = (await getMenuItems()) as MenuItem[];
      setMenuItems(Array.isArray(data) ? data : []);
    } catch {
      alert("خطا در دریافت منو");
      setMenuItems([]);
    }
  }

  function setOrderState(targetOrderId: number | null) {
    setOrderId(targetOrderId);
    if (targetOrderId === null) {
      setOrderStatus(null);
      setOrderItems([]);
      setPaidByPerson({});
      return;
    }
    setOrderItems(loadStoredOrderItems(targetOrderId));
    setPaidByPerson(loadStoredPaidByPerson(targetOrderId));
  }

  async function refreshTable() {
    const tables = (await getTables()) as Table[];
    const found = tables.find((t) => t.tableId === tableId) ?? null;
    setTable(found);
    return found;
  }

  useEffect(() => {
    async function load() {
      try {
        await refreshMenuItems();
        await refreshTablePeople();
        const tables = (await getTables()) as Table[];
        const found = tables.find((t: Table) => t.tableId === tableId);
        setTable(found ?? null);

        if (found?.status === "busy" && found.openOrderId) {
          setOrderStatus("OPEN");
          setOrderState(found.openOrderId);
        } else {
          setOrderState(null);
          setSettlement(null);
        }
      } catch {
        setError("خطا در دریافت اطلاعات میز");
      } finally {
        setLoading(false);
      }
    }

    if (!Number.isNaN(tableId)) {
      load();
    }
  }, [tableId]);

  async function handleCreateOrder() {
    if (!table) return;

    if (table.status === "busy" && table.openOrderId) {
      setOrderStatus("OPEN");
      setOrderState(table.openOrderId);
      return;
    }

    try {
      const res = (await createOrder({
        type: "dine_in",
        tableId: table.tableId,
        openedByUserId: 2,
      })) as CreateOrderResponse;

      if (res?.conflict) {
        const updated = await refreshTable();
        if (updated?.openOrderId) {
          setOrderStatus("OPEN");
          setOrderId(updated.openOrderId);
        }
        return;
      }

      if (!res.id) {
        alert("خطا در ایجاد سفارش");
        return;
      }

      setTable((prev) =>
        prev
          ? {
              ...prev,
              status: "busy",
              openOrderId: res.id,
            }
          : prev,
      );
      setOrderStatus(res.status ?? "OPEN");
      setOrderState(res.id);
    } catch {
      alert("خطا در ایجاد سفارش");
    }
  }

  const openAddItemModal = (product: MenuItem) => {
    if (!orderId) {
      alert("ابتدا سفارش را شروع کنید");
      return;
    }
    if (!isOpenStatus(orderStatus)) {
      alert("این سفارش در حال تسویه است و قابل ویرایش نیست");
      return;
    }
    setSelectedProduct(product);
    setShowAddModal(true);
    setOwnerType("SHARED");
    setSelectedCustomerId(null);
    setCustomName("");
    setItemQuantity("1");
  };

  function closeAddItemModal() {
    setShowAddModal(false);
    setSelectedProduct(null);
    setItemQuantity("1");
    setOwnerType("SHARED");
    setSelectedCustomerId(null);
    setCustomName("");
  }

  async function submitAddItem() {
    if (!orderId) return;
    if (!selectedProduct) return;

    const quantity = Number(itemQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      alert("تعداد نامعتبر است");
      return;
    }

    try {
      let personName: string | null = null;

      if (ownerType === "PERSON") {
        if (selectedCustomerId) {
          const found = customers.find((c) => c.id === selectedCustomerId);
          personName = found?.name?.trim() ?? null;
        } else if (customName.trim()) {
          const newCustomer = addCustomerPreset(customName.trim());
          setCustomers(getCustomerPresets());
          personName = newCustomer.name.trim();
        }

        if (!personName) {
          alert("لطفاً نام مشتری را انتخاب یا وارد کنید");
          return;
        }

        const foundPerson = tablePeople.find((person) => person.name === personName);
        if (!foundPerson) {
          const createdPerson = (await createTablePerson(tableId, {
            name: personName,
            type: "BOTH",
          })) as { id?: number };

          if (!createdPerson?.id) {
            alert("خطا در ایجاد شخص");
            return;
          }

          await refreshTablePeople();
        }
      }

      const body = {
        menuItemId: selectedProduct.id,
        quantity,
        ownerType,
        ownerPersonName: ownerType === "PERSON" ? (personName ?? undefined) : undefined,
      };

      const created = (await addOrderItem(orderId, body)) as AddOrderItemResponse;

      const ownerName = ownerType === "PERSON" ? personName ?? undefined : undefined;

      const nextItems: UiOrderItem[] = [
        ...orderItems,
        {
          itemId: created.id,
          productId: selectedProduct.id,
          name: selectedProduct.name,
          price: created.unitPrice,
          quantity: created.qty,
          lineTotal: created.lineTotal,
          ownerType,
          ownerName,
        },
      ];

      setOrderItems(nextItems);
      saveStoredOrderItems(orderId, nextItems);
      closeAddItemModal();
      await refreshTablePeople();
    } catch {
      alert("خطا در افزودن آیتم");
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (!orderId) return;
    try {
      await deleteOrderItem(orderId, itemId);
      const nextItems = orderItems.filter((item) => item.itemId !== itemId);
      setOrderItems(nextItems);
      saveStoredOrderItems(orderId, nextItems);
    } catch {
      alert("خطا در حذف آیتم");
    }
  }

  function getPaidAmount(personId: number): number {
    return paidByPerson[personId] ?? 0;
  }

  function getRemaining(person: SettlementPerson): number {
    const remaining = person.payable - getPaidAmount(person.personId);
    return remaining > 0 ? remaining : 0;
  }

  function openPaymentModal(personId: number) {
    const person = people.find((p) => p.personId === personId);
    if (!person) return;

    setPayingPersonId(personId);
    setPayerPersonId(personId);
    setBeneficiaryMode("PERSON");
    setBeneficiaryPersonId(personId);
    setPaymentAmount(String(getRemaining(person)));
    setPaymentMethod("CASH");
  }

  function closePaymentModal() {
    setPayingPersonId(null);
  }

  async function submitPayment() {
    if (!orderId || payingPersonId === null || !payerPersonId) {
      return;
    }

    const amount = Number(paymentAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      alert("مبلغ نامعتبر است");
      return;
    }

    let maxAmount = 0;
    let targetBeneficiaryId: number | undefined;

    if (beneficiaryMode === "PERSON") {
      if (!beneficiaryPersonId) {
        alert("ذی‌نفع را انتخاب کنید");
        return;
      }
      const target = people.find(
        (person) => person.personId === beneficiaryPersonId,
      );
      if (!target) {
        alert("ذی‌نفع نامعتبر است");
        return;
      }
      maxAmount = getRemaining(target);
      targetBeneficiaryId = beneficiaryPersonId;
    } else {
      maxAmount = people.reduce((sum, person) => sum + getRemaining(person), 0);
      targetBeneficiaryId = undefined;
    }

    if (amount > maxAmount) {
      alert("مبلغ از باقیمانده بیشتر است");
      return;
    }

    try {
      const result = (await createPayment(orderId, {
        payerPersonId,
        beneficiaryPersonId: targetBeneficiaryId,
        amount,
        method: paymentMethod,
      })) as {
        statusCode?: number;
        message?: string | string[];
        payments?: Array<{
          beneficiaryPersonId: number | null;
          amount: number;
        }>;
      };

      if (result?.statusCode && result.statusCode >= 400) {
        const message = Array.isArray(result.message)
          ? result.message.join(" | ")
          : result.message ?? "خطا در ثبت پرداخت";
        alert(message);
        return;
      }

      if (Array.isArray(result.payments)) {
        setPaidByPerson((prev) => {
          const next = { ...prev };
          for (const payment of result.payments ?? []) {
            if (payment.beneficiaryPersonId == null) continue;
            const id = payment.beneficiaryPersonId;
            next[id] = (next[id] ?? 0) + payment.amount;
          }
          saveStoredPaidByPerson(orderId, next);
          return next;
        });
      }

      closePaymentModal();
    } catch {
      alert("خطا در ثبت پرداخت");
    }
  }

  if (loading) return <p>در حال بارگذاری…</p>;
  if (error) return <p>{error}</p>;
  if (!table) return <p>میز پیدا نشد</p>;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return [
      h.toString().padStart(2, "0"),
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0"),
    ].join(":");
  };

  const elapsedSeconds =
    gameRunning && gameStartedAt
      ? Math.floor((now - gameStartedAt) / 1000)
      : 0;

  const people = settlement?.people ?? [];
  const items = orderItems ?? [];
  const orderTotal = items.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0,
  );

  const allSettled = people.length > 0 && people.every((person) => getRemaining(person) === 0);
  const isOrderEditable = isOpenStatus(orderStatus);
  const selectedPerson =
    payingPersonId !== null
      ? people.find((person) => person.personId === payingPersonId) ?? null
      : null;

  return (
    <div className="min-h-screen bg-amber-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
                میز {table.tableNo}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                وضعیت: {table.status === "free" ? "آزاد" : "سفارش باز"}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <div className="flex items-center gap-3">
                <button
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
                  onClick={() => (gameRunning ? stopGame() : startGame())}
                >
                  🎮 بازی
                </button>

                <div className="px-3 py-2 rounded bg-black text-white font-mono text-sm">
                  {formatTime(elapsedSeconds)}
                </div>
              </div>
              <button
                onClick={() => {
                  if (orderId) {
                    handleSettle(orderId);
                    return;
                  }
                  handleCreateOrder();
                }}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 md:w-auto"
              >
                {orderId ? "تسویه" : "شروع سفارش"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-xl bg-white p-4 shadow-sm md:p-5">
            <div className="flex justify-center mb-4">
              <h2 className="text-lg font-bold">سفارش جدید</h2>
            </div>

            {!orderId && (
              <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
                برای افزودن محصول ابتدا سفارش را شروع کنید.
              </p>
            )}

            {orderId && !isOrderEditable && (
              <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
                این سفارش در حال تسویه است و قابل ویرایش نیست
              </p>
            )}

            <div className="space-y-6">
              {Object.entries(groupedProducts).map(([category, items]) => (
                <div key={category}>
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="shrink-0 text-sm font-semibold text-slate-800">
                      {category}
                    </h3>
                    <div className="h-px w-full bg-slate-200" />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((product) => (
                      <div
                        key={product.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="mb-3">
                          <p className="font-bold text-slate-900">{product.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {product.price.toLocaleString()} تومان
                          </p>
                        </div>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white transition hover:bg-green-700 disabled:opacity-50"
                          disabled={!orderId || allSettled || !isOrderEditable}
                          onClick={() => openAddItemModal(product)}
                          aria-label={`افزودن ${product.name}`}
                        >
                          +
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            {items.length > 0 && (
              <div className="mb-4 p-4 rounded bg-gray-100 border">
                <div className="text-sm text-gray-500">جمع سفارش فعلی</div>
                <div className="text-2xl font-bold">
                  {orderTotal.toLocaleString()} تومان
                </div>
              </div>
            )}

            {orderId && (
              <section className="rounded-xl bg-white p-4 shadow-sm md:p-5">
                <h2 className="mb-4 text-lg font-bold text-slate-900">
                  لیست آیتم‌های سفارش
                </h2>

                {items.length === 0 && (
                  <p className="text-sm text-slate-600">آیتمی ثبت نشده است.</p>
                )}

                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.itemId}
                      className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-sm text-slate-600">
                          تعداد: {item.quantity} | مبلغ:{" "}
                          {item.lineTotal.toLocaleString()} تومان
                        </p>
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {item.ownerType === "SHARED"
                            ? "مشترک"
                            : item.ownerName ?? "شخصی"}
                        </span>
                      </div>
                      <button
                        className="rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                        disabled={allSettled}
                        onClick={() => handleDeleteItem(item.itemId)}
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {orderId && (
              <section className="rounded-xl bg-white p-4 shadow-sm md:p-5">
                <h2 className="mb-4 text-lg font-bold text-slate-900">
                  تسویه سفارش #{orderId}
                </h2>

                {loadingSettlement && (
                  <p className="text-sm text-slate-600">در حال دریافت تسویه…</p>
                )}

                {!loadingSettlement && settlement && (
                  <div className="space-y-3">
                    {allSettled && (
                      <p className="rounded-lg bg-green-100 p-2 text-sm font-semibold text-green-700">
                        میز تسویه شد
                      </p>
                    )}

                    {people.map((person) => {
                      const remaining = getRemaining(person);
                      const paid = person.payable - remaining;
                      return (
                        <div
                          key={person.personId}
                          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <div className="mb-2 font-semibold text-slate-900">
                            {person.name}
                          </div>
                          <div className="space-y-1 text-sm text-slate-700">
                            <div>سفارش: {person.orderFinal.toLocaleString()} تومان</div>
                            <div>بازی: {person.gameTotal.toLocaleString()} تومان</div>
                            <div>
                              قابل پرداخت: {person.payable.toLocaleString()} تومان
                            </div>
                            <div>پرداخت‌شده: {paid.toLocaleString()} تومان</div>
                            <div
                              className={`font-bold ${
                                remaining > 0 ? "text-red-600" : "text-green-600"
                              }`}
                            >
                              باقیمانده: {remaining.toLocaleString()} تومان
                            </div>
                          </div>
                          <button
                            className="mt-3 w-fit rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                            disabled={remaining === 0 || allSettled}
                            onClick={() => openPaymentModal(person.personId)}
                          >
                            {remaining === 0 ? "تسویه شد" : "پرداخت"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      {showAddModal && selectedProduct && orderId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded p-4 w-full max-w-md space-y-3">
            <h3 className="font-bold">افزودن آیتم</h3>
            <p>
              {selectedProduct.name} - {selectedProduct.price.toLocaleString()} تومان
            </p>

            <label className="block">
              <span className="block mb-1">مشترک / شخصی</span>
              <select
                className="border rounded px-2 py-1 w-full"
                value={ownerType}
                onChange={(e) => setOwnerType(e.target.value as "SHARED" | "PERSON")}
              >
                <option value="SHARED">مشترک</option>
                <option value="PERSON">شخصی</option>
              </select>
            </label>

            {ownerType === "PERSON" && (
              <>
                <div className="mb-2">
                  <label className="block font-bold">انتخاب مشتری ثابت:</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={selectedCustomerId ?? ""}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value || null);
                      setCustomName("");
                    }}
                  >
                    <option value="">-- انتخاب از مشتری‌های ثابت --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-2">
                  <label className="block font-bold">یا وارد کردن اسم جدید:</label>
                  <input
                    className="w-full border p-2 rounded"
                    placeholder="مثلاً: حسین"
                    value={customName}
                    onChange={(e) => {
                      setCustomName(e.target.value);
                      setSelectedCustomerId(null);
                    }}
                  />
                </div>
              </>
            )}

            <label className="block">
              <span className="block mb-1">تعداد</span>
              <input
                type="number"
                min={1}
                className="border rounded px-2 py-1 w-full"
                value={itemQuantity}
                disabled={!isOrderEditable}
                onChange={(e) => setItemQuantity(e.target.value)}
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeAddItemModal}
                className="border px-3 py-1 rounded"
              >
                انصراف
              </button>
              <button
                onClick={submitAddItem}
                disabled={selectedProduct === null || !isOrderEditable}
                className="bg-blue-600 text-white px-3 py-1 rounded"
              >
                ثبت
              </button>
            </div>
          </div>
        </div>
      )}

      {payingPersonId !== null && selectedPerson && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded p-4 w-full max-w-md space-y-3">
            <h3 className="font-bold">ثبت پرداخت</h3>
            <p>شخص هدف: {selectedPerson.name}</p>

            <label className="block">
              <span className="block mb-1">پرداخت‌کننده</span>
              <select
                className="border rounded px-2 py-1 w-full"
                value={payerPersonId ?? ""}
                onChange={(e) => setPayerPersonId(Number(e.target.value))}
              >
                {people.map((person) => (
                  <option key={person.personId} value={person.personId}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block mb-1">نوع پرداخت</span>
              <select
                className="border rounded px-2 py-1 w-full"
                value={beneficiaryMode}
                onChange={(e) =>
                  setBeneficiaryMode(e.target.value as "PERSON" | "ALL")
                }
              >
                <option value="PERSON">پرداخت نفرمحور</option>
                <option value="ALL">پرداخت کلی</option>
              </select>
            </label>

            {beneficiaryMode === "PERSON" && (
              <label className="block">
                <span className="block mb-1">ذی‌نفع</span>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={beneficiaryPersonId ?? ""}
                  onChange={(e) => setBeneficiaryPersonId(Number(e.target.value))}
                >
                  {people.map((person) => (
                    <option key={person.personId} value={person.personId}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="block mb-1">مبلغ</span>
              <input
                type="number"
                min={1}
                className="border rounded px-2 py-1 w-full"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="block mb-1">روش پرداخت</span>
              <select
                className="border rounded px-2 py-1 w-full"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as "CASH" | "CARD" | "MANUAL")
                }
              >
                <option value="CASH">CASH</option>
                <option value="CARD">CARD</option>
                <option value="MANUAL">MANUAL</option>
              </select>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closePaymentModal}
                className="border px-3 py-1 rounded"
              >
                انصراف
              </button>
              <button
                onClick={submitPayment}
                className="bg-blue-600 text-white px-3 py-1 rounded"
              >
                ثبت پرداخت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
