"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ApiError,
  posApplyGameDiscount,
  posCreatePayment,
  posGetSettlement,
  posGetTables,
  PosSettlementPerson,
  PosSettlementResponse,
} from "@/lib/api";
import { hasPosAccessToken } from "@/lib/pos-auth";
import { clearOrderLocalState } from "@/lib/pos-store";
import { PosToast, PosToastState } from "../../_components/pos-toast";

type PaymentMethod = "CASH" | "CARD";
type PersonType = "PLAY" | "ORDER" | "BOTH";

function mapErrorToToast(error: unknown): NonNullable<PosToastState> {
  if (error instanceof ApiError) {
    return {
      kind: error.statusCode === 409 ? "conflict" : "error",
      message: error.message,
    };
  }
  return {
    kind: "error",
    message: "خطای غیرمنتظره رخ داد",
  };
}

function toNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function resolvePersonDebt(person: PosSettlementPerson): number {
  return toNonNegativeInt(person.debt) ?? 0;
}

function resolvePersonGameTotal(person: PosSettlementPerson): number {
  return toNonNegativeInt(person.gameTotal) ?? 0;
}

function resolvePersonGameDiscount(person: PosSettlementPerson): number {
  return toNonNegativeInt(person.gameDiscount) ?? 0;
}

function normalizePersonType(type: PosSettlementPerson["type"]): PersonType {
  const raw = typeof type === "string" ? type.toUpperCase() : "ORDER";
  if (raw === "PLAY" || raw === "ORDER" || raw === "BOTH") {
    return raw;
  }
  return "ORDER";
}

function personTypeBadgeClasses(type: PersonType): string {
  if (type === "PLAY") {
    return "bg-violet-100 text-violet-900";
  }
  if (type === "BOTH") {
    return "bg-sky-100 text-sky-900";
  }
  return "bg-amber-100 text-amber-900";
}

function personTypeLabel(type: PersonType): string {
  if (type === "PLAY") {
    return "فقط بازی";
  }
  if (type === "ORDER") {
    return "فقط سفارش";
  }
  return "بازی و سفارش";
}

function paymentMethodLabel(method: PaymentMethod): string {
  if (method === "CARD") {
    return "کارت";
  }
  return "نقدی";
}

function settlementTotalDebt(settlement: PosSettlementResponse | null): number | null {
  if (!settlement) {
    return null;
  }
  return (
    toNonNegativeInt(settlement.summary?.totalDebt) ??
    toNonNegativeInt(settlement.totalDebt) ??
    null
  );
}

