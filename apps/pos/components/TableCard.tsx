import Link from "next/link";

type Props = {
  tableId: number;
  tableNo: number;
  status: "free" | "busy" | "open" | "settling";
};

export default function TableCard({ tableId, tableNo, status }: Props) {
  const isFree = status === "free";
  const isSettling = status === "settling";
  const statusLabel = isFree ? "آزاد" : isSettling ? "در حال تسویه" : "سفارش باز";
  const statusClass = isFree
    ? "bg-green-500 text-white"
    : isSettling
      ? "bg-yellow-500 text-white"
      : "bg-red-500 text-white";

  return (
    <Link href={`/tables/${tableId}`}>
      <div
        className={`rounded-xl p-4 shadow cursor-pointer select-none transition
        ${statusClass}`}
      >
        <div className="text-xl font-bold">میز {tableNo}</div>

        <div className="mt-2 text-sm">{statusLabel}</div>
      </div>
    </Link>
  );
}
