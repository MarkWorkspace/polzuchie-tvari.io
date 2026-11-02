// ROLE: Generic blocking error overlay with a reload action. Knows nothing about WebGL or renderers.
import { useId, useRef } from "react";
import { t } from "../../lib/i18n";
import { useFocusTrap } from "./useFocusTrap";

export interface GameErrorOverlayProps {
  title: string;
  message: string;
  onReload: () => void;
}

export function GameErrorOverlay({ title, message, onReload }: GameErrorOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const reloadRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useFocusTrap(overlayRef, { initialFocus: reloadRef });

  return (
    <div
      ref={overlayRef}
      className="game-error-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="game-error-modal glass-panel">
        <h1 id={titleId} className="game-error-title">
          {title}
        </h1>
        <p className="game-error-message">{message}</p>
        <button ref={reloadRef} type="button" className="game-error-reload" onClick={onReload}>
          {t("session.reload")}
        </button>
      </div>
    </div>
  );
}
