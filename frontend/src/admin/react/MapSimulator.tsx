// ROLE: Canvas preview of food distribution for the React admin dashboard. No game logic.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConfigEditor } from "../ConfigEditor";
import { FoodSimulator } from "../FoodSimulator";

interface MapSimulatorProps {
  editor: ConfigEditor;
  revision: number;
  visible: boolean;
}

export function MapSimulator({ editor, revision, visible }: MapSimulatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSignature = useRef<string | null>(null);
  const [seed, setSeed] = useState(42);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision invalidates the mutable editor model.
  const config = useMemo(() => editor.getSimConfig(), [editor, revision]);

  useEffect(() => {
    if (!visible || !canvasRef.current || !config) return;
    const signature = `${seed}:${JSON.stringify(config)}`;
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;
    const simulator = new FoodSimulator(canvasRef.current);
    simulator.simulateAndDraw(config, seed);
  }, [config, seed, visible]);

  if (!visible || !config) return null;

  return (
    <section className="config-card admin-map-card">
      <div className="admin-map-header">
        <h3 className="admin-section-title">
          <span>🗺️</span> Map Simulation
        </h3>
        <button
          type="button"
          className="login-button admin-secondary-button"
          onClick={() => setSeed(Math.floor(Math.random() * 1000))}
        >
          🎲 Roll Seed
        </button>
      </div>

      <div className="admin-map-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="admin-map-canvas"
          aria-label="Food distribution preview"
        />
      </div>

      <div className="admin-map-stats">
        <span>
          Grid Size:{" "}
          <strong>
            {config.width}×{config.height}
          </strong>
        </span>
        <span>
          Food Count: <strong>{config.target_food_count}</strong>
        </span>
        <span>
          Clusters: <strong>{config.cluster_count}</strong>
        </span>
        <span>
          Cluster Spread: <strong>{config.cluster_spread}</strong>
        </span>
      </div>
    </section>
  );
}
