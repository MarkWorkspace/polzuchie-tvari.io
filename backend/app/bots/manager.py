# ROLE: Bot lifecycle and per-tick steering. No rendering, networking or serialization.
from app.bots.brain import choose_turn

BOT_ID_PREFIX = "bot-"
BOT_SKINS = ("#ef4444", "#3b82f6", "#eab308", "#a855f7", "#ec4899", "#22c55e")


class BotManager:
    def __init__(self, world):
        self.world = world
        self.active = False
        self._bot_ids: list[str] = []
        self._next_bot = 1
        self._respawn_remaining: dict[str, float] = {}

    @property
    def enabled(self) -> bool:
        return bool(self.world.config.bots.enabled)

    @property
    def target_count(self) -> int:
        return max(0, min(20, int(self.world.config.bots.count)))

    def start(self) -> None:
        self.active = True
        self.sync()

    def stop(self) -> None:
        self.active = False
        self._remove_all()

    def reset(self) -> None:
        self._remove_all()
        if self.active:
            self.sync()

    def sync(self) -> None:
        """Match the live player list to the current bot config."""
        if not self.active:
            return

        target = self.target_count if self.enabled else 0
        while len(self._bot_ids) > target:
            self._remove_bot(self._bot_ids.pop())
        while len(self._bot_ids) < target:
            self._spawn_bot()

    def update(self) -> None:
        if not self.active:
            return
        self.sync()

        tick_interval = self.world.tick_interval
        for bot_id in self._bot_ids:
            player = self.world.players.get(bot_id)
            if player is None:
                continue

            if player.is_dead:
                self._update_respawn(bot_id, player, tick_interval)
                continue

            self._respawn_remaining.pop(bot_id, None)
            player.steered_by_mouse = True
            player.turn = choose_turn(self.world, player)
            player.accelerating = False

    def _update_respawn(self, bot_id: str, player, tick_interval: float) -> None:
        remaining = self._respawn_remaining.get(
            bot_id, float(self.world.config.bots.respawn_delay_seconds)
        )
        remaining -= tick_interval
        if remaining > 0:
            self._respawn_remaining[bot_id] = remaining
            return

        start_x, start_y = self.world.food_manager.get_safe_spawn_location()
        player.respawn(start_x, start_y)
        self._respawn_remaining.pop(bot_id, None)

    def _spawn_bot(self) -> None:
        index = self._next_bot
        self._next_bot += 1
        bot_id = f"{BOT_ID_PREFIX}{index}"
        self.world.add_player(
            bot_id,
            f"Bot {index}",
            BOT_SKINS[(index - 1) % len(BOT_SKINS)],
        )
        self._bot_ids.append(bot_id)

    def _remove_bot(self, bot_id: str) -> None:
        self.world.players.pop(bot_id, None)
        self.world.client_visibility.pop(bot_id, None)
        self._respawn_remaining.pop(bot_id, None)
        for visible_players in self.world.client_visibility.values():
            visible_players.discard(bot_id)

    def _remove_all(self) -> None:
        while self._bot_ids:
            self._remove_bot(self._bot_ids.pop())
        self._respawn_remaining.clear()
