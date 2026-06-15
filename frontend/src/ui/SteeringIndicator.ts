// ROLE: Шкала поворота мыши.
export class SteeringIndicator {
  private container: HTMLDivElement;
  private indicatorElement: HTMLDivElement | null = null;
  private barElement: HTMLDivElement | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.render();
  }

  public destroy(): void {
    if (this.indicatorElement) {
      this.indicatorElement.remove();
      this.indicatorElement = null;
    }
  }

  public update(turn: number, controlMode: string): void {
    if (!this.indicatorElement || !this.barElement) return;

    if (controlMode === "keyboard") {
      this.indicatorElement.style.display = "none";
      return;
    }

    this.indicatorElement.style.display = "block";
    this.updateBarPosition(turn);
  }

  private render(): void {
    this.indicatorElement = document.createElement("div");
    this.indicatorElement.className = "steering-indicator-container hud-interactive";
    this.indicatorElement.style.display = "none";

    this.barElement = document.createElement("div");
    this.barElement.className = "steering-bar";
    this.indicatorElement.appendChild(this.barElement);

    this.container.appendChild(this.indicatorElement);
  }

  private updateBarPosition(turn: number): void {
    if (!this.barElement) return;
    const clampedTurn = Math.max(-1.0, Math.min(1.0, turn));

    if (clampedTurn >= 0) {
      this.barElement.style.left = "50%";
      this.barElement.style.width = `${clampedTurn * 50}%`;
      this.barElement.style.background = "linear-gradient(90deg, var(--accent-blue), var(--accent-cyan))";
    } else {
      const widthPercent = -clampedTurn * 50;
      this.barElement.style.left = `${50 - widthPercent}%`;
      this.barElement.style.width = `${widthPercent}%`;
      this.barElement.style.background = "linear-gradient(90deg, #f87171, var(--accent-blue))";
    }
  }
}
