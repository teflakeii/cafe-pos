"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { setAdminAuthenticated } from "@/lib/adminAuth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (pin === "1234") {
      setAdminAuthenticated(true);
      router.replace("/admin/menu");
      return;
    }

    setError("PIN اشتباه است");
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-xl bg-white p-6 shadow-sm"
        >
          <h1 className="mb-4 text-center text-xl font-bold text-slate-900">
            ورود ادمین
          </h1>

          <label className="mb-2 block text-sm font-medium text-slate-700">
            PIN ادمین
          </label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            autoFocus
          />

          {error && (
            <p className="mt-3 rounded-md bg-red-100 p-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            ورود
          </button>
        </form>
      </div>
    </main>
  );
}
