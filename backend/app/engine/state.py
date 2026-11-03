# ROLE: Контейнер игрового состояния: игроки, спектаторы, сетка, менеджеры, tick-метрики и reset.
# Делегирует конфиг, ввод и снимки в ConfigStore/InputRouter/SnapshotService; не содержит игровой логики тика.
import math
import time

from game_config import CELL_SIZE
from app.bots import BotManager
from app.engine.config_store import ConfigStore
from app.engine.entities import Player
from app.engine.food_manager import FoodManager
from app.engine.input_router import InputRouter
from app.engine.snapshot_service import SnapshotService
from app.engine.world_elements import PortalManager, BlackHoleManager
from app.engine.events import EventBus
import app.engine.game as game_orchestrator


class World:
    def __init__(self):
        # Config loading must happen before players exist: it only builds the
        # GameConfig and compiled growth formula. The input/snapshot services
        # hold a back-reference and add no state.
        self.config_store = ConfigStore(self)
        self.input_router = InputRouter(self)
        self.snapshot_service = SnapshotService(self)

        self.players = {}
        self.spectators = set()
        # Set while admin restart closes sockets. New handshakes are rejected
        # until the world reset completes; see app/api/admin.py.
        self.draining = False
        # Monotonic world generation, incremented by reset_state(). An
        # in-flight WebSocket handshake that started in an older generation
        # must not register into the reset world.
        self.restart_epoch = 0
        self.client_visibility = {}
        self.grid_width = self.config.world.width
        self.grid_height = self.config.world.height
        self.target_food_count = self.config.world.target_food_count
        self._recompute_grid_cells()

        self.full_players_cache = {}
        self.mini_players_cache = {}
        self.kill_events = []
        self.tombstones = []
        self.tombstone_seq = 0
        self.spatial_grid = {}
        # Monotonic frame sequence, advanced exactly once per tick by the
        # orchestrator. Every client frame built from the same tick carries the
        # same value, so a client can detect a gap or a duplicate.
        self.frame_seq = 0
        self.server_tick = 0
        # Tick liveness metrics written only by server.game_loop. reset_state()
        # must not clear them: process liveness is independent of game
        # generation, and a restart is not a reason to report a stale tick.
        self.last_tick_monotonic = time.monotonic()
        self.tick_count = 0
        self.tick_duration_ms = 0.0
        self.tick_errors = 0
        # Disconnected players/spectators are removed by the tick orchestrator,
        # not by the connection lifecycle, so death killfeed entries and food
        # drops land in the tick that reports them.
        self.pending_removals: set[str] = set()

        self.events = EventBus()
        self.food_manager = FoodManager(self)
        self.portal_manager = PortalManager(self)
        self.bh_manager = BlackHoleManager(self, self.portal_manager)

        self.portal_manager.update_slots(force_roll=True)
        self.bh_manager.update_slots(force_roll=True)

        self._config_updated_this_tick = False
        self._config_broadcast_needed = False
        self.input_queue = []
        self.bot_manager = BotManager(self)

    def _recompute_grid_cells(self):
        self._grid_width_cells = max(1, int(math.ceil(self.grid_width / CELL_SIZE)))
        self._grid_height_cells = max(1, int(math.ceil(self.grid_height / CELL_SIZE)))

    @property
    def tick_interval(self):
        return 1.0 / self.config.simulation.tick_rate

    def tick_smoothing(self, smoothing_at_20hz):
        return 1.0 - ((1.0 - smoothing_at_20hz) ** (self.tick_interval / 0.05))

    # Config ownership lives in ConfigStore. These properties keep the historic
    # ``world.config``/``world.config_file_path`` attribute contract (including
    # direct assignment) identical for API, serialization and tests.
    @property
    def config(self):
        return self.config_store.config

    @config.setter
    def config(self, value):
        self.config_store.config = value

    @property
    def config_file_path(self):
        return self.config_store.config_file_path

    @config_file_path.setter
    def config_file_path(self, value):
        self.config_store.config_file_path = value

    @property
    def growth_segment_cost_func(self):
        return self.config_store.growth_segment_cost_func

    @growth_segment_cost_func.setter
    def growth_segment_cost_func(self, value):
        self.config_store.growth_segment_cost_func = value

    @property
    def _growth_formula_error_logged(self):
        return self.config_store._growth_formula_error_logged

    @_growth_formula_error_logged.setter
    def _growth_formula_error_logged(self, value):
        self.config_store._growth_formula_error_logged = value

    @property
    def _compiled_growth_cost(self):
        return self.config_store._compiled_growth_cost

    @_compiled_growth_cost.setter
    def _compiled_growth_cost(self, value):
        self.config_store._compiled_growth_cost = value

    # Thin config wrappers preserve the historic World API and instance-level
    # monkeypatch points. ConfigStore routes transactional live/file steps back
    # through these wrappers.
    def _load_config_from_disk(self):
        return self.config_store._load_config_from_disk()

    def _update_compiled_formulas(self):
        return self.config_store._update_compiled_formulas()

    def _safe_growth_cost(self, score, length):
        return self.config_store._safe_growth_cost(score, length)

    def align_player_growth(self, player):
        return self.config_store.align_player_growth(player)

    def _backup_config_file(self):
        return self.config_store._backup_config_file()

    def _restore_config_file(self, old_config, config_existed, backup_ok):
        return self.config_store._restore_config_file(old_config, config_existed, backup_ok)

    def _save_config_to_disk(self, config=None):
        return self.config_store._save_config_to_disk(config)

    def get_config(self):
        return self.config_store.get_config()

    def _apply_live_config(self, candidate, patch, old_width, old_height, old_cluster_count):
        return self.config_store._apply_live_config(
            candidate, patch, old_width, old_height, old_cluster_count
        )

    def _restore_live_config(self, old_config, pending_growth_snapshot):
        return self.config_store._restore_live_config(old_config, pending_growth_snapshot)

    def update_config(self, patch):
        return self.config_store.update_config(patch)

    def add_player(self, player_id, nickname="Игрок", skin="#22c55e"):
        self.spectators.discard(player_id)
        start_x, start_y = self.food_manager.get_safe_spawn_location()
        self.players[player_id] = Player(player_id, start_x, start_y, self.config, nickname, skin)

    def remove_player(self, player_id, emit_death=True):
        """Drop a player/spectator identity from the world.

        ``emit_death`` controls whether the removal counts as a death. It must
        stay ``False`` for cleanup of identities that never really played
        (failed handshake, restart reject), otherwise they show up in the
        killfeed and drop food. Real disconnects are queued through
        ``queue_player_removal`` and removed at the tick boundary with events.
        """
        p = self.players.get(player_id)
        if emit_death and p and not p.is_dead:
            self.kill_events.append({"killer": None, "victim": player_id})
            self.events.emit("player_died", player=p, killer_pid=None)
            p.is_dead = True

        self.players.pop(player_id, None)
        self.spectators.discard(player_id)
        self.input_queue = [item for item in self.input_queue if item[0] != player_id]
        self.client_visibility.pop(player_id, None)
        for visible_players in self.client_visibility.values():
            visible_players.discard(player_id)

    def queue_player_removal(self, player_id):
        """Schedule a removal for the start of the next tick."""
        self.pending_removals.add(player_id)

    def cancel_pending_removal(self, player_id):
        """Cancel a queued removal (e.g. the player reconnected in time)."""
        self.pending_removals.discard(player_id)

    def process_pending_removals(self):
        """Apply queued removals at the tick boundary.

        Called by the orchestrator after transient events were cleared, so the
        death/drop produced here belongs to the tick being broadcast. The copy
        and per-id discard make the pass re-entrancy safe.
        """
        for player_id in list(self.pending_removals):
            self.pending_removals.discard(player_id)
            self.remove_player(player_id)

    def reset_player_input(self, player_id):
        return self.input_router.reset_player_input(player_id)

    def update_direction(self, player_id, action):
        return self.input_router.update_direction(player_id, action)

    def tick(self):
        game_orchestrator.tick(self)

    def get_delta_state(
        self,
        client_id,
        is_full=False,
        update_visibility=True,
        return_visibility=False,
        serialize_proto=False,
    ):
        return self.snapshot_service.get_delta_state(
            client_id,
            is_full,
            update_visibility,
            return_visibility,
            serialize_proto,
        )

    def get_full_state(self, client_id, serialize_proto=False):
        return self.snapshot_service.get_full_state(client_id, serialize_proto)

    def set_client_visibility(self, client_id, visible_players):
        return self.snapshot_service.set_client_visibility(client_id, visible_players)

    def update_player_score(self, player_id, score):
        if player_id in self.players:
            p = self.players[player_id]
            p.score = score
            self.align_player_growth(p)

    def get_health_info(self):
        return {
            "players_count": len(self.players),
            "foods_count": len(self.food_manager.foods),
            "tick_rate": self.config.simulation.tick_rate,
            "tick_age_ms": round(max(0.0, time.monotonic() - self.last_tick_monotonic) * 1000.0, 1),
            "tick_count": self.tick_count,
            "tick_duration_ms": self.tick_duration_ms,
            "tick_errors": self.tick_errors,
        }

    def reset_state(self):
        self.restart_epoch += 1
        self.frame_seq = 0
        self.server_tick = 0
        self.players.clear()
        self.spectators.clear()
        self.client_visibility.clear()
        self.kill_events.clear()
        self.tombstones.clear()
        self.tombstone_seq = 0
        self.input_queue.clear()
        self.pending_removals.clear()
        self.full_players_cache.clear()
        self.mini_players_cache.clear()
        self.spatial_grid = {}

        self.grid_width = self.config.world.width
        self.grid_height = self.config.world.height
        self.target_food_count = self.config.world.target_food_count
        self._recompute_grid_cells()

        self.food_manager.clear()
        self.portal_manager.update_slots(force_roll=True)
        self.bh_manager.update_slots(force_roll=True)
        self.bot_manager.reset()
        self._config_updated_this_tick = False
        self._config_broadcast_needed = False
