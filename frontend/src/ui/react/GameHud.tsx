// ROLE: React composition of the in-game HUD widgets. Not game bootstrap or renderer logic.
import type { CSSProperties } from "react";
import { t } from "../../lib/i18n";
import { useGameStatus } from "./gameUiStore";
import { HudPanel } from "./HudPanel";
import { KillFeed } from "./KillFeed";
import { Leaderboard } from "./Leaderboard";

interface GameHudProps {
  isMobile: boolean;
}

// Kept out of the visible layout: screen readers still announce the live region.
const OFFSCREEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

export function GameHud({ isMobile }: GameHudProps) {
  const status = useGameStatus();
  const pendingText =
    status.msg ?? (status.msgKey ? t(status.msgKey, status.msgParams) : t("status.connecting"));
  const announcement = status.status === "connected" ? "" : pendingText;

  return (
    <>
      <HudPanel isMobile={isMobile} />
      <Leaderboard
        limit={isMobile ? 3 : 10}
        alwaysOpen={isMobile}
        plain={isMobile}
        hideHeader={isMobile}
        showMobileTitle={isMobile}
      />
      <KillFeed />
      <span role="status" aria-live="polite" aria-atomic="true" style={OFFSCREEN}>
        {announcement}
      </span>
    </>
  );
}
