const API_BASE = "";

function formatApiError(data: unknown, fallback: string): string {
  if (typeof data === "string") return data.slice(0, 500);
  if (!data || typeof data !== "object") return fallback;

  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === "string") return obj.detail;
  if (Array.isArray(obj.non_field_errors) && obj.non_field_errors.length > 0) {
    return obj.non_field_errors.map(String).join("; ");
  }

  const parts: string[] = [];

  function walk(value: unknown, path: string) {
    if (typeof value === "string") {
      parts.push(path ? `${path}: ${value}` : value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const nextPath = path ? `${path}[${index + 1}]` : `[${index + 1}]`;
        walk(item, nextPath);
      });
      return;
    }

    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
        const nextPath = path ? `${path}.${key}` : key;
        walk(nested, nextPath);
      });
    }
  }

  walk(obj, "");
  return parts.length ? parts.slice(0, 8).join("; ") : fallback;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const unsafe = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (unsafe) {
    const csrf = getCookie("csrftoken");
    if (csrf) headers.set("X-CSRFToken", csrf);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  const data: any = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    throw new Error(formatApiError(data, `HTTP ${res.status}`));
  }

  return data as T;
}

/**
 * Для session login через /api-auth/login/
 * В settings.py на бэке:
 * CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]
 */
export async function sessionLogin(username: string, password: string): Promise<void> {
  // получить csrftoken cookie (обычно при GET на login страницу)
  await fetch(`${API_BASE}/api-auth/login/`, { credentials: "include" });

  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  await http<void>("/api-auth/login/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

export async function sessionLogout(): Promise<void> {
  await http<void>("/api-auth/logout/", { method: "POST" });
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as Promise<T>;
}