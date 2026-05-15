import { NextRequest, NextResponse } from "next/server";

const backendUrl = () => {
  if (process.env.BACKEND_INTERNAL_URL) {
    return process.env.BACKEND_INTERNAL_URL;
  }
  return process.env.NODE_ENV === "production" ? "http://backend:8000" : "http://127.0.0.1:8000";
};

export async function GET(request: NextRequest) {
  return proxyAdminConfig(request);
}

export async function PATCH(request: NextRequest) {
  return proxyAdminConfig(request, await request.text());
}

async function proxyAdminConfig(request: NextRequest, body?: string) {
  const response = await fetch(`${backendUrl()}/admin/config`, {
    method: request.method,
    headers: {
      "content-type": "application/json",
      "x-admin-password": request.headers.get("x-admin-password") || "",
    },
    body,
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}
