"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  posGetTables,
  PosTableRow,
} from "@/lib/api";
import { clearPosAccessToken, hasPosAccessToken } from "@/lib/pos-auth";
import { getOrderState, loadOrderItems, loadPaidByPerson } from "@/lib/pos-store";
import { PosToast, PosToastState } from "../_components/pos-toast";

type PosVisualStatus = "FREE" | "OPEN" | "SETTLING";

type PosTableCard = PosTableRow & {
  visualStatus: PosVisualStatus;
  totalAmount: number;
  totalPaid: number;
  remainingDebt: number;
};

function statusLabel(status: PosVisualStatus): string {
  if (status === "FREE") {
    return "آزاد";
  }
  if (status === "SETTLING") {
    return "در حال تسویه";
  }
  return "سفارش باز";
}

function statusClasses(status: PosVisualStatus): string {
  if (status === "FREE") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (status === "SETTLING") {
    return "border-rose-300 bg-rose-50 text-rose-900";
  }
  return "border-orange-300 bg-orange-50 text-orange-900";
}

function statusBadgeClasses(status: PosVisualStatus): string {
  if (status === "FREE") {
    return "bg-emerald-600 text-white";
  }
  if (status === "SETTLING") {
    return "bg-rose-600 text-white";
  }
  return "bg-orange-500 text-white";
}

function deriveVisualStatus(table: PosTableRow): PosVisualStatus {
  if (table.status === "free") {
    return "FREE";
  }
  if (table.openOrderStatus === "SETTLING") {
    return "SETTLING";
  }
  if (table.openOrderId && getOrderState(table.openOrderId) === "SETTLING") {
    return "SETTLING";
  }
  return "OPEN";
}

function computeCardFinancial(table: PosTableRow): {
  totalAmount: number;
  totalPaid: number;
  remainingDebt: number;
} {
  if (!table.openOrderId) {
    return {
      totalAmount: 0,
      totalPaid: 0,
      remainingDebt: 0,
    };
  }

  const localItems = loadOrderItems(table.openOrderId);
  const localItemsTotal = localItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalAmount = table.openOrderTotal ?? localItemsTotal;

  const paidByPerson = loadPaidByPerson(table.openOrderId);
  const totalPaid = Object.values(paidByPerson).reduce(
    (sum, paid) => sum + (Number.isInteger(paid) && paid > 0 ? paid : 0),
    0,
  );

  return {
    totalAmount,
    totalPaid,
    remainingDebt: Math.max(totalAmount - totalPaid, 0),
  };
}

function formatMoney(value: number): string {
  return `${value.toLocaleString()} تومان`;
}

export default function PosTablesPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<PosTableRow[]>([]);
  const [toast, setToast] = useState<PosToastState>(null);

  const showToast = useCallback((nextToast: NonNullable<PosToastState>) => {
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((current) => (current === nextToast ? null : current));
    }, 3600);
  }, []);

  const loadTables = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const data = await posGetTables();
      setTables(Array.isArray(data) ? data : []);
    } catch (error) {
      if (options?.silent) {
        return;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!hasPosAccessToken()) {
      router.replace("/pos/login");
      return;
    }

    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let isMounted = true;
    async function run() {
      try {
        await loadTables();
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : "خطا در دریافت میزها";
        if (isMounted) {
          showToast({ kind: "error", message });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    run();

    const onFocus = () => {
      void loadTables({ silent: true });
    };

    const intervalId = window.setInterval(() => {
      void loadTables({ silent: true });
    }, 5000);

    window.addEventListener("focus", onFocus);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [authReady, loadTables, showToast]);

  const cards = useMemo<PosTableCard[]>(() => {
    return tables.map((table) => {
      const financial = computeCardFinancial(table);
      return {
        ...table,
        visualStatus: deriveVisualStatus(table),
        ...financial,
      };
    });
  }, [tables]);

  const handleCardClick = useCallback(
    async (table: PosTableCard) => {
      if (table.visualStatus === "FREE") {
        router.push(`/pos/tables/${table.tableId}`);
        return;
      }

      if (!table.openOrderId) {
        showToast({
          kind: "error",
          message: "شناسه سفارش فعال برای میز پیدا نشد",
        });
        return;
      }

      if (table.visualStatus === "SETTLING") {
        router.push(`/pos/payment/${table.openOrderId}?tableId=${table.tableId}`);
        return;
      }

      router.push(`/pos/tables/${table.tableId}`);
    },
    [router, showToast],
  );

  if (!authReady) {
    return null;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4">
        <p className="text-center text-base text-slate-700">در حال بارگذاری میزها...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-2xl bg-white px-4 py-4 shadow-sm md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900">POS - میزها</h1>
              <p className="mt-1 text-sm text-slate-600">
                روی میز بزنید: آزاد = شروع سفارش، باز = ورود سفارش، تسویه = پرداخت
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearPosAccessToken();
                router.replace("/pos/login");
              }}
              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            >
              خروج از میزها
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((table) => (
            <button
              key={table.tableId}
              type="button"
              onClick={() => void handleCardClick(table)}
              className={`min-h-52 rounded-2xl border-2 p-4 text-right shadow-sm transition active:scale-[0.98] disabled:opacity-50 ${statusClasses(table.visualStatus)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-4xl font-black leading-none">میز {table.tableNo}</div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClasses(table.visualStatus)}`}
                >
                  {statusLabel(table.visualStatus)}
                </span>
              </div>

              {table.visualStatus === "FREE" ? (
                <div className="mt-10 rounded-xl border border-emerald-200 bg-white/60 px-3 py-2 text-sm font-semibold text-emerald-900">
                  آماده ثبت سفارش جدید
                </div>
              ) : (
                <div className="mt-5 space-y-2 rounded-xl bg-white/70 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">جمع سفارش</span>
                    <span className="font-bold text-slate-900">
                      {formatMoney(table.totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">پرداخت‌شده</span>
                    <span className="font-bold text-slate-900">
                      {formatMoney(table.totalPaid)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                    <span className="text-sm font-semibold text-slate-800">باقی‌مانده</span>
                    <span className="text-lg font-black text-rose-700">
                      {formatMoney(table.remainingDebt)}
                    </span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </section>
      </div>

      <PosToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
