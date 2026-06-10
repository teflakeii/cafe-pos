"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ApiError,
  posAddOrderItem,
  posCreateOrder,
  posCreateParticipant,
  posDeleteOrderItem,
  posGetMenuItems,
  posGetParticipantNames,
  posGetSettlement,
  posGetTablePeople,
  posGetTables,
  posSettleOrder,
  posStartGame,
  posStopGame,
  PosMenuItem,
  PosSettlementResponse,
  PosTablePerson,
  PosTableRow,
} from "@/lib/api";
import {
  clearOrderLocalState,
  getOrderState,
  loadOrderItems,
  loadPaidByPerson,
  PosOrderState,
  PosStoredItem,
  saveOrderItems,
  setOrderState,
} from "@/lib/pos-store";
import { hasPosAccessToken } from "@/lib/pos-auth";
import { PosToast, PosToastState } from "../../_components/pos-toast";

const GAME_RATE_PER_HOUR = 50000;

type OwnerType = "SHARED" | "PERSON";
type ParticipantType = "PLAY" | "ORDER" | "BOTH";
type VisualOrderStatus = "FREE" | "OPEN" | "SETTLING";
const CUSTOM_PARTICIPANT_OPTION = "__custom__";
const OWNER_CUSTOM_PARTICIPANT_OPTION = "__owner_custom__";
const GLOBAL_PARTICIPANT_NAMES_STORAGE_KEY = "pos-global-participant-names";
type PersistedGameSession = {
  sessionId: number;
  startedAtMs: number;
  active: boolean;
};

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

function includesShiftClosedMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("shift") &&
    (normalized.includes("closed") || normalized.includes("active shift"))
  );
}

function statusLabel(status: VisualOrderStatus): string {
  if (status === "FREE") {
    return "آزاد";
  }
  if (status === "SETTLING") {
    return "در حال تسویه";
  }
  return "در حال سفارش";
}

function statusBadgeClass(status: VisualOrderStatus): string {
  if (status === "FREE") {
    return "bg-emerald-600 text-white";
  }
  if (status === "SETTLING") {
    return "bg-rose-600 text-white";
  }
  return "bg-orange-500 text-white";
}

function participantTypeLabel(type: ParticipantType): string {
  if (type === "PLAY") {
    return "فقط بازی";
  }
  if (type === "ORDER") {
    return "فقط سفارش";
  }
  return "بازی و سفارش";
}

function participantTypeClass(type: ParticipantType): string {
  if (type === "PLAY") {
    return "bg-violet-100 text-violet-900";
  }
  if (type === "ORDER") {
    return "bg-amber-100 text-amber-900";
  }
  return "bg-sky-100 text-sky-900";
}

function resolveTableStatus(
  table: PosTableRow | null,
  orderState: PosOrderState | null,
): VisualOrderStatus {
  if (!table || table.status === "free" || !table.openOrderId) {
    return "FREE";
  }
  if (orderState === "SETTLING") {
    return "SETTLING";
  }
  return "OPEN";
}

function formatMoney(value: number): string {
  return `${value.toLocaleString()} تومان`;
}

function formatTimer(secondsTotal: number): string {
  const safeSeconds = Math.max(0, secondsTotal);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function calculateLiveGameAmount(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) {
    return 0;
  }
  return Math.round((GAME_RATE_PER_HOUR * elapsedSeconds) / 3600);
}

function normalizeGlobalNames(rows: string[]): string[] {
  return Array.from(
    new Set(
      rows
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right, "fa"));
}

function readCachedGlobalNames(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(GLOBAL_PARTICIPANT_NAMES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeGlobalNames(
      parsed.filter((value): value is string => typeof value === "string"),
    );
  } catch {
    return [];
  }
}

function writeCachedGlobalNames(rows: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    GLOBAL_PARTICIPANT_NAMES_STORAGE_KEY,
    JSON.stringify(normalizeGlobalNames(rows)),
  );
}

function gameSessionStorageKey(tableId: number): string {
  return `pos-game-session:${tableId}`;
}

