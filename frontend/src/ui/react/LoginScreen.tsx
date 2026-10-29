// ROLE: React login screen for nickname and skin selection, including cross-tab session conflicts.
import { type FormEvent, useEffect, useRef, useState } from "react";
import { SKINS } from "../../game/Config";
import { type TranslationKey, t } from "../../lib/i18n";

const SKIN_KEYS: Record<string, TranslationKey> = {
  "#ef4444": "skin.red",
  "#3b82f6": "skin.blue",
  "#eab308": "skin.yellow",
  "#22c55e": "skin.green",
  "#ec4899": "skin.pink",
  "#a855f7": "skin.purple",
  zebra: "skin.zebra",
  tiger: "skin.tiger",
  rainbow: "skin.rainbow",
  cyberpunk: "skin.cyberpunk",
};

export type PlayResult = "started" | "busy";
export type TakeOverResult = "started" | "timeout";

export interface LoginScreenActions {
  onPlay: (nickname: string, skin: string) => Promise<PlayResult>;
  onTakeOver: (nickname: string, skin: string) => Promise<TakeOverResult>;
  onSpectate: () => void;
}

interface ConflictProfile {
  nickname: string;
  skin: string;
}

function getInitialSkin(): string {
  const saved = localStorage.getItem("snake-skin");
  return SKINS.some((skin) => skin.id === saved) ? (saved as string) : SKINS[3].id;
}

function rememberProfile(nickname: string, skin: string): void {
  localStorage.setItem("snake-nickname", nickname);
  localStorage.setItem("snake-skin", skin);
}

export function LoginScreen({ onPlay, onTakeOver, onSpectate }: LoginScreenActions) {
  const [nickname, setNickname] = useState(() => localStorage.getItem("snake-nickname") || "");
  const [selectedSkin, setSelectedSkin] = useState(getInitialSkin);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<ConflictProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;

    const name = nickname.trim() || t("game.defaultPlayer");
    rememberProfile(name, selectedSkin);
    setBusy(true);
    setError(null);
    try {
      const result = await onPlay(name, selectedSkin);
      if (result === "busy") {
        setConflict({ nickname: name, skin: selectedSkin });
      }
    } catch {
      setError(t("session.startFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleTakeOver = async () => {
    if (!conflict || busy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await onTakeOver(conflict.nickname, conflict.skin);
      if (result === "timeout") {
        setError(t("session.takeoverTimeout"));
      }
    } catch {
      setError(t("session.startFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (conflict) {
    return (
      <div className="login-overlay">
        <div className="login-card session-card">
          <h1 className="login-logo">Polzuchie-tvari.io</h1>
          <h2 className="session-title">{t("session.busyTitle")}</h2>
          <p className="session-hint">{t("session.busyHint")}</p>
          {error ? (
            <p className="session-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="session-actions">
            <button type="button" className="login-button" disabled={busy} onClick={handleTakeOver}>
              {busy ? t("session.waiting") : t("session.playHere")}
            </button>
            <button
              type="button"
              className="login-button login-secondary"
              disabled={busy}
              onClick={onSpectate}
            >
              {t("session.spectate")}
            </button>
            <button
              type="button"
              className="login-button login-ghost"
              disabled={busy}
              onClick={() => {
                setConflict(null);
                setError(null);
              }}
            >
              {t("session.cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-overlay">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-logo">Polzuchie-tvari.io</h1>
        <div className="skin-section">
          <h3 className="skin-title">{t("login.selectSkin")}</h3>
          <div className="skin-selector">
            {SKINS.map((skin) => {
              const skinKey = SKIN_KEYS[skin.id];
              return (
                <button
                  key={skin.id}
                  type="button"
                  className={`skin-option ${selectedSkin === skin.id ? "active" : ""}`}
                  style={{ background: skin.bg }}
                  title={skinKey ? t(skinKey) : skin.name}
                  aria-label={skinKey ? t(skinKey) : skin.name}
                  aria-pressed={selectedSkin === skin.id}
                  onClick={() => setSelectedSkin(skin.id)}
                />
              );
            })}
          </div>
        </div>
        <div className="input-section">
          <input
            ref={inputRef}
            type="text"
            className="input-field"
            maxLength={16}
            placeholder={t("login.nickname")}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            aria-label={t("login.nickname")}
          />
        </div>
        {error ? (
          <p className="session-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="login-button" disabled={busy}>
          {busy ? t("session.waiting") : t("login.play")}
        </button>
      </form>
    </div>
  );
}
