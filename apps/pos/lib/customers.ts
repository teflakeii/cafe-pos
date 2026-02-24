import { CustomerPreset, DEFAULT_CUSTOMERS } from "@/data/customers";

const KEY = "customer_presets";

export function getCustomerPresets(): CustomerPreset[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT_CUSTOMERS));
    return DEFAULT_CUSTOMERS;
  }
  return JSON.parse(raw);
}

export function addCustomerPreset(name: string): CustomerPreset {
  const list = getCustomerPresets();
  const newItem = {
    id: crypto.randomUUID(),
    name,
  };
  const next = [...list, newItem];
  localStorage.setItem(KEY, JSON.stringify(next));
  return newItem;
}