function formatMoney(value: number): string {
  return `${value.toLocaleString()} تومان`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default function PosPaymentPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId = Number(params.orderId);

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [discountSubmitting, setDiscountSubmitting] = useState(false);
  const [closingSuccess, setClosingSuccess] = useState(false);
  const [settlement, setSettlement] = useState<PosSettlementResponse | null>(null);
  const [toast, setToast] = useState<PosToastState>(null);

  const [payerPersonId, setPayerPersonId] = useState<number | null>(null);
  const [amountText, setAmountText] = useState("");
  const [discountPercentText, setDiscountPercentText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");

  const redirectTimerRef = useRef<number | null>(null);

  const showToast = useCallback((nextToast: NonNullable<PosToastState>) => {
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((current) => (current === nextToast ? null : current));
    }, 3600);
  }, []);

  const refreshSettlement = useCallback(async (): Promise<PosSettlementResponse> => {
    const data = await posGetSettlement(orderId);
    setSettlement(data);
    return data;
  }, [orderId]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
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

    if (!Number.isInteger(orderId) || orderId <= 0) {
      setLoading(false);
      setToast({ kind: "error", message: "شناسه سفارش نامعتبر است" });
      return;
    }

    let isMounted = true;
    async function run() {
      try {
        await refreshSettlement();
      } catch (error) {
        if (isMounted) {
          showToast(mapErrorToToast(error));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      isMounted = false;
    };
  }, [authReady, orderId, refreshSettlement, showToast]);

  const people = useMemo(() => settlement?.people ?? [], [settlement]);
  const totalDebt = settlementTotalDebt(settlement);

  const selectedPerson = useMemo(() => {
    if (payerPersonId == null) {
      return null;
    }
    return people.find((person) => person.personId === payerPersonId) ?? null;
  }, [payerPersonId, people]);

  const selectedDebt = selectedPerson ? resolvePersonDebt(selectedPerson) : 0;
  const selectedGameTotal = selectedPerson
    ? resolvePersonGameTotal(selectedPerson)
    : 0;
  const selectedGameDiscount = selectedPerson
    ? resolvePersonGameDiscount(selectedPerson)
    : 0;

  useEffect(() => {
    if (people.length === 0) {
      setPayerPersonId(null);
      setAmountText("");
      setDiscountPercentText("");
      return;
    }

    const found = payerPersonId
      ? people.find((person) => person.personId === payerPersonId)
      : null;

    if (!found) {
      const firstWithDebt = people.find((person) => resolvePersonDebt(person) > 0);
      const fallback = firstWithDebt ?? people[0];
      setPayerPersonId(fallback.personId);
      const fallbackDebt = resolvePersonDebt(fallback);
      setAmountText(fallbackDebt > 0 ? String(fallbackDebt) : "");
      setDiscountPercentText("");
    }
  }, [payerPersonId, people]);

  const handleSelectPerson = useCallback((person: PosSettlementPerson) => {
    const debt = resolvePersonDebt(person);
    setPayerPersonId(person.personId);
    setAmountText(debt > 0 ? String(debt) : "");
    setDiscountPercentText("");
  }, []);

  const isClosedStatus = useCallback((row: PosSettlementResponse): boolean => {
    if (typeof row.status !== "string") {
      return false;
    }
    return row.status.toUpperCase() === "CLOSED";
  }, []);

  const shouldRedirectAfterPayment = useCallback(
    async (nextSettlement: PosSettlementResponse): Promise<boolean> => {
      if (isClosedStatus(nextSettlement)) {
        return true;
      }

      const tables = await posGetTables();
      return !tables.some((table) => table.openOrderId === orderId);
    },
    [isClosedStatus, orderId],
  );

  async function handleSubmitPayment() {
    if (!settlement) {
      showToast({ kind: "error", message: "اطلاعات تسویه در دسترس نیست" });
      return;
    }
    if (payerPersonId == null) {
      showToast({ kind: "error", message: "نفر پرداخت‌کننده را انتخاب کنید" });
      return;
    }

    const person = people.find((item) => item.personId === payerPersonId);
    if (!person) {
      showToast({ kind: "error", message: "نفر انتخاب‌شده نامعتبر است" });
      return;
    }

    const debt = resolvePersonDebt(person);
    if (debt <= 0) {
      showToast({ kind: "conflict", message: "این نفر بدهی ندارد" });
      return;
    }

    const amount = Number(amountText);
    if (!Number.isInteger(amount) || amount <= 0) {
      showToast({ kind: "error", message: "مبلغ نامعتبر است" });
      return;
    }
    if (amount > debt) {
      showToast({ kind: "conflict", message: "مبلغ بیشتر از بدهی نفر است" });
      return;
    }

    setSubmitting(true);
    try {
      await posCreatePayment(orderId, {
        payerPersonId,
        amount,
        method,
      });

      const nextSettlement = await refreshSettlement();

      if (await shouldRedirectAfterPayment(nextSettlement)) {
        clearOrderLocalState(orderId);
        setClosingSuccess(true);
        redirectTimerRef.current = window.setTimeout(() => {
          router.replace("/pos/tables");
        }, 1000);
        return;
      }

      const refreshedSelected = nextSettlement.people.find(
        (item) => item.personId === payerPersonId,
      );
      if (refreshedSelected) {
        const nextDebt = resolvePersonDebt(refreshedSelected);
        setAmountText(nextDebt > 0 ? String(nextDebt) : "");
      }

      showToast({ kind: "success", message: "پرداخت ثبت شد" });
    } catch (error) {
      showToast(mapErrorToToast(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyGameDiscount() {
    if (!settlement) {
      showToast({ kind: "error", message: "اطلاعات تسویه در دسترس نیست" });
      return;
    }
    if (payerPersonId == null) {
      showToast({ kind: "error", message: "نفر را انتخاب کنید" });
      return;
    }

    const person = people.find((item) => item.personId === payerPersonId);
    if (!person) {
      showToast({ kind: "error", message: "نفر انتخاب‌شده نامعتبر است" });
      return;
    }

    const personGameTotal = resolvePersonGameTotal(person);
    if (personGameTotal <= 0) {
      showToast({ kind: "conflict", message: "این نفر سهم بازی ندارد" });
      return;
    }

    const discountPercent = Number(discountPercentText);
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      showToast({ kind: "error", message: "درصد تخفیف باید بین ۱ تا ۱۰۰ باشد" });
      return;
    }

    const discountAmount = Math.floor((personGameTotal * discountPercent) / 100);
    if (discountAmount <= 0) {
      showToast({
        kind: "conflict",
        message: "این درصد برای سهم بازی این نفر تخفیف صفر می‌دهد",
      });
      return;
    }

    setDiscountSubmitting(true);
    try {
      await posApplyGameDiscount(orderId, {
        personId: payerPersonId,
        discountAmount,
      });

      const nextSettlement = await refreshSettlement();
      const refreshedSelected = nextSettlement.people.find(
        (item) => item.personId === payerPersonId,
      );
      if (refreshedSelected) {
        const nextDebt = resolvePersonDebt(refreshedSelected);
        setAmountText(nextDebt > 0 ? String(nextDebt) : "");
      }
      setDiscountPercentText("");
      showToast({ kind: "success", message: "تخفیف بازی ثبت شد" });
    } catch (error) {
      showToast(mapErrorToToast(error));
    } finally {
      setDiscountSubmitting(false);
    }
  }

  function handlePrintSelectedPerson() {
    if (!selectedPerson) {
      showToast({ kind: "error", message: "ابتدا یک نفر را انتخاب کنید" });
      return;
    }

    const gameTotal = resolvePersonGameTotal(selectedPerson);
    const gameDiscount = resolvePersonGameDiscount(selectedPerson);
    const paid =
      typeof selectedPerson.paid === "number" && Number.isFinite(selectedPerson.paid)
        ? Math.max(selectedPerson.paid, 0)
        : 0;
    const debt = resolvePersonDebt(selectedPerson);
    const nowText = new Date().toLocaleString("fa-IR");

    const popup = window.open("", "_blank", "width=420,height=640");
    if (!popup) {
      showToast({
        kind: "error",
        message: "مرورگر اجازه باز شدن پنجره چاپ را نداد",
      });
      return;
    }

    const html = `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>فیش تسویه ${escapeHtml(selectedPerson.name)} - سفارش #${orderId}</title>
    <style>
      body { font-family: Tahoma, Arial, sans-serif; padding: 16px; color: #0f172a; }
      .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; }
      .title { font-weight: 700; font-size: 18px; margin-bottom: 8px; }
      .row { display: flex; justify-content: space-between; gap: 8px; margin: 6px 0; }
      .label { color: #475569; }
      .value { font-weight: 700; }
      .danger { color: #be123c; }
      .ok { color: #166534; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title">فیش تسویه نفر</div>
      <div class="row"><span class="label">شماره سفارش</span><span class="value">#${orderId}</span></div>
      <div class="row"><span class="label">تاریخ</span><span class="value">${escapeHtml(nowText)}</span></div>
      <div class="row"><span class="label">نام نفر</span><span class="value">${escapeHtml(selectedPerson.name)}</span></div>
      <div class="row"><span class="label">نوع نفر</span><span class="value">${escapeHtml(personTypeLabel(normalizePersonType(selectedPerson.type)))}</span></div>
      <div class="row"><span class="label">روش پرداخت انتخابی</span><span class="value">${escapeHtml(paymentMethodLabel(method))}</span></div>
      <div class="row"><span class="label">سهم بازی</span><span class="value">${formatMoney(gameTotal)}</span></div>
      <div class="row"><span class="label">تخفیف بازی</span><span class="value ok">${formatMoney(gameDiscount)}</span></div>
      <div class="row"><span class="label">پرداخت‌شده</span><span class="value">${formatMoney(paid)}</span></div>
      <div class="row"><span class="label">بدهی باقی‌مانده</span><span class="value danger">${formatMoney(debt)}</span></div>
    </div>
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () {
          window.print();
          window.close();
        }, 120);
      });
    </script>
  </body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  if (!authReady) {
    return null;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4">
        <p className="text-center text-base text-slate-700">در حال بارگذاری...</p>
      </main>
    );
  }

  if (closingSuccess) {
    return (
      <main className="min-h-screen bg-slate-100 p-4">
        <div className="mx-auto mt-20 max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
          <p className="text-xl font-black text-emerald-900">سفارش با موفقیت بسته شد</p>
          <p className="mt-2 text-sm text-emerald-800">در حال بازگشت به میزها...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900">پرداخت سفارش #{orderId}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {totalDebt !== null
                  ? `بدهی کل: ${formatMoney(totalDebt)}`
                  : "تسویه نفرات را انتخاب و پرداخت را ثبت کنید"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/pos/tables")}
              className="min-h-12 rounded-xl border border-slate-300 px-5 text-base font-semibold text-slate-800"
            >
              بازگشت به میزها
            </button>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <article className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-black text-slate-900">نفرات و بدهی</h2>

            {people.length === 0 ? (
              <p className="text-sm text-slate-600">نفری برای تسویه پیدا نشد.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {people.map((person) => {
                  const type = normalizePersonType(person.type);
                  const debt = resolvePersonDebt(person);
                  const gameTotal = resolvePersonGameTotal(person);
                  const gameDiscount = resolvePersonGameDiscount(person);
                  const isPaid = debt === 0;
                  const isSelected = payerPersonId === person.personId;

                  return (
                    <button
                      key={person.personId}
                      type="button"
                      onClick={() => handleSelectPerson(person)}
                      disabled={isPaid}
                      className={`rounded-2xl border-2 p-4 text-right shadow-sm transition-all duration-200 ${
                        isPaid
                          ? "border-emerald-300 bg-emerald-50 opacity-80"
                          : "border-rose-300 bg-rose-50 hover:scale-[1.01]"
                      } ${isSelected ? "ring-2 ring-slate-900" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xl font-black text-slate-900">{person.name}</h3>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${personTypeBadgeClasses(type)}`}
                        >
                          {personTypeLabel(type)}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="text-xs font-semibold text-slate-600">
                          سهم بازی: {formatMoney(gameTotal)}
                        </div>
                        {gameDiscount > 0 ? (
                          <div className="mt-1 text-xs font-semibold text-emerald-700">
                            تخفیف بازی: {formatMoney(gameDiscount)}
                          </div>
                        ) : null}
                        <div className="text-xs font-semibold text-slate-600">بدهی فعلی</div>
                        <div
                          className={`mt-1 text-2xl font-black ${
                            isPaid ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatMoney(debt)}
                        </div>
                        {typeof person.paid === "number" ? (
                          <div className="mt-1 text-xs font-semibold text-slate-600">
                            پرداخت‌شده: {formatMoney(person.paid)}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3 min-h-7">
                        {isPaid ? (
                          <span className="inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                            پرداخت شد
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-black text-slate-900">ثبت پرداخت</h2>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">پرداخت‌کننده انتخاب‌شده</div>
                <div className="mt-1 text-base font-black text-slate-900">
                  {selectedPerson?.name ?? "انتخاب نشده"}
                </div>
                {selectedPerson ? (
                  <>
                    <div className="mt-1 text-sm font-semibold text-slate-700">
                      سهم بازی: {formatMoney(selectedGameTotal)}
                    </div>
                    {selectedGameDiscount > 0 ? (
                      <div className="mt-1 text-sm font-semibold text-emerald-700">
                        تخفیف بازی: {formatMoney(selectedGameDiscount)}
                      </div>
                    ) : null}
                    <div className="mt-1 text-sm font-semibold text-rose-700">
                      بدهی: {formatMoney(selectedDebt)}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">تخفیف بازی این نفر</div>
                <div className="mt-2 grid gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={discountPercentText}
                    onChange={(event) => setDiscountPercentText(event.target.value)}
                    placeholder="درصد تخفیف (۱ تا ۱۰۰)"
                    className="min-h-11 w-full rounded-xl border border-slate-300 px-3"
                  />
                  {selectedPerson ? (
                    <div className="text-xs font-semibold text-slate-600">
                      مبلغ تخفیف محاسبه‌شده:{" "}
                      {formatMoney(
                        Math.floor(
                          (selectedGameTotal *
                            Math.max(
                              0,
                              Math.min(100, Number(discountPercentText) || 0),
                            )) /
                            100,
                        ),
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleApplyGameDiscount()}
                    disabled={
                      discountSubmitting ||
                      submitting ||
                      !selectedPerson ||
                      selectedGameTotal <= 0
                    }
                    className="min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    {discountSubmitting ? "در حال ثبت تخفیف..." : "ثبت تخفیف بازی"}
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">مبلغ</span>
                <input
                  type="number"
                  min={1}
                  value={amountText}
                  onChange={(event) => setAmountText(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-slate-300 px-3"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  روش پرداخت
                </span>
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                  className="min-h-12 w-full rounded-xl border border-slate-300 px-3"
                >
                  <option value="CASH">نقدی</option>
                  <option value="CARD">کارت</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => void handleSubmitPayment()}
                disabled={
                  submitting ||
                  discountSubmitting ||
                  !selectedPerson ||
                  selectedDebt <= 0
                }
                className="min-h-12 w-full rounded-xl bg-emerald-600 px-4 text-base font-black text-white disabled:opacity-50"
              >
                {submitting ? "در حال ثبت..." : "ثبت پرداخت"}
              </button>

              <button
                type="button"
                onClick={handlePrintSelectedPerson}
                disabled={submitting || discountSubmitting || !selectedPerson}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-800 disabled:opacity-50"
              >
                چاپ فیش نفر انتخاب‌شده
              </button>
            </div>
          </article>
        </section>
      </div>

      <PosToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
