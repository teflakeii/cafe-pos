export const ADMIN_SESSION_KEY = "admin-auth";

export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

export function setAdminAuthenticated(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) {
    localStorage.setItem(ADMIN_SESSION_KEY, "true");
  } else {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }
}
