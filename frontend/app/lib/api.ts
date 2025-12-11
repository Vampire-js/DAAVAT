export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
}
