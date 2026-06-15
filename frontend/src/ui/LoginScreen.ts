// ROLE: Экран входа.
import { SKINS } from "../game/Config";
import { t } from "../lib/i18n";

function getSkinTranslationKey(id: string): any {
  if (id === "#ef4444") return "skin.red";
  if (id === "#3b82f6") return "skin.blue";
  if (id === "#eab308") return "skin.yellow";
  if (id === "#22c55e") return "skin.green";
  if (id === "#ec4899") return "skin.pink";
  if (id === "#a855f7") return "skin.purple";
  if (id === "zebra") return "skin.zebra";
  if (id === "tiger") return "skin.tiger";
  if (id === "rainbow") return "skin.rainbow";
  if (id === "cyberpunk") return "skin.cyberpunk";
  return null;
}

export class LoginScreen {
  private container: HTMLDivElement;
  private overlay: HTMLDivElement | null = null;
  private selectedSkin: string = SKINS[3].id; // Default to green
  private onPlayCallback: (nickname: string, skin: string) => void;

  constructor(container: HTMLDivElement, onPlay: (nickname: string, skin: string) => void) {
    this.container = container;
    this.onPlayCallback = onPlay;
    this.render();
  }

  public hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private render(): void {
    const savedName = localStorage.getItem("snake-nickname") || "";

    this.overlay = document.createElement("div");
    this.overlay.className = "login-overlay";
    this.overlay.innerHTML = `
      <div class="login-card">
        <h1 class="login-logo">Polzuchie-tvari.io</h1>
        <div class="skin-section">
          <h3 class="skin-title">${t("login.selectSkin")}</h3>
          <div class="skin-selector" id="skin-selector"></div>
        </div>
        <div class="input-section">
          <input type="text" id="nickname-input" class="input-field" maxlength="16" placeholder="${t("login.nickname")}" autofocus />
        </div>
        <button id="play-btn" class="login-button">${t("login.play")}</button>
      </div>
    `;

    this.container.appendChild(this.overlay);
    
    const input = this.overlay.querySelector("#nickname-input") as HTMLInputElement;
    if (input && savedName) {
      input.value = savedName;
    }

    this.setupSkinSelector();
    this.bindEvents();
  }

  private setupSkinSelector(): void {
    const selector = this.overlay?.querySelector("#skin-selector");
    if (!selector) return;

    SKINS.forEach((skin) => {
      const btn = document.createElement("div");
      btn.className = `skin-option ${this.selectedSkin === skin.id ? "active" : ""}`;
      btn.style.background = skin.bg;
      const skinKey = getSkinTranslationKey(skin.id);
      btn.title = skinKey ? t(skinKey) : skin.name;
      btn.dataset.id = skin.id;

      btn.addEventListener("click", () => {
        this.selectedSkin = skin.id;
        selector.querySelectorAll(".skin-option").forEach((el) => {
          el.classList.toggle("active", (el as HTMLElement).dataset.id === skin.id);
        });
      });

      selector.appendChild(btn);
    });
  }

  private bindEvents(): void {
    const playBtn = this.overlay?.querySelector("#play-btn");
    const input = this.overlay?.querySelector("#nickname-input") as HTMLInputElement;

    const triggerPlay = () => {
      const name = input?.value.trim() || t("game.defaultPlayer");
      localStorage.setItem("snake-nickname", name);
      this.onPlayCallback(name, this.selectedSkin);
    };

    playBtn?.addEventListener("click", triggerPlay);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") triggerPlay();
    });
  }
}
