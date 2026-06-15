// ROLE: Canvas-симулятор распределения еды. Без UI.

interface SimConfig {
  width: number;
  height: number;
  target_food_count: number;
  cluster_count: number;
  cluster_spawn_chance: number;
  cluster_spread: number;
  foodTypes: { value: number; weight: number; color: string }[];
}

export class FoodSimulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not acquire 2D context");
    this.ctx = context;
  }

  public simulateAndDraw(cfg: SimConfig, seed = 42): void {
    const data = this.runLCGSimulation(cfg, seed);
    this.drawSimulation(data, cfg.cluster_spread);
  }

  private runLCGSimulation(cfg: SimConfig, seed: number) {
    let lcgSeed = seed + 1;
    const lcgRandom = () => {
      const x = Math.sin(lcgSeed++) * 10000;
      return x - Math.floor(x);
    };

    // Create clusters
    const clusters: { x: number; y: number }[] = [];
    for (let i = 0; i < cfg.cluster_count; i++) {
      clusters.push({
        x: 10 + lcgRandom() * (cfg.width - 20),
        y: 10 + lcgRandom() * (cfg.height - 20)
      });
    }

    // Prepare food type weights
    const types = cfg.foodTypes.length > 0 ? cfg.foodTypes : [{ value: 1, weight: 1, color: "#ef4444" }];
    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);

    const getWeightedType = () => {
      let rand = lcgRandom() * totalWeight;
      for (const t of types) {
        if (rand < t.weight) return t;
        rand -= t.weight;
      }
      return types[0];
    };

    // Box-Muller normal distribution
    const randomNormal = (mean: number, stdDev: number) => {
      const u1 = lcgRandom() || 0.0001;
      const u2 = lcgRandom() || 0.0001;
      const stdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
      return mean + stdDev * stdNormal;
    };

    const foods: { x: number; y: number; color: string; value: number }[] = [];
    for (let i = 0; i < cfg.target_food_count; i++) {
      const chosen = getWeightedType();
      let x = 0;
      let y = 0;

      if (lcgRandom() < cfg.cluster_spawn_chance && clusters.length > 0) {
        const cluster = clusters[Math.floor(lcgRandom() * clusters.length)];
        x = randomNormal(cluster.x, cfg.cluster_spread);
        y = randomNormal(cluster.y, cfg.cluster_spread);
      } else {
        x = lcgRandom() * (cfg.width - 2);
        y = lcgRandom() * (cfg.height - 2);
      }

      x = Math.max(1, Math.min(cfg.width - 1, x));
      y = Math.max(1, Math.min(cfg.height - 1, y));
      foods.push({ x, y, color: chosen.color, value: chosen.value });
    }

    return { width: cfg.width, height: cfg.height, clusters, foods };
  }

  private drawSimulation(data: any, clusterSpread: number): void {
    const ctx = this.ctx;
    const canvas = this.canvas;

    const displayW = canvas.clientWidth || 300;
    const aspectRatio = data.height / data.width;
    const displayH = Math.min(400, displayW * aspectRatio);
    const finalW = displayH / aspectRatio;

    canvas.width = finalW * window.devicePixelRatio;
    canvas.height = displayH * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const scale = Math.min(finalW / data.width, displayH / data.height);
    const oX = (finalW - data.width * scale) / 2;
    const oY = (displayH - data.height * scale) / 2;

    const mapToCanvas = (x: number, y: number) => ({
      cx: oX + x * scale,
      cy: oY + y * scale
    });

    // 1. Draw Map Base
    ctx.fillStyle = "#16171b";
    ctx.fillRect(0, 0, finalW, displayH);

    // 2. Draw map borders
    ctx.strokeStyle = "#e63946";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(oX, oY, data.width * scale, data.height * scale);

    // 3. Draw clusters
    ctx.fillStyle = "rgba(59, 130, 246, 0.06)";
    ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const c of data.clusters) {
      const { cx, cy } = mapToCanvas(c.x, c.y);
      ctx.beginPath();
      ctx.arc(cx, cy, clusterSpread * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 4. Draw foods
    for (const f of data.foods) {
      const { cx, cy } = mapToCanvas(f.x, f.y);
      const size = Math.max(1.5, Math.min(4.5, (0.2 + Math.sqrt(f.value) * 0.1) * scale * 2.0));
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
