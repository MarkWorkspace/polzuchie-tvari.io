// ROLE: 2D-радар на Canvas с частотой обновления экрана. Не UI, не ввод.
import { WORLD_WIDTH, WORLD_HEIGHT, gridSize } from "../game/Config";

export class Minimap {
  private container: HTMLDivElement;
  private wrapper: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

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
    const canvas = this.canvas;
    const ctx = this.ctx;
    const state = msg?.gameState;

    if (!canvas || !ctx || !state || !msg.foodMinimapData) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mapW = state.server_world?.width ?? WORLD_WIDTH;
    const mapH = state.server_world?.height ?? WORLD_HEIGHT;

    const myPlayer = state.players[myId];
    let px = mapW / 2;
    let py = mapH / 2;
    let myAngle = 0;

    if (typeof msg.camX === "number" && typeof msg.camY === "number" && typeof msg.camAngle === "number") {
      px = (msg.camX - gridSize / 2) / gridSize;
      py = (-msg.camY - gridSize / 2) / gridSize;
      myAngle = msg.camAngle;
    } else if (myPlayer && myPlayer.body && myPlayer.body.length > 0) {
      px = myPlayer.body[0].x;
      py = myPlayer.body[0].y;
      myAngle = myPlayer.angle ?? 0;
    }

    const scale = Math.min(canvas.width / mapW, canvas.height / mapH);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-myAngle - Math.PI / 2);

    const foodMinimapData = msg.foodMinimapData instanceof Float32Array 
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
    radarRadius: number
  ): void {
    const foodCount = foodMinimapData.length / 4;
    for (let i = 0; i < foodCount; i++) {
      const fx = foodMinimapData[i * 4 + 0];
      const fy = foodMinimapData[i * 4 + 1];
      let fvalue = foodMinimapData[i * 4 + 2];
      let fcolorInt = foodMinimapData[i * 4 + 3];

      // Auto-correct swapped color and value indices
      if (fvalue > 1000.0 && fcolorInt < 1000.0) {
        const temp = fvalue;
        fvalue = fcolorInt;
        fcolorInt = temp;
      }

      let baseRx = fx - px;
      let baseRy = fy - py;
      if (baseRx > mapW / 2) baseRx -= mapW;
      else if (baseRx < -mapW / 2) baseRx += mapW;
      if (baseRy > mapH / 2) baseRy -= mapH;
      else if (baseRy < -mapH / 2) baseRy += mapH;

      let hexColor = "#ef4444";
      if (typeof fcolorInt === "number" && !isNaN(fcolorInt) && fcolorInt > 0) {
        hexColor = "#" + Math.round(fcolorInt).toString(16).padStart(6, "0");
      }

      ctx.fillStyle = hexColor;
      ctx.globalAlpha = isMobile ? 0.95 : (fvalue >= 2.0 ? 0.9 : 0.7);

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
    radarRadius: number
  ): void {
    const dotSize = 3.5;

    for (const pid in players) {
      if (pid === myId) continue;
      const p = players[pid];
      if (p.is_dead || !p.body || p.body.length === 0) continue;

      ctx.fillStyle = p.skin === "zebra" ? "#e2e8f0" : p.skin || "#22c55e";
      const head = p.body[0];
      if (!head || typeof head.x !== "number" || typeof head.y !== "number" || isNaN(head.x) || isNaN(head.y)) {
        continue;
      }
      let baseRx = head.x - px;
      let baseRy = head.y - py;
      if (baseRx > mapW / 2) baseRx -= mapW;
      else if (baseRx < -mapW / 2) baseRx += mapW;
      if (baseRy > mapH / 2) baseRy -= mapH;
      else if (baseRy < -mapH / 2) baseRy += mapH;

      const sx = baseRx * scale;
      const sy = baseRy * scale;
      
      if (Math.abs(sx) <= radarRadius && Math.abs(sy) <= radarRadius) {
        ctx.beginPath();
        ctx.arc(sx, sy, dotSize, 0, Math.PI * 2.0);
        ctx.fill();
      }
    }

    const myPlayer = players[myId];
    if (myPlayer && myPlayer.body && myPlayer.body.length > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, dotSize, 0, Math.PI * 2.0);
      ctx.fill();
    }
  }
}
