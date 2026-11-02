// ROLE: Generic blocking error overlay with a reload action. Knows nothing about WebGL or renderers.
import { t } from "../../lib/i18n";

export interface GameErrorOverlayProps {
  title: string;
  message: string;
  onReload: () => void;
}

export function GameErrorOverlay({ title, message, onReload }: GameErrorOverlayProps) {
  return (
    <div className="game-error-overlay" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="game-error-modal glass-panel">
        <h1 className="game-error-title">{title}</h1>
        <p className="game-error-message">{message}</p>
        <button type="button" className="game-error-reload" onClick={onReload}>
          {t("session.reload")}
        </button>
      </div>
    </div>
  );
}
