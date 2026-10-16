"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}
export function assetUrl(path: string): string {
  const base = typeof window !== "undefined" ? (window.__SAKTO_BASE__ || "") : "";
  return path.startsWith("/") && !path.startsWith("//") ? `${base}${path}` : path;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(assetUrl(path), { ...options, credentials: "same-origin", cache: "no-store", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  } catch { throw new ApiError("We couldn’t reach Sakto Meals. Check your connection and try again.", 0); }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(result?.error || "Something went wrong. Please try again.", response.status);
  return result.data as T;
}
const UserContext = createContext<{user: User | null; loading: boolean; refresh: () => Promise<void>}>({user: null, loading: true, refresh: async () => {}});
export function UserProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setUser(await api<User | null>("/api/auth/me")); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <UserContext.Provider value={{user, loading, refresh}}>{children}</UserContext.Provider>;
}
export const useUser = () => useContext(UserContext);
