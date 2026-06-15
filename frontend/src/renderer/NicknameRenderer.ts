// ROLE: Отображение 2D HTML никнеймов над головами змеек. Не трехмерный рендеринг, не HUD.
import * as THREE from "three";

export class NicknameRenderer {
  private nicknameContainer!: HTMLDivElement;
  private nicknameElements = new Map<string, HTMLDivElement>();
  private tempV = new THREE.Vector3();

  constructor() {
    this.setupNicknameContainer();
  }

  public update(msg: any, camera: THREE.PerspectiveCamera, width: number, height: number): void {
    const activeIds = new Set<string>();

    if (!msg.nicknames) return;

    for (let i = 0; i < msg.nicknames.length; i++) {
      const n = msg.nicknames[i];
      if (n.id === msg.myId) {
        continue;
      }
      activeIds.add(n.id);

      this.tempV.set(n.x, n.y, n.z);
      this.tempV.project(camera);

      // Check if behind camera
      if (this.tempV.z > 1.0) {
        const existing = this.nicknameElements.get(n.id);
        if (existing) existing.style.display = "none";
        continue;
      }

      const screenX = (this.tempV.x * 0.5 + 0.5) * width;
      const screenY = (-(this.tempV.y * 0.5) + 0.5) * height;

      let el = this.nicknameElements.get(n.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "nickname-tag";
        el.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          transform-origin: 0 0;
          color: #ffffff;
          font-family: 'Outfit', sans-serif;
          font-size: 11px;
          font-weight: 600;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          pointer-events: none;
          will-change: transform, opacity;
        `;
        this.nicknameContainer.appendChild(el);
        this.nicknameElements.set(n.id, el);
      }

      if (el.textContent !== n.nickname) el.textContent = n.nickname;
      
      const yOffset = n.isTombstone ? "-50%" : "-100%";
      const transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, ${yOffset})`;
      if (el.style.transform !== transform) el.style.transform = transform;
      
      const newOpacity = String(n.opacity);
      if (el.style.opacity !== newOpacity) el.style.opacity = newOpacity;
      
      el.style.display = "";
    }

    // Clean up disconnected players
    this.nicknameElements.forEach((el, id) => {
      if (!activeIds.has(id)) {
        el.remove();
        this.nicknameElements.delete(id);
      }
    });
  }

  public destroy(): void {
    this.nicknameElements.forEach((el) => el.remove());
    this.nicknameElements.clear();
    this.nicknameContainer.remove();
  }

  private setupNicknameContainer(): void {
    let container = document.getElementById("nickname-overlay") as HTMLDivElement;
    if (!container) {
      container = document.createElement("div");
      container.id = "nickname-overlay";
      container.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        overflow: hidden;
        z-index: 10;
      `;
      document.getElementById("app")?.appendChild(container);
    }
    this.nicknameContainer = container;
  }
}
