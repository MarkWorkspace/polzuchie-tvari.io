// ROLE: Shared admin REST helpers for Playwright specs. Not product code.
import { type APIRequestContext, expect } from "@playwright/test";

export const BACKEND_URL = "http://127.0.0.1:8000";
const ADMIN_PASSWORD = "e2e-admin";

export async function loginAdmin(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${BACKEND_URL}/admin/login`, {
    data: { password: ADMIN_PASSWORD },
  });
  expect(response.ok()).toBe(true);
}

export async function readConfig(request: APIRequestContext): Promise<unknown> {
  const response = await request.get(`${BACKEND_URL}/admin/config`);
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function patchConfig(request: APIRequestContext, patch: unknown): Promise<void> {
  const response = await request.patch(`${BACKEND_URL}/admin/config`, { data: patch });
  expect(response.ok()).toBe(true);
}
