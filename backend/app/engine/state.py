# ROLE: Контейнер игрового состояния, загрузка конфигурации, управление игроками. Не содержит игровой логики тика.
import os
import json
import logging
import math
import shutil
import tempfile
import errno
from copy import deepcopy
from pathlib import Path

from game_config import GameConfig, CELL_SIZE
from app.bots import BotManager
from app.engine.entities import Player
from app.engine.food_manager import FoodManager
from app.engine.world_elements import PortalManager, BlackHoleManager
from app.engine.systems.formula_parser import compile_growth_formula
from app.engine.events import EventBus
import app.engine.game as game_orchestrator

logger = logging.getLogger(__name__)

VALID_ACTIONS = frozenset(
    {
        "LEFT_DOWN",
        "LEFT_UP",
        "RIGHT_DOWN",
        "RIGHT_UP",
        "SPACE_DOWN",
        "SPACE_UP",
        "RESPAWN",
    }
)


class World:
    def __init__(self):
        self.config = GameConfig()
        self.config_file_path = os.getenv("CONFIG_PATH", "config.json")
        self._load_config_from_disk()

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

    def _load_config_from_disk(self):
        if not os.path.exists(self.config_file_path):
            self._update_compiled_formulas()
            return
        try:
            with open(self.config_file_path, "r", encoding="utf-8") as f:
                patch = json.load(f)
            if not isinstance(patch, dict):
                raise ValueError("Config file must contain a JSON object")
            self.config.apply_patch(patch)
        except Exception as e:
            logger.error("Failed to load config from %s: %s", self.config_file_path, e)
            raise RuntimeError(f"Invalid config file {self.config_file_path}: {e}") from e
        logger.info("Successfully loaded config from %s", self.config_file_path)
        self._update_compiled_formulas()

    def _update_compiled_formulas(self):
        formula = self.config.snake.growth_score_per_segment
        # Fail fast: GameConfig.validate() already compiles the formula, so an
        # invalid expression must never silently fall back to a constant cost.
        self.growth_segment_cost_func = compile_growth_formula(formula).evaluate
        logger.info("Bound growth segment cost function: %s", formula)

    def align_player_growth(self, player):
        start_score = self.config.snake.start_score
        start_length = self.config.snake.start_length
        max_growth_score = self.config.snake.max_growth_score

        if player.score <= start_score:
            ideal_length = start_length
            ideal_pending = 0.0
        else:
            current_score = start_score
            current_length = start_length
            ideal_pending = 0.0

            max_iter = 10000
            while max_iter > 0:
                max_iter -= 1
                cost = max(
                    0.1,
                    float(self.growth_segment_cost_func(current_score, current_length)),
                )
                if current_score + cost > player.score:
                    ideal_pending = player.score - current_score
                    ideal_length = current_length
                    break
                if current_score >= max_growth_score:
                    ideal_pending = 0.0
                    ideal_length = current_length
                    break
                current_score += cost
                current_length += 1
            else:
                ideal_length = current_length
                ideal_pending = player.score - current_score

        current_length = player.body_len
        score_offset = 0.0
        if ideal_length > current_length:
            for length in range(current_length, ideal_length):
                cost = max(0.1, float(self.growth_segment_cost_func(player.score, length)))
                score_offset += cost
            player.pending_growth = ideal_pending + score_offset
        elif ideal_length < current_length:
            for length in range(ideal_length, current_length):
                cost = max(0.1, float(self.growth_segment_cost_func(player.score, length)))
                score_offset += cost
            player.pending_growth = ideal_pending - score_offset
        else:
            player.pending_growth = ideal_pending

    @staticmethod
    def _fsync_file(path):
        """Best-effort fsync of an existing file.

        Windows cannot fsync a read-only handle, so reopen for writing; a
        read-only config must not turn a completed copy into a failed update.
        """
        try:
            with open(path, "r+b") as f:
                os.fsync(f.fileno())
        except OSError:
            logger.debug("Could not fsync %s", path, exc_info=True)

    @staticmethod
    def _fsync_directory(directory):
        """Best-effort directory fsync after a rename; skipped on Windows."""
        if os.name == "nt" or not hasattr(os, "O_DIRECTORY"):
            return
        try:
            dir_fd = os.open(str(directory), os.O_RDONLY | os.O_DIRECTORY)
        except OSError:
            logger.debug("Could not open %s for fsync", directory, exc_info=True)
            return
        try:
            os.fsync(dir_fd)
        except OSError:
            logger.debug("Could not fsync directory %s", directory, exc_info=True)
        finally:
            os.close(dir_fd)

    def _backup_config_file(self):
        """Copy the current config file to ``<name>.bak``.

        Returns True when a backup exists for this transaction. A missing
        config file is a no-op: there is no previous version to restore.
        """
        path = Path(self.config_file_path)
        if not path.exists():
            return False
        backup_path = path.with_name(f"{path.name}.bak")
        shutil.copy2(path, backup_path)
        self._fsync_file(backup_path)
        logger.info("Backed up config to %s", backup_path)
        return True

    def _restore_config_file(self, old_config, config_existed, backup_ok):
        """Best-effort disk rollback after a failed save.

        Prefers the backup written before the save. If the config file did not
        exist before the failed transaction, any partially created file is
        removed. Errors are logged and never mask the original save failure.
        """
        path = Path(self.config_file_path)
        backup_path = path.with_name(f"{path.name}.bak")
        if backup_ok and backup_path.exists():
            try:
                shutil.copy2(backup_path, path)
                self._fsync_file(path)
                logger.info("Restored config from %s after failed save", backup_path)
                return
            except OSError:
                logger.exception("Failed to restore config from %s", backup_path)
        if not config_existed:
            try:
                path.unlink()
            except FileNotFoundError:
                pass
            except OSError:
                logger.exception("Failed to remove partial config %s", path)
            return
        try:
            self._save_config_to_disk(old_config)
        except OSError:
            logger.exception("Failed to rewrite previous config to %s", path)

    def _save_config_to_disk(self, config=None):
        path = Path(self.config_file_path)
        payload = (config or self.config).to_dict()
        temp_path = None
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            target_mode = path.stat().st_mode & 0o777 if path.exists() else 0o644
            fd, temp_path = tempfile.mkstemp(
                dir=str(path.parent),
                prefix=f".{path.name}.",
                suffix=".tmp",
                text=True,
            )
            os.chmod(temp_path, target_mode)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=4, ensure_ascii=False, allow_nan=False)
                f.write("\n")
                f.flush()
                os.fsync(f.fileno())
            try:
                os.replace(temp_path, path)
            except OSError as exc:
                # A single-file bind mount is a mount point: rename(2)
                # can fail with EXDEV/EBUSY. Fall back to an in-place write.
                if exc.errno not in (errno.EXDEV, errno.EBUSY):
                    raise
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=4, ensure_ascii=False, allow_nan=False)
                    f.write("\n")
                    f.flush()
                    os.fsync(f.fileno())
            else:
                temp_path = None
            self._fsync_directory(path.parent)
            logger.info("Successfully saved config to %s", self.config_file_path)
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

    def get_config(self):
        return self.config.to_dict()

    def _apply_live_config(self, candidate, patch, old_width, old_height, old_cluster_count):
        """Bind ``candidate`` to the live world and refresh derived state."""
        self.config = candidate
        # Players (including bots) hold a reference, not a snapshot: keep them
        # on the live config before recalculating derived growth state.
        for player in self.players.values():
            player.config = candidate
        self._update_compiled_formulas()

        for player in self.players.values():
            self.align_player_growth(player)

        self.grid_width = candidate.world.width
        self.grid_height = candidate.world.height
        self.target_food_count = candidate.world.target_food_count
        size_changed = old_width != self.grid_width or old_height != self.grid_height
        self._recompute_grid_cells()
        self.spatial_grid = {}

        self.food_manager.on_grid_resize(old_width, old_height, old_cluster_count)
        self.food_manager.apply_config()

        # Radius-only changes must not re-roll slots; apply_config() refreshes
        # derived fields on existing entities after any update_slots() call.
        portals_changed = "world" in patch and (
            "portals_enabled" in patch["world"] or "portals_count" in patch["world"]
        )
        if portals_changed or size_changed:
            self.portal_manager.update_slots(force_roll=True)
        self.portal_manager.apply_config()

        black_holes_changed = "world" in patch and (
            "black_holes_enabled" in patch["world"] or "black_holes_count" in patch["world"]
        )
        if black_holes_changed or size_changed:
            self.bh_manager.update_slots(force_roll=size_changed)
        self.bh_manager.apply_config()

        self.bot_manager.sync()

    def _restore_live_config(self, old_config):
        """Restore config ownership and grid scalars after a failed apply/save.

        ``self.config``, player config references, the compiled growth formula,
        grid dimensions/cell caches and ``spatial_grid`` are rolled back. Food,
        portals, black holes and bots may keep derived state from a partially
        applied candidate; the next successful update or restart reconciles
        them.
        """
        self.config = old_config
        for player in self.players.values():
            player.config = old_config
        self._update_compiled_formulas()

        self.grid_width = old_config.world.width
        self.grid_height = old_config.world.height
        self.target_food_count = old_config.world.target_food_count
        self._recompute_grid_cells()
        self.spatial_grid = {}

    def update_config(self, patch):
        """Validate, apply live and then persist a config patch.

        Validation happens on a deep copy before any live state changes. The
        candidate is then applied in memory and only afterwards written to
        disk (with a ``.bak`` of the previous file). A failed apply leaves the
        file untouched; a failed save rolls memory back to ``old_config`` and
        restores the file from the backup. See ``_restore_live_config`` for the
        intentionally limited rollback scope.
        """
        old_config = self.config
        old_width = self.grid_width
        old_height = self.grid_height
        old_cluster_count = old_config.world.cluster_count

        candidate = deepcopy(old_config)
        candidate.apply_patch(patch)

        try:
            self._apply_live_config(candidate, patch, old_width, old_height, old_cluster_count)
        except Exception:
            self._restore_live_config(old_config)
            raise

        config_existed = os.path.exists(self.config_file_path)
        try:
            backup_ok = self._backup_config_file()
        except Exception:
            self._restore_live_config(old_config)
            raise

        try:
            self._save_config_to_disk(candidate)
        except Exception:
            self._restore_live_config(old_config)
            self._restore_config_file(old_config, config_existed, backup_ok)
            raise

        self._config_updated_this_tick = True
        return self.get_config()

    def add_player(self, player_id, nickname="Игрок", skin="#22c55e"):
        self.spectators.discard(player_id)
        start_x, start_y = self.food_manager.get_safe_spawn_location()
        self.players[player_id] = Player(player_id, start_x, start_y, self.config, nickname, skin)

    def remove_player(self, player_id):
        p = self.players.get(player_id)
        if p and not p.is_dead:
            self.kill_events.append({"killer": None, "victim": player_id})
            self.events.emit("player_died", player=p, killer_pid=None)
            p.is_dead = True

        self.players.pop(player_id, None)
        self.spectators.discard(player_id)
        self.input_queue = [item for item in self.input_queue if item[0] != player_id]
        self.client_visibility.pop(player_id, None)
        for visible_players in self.client_visibility.values():
            visible_players.discard(player_id)

    def reset_player_input(self, player_id):
        if player_id in self.players:
            p = self.players[player_id]
            p.turn = 0
            p.current_turn = 0.0
            p.accelerating = False

    def update_direction(self, player_id, action):
        if action == "RESPAWN":
            if player_id in self.players:
                p = self.players[player_id]
                if p.is_dead:
                    start_x, start_y = self.food_manager.get_safe_spawn_location()
                    p.respawn(start_x, start_y)
            return

        if action.startswith("TURN:"):
            try:
                val = float(action[5:])
                if math.isnan(val) or math.isinf(val):
                    return
                if -1.0 <= val <= 1.0:
                    if player_id in self.players:
                        self.players[player_id].turn = val
                        self.players[player_id].steered_by_mouse = True
            except ValueError:
                pass
            return

        if action.startswith("CONTROL_MODE:"):
            if player_id in self.players:
                self.players[player_id].turn = 0
                self.players[player_id].current_turn = 0.0
                mode = action.split(":")[1]
                self.players[player_id].steered_by_mouse = mode in ("mouse", "tilt")
            return

        if action not in VALID_ACTIONS:
            return
        if player_id in self.players:
            p = self.players[player_id]
            if action == "LEFT_DOWN":
                p.turn = -1
                p.steered_by_mouse = False
            elif action == "LEFT_UP" and p.turn == -1:
                p.turn = 0
                p.steered_by_mouse = False
            elif action == "RIGHT_DOWN":
                p.turn = 1
                p.steered_by_mouse = False
            elif action == "RIGHT_UP" and p.turn == 1:
                p.turn = 0
                p.steered_by_mouse = False
            elif action == "SPACE_DOWN":
                p.accelerating = True
            elif action == "SPACE_UP":
                p.accelerating = False

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
        from app.engine.systems.serialization import get_delta_state

        return get_delta_state(
            self,
            client_id,
            is_full,
            update_visibility,
            return_visibility,
            serialize_proto,
        )

    def get_full_state(self, client_id, serialize_proto=False):
        from app.engine.systems.serialization import get_full_state

        return get_full_state(self, client_id, serialize_proto)

    def set_client_visibility(self, client_id, visible_players):
        self.client_visibility[client_id] = visible_players

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
        }

    def reset_state(self):
        self.restart_epoch += 1
        self.players.clear()
        self.spectators.clear()
        self.client_visibility.clear()
        self.kill_events.clear()
        self.tombstones.clear()
        self.tombstone_seq = 0
        self.input_queue.clear()
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
