// ROLE: 2D-радар на Canvas с throttle 12 Гц и cap food-точек. Не UI, не ввод.
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import { wrapDelta } from "../worker/shared/MathUtils";
import { worldToGridX, worldToGridY } from "../worker/shared/WorldMath";

/** Минимальный интервал между перерисовками миникарты (12 Гц). */
export const MINIMAP_UPDATE_INTERVAL_MS = 1000 / 12;

/** Максимум food-точек, которые миникарта рисует за одно обновление. */
export const MAX_MINIMAP_FOODS = 300;

export function shouldUpdateMinimap(
  lastDrawAt: number,
  now: number,
  intervalMs: number = MINIMAP_UPDATE_INTERVAL_MS,
): boolean {
  if (!Number.isFinite(lastDrawAt)) return true;
  return now >= lastDrawAt + intervalMs;
}

export function capMinimapFoodCount(foodCount: number): number {
  if (!Number.isFinite(foodCount) || foodCount <= 0) return 0;
  return Math.min(Math.floor(foodCount), MAX_MINIMAP_FOODS);
}

export function getPlayerHead(player: any): { x: number; y: number } | null {
  if (!player) return null;
  if (typeof player.head_x === "number" && typeof player.head_y === "number") {
    return { x: player.head_x, y: player.head_y };
  }
  const body = player.body;
  if (!Array.isArray(body) || body.length < 2) return null;
  if (typeof body[0] === "number" && typeof body[1] === "number") {
    return { x: body[0], y: body[1] };
  }
  return null;
}

export function getPlayerDotColor(skin: string | undefined): string {
  if (skin === "zebra") return "#e2e8f0";
  if (skin && /^#[0-9a-f]{6}$/i.test(skin)) return skin;
  return "#22c55e";
}

export class Minimap {
  private container: HTMLDivElement;
  private wrapper: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private lastDrawAt = Number.NEGATIVE_INFINITY;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.render();
  }

  public destroy(): void {
    if (this.wrapper) {
      this.wrapper.remove();
      this.wrapper = null;
      this.canvas = null;
      this.ctx = null;
    }
  }

  public update(msg: any, myId: string, isMobile: boolean): void {
    const now = performance.now();
    if (!shouldUpdateMinimap(this.lastDrawAt, now)) return;

    const canvas = this.canvas;
    const ctx = this.ctx;
    const state = msg?.gameState;

    if (!canvas || !ctx || !state || !msg.foodMinimapData) return;
    this.lastDrawAt = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mapW = state.server_world?.width ?? WORLD_WIDTH;
    const mapH = state.server_world?.height ?? WORLD_HEIGHT;

    const myPlayer = state.players[myId];
    let px = mapW / 2;
    let py = mapH / 2;
    let myAngle = 0;

    if (
      typeof msg.camX === "number" &&
      typeof msg.camY === "number" &&
      typeof msg.camAngle === "number"
    ) {
      px = worldToGridX(msg.camX, gridSize);
      py = worldToGridY(msg.camY, gridSize);
      myAngle = msg.camAngle;
    } else if (myPlayer) {
      const head = getPlayerHead(myPlayer);
      if (head) {
        px = head.x;
        py = head.y;
      }
      myAngle = myPlayer.angle ?? 0;
    }

    const scale = Math.min(canvas.width / mapW, canvas.height / mapH);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-myAngle - Math.PI / 2);

    const foodMinimapData =
      msg.foodMinimapData instanceof Float32Array
        ? msg.foodMinimapData
        : new Float32Array(msg.foodMinimapData);

    const radarRadius = canvas.width / 2; // 100 for 200x200 canvas

    this.drawFoods(ctx, foodMinimapData, px, py, scale, mapW, mapH, isMobile, radarRadius);
    this.drawPlayers(ctx, state.players, myId, px, py, scale, mapW, mapH, radarRadius);

    ctx.restore();
  }

  private render(): void {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "minimap-panel glass-panel hud-interactive";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "minimap-canvas";
    this.canvas.width = 200;
    this.canvas.height = 200;
    this.ctx = this.canvas.getContext("2d");

    this.wrapper.appendChild(this.canvas);
    this.container.appendChild(this.wrapper);
  }

  private drawFoods(
    ctx: CanvasRenderingContext2D,
    foodMinimapData: Float32Array,
    px: number,
    py: number,
    scale: number,
    mapW: number,
    mapH: number,
    isMobile: boolean,
    radarRadius: number,
  ): void {
    const foodCount = capMinimapFoodCount(foodMinimapData.length / 4);
    for (let i = 0; i < foodCount; i++) {
      const fx = foodMinimapData[i * 4 + 0];
      const fy = foodMinimapData[i * 4 + 1];
      const fvalue = foodMinimapData[i * 4 + 2];
      const fcolorInt = foodMinimapData[i * 4 + 3];

      const baseRx = wrapDelta(fx - px, mapW);
      const baseRy = wrapDelta(fy - py, mapH);

      let hexColor = "#ef4444";
      if (Number.isFinite(fcolorInt) && fcolorInt > 0) {
        hexColor = `#${Math.round(fcolorInt).toString(16).padStart(6, "0")}`;
      }

      ctx.fillStyle = hexColor;
      ctx.globalAlpha = isMobile ? 0.95 : fvalue >= 2.0 ? 0.9 : 0.7;

      let s = 1.0;
      if (fvalue > 1.0) {
        s = fvalue >= 50.0 ? 6.0 : fvalue >= 20.0 ? 4.0 : 2.5;
      }

      const sx = baseRx * scale;
      const sy = baseRy * scale;

      if (Math.abs(sx) <= radarRadius && Math.abs(sy) <= radarRadius) {
        ctx.fillRect(sx - s / 2.0, sy - s / 2.0, s, s);
      }
    }
    ctx.globalAlpha = 1.0;
  }

  private drawPlayers(
    ctx: CanvasRenderingContext2D,
    players: Record<string, any>,
    myId: string,
    px: number,
    py: number,
    scale: number,
    mapW: number,
    mapH: number,
    radarRadius: number,
  ): void {
    const dotSize = 3.5;

    for (const pid in players) {
      if (pid === myId) continue;
      const p = players[pid];
      if (p.is_dead || !p.body_len) continue;
      const head = getPlayerHead(p);
      if (!head) continue;

      ctx.fillStyle = getPlayerDotColor(p.skin);
      const baseRx = wrapDelta(head.x - px, mapW);
      const baseRy = wrapDelta(head.y - py, mapH);

      const sx = baseRx * scale;
      const sy = baseRy * scale;

      if (Math.abs(sx) <= radarRadius && Math.abs(sy) <= radarRadius) {
        ctx.beginPath();
        ctx.arc(sx, sy, dotSize, 0, Math.PI * 2.0);
        ctx.fill();
      }
    }

    const myPlayer = players[myId];
    if (myPlayer && !myPlayer.is_dead && getPlayerHead(myPlayer)) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, dotSize, 0, Math.PI * 2.0);
      ctx.fill();
    }
  }
}
