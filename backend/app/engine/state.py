import os
import json
import math
import random
import msgpack
from collections import defaultdict

from game_config import GameConfig, validate_growth_formula
from app.engine.entities import Food, Portal, BlackHole, Player

VALID_ACTIONS = frozenset({"LEFT_DOWN", "LEFT_UP", "RIGHT_DOWN", "RIGHT_UP", "SPACE_DOWN", "SPACE_UP"})

class GameState:
    def __init__(self):
        self.config = GameConfig()
        self.config_file_path = "config.json"
        self._load_config_from_disk()
        self.players = {}
        self.client_visibility = {}
        self.grid_width = self.config.world.width
        self.grid_height = self.config.world.height
        self.target_food_count = self.config.world.target_food_count
        self.clusters = self._create_clusters()
        self.food_id_counter = 0
        self.foods = {}
        self.cluster_timer = 0.0
        self.new_foods = []
        self.eaten_foods = []
        self.pending_eaten_foods = []
        self.kill_events = []
        self.moved_foods = []
        self.player_grid = defaultdict(list)
        self.black_hole_id_counter = 0
        self.black_hole_timers = []
        self.black_hole_slots = []
        self.portals = []
        self._generate_portals()
        self._update_black_hole_slots(force_roll=True)
        for _ in range(self.target_food_count):
            f = self._spawn_food()
            self.foods[f.id] = f

    @property
    def tick_interval(self):
        return 1.0 / self.config.simulation.tick_rate

    def tick_smoothing(self, smoothing_at_20hz):
        return 1.0 - ((1.0 - smoothing_at_20hz) ** (self.tick_interval / 0.05))

    def _create_clusters(self):
        return [
            (
                random.uniform(10, self.grid_width - 10),
                random.uniform(10, self.grid_height - 10)
            )
            for _ in range(self.config.world.cluster_count)
        ]

    def _generate_portals(self):
        self.portals = []
        if self.config.world.portals_enabled == 0:
            return
        
        colors = ["#3b82f6", "#f97316", "#a855f7", "#ec4899", "#14b8a6"]
        min_dist = max(self.grid_width, self.grid_height) * 0.3
        portal_count = self.config.world.portals_count
        radius = self.config.world.portals_radius

        for i in range(portal_count):
            color = colors[i % len(colors)]
            p1 = None
            p2 = None
            for _ in range(100):
                candidate1 = (random.uniform(5, self.grid_width - 5), random.uniform(5, self.grid_height - 5))
                too_close = False
                for op in self.portals:
                    d1 = math.hypot(candidate1[0] - op.x1, candidate1[1] - op.y1)
                    d2 = math.hypot(candidate1[0] - op.x2, candidate1[1] - op.y2)
                    if d1 < radius * 3 or d2 < radius * 3:
                        too_close = True
                        break
                if not too_close:
                    p1 = candidate1
                    break
                    
            if not p1:
                p1 = (random.uniform(5, self.grid_width - 5), random.uniform(5, self.grid_height - 5))
                
            for _ in range(100):
                candidate2 = (random.uniform(5, self.grid_width - 5), random.uniform(5, self.grid_height - 5))
                dist_p1 = math.hypot(candidate2[0] - p1[0], candidate2[1] - p1[1])
                if dist_p1 < min_dist:
                    continue
                too_close = False
                for op in self.portals:
                    d1 = math.hypot(candidate2[0] - op.x1, candidate2[1] - op.y1)
                    d2 = math.hypot(candidate2[0] - op.x2, candidate2[1] - op.y2)
                    if d1 < radius * 3 or d2 < radius * 3:
                        too_close = True
                        break
                if not too_close:
                    p2 = candidate2
                    break
                    
            if not p2:
                p2 = ((p1[0] + min_dist) % self.grid_width, (p1[1] + min_dist) % self.grid_height)
                
            self.portals.append(Portal(i, p1[0], p1[1], p2[0], p2[1], radius, color))

    def _update_black_hole_slots(self, force_roll=False):
        target_count = self.config.world.black_holes_count
        while len(self.black_hole_slots) < target_count:
            self.black_hole_slots.append(None)
        while len(self.black_hole_slots) > target_count:
            self.black_hole_slots.pop()
        
        while len(self.black_hole_timers) < target_count:
            self.black_hole_timers.append(random.uniform(0.0, 60.0))
        while len(self.black_hole_timers) > target_count:
            self.black_hole_timers.pop()
        
        if not self.config.world.black_holes_enabled:
            # immediately remove all black holes if disabled
            for i in range(len(self.black_hole_slots)):
                self.black_hole_slots[i] = None
            return

        if force_roll:
            self.black_hole_timers = [random.uniform(0.0, 60.0) for _ in range(target_count)]
            for i in range(target_count):
                should_exist = random.random() < self.config.world.black_holes_spawn_chance
                if should_exist:
                    self.black_hole_slots[i] = self._spawn_black_hole(i)
                else:
                    self.black_hole_slots[i] = None

    def _spawn_black_hole(self, slot_idx):
        self.black_hole_id_counter += 1
        bh_id = f"bh_{slot_idx}_{self.black_hole_id_counter}"
        pull_radius = self.config.world.black_holes_pull_radius
        kill_radius = self.config.world.black_holes_kill_radius

        for _ in range(100):
            x = random.uniform(5, self.grid_width - 5)
            y = random.uniform(5, self.grid_height - 5)
            too_close = False
            for op in self.portals:
                if math.hypot(x - op.x1, y - op.y1) < op.radius * 3 or math.hypot(x - op.x2, y - op.y2) < op.radius * 3:
                    too_close = True
                    break
            for obh in self.black_hole_slots:
                if obh is not None and obh.state != "dead":
                    if math.hypot(x - obh.x, y - obh.y) < obh.pull_radius * 1.5:
                        too_close = True
                        break
            if not too_close:
                return BlackHole(bh_id, x, y, pull_radius, kill_radius)
        
        return BlackHole(
            bh_id,
            random.uniform(5, self.grid_width - 5),
            random.uniform(5, self.grid_height - 5),
            pull_radius,
            kill_radius
        )

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
            
            import math
            safe_env = {
                "math": math,
                "log": lambda x: math.log(max(0.001, x)),
                "log10": lambda x: math.log10(max(0.001, x)),
                "sin": math.sin, "cos": math.cos, "tan": math.tan,
                "sqrt": lambda x: math.sqrt(max(0.0, x)),
                "exp": math.exp, "abs": abs, "min": min, "max": max, "pow": pow,
                "pi": math.pi, "e": math.e
            }
            expr = f"lambda s, l: {formula}"
            safe_globals = {**safe_env, "__builtins__": {}}
            self.growth_segment_cost_func = eval(compile(expr, "<string>", "eval"), safe_globals)
            print(f"[Config] Compiled growth segment cost function: {expr}")
        except Exception as e:
            print(f"[Config] Error compiling growth formula: {e}. Falling back to lambda s, l: 10.0")
            self.growth_segment_cost_func = lambda s, l: 10.0

    def align_player_growth(self, player):
        start_score = self.config.snake.start_score
        start_length = self.config.snake.start_length
        max_growth_score = self.config.snake.max_growth_score
        min_body_length = self.config.snake.min_body_length

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
                cost = max(0.1, float(self.growth_segment_cost_func(current_score, current_length)))
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

        current_length = len(player.body)
        score_offset = 0.0
        if ideal_length > current_length:
            for l in range(current_length, ideal_length):
                cost = max(0.1, float(self.growth_segment_cost_func(player.score, l)))
                score_offset += cost
            player.pending_growth = ideal_pending + score_offset
        elif ideal_length < current_length:
            for l in range(ideal_length, current_length):
                cost = max(0.1, float(self.growth_segment_cost_func(player.score, l)))
                score_offset += cost
            player.pending_growth = ideal_pending - score_offset
        else:
            player.pending_growth = ideal_pending

    def _save_config_to_disk(self):
        try:
            with open(self.config_file_path, "w", encoding="utf-8") as f:
                json.dump(self.config.to_dict(), f, indent=4, ensure_ascii=False)
            print(f"[Config] Successfully saved config to {self.config_file_path}")
        except Exception as e:
            print(f"[Config] Failed to save config to disk: {e}")

    def get_config(self):
        return self.config.to_dict()

    def update_config(self, patch):
        old_width = self.grid_width
        old_height = self.grid_height
        old_cluster_count = len(self.clusters)
        self.config.apply_patch(patch)
        self._update_compiled_formulas()
        for p in self.players.values():
            self.align_player_growth(p)
        self._save_config_to_disk()
        self.grid_width = self.config.world.width
        self.grid_height = self.config.world.height
        self.target_food_count = self.config.world.target_food_count
        if self.grid_width != old_width or self.grid_height != old_height or old_cluster_count != self.config.world.cluster_count:
            self.clusters = self._create_clusters()
            
            outside_food_ids = []
            for fid, f in self.foods.items():
                if f.x < 0 or f.x >= self.grid_width or f.y < 0 or f.y >= self.grid_height:
                    f.eaten = True
                    outside_food_ids.append(fid)
            for fid in outside_food_ids:
                self.pending_eaten_foods.append(fid)
                self.foods.pop(fid, None)

            for p in self.players.values():
                for segment in p.body:
                    segment["x"] = segment["x"] % self.grid_width
                    segment["y"] = segment["y"] % self.grid_height

        self._trim_food_overflow(defer_events=True)

        portals_changed = (
            "world" in patch and (
                "portals_enabled" in patch["world"] or
                "portals_count" in patch["world"] or
                "portals_radius" in patch["world"]
            )
        )
        if portals_changed:
            self._generate_portals()

        black_holes_changed = (
            "world" in patch and (
                "black_holes_enabled" in patch["world"] or
                "black_holes_count" in patch["world"] or
                "black_holes_pull_radius" in patch["world"] or
                "black_holes_kill_radius" in patch["world"]
            )
        )
        if black_holes_changed:
            self._update_black_hole_slots()

        return self.get_config()

    def _trim_food_overflow(self, defer_events=False):
        max_food_count = self.target_food_count + self.config.world.food_overflow_limit
        while len(self.foods) > max_food_count:
            oldest_id = next(iter(self.foods))
            self.foods[oldest_id].eaten = True
            if defer_events:
                self.pending_eaten_foods.append(oldest_id)
            else:
                self.eaten_foods.append(oldest_id)
            self.foods.pop(oldest_id, None)

    def _spawn_food(self):
        self.food_id_counter += 1
        food_types = self.config.food.types
        weights = [ft.weight for ft in food_types]
        chosen = random.choices(food_types, weights=weights)[0]
        
        if random.random() < self.config.world.cluster_spawn_chance:
            cx, cy = random.choice(self.clusters)
            x = random.gauss(cx, self.config.world.cluster_spread)
            y = random.gauss(cy, self.config.world.cluster_spread)
        else:
            x = random.uniform(1, self.grid_width - 1)
            y = random.uniform(1, self.grid_height - 1)
            
        x = max(1, min(self.grid_width - 1, x))
        y = max(1, min(self.grid_height - 1, y))
        
        return Food(self.food_id_counter, x, y, chosen.value, self.config, chosen.color)

    def _get_food_color(self, value):
        for ft in self.config.food.types:
            if ft.value == value:
                return ft.color
        if self.config.food.types:
            return min(self.config.food.types, key=lambda ft: abs(ft.value - value)).color
        return "#ef4444"

    def _get_safe_spawn_location(self):
        safe_distance = self.config.snake.safe_spawn_distance
        safe_distance_sq = safe_distance ** 2
        max_attempts = 50
        
        CELL_SIZE = 10.0
        grid_width_cells = math.ceil(self.grid_width / CELL_SIZE)
        grid_height_cells = math.ceil(self.grid_height / CELL_SIZE)
        cells_range = math.ceil(safe_distance / CELL_SIZE)
        
        spatial_grid = {}
        for p in self.players.values():
            for segment in p.body:
                cx = int(segment["x"] / CELL_SIZE) % max(1, grid_width_cells)
                cy = int(segment["y"] / CELL_SIZE) % max(1, grid_height_cells)
                spatial_grid.setdefault((cx, cy), []).append(segment)
        
        for _ in range(max_attempts):
            x = random.uniform(5, self.grid_width - 5)
            y = random.uniform(5, self.grid_height - 5)
            
            grid_x = int(x / CELL_SIZE) % max(1, grid_width_cells)
            grid_y = int(y / CELL_SIZE) % max(1, grid_height_cells)
            
            is_safe = True
            for dx in range(-cells_range, cells_range + 1):
                for dy in range(-cells_range, cells_range + 1):
                    cx = (grid_x + dx) % max(1, grid_width_cells)
                    cy = (grid_y + dy) % max(1, grid_height_cells)
                    
                    if (cx, cy) in spatial_grid:
                        for segment in spatial_grid[(cx, cy)]:
                            dist_x = abs(x - segment["x"])
                            dist_x = min(dist_x, self.grid_width - dist_x)
                            dist_y = abs(y - segment["y"])
                            dist_y = min(dist_y, self.grid_height - dist_y)
                            
                            if (dist_x * dist_x + dist_y * dist_y) < safe_distance_sq:
                                is_safe = False
                                break
                    if not is_safe:
                        break
                if not is_safe:
                    break
            
            if is_safe:
                return x, y
                
        return random.uniform(5, self.grid_width - 5), random.uniform(5, self.grid_height - 5)

    def add_player(self, player_id, nickname="Игрок", skin="#22c55e"):
        start_x, start_y = self._get_safe_spawn_location()
        self.players[player_id] = Player(start_x, start_y, self.config, nickname, skin)

    def remove_player(self, player_id):
        self.players.pop(player_id, None)
        self.client_visibility.pop(player_id, None)
        for visible_players in self.client_visibility.values():
            visible_players.discard(player_id)

    def update_direction(self, player_id, action):
        if action.startswith("TURN:"):
            try:
                val = float(action[5:])
                if -1.0 <= val <= 1.0:
                    if player_id in self.players:
                        self.players[player_id].turn = val
                        self.players[player_id].steered_by_mouse = True
            except ValueError:
                pass
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
        self.new_foods = []
        self.eaten_foods = self.pending_eaten_foods
        self.pending_eaten_foods = []
        self.kill_events = []
        self.moved_foods = []
        
        self.cluster_timer += self.tick_interval
        if self.cluster_timer >= 60.0:
            self.cluster_timer -= 60.0
            if random.random() < self.config.world.cluster_move_chance:
                idx = random.randint(0, len(self.clusters) - 1)
                self.clusters[idx] = (random.uniform(10, self.grid_width - 10), random.uniform(10, self.grid_height - 10))

        tick_interval = self.tick_interval
        if self.config.world.black_holes_enabled:
            for i in range(len(self.black_hole_slots)):
                self.black_hole_timers[i] += tick_interval
                if self.black_hole_timers[i] >= 60.0:
                    self.black_hole_timers[i] = 0.0
                    should_exist = random.random() < self.config.world.black_holes_spawn_chance
                    bh = self.black_hole_slots[i]
                    if should_exist:
                        if bh is None or bh.state == "dead" or bh.state == "collapsing":
                            self.black_hole_slots[i] = self._spawn_black_hole(i)
                    else:
                        if bh is not None and bh.state != "dead" and bh.target_scale == 1.0:
                            bh.target_scale = 0.0
                            bh.state = "collapsing"
            
            growth_time = max(0.1, self.config.world.black_holes_growth_time)
            for i, bh in enumerate(self.black_hole_slots):
                if bh is None or bh.state == "dead":
                    continue
                if bh.target_scale == 1.0 and bh.current_scale < 1.0:
                    bh.current_scale = min(1.0, bh.current_scale + tick_interval / growth_time)
                    if bh.current_scale >= 1.0:
                        bh.state = "active"
                elif bh.target_scale == 0.0 and bh.current_scale > 0.0:
                    bh.current_scale = max(0.0, bh.current_scale - tick_interval / growth_time)
                    if bh.current_scale <= 0.0:
                        bh.state = "dead"
                        self.black_hole_slots[i] = None
        else:
            for i in range(len(self.black_hole_slots)):
                self.black_hole_slots[i] = None

        base_speed = self.config.simulation.base_speed_per_second * tick_interval
        max_turn_deg_rad = self.config.simulation.max_turn_speed_deg_per_second * math.pi / 180
        min_turn_radius_cfg = self.config.simulation.min_turn_radius
        thickness_coeff = self.config.simulation.turn_radius_thickness_coeff
        idle_turn_smoothing = self.tick_smoothing(self.config.simulation.turn_idle_smoothing_at_20hz)
        active_turn_smoothing = self.tick_smoothing(self.config.simulation.turn_active_smoothing_at_20hz)
        
        CELL_SIZE = 10.0 
        grid_width_cells = max(1, math.ceil(self.grid_width / CELL_SIZE))
        grid_height_cells = max(1, math.ceil(self.grid_height / CELL_SIZE))
        spatial_grid = {}
        food_grid = {}

        for pid, p in self.players.items():
            p.new_heads_this_tick = []
            for segment in p.body:
                cx = int(segment["x"] / CELL_SIZE) % grid_width_cells
                cy = int(segment["y"] / CELL_SIZE) % grid_height_cells
                spatial_grid.setdefault((cx, cy), []).append((pid, segment["x"], segment["y"], p.head_radius))

        for f in self.foods.values():
            cx = int(f.x / CELL_SIZE) % grid_width_cells
            cy = int(f.y / CELL_SIZE) % grid_height_cells
            food_grid.setdefault((cx, cy), []).append(f)
            
        dead_players = set()

        for pid, player in self.players.items():
            is_accelerating = player.is_accelerating_valid
            player.speed_mult = self.config.boost.speed_multiplier if is_accelerating else 1.0
            
            if is_accelerating:
                player.boost_drop += tick_interval
                if player.boost_drop >= self.config.boost.drain_interval_seconds:
                    player.boost_drop -= self.config.boost.drain_interval_seconds
                    drain = self.config.boost.drain_per_interval
                    player.score = max(0, player.score - drain)
                    player.pending_growth -= drain
                    if len(player.body) > 0:
                        tail = player.body[-1]
                        self.food_id_counter += 1
                        drop_val = self.config.boost.food_drop_value
                        new_f = Food(
                            self.food_id_counter,
                            (tail["x"] + random.uniform(-0.5, 0.5)) % self.grid_width,
                            (tail["y"] + random.uniform(-0.5, 0.5)) % self.grid_height,
                            drop_val,
                            self.config,
                            self._get_food_color(drop_val)
                        )
                        self.foods[new_f.id] = new_f
                        self.new_foods.append(new_f.to_dict())
                        self._trim_food_overflow()
            else:
                player.boost_drop = 0.0

            effective_radius = min_turn_radius_cfg + player.head_radius * thickness_coeff
            max_turn_from_radius = self.config.simulation.base_speed_per_second / max(effective_radius, 0.01)
            turn_speed = min(max_turn_deg_rad, max_turn_from_radius) * tick_interval

            player.pending_steps += player.speed_mult
            steps_this_tick = int(player.pending_steps)
            player.pending_steps -= steps_this_tick

            for _ in range(steps_this_tick):
                target_turn = player.turn * turn_speed
                if getattr(player, "steered_by_mouse", False):
                    player.current_turn = target_turn
                else:
                    if player.turn == 0:
                        player.current_turn += (0 - player.current_turn) * idle_turn_smoothing
                    else:
                        player.current_turn += (target_turn - player.current_turn) * active_turn_smoothing
                
                player.angle += player.current_turn
                head = player.body[0]
                
                if player.last_portal_exited is not None:
                    portal_id, ep_idx = player.last_portal_exited
                    target_portal = None
                    for op in self.portals:
                        if op.id == portal_id:
                            target_portal = op
                            break
                    if target_portal:
                        ex_x = target_portal.x2 if ep_idx == 1 else target_portal.x1
                        ex_y = target_portal.y2 if ep_idx == 1 else target_portal.y1
                        dist = math.hypot(head["x"] - ex_x, head["y"] - ex_y)
                        if dist > target_portal.radius:
                            player.last_portal_exited = None
                    else:
                        player.last_portal_exited = None

                dx = math.cos(player.angle) * base_speed
                dy = math.sin(player.angle) * base_speed

                pull_x = 0.0
                pull_y = 0.0
                if self.config.world.black_holes_enabled and self.black_hole_slots:
                    for bh in self.black_hole_slots:
                        if bh is None or bh.state == "dead" or bh.current_scale <= 0.01:
                            continue
                        
                        bh_dx = bh.x - head["x"]
                        if bh_dx > self.grid_width / 2:
                            bh_dx -= self.grid_width
                        elif bh_dx < -self.grid_width / 2:
                            bh_dx += self.grid_width
                            
                        bh_dy = bh.y - head["y"]
                        if bh_dy > self.grid_height / 2:
                            bh_dy -= self.grid_height
                        elif bh_dy < -self.grid_height / 2:
                            bh_dy += self.grid_height
                            
                        dist = math.hypot(bh_dx, bh_dy)
                        eff_pull_radius = bh.pull_radius * bh.current_scale
                        if 0.001 < dist < eff_pull_radius:
                            pull_dist_factor = (eff_pull_radius - dist) / eff_pull_radius
                            pull_mag = self.config.world.black_holes_pull_force * bh.current_scale * pull_dist_factor * tick_interval
                            pull_x += (bh_dx / dist) * pull_mag
                            pull_y += (bh_dy / dist) * pull_mag

                new_head = {
                    "x": (head["x"] + dx + pull_x) % self.grid_width,
                    "y": (head["y"] + dy + pull_y) % self.grid_height
                }

                if self.config.world.portals_enabled == 1 and self.portals:
                    for portal in self.portals:
                        dist1 = math.hypot(new_head["x"] - portal.x1, new_head["y"] - portal.y1)
                        if dist1 < portal.radius:
                            if player.last_portal_exited != (portal.id, 0):
                                new_head["x"] = portal.x2
                                new_head["y"] = portal.y2
                                player.last_portal_exited = (portal.id, 1)
                                break
                        dist2 = math.hypot(new_head["x"] - portal.x2, new_head["y"] - portal.y2)
                        if dist2 < portal.radius:
                            if player.last_portal_exited != (portal.id, 1):
                                new_head["x"] = portal.x1
                                new_head["y"] = portal.y1
                                player.last_portal_exited = (portal.id, 0)
                                break

                hit_black_hole = False
                if self.config.world.black_holes_enabled and self.black_hole_slots:
                    for bh in self.black_hole_slots:
                        if bh is None or bh.state == "dead" or bh.current_scale <= 0.01:
                            continue
                        
                        bh_dx = bh.x - new_head["x"]
                        if bh_dx > self.grid_width / 2:
                            bh_dx -= self.grid_width
                        elif bh_dx < -self.grid_width / 2:
                            bh_dx += self.grid_width
                            
                        bh_dy = bh.y - new_head["y"]
                        if bh_dy > self.grid_height / 2:
                            bh_dy -= self.grid_height
                        elif bh_dy < -self.grid_height / 2:
                            bh_dy += self.grid_height
                            
                        dist = math.hypot(bh_dx, bh_dy)
                        eff_kill_radius = bh.kill_radius * bh.current_scale
                        if dist < eff_kill_radius:
                            hit_black_hole = True
                            break
                            
                if hit_black_hole:
                    player.deaths += 1
                    dead_players.add(pid)
                    self.kill_events.append({"killer": "black_hole", "victim": pid})
                    
                    drop_amount = math.floor(player.score * self.config.food.death_drop_score_fraction)
                    food_types = self.config.food.types
                    ft_weights = [ft.weight for ft in food_types]
                    body_list = list(player.body)
                    max_drops = 200
                    drops = 0
                    while drop_amount > 0 and drops < max_drops:
                        segment = random.choice(body_list)
                        chosen = random.choices(food_types, weights=ft_weights)[0]
                        val = min(chosen.value, drop_amount)
                        drop_amount -= val
                        self.food_id_counter += 1
                        new_f = Food(
                            self.food_id_counter,
                            (segment["x"] + random.uniform(-1.5, 1.5)) % self.grid_width,
                            (segment["y"] + random.uniform(-1.5, 1.5)) % self.grid_height,
                            val,
                            self.config,
                            self._get_food_color(val)
                        )
                        self.foods[new_f.id] = new_f
                        self.new_foods.append(new_f.to_dict())
                        drops += 1
                        
                    start_x, start_y = self._get_safe_spawn_location()
                    player.respawn(start_x, start_y)
                    break

                player.body.appendleft(new_head)
                player.new_heads_this_tick.insert(0, new_head)

                cost = max(0.1, float(self.growth_segment_cost_func(player.score, len(player.body))))
                if player.score >= self.config.snake.max_growth_score:
                    player.pending_growth = 0.0
                    if len(player.body) > 0:
                        player.body.pop()
                else:
                    if player.pending_growth >= cost:
                        player.pending_growth -= cost
                    else:
                        if len(player.body) > 0:
                            player.body.pop()
                        if player.pending_growth <= -cost:
                            player.pending_growth += cost
                            if len(player.body) > self.config.snake.min_body_length:
                                player.body.pop()

            if pid in dead_players:
                continue
            new_head = player.body[0]
            head_radius = player.head_radius
            
            is_dead = False
            killer_pid = None
            grid_x = int(new_head["x"] / CELL_SIZE) % grid_width_cells
            grid_y = int(new_head["y"] / CELL_SIZE) % grid_height_cells
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    cell = ((grid_x + dx) % grid_width_cells, (grid_y + dy) % grid_height_cells)
                    if cell in spatial_grid:
                        for other_pid, ox, oy, other_radius in spatial_grid[cell]:
                            if pid != other_pid and other_pid not in dead_players:
                                collision_dist = (head_radius + other_radius) * 0.95
                                dist_x = abs(new_head["x"] - ox)
                                dist_x = min(dist_x, self.grid_width - dist_x)
                                dist_y = abs(new_head["y"] - oy)
                                dist_y = min(dist_y, self.grid_height - dist_y)
                                if (dist_x * dist_x + dist_y * dist_y) < (collision_dist * collision_dist):
                                    is_dead = True
                                    killer_pid = other_pid
                                    break
                        if is_dead: break
                if is_dead: break
            
            if is_dead:
                if killer_pid and killer_pid in self.players:
                    self.players[killer_pid].kills += 1
                player.deaths += 1
                dead_players.add(pid)
                self.kill_events.append({"killer": killer_pid, "victim": pid})
                
                drop_amount = math.floor(player.score * self.config.food.death_drop_score_fraction)
                food_types = self.config.food.types
                ft_weights = [ft.weight for ft in food_types]
                body_list = list(player.body)
                max_drops = 200
                drops = 0
                while drop_amount > 0 and drops < max_drops:
                    segment = random.choice(body_list)
                    chosen = random.choices(food_types, weights=ft_weights)[0]
                    val = min(chosen.value, drop_amount)
                    drop_amount -= val
                    self.food_id_counter += 1
                    new_f = Food(
                        self.food_id_counter,
                        (segment["x"] + random.uniform(-1.5, 1.5)) % self.grid_width,
                        (segment["y"] + random.uniform(-1.5, 1.5)) % self.grid_height,
                        val,
                        self.config,
                        self._get_food_color(val)
                    )
                    self.foods[new_f.id] = new_f
                    self.new_foods.append(new_f.to_dict())
                    drops += 1

                start_x, start_y = self._get_safe_spawn_location()
                player.respawn(start_x, start_y)
                continue

            eaten_value = 0
            food_grid_x = int(new_head["x"] / CELL_SIZE) % grid_width_cells
            food_grid_y = int(new_head["y"] / CELL_SIZE) % grid_height_cells
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    cell = ((food_grid_x + dx) % grid_width_cells, (food_grid_y + dy) % grid_height_cells)
                    if cell in food_grid:
                        for f in food_grid[cell]:
                            if f.eaten: continue
                            dist_x = abs(new_head["x"] - f.x)
                            dist_x = min(dist_x, self.grid_width - dist_x)
                            dist_y = abs(new_head["y"] - f.y)
                            dist_y = min(dist_y, self.grid_height - dist_y)
                            if (dist_x * dist_x + dist_y * dist_y) < ((head_radius + f.radius) ** 2):
                                eaten_value += f.value
                                f.eaten = True
                                self.eaten_foods.append(f.id)
            
            if eaten_value > 0:
                player.score += eaten_value
                player.pending_growth += eaten_value

        if self.config.world.black_holes_enabled and self.black_hole_slots:
            for bh in self.black_hole_slots:
                if bh is None or bh.state == "dead" or bh.current_scale <= 0.01:
                    continue
                eff_pull_radius = bh.pull_radius * bh.current_scale
                eff_kill_radius = bh.kill_radius * bh.current_scale
                for f in self.foods.values():
                    if f.eaten: continue
                    
                    fdx = bh.x - f.x
                    if fdx > self.grid_width / 2:
                        fdx -= self.grid_width
                    elif fdx < -self.grid_width / 2:
                        fdx += self.grid_width
                        
                    fdy = bh.y - f.y
                    if fdy > self.grid_height / 2:
                        fdy -= self.grid_height
                    elif fdy < -self.grid_height / 2:
                        fdy += self.grid_height
                        
                    dist = math.hypot(fdx, fdy)
                    if dist < eff_kill_radius:
                        f.eaten = True
                        self.eaten_foods.append(f.id)
                    elif dist < eff_pull_radius:
                        pull_dist_factor = (eff_pull_radius - dist) / eff_pull_radius
                        pull_mag = self.config.world.black_holes_pull_force * bh.current_scale * pull_dist_factor * tick_interval
                        f.x = (f.x + (fdx / dist) * pull_mag) % self.grid_width
                        f.y = (f.y + (fdy / dist) * pull_mag) % self.grid_height
                        self.moved_foods.append({"id": f.id, "x": round(f.x, 2), "y": round(f.y, 2)})

        attraction_radius = self.config.food.attraction_radius
        attraction_speed = self.config.food.attraction_speed * tick_interval
        if attraction_radius > 0 and attraction_speed > 0:
            attracted_ids = set()
            for pid, player in self.players.items():
                if pid in dead_players or not player.body:
                    continue
                head = player.body[0]
                hx, hy = head["x"], head["y"]
                grid_x = int(hx / CELL_SIZE) % grid_width_cells
                grid_y = int(hy / CELL_SIZE) % grid_height_cells
                radius_cells = int(attraction_radius / CELL_SIZE) + 1
                for dx in range(-radius_cells, radius_cells + 1):
                    for dy in range(-radius_cells, radius_cells + 1):
                        cell = ((grid_x + dx) % grid_width_cells, (grid_y + dy) % grid_height_cells)
                        if cell in food_grid:
                            for f in food_grid[cell]:
                                if f.eaten or f.id in attracted_ids:
                                    continue
                                
                                fdx = hx - f.x
                                if fdx > self.grid_width / 2:
                                    fdx -= self.grid_width
                                elif fdx < -self.grid_width / 2:
                                    fdx += self.grid_width
                                    
                                fdy = hy - f.y
                                if fdy > self.grid_height / 2:
                                    fdy -= self.grid_height
                                elif fdy < -self.grid_height / 2:
                                    fdy += self.grid_height
                                    
                                dist_sq = fdx * fdx + fdy * fdy
                                eat_radius = player.head_radius + f.radius
                                if dist_sq <= eat_radius * eat_radius:
                                    f.eaten = True
                                    self.eaten_foods.append(f.id)
                                    player.score += f.value
                                    player.pending_growth += f.value
                                    attracted_ids.add(f.id)
                                    continue
                                
                                if dist_sq < attraction_radius * attraction_radius and dist_sq > 0.001:
                                    dist = math.sqrt(dist_sq)
                                    move = min(attraction_speed, dist * 0.5)
                                    f.x = (f.x + (fdx / dist) * move) % self.grid_width
                                    f.y = (f.y + (fdy / dist) * move) % self.grid_height
                                    attracted_ids.add(f.id)
                                    
                                    post_dx = hx - f.x
                                    if post_dx > self.grid_width / 2:
                                        post_dx -= self.grid_width
                                    elif post_dx < -self.grid_width / 2:
                                        post_dx += self.grid_width
                                    
                                    post_dy = hy - f.y
                                    if post_dy > self.grid_height / 2:
                                        post_dy -= self.grid_height
                                    elif post_dy < -self.grid_height / 2:
                                        post_dy += self.grid_height
                                    
                                    if (post_dx * post_dx + post_dy * post_dy) <= eat_radius * eat_radius:
                                        f.eaten = True
                                        self.eaten_foods.append(f.id)
                                        player.score += f.value
                                        player.pending_growth += f.value
                                    else:
                                        self.moved_foods.append({"id": f.id, "x": f.x, "y": f.y})

        self.foods = {fid: f for fid, f in self.foods.items() if not f.eaten}
        self._trim_food_overflow()

        while len(self.foods) < self.target_food_count:
            f = self._spawn_food()
            self.foods[f.id] = f
            self.new_foods.append(f.to_dict())

        self.full_players_dict = {pid: p.to_dict(in_aoi=True, is_full=False) for pid, p in self.players.items()}
        self.mini_players_dict = {pid: p.to_dict(in_aoi=False, is_full=False) for pid, p in self.players.items()}
        
        self.full_players_packed = {pid: msgpack.packb(p_dict) for pid, p_dict in self.full_players_dict.items()}
        self.mini_players_packed = {pid: msgpack.packb(p_dict) for pid, p_dict in self.mini_players_dict.items()}
        self._cached_config_dict = self.config.to_dict()

        self.player_grid = defaultdict(list)
        CELL_SIZE = 10.0
        self._grid_width_cells = max(1, math.ceil(self.grid_width / CELL_SIZE))
        self._grid_height_cells = max(1, math.ceil(self.grid_height / CELL_SIZE))
        self._max_player_body_len = 1
        
        for pid, p in self.players.items():
            if not p.body:
                continue
            head = p.body[0]
            cx = int(head["x"] / CELL_SIZE) % self._grid_width_cells
            cy = int(head["y"] / CELL_SIZE) % self._grid_height_cells
            self.player_grid[(cx, cy)].append((pid, p))
            
            p_len = len(p.body)
            if p_len > self._max_player_body_len:
                self._max_player_body_len = p_len
        
        for p in self.players.values():
            p.just_respawned = False

    def get_delta_state(self, client_id, is_full=False, update_visibility=True, return_visibility=False, serialize_msgpack=False):
        client_player = self.players.get(client_id)
        if client_player and len(client_player.body) > 0:
            cx, cy = client_player.body[0]["x"], client_player.body[0]["y"]
            effective_score = max(0, len(client_player.body) - self.config.snake.start_length) * 10.0
        else:
            cx, cy = self.grid_width / 2, self.grid_height / 2
            effective_score = 0
            
        previous_visible = self.client_visibility.get(client_id, set())
        current_visible = set()
        players_data = {}
        
        min_fog = self.config.visual.min_fog_radius
        expansion = self.config.visual.fog_score_expansion_coeff
        fog_radius_world = min_fog + effective_score * expansion
        fog_radius_grid = fog_radius_world / 20.0
        
        max_safe_radius = (fog_radius_grid + self._max_player_body_len * 0.5) * 1.03
        
        CELL_SIZE = 10.0
        gcx = int(cx / CELL_SIZE) % self._grid_width_cells
        gcy = int(cy / CELL_SIZE) % self._grid_height_cells
        cell_range = math.ceil(max_safe_radius / CELL_SIZE)
        
        candidate_players = []
        for dx in range(-cell_range, cell_range + 1):
            for dy in range(-cell_range, cell_range + 1):
                cell = ((gcx + dx) % self._grid_width_cells, (gcy + dy) % self._grid_height_cells)
                if cell in self.player_grid:
                    candidate_players.extend(self.player_grid[cell])
                    
        candidates_dict = {pid: p for pid, p in candidate_players}
        if client_player and client_id not in candidates_dict:
            candidates_dict[client_id] = client_player
            
        for pid, p in candidates_dict.items():
            if not p.body:
                continue
                
            head = p.body[0]
            fdx = head["x"] - cx
            if fdx > self.grid_width / 2:
                fdx -= self.grid_width
            elif fdx < -self.grid_width / 2:
                fdx += self.grid_width
                
            fdy = head["y"] - cy
            if fdy > self.grid_height / 2:
                fdy -= self.grid_height
            elif fdy < -self.grid_height / 2:
                fdy += self.grid_height
                
            dist_sq = fdx * fdx + fdy * fdy
            target_padding = len(p.body) * 0.5
            safe_radius = (fog_radius_grid + target_padding) * 1.03
            
            in_aoi = (pid == client_id) or (dist_sq < safe_radius ** 2)
            if in_aoi:
                current_visible.add(pid)
                
            if serialize_msgpack:
                if is_full:
                    players_data[pid] = msgpack.packb(p.to_dict(in_aoi=in_aoi, is_full=True))
                else:
                    if in_aoi:
                        if pid not in previous_visible:
                            players_data[pid] = msgpack.packb(p.to_dict(in_aoi=True, is_full=True))
                        else:
                            players_data[pid] = self.full_players_packed.get(pid, self.full_players_packed[pid])
                    else:
                        players_data[pid] = self.mini_players_packed.get(pid, self.mini_players_packed[pid])
            else:
                if is_full:
                    players_data[pid] = p.to_dict(in_aoi=in_aoi, is_full=True)
                else:
                    if in_aoi:
                        if pid not in previous_visible:
                            players_data[pid] = p.to_dict(in_aoi=True, is_full=True)
                        else:
                            players_data[pid] = self.full_players_dict.get(pid, p.to_dict(in_aoi=True, is_full=False))
                    else:
                        players_data[pid] = self.mini_players_dict.get(pid, p.to_dict(in_aoi=False, is_full=False))
                        
        for pid in self.players:
            if pid not in players_data:
                if serialize_msgpack:
                    players_data[pid] = self.mini_players_packed.get(pid)
                else:
                    p = self.players[pid]
                    players_data[pid] = self.mini_players_dict.get(pid, p.to_dict(in_aoi=False, is_full=False))

        cfg = getattr(self, '_cached_config_dict', None) or self.config.to_dict()
        
        if serialize_msgpack:
            prepacked_kv_list = []
            for pid, packed_val in players_data.items():
                if packed_val:
                    prepacked_kv_list.append(msgpack.packb(pid) + packed_val)
                
            n = len(prepacked_kv_list)
            if n <= 15:
                players_header = bytes([0x80 | n])
            elif n <= 65535:
                players_header = b'\xde' + n.to_bytes(2, byteorder='big')
            else:
                players_header = b'\xdf' + n.to_bytes(4, byteorder='big')
            players_packed = players_header + b''.join(prepacked_kv_list)
            
            portals_list = [p.to_dict() for p in self.portals] if self.config.world.portals_enabled == 1 else []
            black_holes_list = [bh.to_dict() for bh in self.black_hole_slots if bh is not None and bh.state != "dead"] if self.config.world.black_holes_enabled == 1 else []

            state = {
                "type": "FULL" if is_full else "DELTA",
                "server_tick_rate": self.config.simulation.tick_rate,
                "server_world": cfg["world"],
                "server_simulation": cfg["simulation"],
                "server_snake": cfg["snake"],
                "server_visual": cfg["visual"],
                "server_food": cfg["food"],
                "players": b"PLAYERS_PLACEHOLDER",
                "new_foods": self.new_foods,
                "eaten_foods": self.eaten_foods,
                "moved_foods": self.moved_foods,
                "kill_events": self.kill_events,
                "portals": portals_list,
                "black_holes": black_holes_list
            }
            packed_state = msgpack.packb(state)
            final_state = packed_state.replace(b"\xc4\x13PLAYERS_PLACEHOLDER", players_packed)
        else:
            portals_list = [p.to_dict() for p in self.portals] if self.config.world.portals_enabled == 1 else []
            black_holes_list = [bh.to_dict() for bh in self.black_hole_slots if bh is not None and bh.state != "dead"] if self.config.world.black_holes_enabled == 1 else []

            state = {
                "type": "FULL" if is_full else "DELTA",
                "server_tick_rate": self.config.simulation.tick_rate,
                "server_world": cfg["world"],
                "server_simulation": cfg["simulation"],
                "server_snake": cfg["snake"],
                "server_visual": cfg["visual"],
                "server_food": cfg["food"],
                "players": players_data,
                "new_foods": self.new_foods,
                "eaten_foods": self.eaten_foods,
                "moved_foods": self.moved_foods,
                "kill_events": self.kill_events,
                "portals": portals_list,
                "black_holes": black_holes_list
            }
            final_state = state

        if client_id and update_visibility:
            self.client_visibility[client_id] = current_visible

        if return_visibility:
            return final_state, current_visible

        return final_state
        
    def get_full_state(self, client_id):
        state = self.get_delta_state(client_id, is_full=True)
        state["foods"] = [f.to_dict() for f in self.foods.values()]
        return state

game = GameState()
