// ROLE: Состояние и бизнес-логика конфигурации админ-панели. Без UI.
import { HIDDEN_FIELDS, getNewSectionKey } from "./AdminLabels";

export class ConfigEditor {
  private password = "";
  private config: any = null;
  private drafts: Record<string, string> = {};
  private foodTypes: { value: number; weight: number; color: string; image: string; expanded?: boolean }[] = [];

  constructor(password: string) {
    this.password = password;
  }

  public getConfig(): any { return this.config; }
  public getDrafts(): Record<string, string> { return this.drafts; }
  public getFoodTypes(): any[] { return this.foodTypes; }

  public setDraft(key: string, value: string): void {
    this.drafts[key] = value;
  }

  public async load(): Promise<string> {
    try {
      const res = await fetch(this.getApiUrl(), { headers: { "x-admin-password": this.password } });
      if (!res.ok) return `Access error: Invalid password (${res.status})`;
      this.config = await res.json();
      this.resetLocalDrafts();
      return "OK";
    } catch (e) {
      return `Failed to connect to server: ${String(e)}`;
    }
  }

  public async save(): Promise<string> {
    const patch = this.buildPatch();
    if (Object.keys(patch).length === 0) return "No changes detected";
    try {
      const res = await fetch(this.getApiUrl(), {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-admin-password": this.password },
        body: JSON.stringify(patch)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return err?.detail || `Error saving config: ${res.status}`;
      }
      this.config = await res.json();
      this.resetLocalDrafts();
      return "✓ Configuration successfully updated in real-time!";
    } catch (e) {
      return `Network error: ${String(e)}`;
    }
  }

  public resetLocalDrafts(): void {
    if (!this.config) return;
    this.drafts = {};
    for (const [sec, vals] of Object.entries(this.config)) {
      for (const [key, value] of Object.entries(vals as any)) {
        if (HIDDEN_FIELDS.has(key)) continue;
        this.drafts[`${sec}.${key}`] = String(value);
      }
    }
    this.foodTypes = (this.config.food?.types || []).map((ft: any) => ({
      value: ft.value,
      weight: ft.weight,
      color: ft.color,
      image: ft.image || "",
      expanded: false
    }));
  }

  public addFoodType(): void {
    this.foodTypes.push({ value: 1, weight: 10, color: "#ffffff", image: "", expanded: true });
  }

  public removeFoodType(idx: number): void {
    this.foodTypes.splice(idx, 1);
  }

  public updateFoodType(idx: number, key: string, value: any): void {
    if (this.foodTypes[idx]) {
      (this.foodTypes[idx] as any)[key] = value;
    }
  }

  public getModifiedCounts(): Record<string, number> {
    const counts: Record<string, number> = { world_network: 0, snake_physics: 0, food_boost: 0, camera_visual: 0, all: 0 };
    if (!this.config) return counts;
    let total = 0;
    for (const [sec, vals] of Object.entries(this.config)) {
      for (const [key, value] of Object.entries(vals as any)) {
        if (HIDDEN_FIELDS.has(key)) continue;
        if ((this.drafts[`${sec}.${key}`] ?? String(value)) !== String(value)) {
          counts[getNewSectionKey(sec)] = (counts[getNewSectionKey(sec)] || 0) + 1;
          total++;
        }
      }
    }
    const cleanTypes = this.foodTypes.map(t => ({ value: Number(t.value), weight: Number(t.weight), color: t.color, image: t.image }));
    if (JSON.stringify(cleanTypes) !== JSON.stringify(this.config.food?.types || [])) {
      counts.food_boost += 1;
      total++;
    }
    counts.all = total;
    return counts;
  }

  public getSimConfig(): any {
    if (!this.config) return null;
    return {
      width: Math.max(20, parseInt(this.drafts["world.width"]) || 100),
      height: Math.max(20, parseInt(this.drafts["world.height"]) || 100),
      target_food_count: Math.max(0, parseInt(this.drafts["world.target_food_count"]) || 100),
      cluster_count: Math.max(1, parseInt(this.drafts["world.cluster_count"]) || 5),
      cluster_spawn_chance: Math.max(0, parseFloat(this.drafts["world.cluster_spawn_chance"]) || 0.8),
      cluster_spread: Math.max(0.1, parseFloat(this.drafts["world.cluster_spread"]) || 5.0),
      foodTypes: this.foodTypes
    };
  }

  private buildPatch(): Record<string, any> {
    if (!this.config) return {};
    const patch: Record<string, any> = {};
    for (const [sec, vals] of Object.entries(this.config)) {
      for (const [key, value] of Object.entries(vals as any)) {
        if (HIDDEN_FIELDS.has(key)) continue;
        const draft = this.drafts[`${sec}.${key}`];
        if (draft !== undefined && draft !== String(value)) {
          patch[sec] = patch[sec] || {};
          patch[sec][key] = key === "growth_score_per_segment" ? draft : Number(draft);
        }
      }
    }
    const cleanTypes = this.foodTypes.map(t => ({ value: Number(t.value), weight: Number(t.weight), color: t.color, image: t.image }));
    if (JSON.stringify(cleanTypes) !== JSON.stringify(this.config.food?.types || [])) {
      patch.food = patch.food || {};
      patch.food.types = cleanTypes;
    }
    return patch;
  }

  private getApiUrl(): string {
    const host = window.location.hostname || "127.0.0.1";
    const port = window.location.port;
    const protocol = window.location.protocol;
    const isStd = port === "" || port === "80" || port === "443";
    return isStd ? `${protocol}//${host}/ws/admin/config` : `${protocol}//${host}:8000/admin/config`;
  }
}