function readPersistedGameSession(tableId: number): PersistedGameSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(gameSessionStorageKey(tableId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedGameSession;
    if (
      !parsed ||
      !Number.isInteger(parsed.sessionId) ||
      !Number.isInteger(parsed.startedAtMs) ||
      typeof parsed.active !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistGameSession(
  tableId: number,
  value: PersistedGameSession | null,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const key = gameSessionStorageKey(tableId);
  if (!value) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function settlementGrandTotal(settlement: PosSettlementResponse | null): number | null {
  if (!settlement) {
    return null;
  }
  if (typeof settlement.summary?.grandTotal === "number") {
    return settlement.summary.grandTotal;
  }
  if (typeof settlement.totalDebt === "number") {
    return settlement.totalDebt;
  }
  return null;
}

function settlementRemainingTotal(
  settlement: PosSettlementResponse | null,
): number | null {
  if (!settlement || !Array.isArray(settlement.people) || settlement.people.length === 0) {
    return null;
  }

  const hasExplicitDebt = settlement.people.some(
    (person) =>
      typeof person.debt === "number" || typeof person.remaining === "number",
  );

  if (!hasExplicitDebt) {
    return null;
  }

  return settlement.people.reduce((sum, person) => {
    const debt =
      typeof person.debt === "number"
        ? person.debt
        : typeof person.remaining === "number"
          ? person.remaining
          : 0;
    return sum + Math.max(debt, 0);
  }, 0);
}

export default function PosTableDetailPage() {
  const params = useParams<{ tableId: string }>();
  const router = useRouter();
  const tableId = Number(params.tableId);

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<PosTableRow | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderState, setCurrentOrderState] = useState<PosOrderState | null>(null);
  const [orderLocked, setOrderLocked] = useState(false);
  const [isShiftClosed, setIsShiftClosed] = useState(false);

  const [people, setPeople] = useState<PosTablePerson[]>([]);
  const [menuItems, setMenuItems] = useState<PosMenuItem[]>([]);
  const [items, setItems] = useState<PosStoredItem[]>([]);
  const [settlement, setSettlement] = useState<PosSettlementResponse | null>(null);
  const [paidTotal, setPaidTotal] = useState(0);

  const [toast, setToast] = useState<PosToastState>(null);

  const [globalParticipantNames, setGlobalParticipantNames] = useState<string[]>(
    () => readCachedGlobalNames(),
  );
  const [participantNameSelection, setParticipantNameSelection] = useState("");
  const [participantCustomName, setParticipantCustomName] = useState("");
  const [participantType, setParticipantType] = useState<ParticipantType>("BOTH");

  const [selectedMenuItemId, setSelectedMenuItemId] = useState<number | null>(null);
  const [qtyText, setQtyText] = useState("1");
  const [ownerType, setOwnerType] = useState<OwnerType>("SHARED");
  const [ownerPersonNameSelection, setOwnerPersonNameSelection] = useState("");
  const [ownerPersonCustomName, setOwnerPersonCustomName] = useState("");

  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submittingParticipant, setSubmittingParticipant] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [settling, setSettling] = useState(false);

  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [gameStartedAtMs, setGameStartedAtMs] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [gameBusy, setGameBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const previousOrderIdRef = useRef<number | null>(null);

  const showToast = useCallback((nextToast: NonNullable<PosToastState>) => {
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((current) => (current === nextToast ? null : current));
    }, 3600);
  }, []);

  const refreshPeople = useCallback(async () => {
    const data = await posGetTablePeople(tableId);
    setPeople(Array.isArray(data) ? data : []);
  }, [tableId]);

  const refreshSettlement = useCallback(
    async (targetOrderId: number | null, options?: { silent?: boolean }) => {
      if (!targetOrderId) {
        setSettlement(null);
        return;
      }

      try {
        const data = await posGetSettlement(targetOrderId);
        setSettlement(data);
        setIsShiftClosed(false);
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 403) {
          setIsShiftClosed(true);
        }

        if (!options?.silent && error instanceof ApiError && error.statusCode >= 500) {
          showToast(mapErrorToToast(error));
        }

        setSettlement(null);
      }
    },
    [showToast],
  );

  const refreshBase = useCallback(async () => {
    const [tableRows, menuRows, participantNameRows] = await Promise.all([
      posGetTables(),
      posGetMenuItems(),
      posGetParticipantNames().catch(() => [] as string[]),
    ]);
    const selectedTable = tableRows.find((row) => row.tableId === tableId) ?? null;
    setTable(selectedTable);
    setMenuItems(Array.isArray(menuRows) ? menuRows : []);
    setGlobalParticipantNames((previous) => {
      const next = normalizeGlobalNames([
        ...previous,
        ...readCachedGlobalNames(),
        ...(Array.isArray(participantNameRows) ? participantNameRows : []),
      ]);
      writeCachedGlobalNames(next);
      return next;
    });

    if (selectedTable?.openOrderId) {
      const activeOrderId = selectedTable.openOrderId;
      previousOrderIdRef.current = activeOrderId;
      setOrderId(activeOrderId);
      const backendState = selectedTable.openOrderStatus;
      const nextOrderState: PosOrderState =
        backendState === "SETTLING"
          ? "SETTLING"
          : backendState === "OPEN"
            ? "OPEN"
            : getOrderState(activeOrderId) ?? "OPEN";
      setCurrentOrderState(nextOrderState);
      setOrderState(activeOrderId, nextOrderState);
      setItems(loadOrderItems(activeOrderId));
      const paidMap = loadPaidByPerson(activeOrderId);
      setPaidTotal(
        Object.values(paidMap).reduce((sum, paid) => sum + Math.max(paid, 0), 0),
      );
      setOrderLocked(false);
      await refreshPeople();
      if (nextOrderState === "SETTLING") {
        await refreshSettlement(activeOrderId, { silent: true });
      } else {
        setSettlement(null);
      }
      return;
    }

    const previousOrderId = previousOrderIdRef.current;
    if (previousOrderId !== null) {
      clearOrderLocalState(previousOrderId);
      setOrderLocked(true);
    } else {
      setOrderLocked(false);
    }

    previousOrderIdRef.current = null;
    setOrderId(null);
    setCurrentOrderState(null);
    setItems([]);
    setPaidTotal(0);
    setSettlement(null);
    await refreshPeople();
  }, [refreshPeople, refreshSettlement, tableId]);

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

    if (!Number.isInteger(tableId) || tableId <= 0) {
      setLoading(false);
      setToast({ kind: "error", message: "شناسه میز نامعتبر است" });
      return;
    }

    const persisted = readPersistedGameSession(tableId);
    if (persisted && persisted.active) {
      setGameSessionId(persisted.sessionId);
      setGameStartedAtMs(persisted.startedAtMs);
      setGameActive(true);
      setNow(Date.now());
    } else {
      persistGameSession(tableId, null);
      setGameSessionId(null);
      setGameStartedAtMs(null);
      setGameActive(false);
    }

    let isMounted = true;
    async function run() {
      try {
        await refreshBase();
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

    const onFocus = () => {
      void refreshBase();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [authReady, refreshBase, showToast, tableId]);

  useEffect(() => {
    if (!gameActive || !gameStartedAtMs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [gameActive, gameStartedAtMs]);

  useEffect(() => {
    if (ownerType === "SHARED") {
      if (ownerPersonNameSelection) {
        setOwnerPersonNameSelection("");
      }
      if (ownerPersonCustomName) {
        setOwnerPersonCustomName("");
      }
    }
  }, [ownerPersonCustomName, ownerPersonNameSelection, ownerType]);

  useEffect(() => {
    if (
      ownerPersonNameSelection !== OWNER_CUSTOM_PARTICIPANT_OPTION &&
      ownerPersonCustomName
    ) {
      setOwnerPersonCustomName("");
    }
  }, [ownerPersonCustomName, ownerPersonNameSelection]);

  useEffect(() => {
    if (
      participantNameSelection !== CUSTOM_PARTICIPANT_OPTION &&
      participantCustomName
    ) {
      setParticipantCustomName("");
    }
  }, [participantCustomName, participantNameSelection]);

  const visualStatus = useMemo(
    () => resolveTableStatus(table, orderState),
    [table, orderState],
  );

  const canEditOrder = orderState === "OPEN" && !orderLocked;
  const isUiLocked = orderLocked;

  const localOrderTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.lineTotal, 0),
    [items],
  );

  const headerTotal = useMemo(() => {
    const settlementTotal = settlementGrandTotal(settlement);
    if (settlementTotal !== null) {
      return settlementTotal;
    }
    if (typeof table?.openOrderTotal === "number") {
      return table.openOrderTotal;
    }
    return localOrderTotal;
  }, [localOrderTotal, settlement, table?.openOrderTotal]);

  const headerRemaining = useMemo(() => {
    const remainingFromSettlement = settlementRemainingTotal(settlement);
    if (remainingFromSettlement !== null) {
      return remainingFromSettlement;
    }
    return Math.max(headerTotal - paidTotal, 0);
  }, [headerTotal, paidTotal, settlement]);

  const eligibleOwnerPeople = useMemo(
    () => people.filter((person) => person.type === "ORDER" || person.type === "BOTH"),
    [people],
  );

  const participantSummary = useMemo(() => {
    const summary: Record<ParticipantType, number> = {
      BOTH: 0,
      ORDER: 0,
      PLAY: 0,
    };

    for (const person of people) {
      if (person.type === "BOTH" || person.type === "ORDER" || person.type === "PLAY") {
        summary[person.type] += 1;
      }
    }

    return summary;
  }, [people]);

  const ownerNameOptions = useMemo(
    () =>
      normalizeGlobalNames([
        ...globalParticipantNames,
        ...eligibleOwnerPeople.map((person) => person.name),
      ]),
    [eligibleOwnerPeople, globalParticipantNames],
  );

  const peopleById = useMemo(() => {
    return new Map(people.map((person) => [person.id, person.name]));
  }, [people]);

  const elapsedGameSeconds =
    gameActive && gameStartedAtMs
      ? Math.max(Math.floor((now - gameStartedAtMs) / 1000), 0)
      : 0;
  const liveGameAmountPerPerson = calculateLiveGameAmount(elapsedGameSeconds);
  const gameEligibleCount =
    participantSummary.PLAY + participantSummary.BOTH;
  const liveGameAmountTotal =
    gameEligibleCount > 0 ? liveGameAmountPerPerson * gameEligibleCount : 0;

  async function handleStartOrder() {
    if (!table || isUiLocked) {
      return;
    }

    setSubmittingOrder(true);
    try {
      const order = await posCreateOrder(table.tableId);
      setOrderLocked(false);
      setIsShiftClosed(false);
      setOrderId(order.id);
      setCurrentOrderState("OPEN");
      setOrderState(order.id, "OPEN");
      setItems(loadOrderItems(order.id));
      previousOrderIdRef.current = order.id;
      await refreshBase();
      showToast({ kind: "success", message: "سفارش با موفقیت ایجاد شد" });
    } catch (error) {
      if (error instanceof ApiError && includesShiftClosedMessage(error.message)) {
        setIsShiftClosed(true);
      }
      showToast(mapErrorToToast(error));
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function handleAddParticipant() {
    if (!orderId) {
      showToast({ kind: "error", message: "ابتدا سفارش را شروع کنید" });
      return;
    }
    if (!canEditOrder) {
      showToast({ kind: "conflict", message: "سفارش قابل ویرایش نیست" });
      return;
    }

    const selectedName = participantNameSelection.trim();
    const name =
      selectedName === CUSTOM_PARTICIPANT_OPTION
        ? participantCustomName.trim()
        : selectedName;
    if (!name) {
      showToast({ kind: "error", message: "نام نفر الزامی است" });
      return;
    }

    setSubmittingParticipant(true);
    try {
      await posCreateParticipant(orderId, {
        name,
        type: participantType,
      });
      setGlobalParticipantNames((prev) => {
        const next = normalizeGlobalNames([...prev, name]);
        writeCachedGlobalNames(next);
        return next;
      });
      setParticipantNameSelection(name);
      setParticipantCustomName("");
      await Promise.all([
        refreshPeople(),
        refreshSettlement(orderId, { silent: true }),
      ]);
      showToast({ kind: "success", message: "نفر جدید اضافه شد" });
    } catch (error) {
      showToast(mapErrorToToast(error));
    } finally {
      setSubmittingParticipant(false);
    }
  }

  async function handleAddItem() {
    if (!orderId) {
      showToast({ kind: "error", message: "ابتدا سفارش را شروع کنید" });
      return;
    }
    if (!canEditOrder) {
      showToast({ kind: "conflict", message: "سفارش قابل ویرایش نیست" });
      return;
    }
    if (!selectedMenuItemId) {
      showToast({ kind: "error", message: "یک آیتم از منو انتخاب کنید" });
      return;
    }

    const qty = Number(qtyText);
    if (!Number.isInteger(qty) || qty <= 0) {
      showToast({ kind: "error", message: "تعداد نامعتبر است" });
      return;
    }

    const ownerPersonName =
      ownerPersonNameSelection === OWNER_CUSTOM_PARTICIPANT_OPTION
        ? ownerPersonCustomName.trim()
        : ownerPersonNameSelection.trim();
    if (ownerType === "PERSON" && !ownerPersonName) {
      showToast({ kind: "error", message: "مالک آیتم را انتخاب کنید" });
      return;
    }

    setSubmittingItem(true);
    try {
      const ownerPerson = eligibleOwnerPeople.find(
        (person) => person.name === ownerPersonName,
      );

      const created = await posAddOrderItem(orderId, {
        menuItemId: selectedMenuItemId,
        qty,
        ownerType,
        ownerPersonId: ownerType === "PERSON" ? ownerPerson?.id : undefined,
      });

      const nextItems: PosStoredItem[] = [
        ...items,
        {
          itemId: created.id,
          menuItemId: created.menuItemId ?? selectedMenuItemId,
          name: created.name,
          qty: created.qty,
          unitPrice: created.unitPrice,
          lineTotal: created.lineTotal,
          ownerType,
          ownerPersonId:
            ownerType === "PERSON" ? ownerPerson?.id ?? undefined : undefined,
          ownerPersonName:
            ownerType === "PERSON" ? ownerPersonName : undefined,
        },
      ];

      setItems(nextItems);
      saveOrderItems(orderId, nextItems);
      if (ownerType === "PERSON" && ownerPersonName) {
        setGlobalParticipantNames((previous) => {
          const next = normalizeGlobalNames([...previous, ownerPersonName]);
          writeCachedGlobalNames(next);
          return next;
        });
      }
      setTable((prev) => {
        if (!prev) {
          return prev;
        }
        const currentTotal = prev.openOrderTotal ?? 0;
        return {
          ...prev,
          openOrderTotal: currentTotal + created.lineTotal,
        };
      });

      await refreshSettlement(orderId, { silent: true });
      showToast({ kind: "success", message: "آیتم با موفقیت اضافه شد" });
    } catch (error) {
      showToast(mapErrorToToast(error));
    } finally {
      setSubmittingItem(false);
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (!orderId || !canEditOrder) {
      return;
    }

    const removed = items.find((item) => item.itemId === itemId);

    try {
      await posDeleteOrderItem(orderId, itemId);
      const nextItems = items.filter((item) => item.itemId !== itemId);
      setItems(nextItems);
      saveOrderItems(orderId, nextItems);
      if (removed) {
        setTable((prev) => {
          if (!prev) {
            return prev;
          }
          const currentTotal = prev.openOrderTotal ?? 0;
          return {
            ...prev,
            openOrderTotal: Math.max(currentTotal - removed.lineTotal, 0),
          };
        });
      }
      await refreshSettlement(orderId, { silent: true });
      showToast({ kind: "success", message: "آیتم حذف شد" });
    } catch (error) {
      showToast(mapErrorToToast(error));
    }
  }

  async function handleSettleOrder() {
    if (!orderId) {
      showToast({ kind: "error", message: "سفارش فعالی وجود ندارد" });
      return;
    }
    if (isUiLocked) {
      showToast({ kind: "conflict", message: "این سفارش بسته شده است" });
      return;
    }

    setSettling(true);
    try {
      await posSettleOrder(orderId);
      setCurrentOrderState("SETTLING");
      setOrderState(orderId, "SETTLING");
      router.push(`/pos/payment/${orderId}?tableId=${tableId}`);
    } catch (error) {
      showToast(mapErrorToToast(error));
    } finally {
      setSettling(false);
    }
  }

  async function handleStartGame() {
    if (!Number.isInteger(tableId) || tableId <= 0 || isUiLocked) {
      return;
    }
    if (isShiftClosed) {
      showToast({
        kind: "conflict",
        message: "شیفت بسته است و شروع بازی غیرفعال است",
      });
      return;
    }

    setGameBusy(true);
    try {
      const result = await posStartGame(tableId);
      const startedAtMs = new Date(result.startedAt).getTime();
      const safeStartedAtMs = Number.isNaN(startedAtMs) ? Date.now() : startedAtMs;

      setGameSessionId(result.sessionId);
      setGameStartedAtMs(safeStartedAtMs);
      setGameActive(true);
      setNow(Date.now());
      persistGameSession(tableId, {
        sessionId: result.sessionId,
        startedAtMs: safeStartedAtMs,
        active: true,
      });
      showToast({ kind: "success", message: "بازی با موفقیت شروع شد" });
    } catch (error) {
      if (error instanceof ApiError && includesShiftClosedMessage(error.message)) {
        setIsShiftClosed(true);
      }
      showToast(mapErrorToToast(error));
    } finally {
      setGameBusy(false);
    }
  }

  async function handleStopGame() {
    if (!gameSessionId) {
      return;
    }

    setGameBusy(true);
    try {
      await posStopGame(gameSessionId);
      setGameActive(false);
      setGameSessionId(null);
      setGameStartedAtMs(null);
      persistGameSession(tableId, null);
      if (orderId) {
        await refreshSettlement(orderId, { silent: true });
      }
      showToast({ kind: "success", message: "بازی با موفقیت پایان یافت" });
    } catch (error) {
      showToast(mapErrorToToast(error));
    } finally {
      setGameBusy(false);
    }
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

  if (!table) {
    return (
      <main className="min-h-screen bg-slate-100 p-4">
        <div className="mx-auto mt-10 max-w-xl rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-900">میز پیدا نشد</p>
          <button
            type="button"
            onClick={() => router.push("/pos/tables")}
            className="mt-4 min-h-12 rounded-xl border border-slate-300 px-5 font-semibold text-slate-800"
          >
            بازگشت به میزها
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900">
                میز شماره {table.tableNo}
              </h1>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(
                    visualStatus,
                  )}`}
                >
                  {statusLabel(visualStatus)}
                </span>
                {orderLocked ? (
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                    سفارش بسته شده است
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-600">جمع کل</p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {formatMoney(headerTotal)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-600">باقی‌مانده</p>
                <p
                  className={`mt-1 text-xl font-black ${
                    headerRemaining > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {formatMoney(headerRemaining)}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-sky-50 p-5 shadow-md md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black text-indigo-950">کنترل بازی</h2>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-indigo-900">
              محاسبه ساعتی
            </span>
          </div>

          {!gameActive ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-indigo-900">
                نرخ ساعتی بازی: {formatMoney(GAME_RATE_PER_HOUR)}
              </p>
              <p className="text-sm text-indigo-900/80">محاسبه ساعتی</p>
              <button
                type="button"
                onClick={() => void handleStartGame()}
                disabled={gameBusy || isShiftClosed || isUiLocked}
                className="min-h-16 w-full rounded-2xl bg-emerald-600 px-6 text-xl font-black text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
              >
                شروع بازی
              </button>
              {isShiftClosed ? (
                <p className="text-sm font-semibold text-rose-700">
                  شیفت بسته است و شروع بازی غیرفعال شده است
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="text-xs font-semibold text-slate-600">زمان جاری</p>
                  <p className="mt-1 text-3xl font-black tracking-wide text-slate-900">
                    {formatTimer(elapsedGameSeconds)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="text-xs font-semibold text-slate-600">نرخ ساعتی</p>
                  <p className="mt-1 text-xl font-black text-slate-900">
                    {formatMoney(GAME_RATE_PER_HOUR)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="text-xs font-semibold text-slate-600">
                    مبلغ فعلی بازی (جمع کل)
                  </p>
                  <p className="mt-1 text-xl font-black text-rose-700">
                    {formatMoney(liveGameAmountTotal)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    {`هر نفر: ${formatMoney(liveGameAmountPerPerson)} | نفرات بازی: ${gameEligibleCount}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleStopGame()}
                disabled={gameBusy}
                className="min-h-16 w-full rounded-2xl bg-rose-600 px-6 text-xl font-black text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
              >
                پایان بازی
              </button>
            </div>
          )}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl bg-slate-50 p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-black text-slate-900">بخش سفارش</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleStartOrder()}
                  disabled={submittingOrder || Boolean(orderId) || isUiLocked}
                  className="min-h-12 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  شروع سفارش
                </button>
                <button
                  type="button"
                  onClick={() => void handleSettleOrder()}
                  disabled={!orderId || settling || orderState !== "OPEN" || isUiLocked}
                  className="min-h-12 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  انتقال به تسویه
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/pos/tables")}
                  className="min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800"
                >
                  بازگشت
                </button>
              </div>
            </div>

            {!orderId ? (
              <p className="rounded-xl bg-white p-3 text-sm text-slate-700">
                برای افزودن آیتم ابتدا سفارش را شروع کنید.
              </p>
            ) : (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={selectedMenuItemId ?? ""}
                    onChange={(event) => setSelectedMenuItemId(Number(event.target.value))}
                    className="min-h-12 rounded-xl border border-slate-300 px-3"
                    disabled={!canEditOrder}
                  >
                    <option value="">انتخاب آیتم منو</option>
                    {menuItems.map((menuItem) => (
                      <option key={menuItem.id} value={menuItem.id}>
                        {menuItem.name} - {menuItem.price.toLocaleString()}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    value={qtyText}
                    onChange={(event) => setQtyText(event.target.value)}
                    className="min-h-12 rounded-xl border border-slate-300 px-3"
                    placeholder="تعداد"
                    disabled={!canEditOrder}
                  />

                  <select
                    value={ownerType}
                    onChange={(event) => setOwnerType(event.target.value as OwnerType)}
                    className="min-h-12 rounded-xl border border-slate-300 px-3"
                    disabled={!canEditOrder}
                  >
                    <option value="SHARED">مشترک</option>
                    <option value="PERSON">شخصی</option>
                  </select>

                  <select
                    value={ownerPersonNameSelection}
                    onChange={(event) =>
                      setOwnerPersonNameSelection(event.target.value)
                    }
                    disabled={ownerType === "SHARED" || !canEditOrder}
                    className="min-h-12 rounded-xl border border-slate-300 px-3 disabled:bg-slate-100"
                  >
                    <option value="">انتخاب مالک آیتم از لیست سراسری</option>
                    {ownerNameOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                    <option value={OWNER_CUSTOM_PARTICIPANT_OPTION}>
                      + نام جدید
                    </option>
                  </select>

                  {ownerType === "PERSON" &&
                  ownerPersonNameSelection === OWNER_CUSTOM_PARTICIPANT_OPTION ? (
                    <input
                      type="text"
                      value={ownerPersonCustomName}
                      onChange={(event) =>
                        setOwnerPersonCustomName(event.target.value)
                      }
                      placeholder="نام جدید مالک آیتم"
                      className="min-h-12 rounded-xl border border-slate-300 px-3 md:col-span-2"
                      disabled={!canEditOrder}
                    />
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => void handleAddItem()}
                  disabled={submittingItem || !canEditOrder}
                  className="mt-3 min-h-12 w-full rounded-xl bg-sky-600 px-4 text-base font-bold text-white disabled:opacity-50"
                >
                  افزودن آیتم
                </button>

                <div className="mt-4 rounded-xl bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-lg font-black text-slate-900">آیتم‌های سفارش</h4>
                    <span className="text-base font-black text-slate-900">
                      جمع سفارش: {formatMoney(localOrderTotal)}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-sm text-slate-600">آیتمی ثبت نشده است.</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.itemId}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="text-xs text-slate-600">
                              {item.qty} × {item.unitPrice.toLocaleString()} ={" "}
                              {item.lineTotal.toLocaleString()} تومان
                            </div>
                            <div className="text-xs text-slate-600">
                              مالک:{" "}
                              {item.ownerType === "SHARED"
                                ? "مشترک"
                                : item.ownerPersonName ??
                                  peopleById.get(item.ownerPersonId ?? 0) ??
                                  "شخصی"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeleteItem(item.itemId)}
                            disabled={!canEditOrder}
                            className="min-h-10 rounded-xl bg-rose-600 px-3 text-sm font-bold text-white disabled:opacity-50"
                          >
                            حذف
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </article>

          <article className="rounded-2xl bg-slate-50 p-4 shadow-sm">
            <h3 className="mb-3 text-xl font-black text-slate-900">نفرات میز</h3>

            <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <div className="grid gap-2">
                <select
                  value={participantNameSelection}
                  onChange={(event) =>
                    setParticipantNameSelection(event.target.value)
                  }
                  className="min-h-12 rounded-xl border border-slate-300 px-3"
                  disabled={!canEditOrder}
                >
                  <option value="">انتخاب نام از لیست سراسری</option>
                  {globalParticipantNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value={CUSTOM_PARTICIPANT_OPTION}>+ نام جدید</option>
                </select>

                {participantNameSelection === CUSTOM_PARTICIPANT_OPTION ? (
                  <input
                    type="text"
                    value={participantCustomName}
                    onChange={(event) =>
                      setParticipantCustomName(event.target.value)
                    }
                    placeholder="نام جدید را وارد کنید"
                    className="min-h-12 rounded-xl border border-slate-300 px-3"
                    disabled={!canEditOrder}
                  />
                ) : null}
              </div>
              <select
                value={participantType}
                onChange={(event) =>
                  setParticipantType(event.target.value as ParticipantType)
                }
                className="min-h-12 rounded-xl border border-slate-300 px-3"
                disabled={!canEditOrder}
              >
                <option value="BOTH">بازی و سفارش</option>
                <option value="ORDER">فقط سفارش</option>
                <option value="PLAY">فقط بازی</option>
              </select>
              <button
                type="button"
                onClick={() => void handleAddParticipant()}
                disabled={!orderId || submittingParticipant || !canEditOrder}
                className="min-h-12 rounded-xl bg-indigo-600 px-4 text-base font-bold text-white disabled:opacity-50"
              >
                افزودن نفر
              </button>
            </div>

            <div className="space-y-2">
              {people.length === 0 ? (
                <p className="rounded-xl bg-white p-3 text-sm text-slate-600">
                  نفری ثبت نشده است.
                </p>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="text-sm font-semibold text-slate-900">
                    تعداد نفرات ثبت‌شده: {people.length}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(Object.keys(participantSummary) as ParticipantType[]).map((type) =>
                      participantSummary[type] > 0 ? (
                        <span
                          key={type}
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${participantTypeClass(
                            type,
                          )}`}
                        >
                          {participantTypeLabel(type)}: {participantSummary[type]}
                        </span>
                      ) : null,
                    )}
                  </div>
                </div>
              )}
            </div>
          </article>
        </section>
      </div>

      <PosToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
