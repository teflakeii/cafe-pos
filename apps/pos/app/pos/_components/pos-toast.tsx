"use client";

export type PosToastState = {
  kind: "error" | "success" | "conflict";
  message: string;
} | null;

type PosToastProps = {
  toast: PosToastState;
  onClose: () => void;
};

const STYLE_BY_KIND: Record<NonNullable<PosToastState>["kind"], string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  conflict: "bg-amber-500 text-slate-900",
};

export function PosToast({ toast, onClose }: PosToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        className={`w-full max-w-xl rounded-2xl px-4 py-3 text-base font-semibold shadow-lg ${STYLE_BY_KIND[toast.kind]}`}
      >
        <div className="flex items-center justify-between gap-4">
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-black/20 px-3 py-1 text-sm"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
