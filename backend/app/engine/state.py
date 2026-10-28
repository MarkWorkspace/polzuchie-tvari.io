# ROLE: Контейнер игрового состояния, загрузка конфигурации, управление игроками. Не содержит игровой логики тика.
import os
import json
import math
import tempfile
import errno
from copy import deepcopy
from pathlib import Path

from game_config import GameConfig, validate_growth_formula, CELL_SIZE
from app.bots import BotManager
from app.engine.entities import Player
from app.engine.food_manager import FoodManager
from app.engine.world_elements import PortalManager, BlackHoleManager
from app.engine.systems.formula_parser import evaluate_formula
from app.engine.events import EventBus
import app.engine.game as game_orchestrator

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
        self.client_visibility = {}
        self.grid_width = self.config.world.width
        self.grid_height = self.config.world.height
        self.target_food_count = self.config.world.target_food_count
        self._recompute_grid_cells()

        self.full_players_cache = {}
        self.mini_players_cache = {}
        self.kill_events = []
        self.tombstones = []
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
        if os.path.exists(self.config_file_path):
            try:
                with open(self.config_file_path, "r", encoding="utf-8") as f:
                    patch = json.load(f)
                if isinstance(patch, dict):
                    self.config.apply_patch(patch)
                    print(f"[Config] Successfully loaded config from {self.config_file_path}")
            except Exception as e:
                print(f"[Config] Failed to load config from disk: {e}")
        self._update_compiled_formulas()

    def _update_compiled_formulas(self):
        formula = self.config.snake.growth_score_per_segment
        try:
            if not isinstance(formula, str):
                formula = str(formula)
            validate_growth_formula(formula)

            self.growth_segment_cost_func = lambda score, length: evaluate_formula(
                formula, score, length
            )
            print(f"[Config] Bound growth segment cost function: {formula}")
        except Exception as e:
            print(
                f"[Config] Error compiling growth formula: {e}. Falling back to lambda score, length: 10.0"
            )
            self.growth_segment_cost_func = lambda score, length: 10.0

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
                json.dump(payload, f, indent=4, ensure_ascii=False)
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
                    json.dump(payload, f, indent=4, ensure_ascii=False)
                    f.write("\n")
                    f.flush()
                    os.fsync(f.fileno())
            else:
                temp_path = None
            print(f"[Config] Successfully saved config to {self.config_file_path}")
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

    def get_config(self):
        return self.config.to_dict()

    def update_config(self, patch):
        old_width = self.grid_width
        old_height = self.grid_height
        old_cluster_count = self.config.world.cluster_count

        # Validate the patch and persist it before mutating live state.
        candidate = deepcopy(self.config)
        candidate.apply_patch(patch)
        self._save_config_to_disk(candidate)
        self.config = candidate
        self._update_compiled_formulas()
        self._config_updated_this_tick = True

        for p in self.players.values():
            self.align_player_growth(p)

        self.grid_width = self.config.world.width
        self.grid_height = self.config.world.height
        self.target_food_count = self.config.world.target_food_count
        size_changed = old_width != self.grid_width or old_height != self.grid_height
        self._recompute_grid_cells()
        self.spatial_grid = {}

        self.food_manager.on_grid_resize(old_width, old_height, old_cluster_count)

        portals_changed = "world" in patch and (
            "portals_enabled" in patch["world"]
            or "portals_count" in patch["world"]
            or "portals_radius" in patch["world"]
        )
        if portals_changed or size_changed:
            self.portal_manager.update_slots(force_roll=True)

        black_holes_changed = "world" in patch and (
            "black_holes_enabled" in patch["world"]
            or "black_holes_count" in patch["world"]
            or "black_holes_pull_radius" in patch["world"]
            or "black_holes_kill_radius" in patch["world"]
        )
        if black_holes_changed or size_changed:
            self.bh_manager.update_slots(force_roll=size_changed)

        self.bot_manager.sync()
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
        self.players.clear()
        self.spectators.clear()
        self.client_visibility.clear()
        self.kill_events.clear()
        self.tombstones.clear()
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
