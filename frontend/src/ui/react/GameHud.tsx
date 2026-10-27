// ROLE: React composition of the in-game HUD widgets. Not game bootstrap or renderer logic.
import { HudPanel } from "./HudPanel";
import { KillFeed } from "./KillFeed";
import { Leaderboard } from "./Leaderboard";

interface GameHudProps {
  isMobile: boolean;
}

export function GameHud({ isMobile }: GameHudProps) {
  return (
    <>
      <HudPanel />
      <Leaderboard
        limit={isMobile ? 3 : 10}
        alwaysOpen={isMobile}
        plain={isMobile}
        hideHeader={isMobile}
        showMobileTitle={isMobile}
      />
      <KillFeed />
    </>
  );
}
