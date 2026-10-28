// ROLE: React settings drawer (controls, FPS, guide, admin link, leaderboard).
import { useEffect, useRef, useState } from "react";
import type { ControlMode, InputManager } from "../../game/InputManager";
import { t } from "../../lib/i18n";
import type { RenderQuality, RenderQualityControl } from "../../renderer/RenderQuality";
import { Leaderboard } from "./Leaderboard";

export interface SettingsCallbacks {
  onAdminClick: () => void;
  onFpsToggle: (enabled: boolean) => void;
}

interface SettingsPanelProps {
  inputManager: InputManager | null;
  callbacks: SettingsCallbacks;
  qualityControl?: RenderQualityControl | null;
}

const IS_MOBILE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  window.innerWidth <= 768;

export function SettingsPanel({ inputManager, callbacks, qualityControl }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [showFps, setShowFps] = useState(() => localStorage.getItem("snake-show-fps") === "true");
  const [mode, setMode] = useState<ControlMode>(() => inputManager?.getControlMode() ?? "mouse");
  const [quality, setQuality] = useState<RenderQuality>(
    () => qualityControl?.getQuality() ?? "auto",
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const debugMode = new URLSearchParams(window.location.search).get("debug") === "true";

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        wasOpen.current = false;
        triggerRef.current?.focus();
      }
      return;
    }

    wasOpen.current = true;
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const selectMode = (nextMode: ControlMode) => {
    inputManager?.setControlMode(nextMode);
    setMode(nextMode);
  };

  const toggleFps = () => {
    const next = !showFps;
    setShowFps(next);
    localStorage.setItem("snake-show-fps", next ? "true" : "false");
    callbacks.onFpsToggle(next);
  };

  const guideKey =
    mode === "tilt"
      ? "guide.tiltSteer"
      : mode === "keyboard"
        ? "guide.keySteer"
        : "guide.touchSteer";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`settings-trigger ${open ? "hidden" : ""}`}
        aria-label={t("menu.settings")}
        aria-expanded={open}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        onClick={() => setOpen(true)}
      >
        ☰
      </button>

      <button
        type="button"
        className={`settings-overlay ${open ? "visible" : ""}`}
        aria-label={t("menu.closeOverlay")}
        aria-hidden={!open}
        disabled={!open}
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />

      <aside
        className={`settings-drawer custom-scrollbar ${open ? "open" : ""}`}
        aria-hidden={!open}
        aria-label={t("menu.title")}
        aria-modal="true"
        role="dialog"
        inert={!open}
      >
        <div className="drawer-header">
          <span className="drawer-title">{t("menu.title")}</span>
          <button
            ref={closeRef}
            type="button"
            className="drawer-close"
            aria-label={t("menu.close")}
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

        {inputManager ? (
          <section className="drawer-section">
            <h3 className="drawer-section-title">{t("menu.controls")}</h3>
            <div className="drawer-control-list">
              {!IS_MOBILE ? (
                <ControlOption
                  active={mode === "keyboard"}
                  icon="⌨"
                  title={t("control.keyboard")}
                  description={t("control.keyboardDesc")}
                  onClick={() => selectMode("keyboard")}
                />
              ) : null}
              <ControlOption
                active={mode === "mouse"}
                icon="🖱"
                title={IS_MOBILE ? t("control.touchDrag") : t("control.mouseSteer")}
                description={IS_MOBILE ? t("control.touchDragDesc") : t("control.mouseSteerDesc")}
                onClick={() => selectMode("mouse")}
              />
              {IS_MOBILE ? (
                <ControlOption
                  active={mode === "tilt"}
                  icon="📱"
                  title={t("control.tilt")}
                  description={t("control.tiltDesc")}
                  onClick={() => selectMode("tilt")}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {qualityControl ? (
          <section className="drawer-section">
            <h3 className="drawer-section-title">{t("menu.graphics")}</h3>
            <label className="drawer-select-row">
              <span>{t("menu.quality")}</span>
              <select
                className="drawer-select"
                value={quality}
                onChange={(event) => {
                  const next = event.currentTarget.value as RenderQuality;
                  setQuality(next);
                  qualityControl.setQuality(next);
                }}
              >
                <option value="auto">{t("quality.auto")}</option>
                <option value="high">{t("quality.high")}</option>
                <option value="medium">{t("quality.medium")}</option>
                <option value="low">{t("quality.low")}</option>
              </select>
            </label>
            <p className="drawer-hint">{t("menu.qualityHint")}</p>
          </section>
        ) : null}

        <section className="drawer-section">
          <h3 className="drawer-section-title">{t("menu.settings")}</h3>
          <div className="drawer-control-list">
            <ControlOption
              active={showFps}
              icon="📈"
              title={t("menu.showFps")}
              description={t("menu.showFpsDesc")}
              onClick={toggleFps}
            />
          </div>
        </section>

        {inputManager ? (
          <section className="drawer-guide">
            <h3 className="drawer-section-title">{t("menu.guide")}</h3>
            <div className="drawer-guide-content">
              <div>🎯 {t(guideKey)}</div>
              <div>
                🚀{" "}
                {mode === "keyboard"
                  ? t("guide.keyBoost")
                  : IS_MOBILE
                    ? t("guide.touchBoost")
                    : t("guide.mouseBoost")}
              </div>
              <div>🍎 {t("guide.collectFood")}</div>
              <div>⚠️ {t("guide.collision")}</div>
            </div>
          </section>
        ) : null}

        {debugMode ? (
          <section className="drawer-section">
            <button
              type="button"
              className="drawer-control-option"
              onClick={() => window.open("/?spectator=debug", "_blank")}
            >
              <span className="control-icon">👁</span>
              <span className="control-text">
                <span className="control-title">{t("menu.openDebugSpectator")}</span>
                <span className="control-desc">{t("menu.openDebugSpectatorDesc")}</span>
              </span>
            </button>
          </section>
        ) : null}

        {open ? (
          <div className="drawer-leaderboard">
            <Leaderboard limit={10} alwaysOpen plain />
          </div>
        ) : null}

        <button type="button" className="drawer-admin-link" onClick={callbacks.onAdminClick}>
          <span>⚙</span> {t("menu.admin")}
        </button>
      </aside>
    </>
  );
}

function ControlOption({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`drawer-control-option ${active ? "active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="control-icon">{icon}</span>
      <span className="control-text">
        <span className="control-title">{title}</span>
        <span className="control-desc">{description}</span>
      </span>
    </button>
  );
}
