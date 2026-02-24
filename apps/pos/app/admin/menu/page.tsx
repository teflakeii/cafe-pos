"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createMenuItem,
  getAllMenuItems,
  toggleMenuItem,
  updateMenuItem,
} from "@/lib/api";
import { isAdminAuthenticated, setAdminAuthenticated } from "@/lib/adminAuth";

type MenuItemRow = {
  id: number;
  name: string;
  category: string;
  price: number;
  isActive: boolean;
};

type MenuFormState = {
  name: string;
  category: string;
  price: string;
};

const EMPTY_FORM: MenuFormState = {
  name: "",
  category: "",
  price: "",
};

export default function AdminMenuPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [createForm, setCreateForm] = useState<MenuFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<MenuFormState>(EMPTY_FORM);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      setAuthChecked(true);
      return;
    }
    setIsAuthed(true);
    setAuthChecked(true);
  }, [router]);

  async function loadItems() {
    try {
      setError(null);
      const data = (await getAllMenuItems()) as MenuItemRow[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) return;
    loadItems();
  }, [isAuthed]);

  function parsePrice(input: string): number {
    return Number(input);
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    const price = parsePrice(createForm.price);
    if (!createForm.name.trim() || !createForm.category.trim() || !Number.isInteger(price) || price <= 0) {
      alert("نام، دسته و قیمت معتبر الزامی است");
      return;
    }

    try {
      await createMenuItem({
        name: createForm.name.trim(),
        category: createForm.category.trim(),
        price,
      });
      setShowCreateModal(false);
      setCreateForm(EMPTY_FORM);
      await loadItems();
    } catch {
      alert("خطا در ایجاد آیتم منو");
    }
  }

  function openEditModal(item: MenuItemRow) {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
    });
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    const price = parsePrice(editForm.price);
    if (!editForm.name.trim() || !editForm.category.trim() || !Number.isInteger(price) || price <= 0) {
      alert("نام، دسته و قیمت معتبر الزامی است");
      return;
    }

    try {
      await updateMenuItem(editingItem.id, {
        name: editForm.name.trim(),
        category: editForm.category.trim(),
        price,
      });
      setEditingItem(null);
      await loadItems();
    } catch {
      alert("خطا در ویرایش آیتم منو");
    }
  }

  async function handleToggle(id: number) {
    try {
      await toggleMenuItem(id);
      await loadItems();
    } catch {
      alert("خطا در تغییر وضعیت آیتم منو");
    }
  }

  if (!authChecked) return null;
  if (!isAuthed) return null;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">مدیریت منو</h1>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => setShowCreateModal(true)}
            >
              افزودن آیتم
            </button>
            <button
              onClick={() => {
                setAdminAuthenticated(false);
                router.replace("/");
              }}
              className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
            >
              خروج از ادمین
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-600">در حال بارگذاری…</p>}
        {error && <p className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="p-3">نام</th>
                  <th className="p-3">دسته</th>
                  <th className="p-3">قیمت</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3">{item.category}</td>
                    <td className="p-3">{item.price.toLocaleString()} تومان</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          item.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {item.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          className="rounded-md bg-amber-100 px-3 py-1 text-amber-700 hover:bg-amber-200"
                          onClick={() => openEditModal(item)}
                        >
                          ویرایش
                        </button>
                        <button
                          className="rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
                          onClick={() => handleToggle(item.id)}
                        >
                          {item.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form
            className="w-full max-w-md rounded-xl bg-white p-4 shadow"
            onSubmit={handleCreateSubmit}
          >
            <h2 className="mb-3 text-lg font-bold">افزودن آیتم منو</h2>
            <div className="space-y-3">
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="نام"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="دسته"
                value={createForm.category}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, category: e.target.value }))
                }
              />
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="قیمت (تومان)"
                type="number"
                min={1}
                value={createForm.price}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, price: e.target.value }))
                }
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-1.5"
                onClick={() => setShowCreateModal(false)}
              >
                انصراف
              </button>
              <button
                type="submit"
                className="rounded bg-blue-600 px-3 py-1.5 text-white"
              >
                ثبت
              </button>
            </div>
          </form>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form
            className="w-full max-w-md rounded-xl bg-white p-4 shadow"
            onSubmit={handleEditSubmit}
          >
            <h2 className="mb-3 text-lg font-bold">ویرایش آیتم منو</h2>
            <div className="space-y-3">
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="نام"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="دسته"
                value={editForm.category}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, category: e.target.value }))
                }
              />
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="قیمت (تومان)"
                type="number"
                min={1}
                value={editForm.price}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, price: e.target.value }))
                }
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-1.5"
                onClick={() => setEditingItem(null)}
              >
                انصراف
              </button>
              <button
                type="submit"
                className="rounded bg-blue-600 px-3 py-1.5 text-white"
              >
                ذخیره
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
