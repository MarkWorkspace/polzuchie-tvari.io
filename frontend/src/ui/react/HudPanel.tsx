// ROLE: React score panel, score feed and ping indicator. No game logic.
import { t } from "../../lib/i18n";
import { useGamePing, useGameScore, useGameStatus } from "./gameUiStore";

function pingClass(ping: number | null): string {
  if (ping === null) return "offline";
  if (ping > 150) return "bad";
  if (ping > 75) return "warn";
  return "good";
}

export function HudPanel() {
  const status = useGameStatus();
  const ping = useGamePing();
  const { score, feed } = useGameScore();

  const isConnected = status.status === "connected";
  const guideKey = status.controlMode === "keyboard" ? "status.kbdGuide" : "status.mouseGuide";
  const pendingText =
    status.msg ?? (status.msgKey ? t(status.msgKey, status.msgParams) : t("status.connecting"));

  return (
    <>
      <div className="score-panel glass-panel hud-interactive">
        <span className="score-title">Score</span>
        <span className="score-value">{score}</span>
        <div className={`hud-guide ${isConnected ? "connected" : "pending"}`}>
          {isConnected ? (
            <>
              <div className="hud-guide-title">{t("help.controls")}:</div>
              {t(guideKey)
                .split("|")
                .map((line) => (
                  <div key={line}>{line.trim()}</div>
                ))}
            </>
          ) : (
            pendingText
          )}
        </div>
      </div>

      <div className="score-feed">
        {feed.map((item) => (
          <div
            key={item.id}
            className={`score-feed-item ${item.delta > 0 ? "positive" : "negative"}`}
          >
            {item.delta > 0 ? `+${item.delta}` : item.delta}
          </div>
        ))}
      </div>

      <div className={`hud-ping ${pingClass(ping)}`}>
        Ping:{" "}
        <span className="ping-value">{ping === null ? "offline" : `${Math.round(ping)} ms`}</span>
      </div>
    </>
  );
}
