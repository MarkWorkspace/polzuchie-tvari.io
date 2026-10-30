// ROLE: E2E security checks for WebSocket Origin allowlisting and per-role
// connection caps. Does not exercise gameplay, rendering or admin flows.
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

type SocketResult = { opened: boolean; code: number | null; receivedFrame: boolean };

let evilServer: Server | undefined;
let evilOrigin = "";

// A real cross-origin page (different port) makes Chromium send a concrete
// Origin header. about:blank would only exercise the opaque "null" origin and
// could be rejected by the browser before the backend admission check runs.
test.beforeAll(async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end("<!doctype html><html><body>cross-origin</body></html>");
  });
  evilServer = server;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Failed to bind the cross-origin test server");
  }
  evilOrigin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  const server = evilServer;
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

// Derive the backend URL from Playwright's baseURL so the spec also works when
// the preview runs on a non-default port during local debugging.
function websocketUrl(baseURL: string): string {
  const url = new URL(baseURL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${url.origin}/ws/`;
}

test("rejects a cross-origin WebSocket handshake", async ({ page, baseURL }) => {
  test.setTimeout(30_000);
  if (!baseURL) throw new Error("Playwright baseURL is required");
  await page.goto(evilOrigin);

  const result = await page.evaluate(
    ({ url }) =>
      new Promise<SocketResult>((resolve) => {
        const socket = new WebSocket(`${url}?nickname=Cross&skin=%2322c55e&role=spectator`);
        let opened = false;
        let receivedFrame = false;
        socket.onopen = () => {
          opened = true;
        };
        socket.onmessage = () => {
          receivedFrame = true;
        };
        socket.onclose = (event) => resolve({ opened, code: event.code, receivedFrame });
        socket.onerror = () => {
          // A failed handshake is reported through onclose as well.
        };
        setTimeout(() => resolve({ opened, code: null, receivedFrame }), 10_000);
      }),
    { url: websocketUrl(baseURL) },
  );

  // The backend accepts first (so the browser can see the application code)
  // and then closes with 1008. Do not assert opened === false: accept-then-close
  // may legitimately fire onopen before onclose.
  expect(result.code).toBe(1008);
  expect(result.receivedFrame).toBe(false);
});

test("spectator cap rejects the fourth socket and keeps player slots free", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const url = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/`;
    const sockets: WebSocket[] = [];

    // Rejected handshakes are accepted first and closed with an application
    // code, so the browser may briefly fire onopen before onclose(4003).
    const openSocket = (role: string, waitFor: "message" | "close") =>
      new Promise<SocketResult>((resolve) => {
        const socket = new WebSocket(`${url}?nickname=Security&skin=%2322c55e&role=${role}`);
        sockets.push(socket);
        socket.binaryType = "arraybuffer";
        let opened = false;
        let receivedFrame = false;
        let settled = false;
        const settle = (code: number | null) => {
          if (settled) return;
          settled = true;
          resolve({ opened, code, receivedFrame });
        };

        socket.onopen = () => {
          opened = true;
        };
        socket.onmessage = () => {
          receivedFrame = true;
          if (waitFor === "message") settle(null);
        };
        socket.onclose = (event) => settle(event.code);
        socket.onerror = () => {
          // A failed handshake is reported through onclose as well.
        };
        setTimeout(() => settle(null), 15_000);
      });

    // Each accepted spectator must deliver a first state frame; onopen alone
    // would also fire for a socket that is immediately closed with 4003.
    const spectators = await Promise.all([
      openSocket("spectator", "message"),
      openSocket("spectator", "message"),
      openSocket("spectator", "message"),
    ]);
    const fourth = await openSocket("spectator", "close");
    const player = await openSocket("player", "message");

    // Close every socket and wait for the server-side cleanup so later specs
    // do not inherit these connections.
    await Promise.all(
      sockets.map(
        (socket) =>
          new Promise<void>((resolve) => {
            if (socket.readyState === WebSocket.CLOSED) {
              resolve();
              return;
            }
            socket.onclose = () => resolve();
            socket.close();
            setTimeout(resolve, 2_000);
          }),
      ),
    );

    return { spectators, fourth, player };
  });

  expect(result.spectators.every((socket) => socket.receivedFrame)).toBe(true);
  expect(result.spectators.every((socket) => socket.code === null)).toBe(true);
  expect(result.fourth.code).toBe(4003);
  expect(result.player.receivedFrame).toBe(true);
  expect(result.player.code).toBeNull();
});
