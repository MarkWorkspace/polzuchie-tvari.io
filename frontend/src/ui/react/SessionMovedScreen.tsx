// ROLE: React screen shown when another tab takes over the player session.
import { t } from "../../lib/i18n";

interface SessionMovedScreenProps {
  onReload: () => void;
  onSpectate: () => void;
}

export function SessionMovedScreen({ onReload, onSpectate }: SessionMovedScreenProps) {
  return (
    <div className="login-overlay">
      <div className="login-card session-card">
        <h1 className="login-logo">Polzuchie-tvari.io</h1>
        <h2 className="session-title">{t("session.movedTitle")}</h2>
        <p className="session-hint">{t("session.movedHint")}</p>
        <div className="session-actions">
          <button type="button" className="login-button" onClick={onSpectate}>
            {t("session.spectate")}
          </button>
          <button type="button" className="login-button login-secondary" onClick={onReload}>
            {t("session.reload")}
          </button>
        </div>
      </div>
    </div>
  );
}
