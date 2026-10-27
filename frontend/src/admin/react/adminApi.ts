// ROLE: URL helpers and fetch wrappers for the React admin UI. Not game logic.

export function adminApiUrl(path: string): string {
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol;
  const port = import.meta.env.DEV ? "8000" : window.location.port || "";
  const portPart = port ? `:${port}` : "";
  const prefix = import.meta.env.DEV ? "" : "/ws";
  return `${protocol}//${host}${portPart}${prefix}${path}`;
}

export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(adminApiUrl(path), {
    credentials: "include",
    ...init,
  });
}
