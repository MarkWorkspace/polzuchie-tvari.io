// ROLE: Accessible restart confirmation modal for the React admin dashboard.
import { useEffect, useRef } from "react";

interface RestartModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function RestartModal({ onCancel, onConfirm }: RestartModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);

  useEffect(() => {
    onCancelRef.current = onCancel;
    onConfirmRef.current = onConfirm;
  }, [onCancel, onConfirm]);

  useEffect(() => {
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="admin-modal-backdrop">
      <div
        className="admin-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="restart-modal-title"
        aria-describedby="restart-modal-description"
      >
        <div className="admin-modal-icon" aria-hidden="true">
          ⚠️
        </div>
        <h3 id="restart-modal-title">Restart Game?</h3>
        <p id="restart-modal-description">
          This will disconnect all players and reset the game state. Food will be respawned.
          Configuration settings are preserved.
        </p>
        <div className="admin-modal-actions">
          <button
            type="button"
            className="login-button admin-secondary-button"
            onClick={onCancel}
            ref={cancelRef}
          >
            Cancel
          </button>
          <button
            type="button"
            className="login-button admin-danger-button"
            onClick={() => onConfirmRef.current()}
          >
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}
