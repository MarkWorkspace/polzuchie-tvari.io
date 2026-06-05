import os
import json
import math
import random
import threading
import msgpack
from collections import defaultdict

from game_config import GameConfig, validate_growth_formula
from app.engine.entities import Player
from app.engine.food_manager import FoodManager
from app.engine.world_elements import PortalManager, BlackHoleManager

VALID_ACTIONS = frozenset({"LEFT_DOWN", "LEFT_UP", "RIGHT_DOWN", "RIGHT_UP", "SPACE_DOWN", "SPACE_UP"})

class GameState:
    def __init__(self):
        self.lock = threading.RLock()
        self.config = GameConfig()
        self.config_file_path = "config.json"
        self._load_config_from_disk()
        
        self.players = {}
        self.client_visibility = {}
        self.grid_width = self.config.world.width
        self.grid_height = self.config.world.height
        self.target_food_count = self.config.world.target_food_count
        
        self.player_grid = defaultdict(list)
        self.kill_events = []
        
        self.food_manager = FoodManager(self)
        self.portal_manager = PortalManager(self)
        self.bh_manager = BlackHoleManager(self, self.portal_manager)
        
        self._cached_config_dict = self.config.to_dict()
        self._config_updated_this_tick = False
        self._config_broadcast_needed = False

    @property
    def tick_interval(self):
        with self.lock:
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
        with self.lock:
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
        with self.lock:
            return self.config.to_dict()

    def update_config(self, patch):
        with self.lock:
            old_width = self.grid_width
            old_height = self.grid_height
            old_cluster_count = self.config.world.cluster_count
            
            self.config.apply_patch(patch)
            self._update_compiled_formulas()
            self._cached_config_dict = self.config.to_dict()
            self._config_updated_this_tick = True
            
            for p in self.players.values():
                self.align_player_growth(p)
            self._save_config_to_disk()
            
            self.grid_width = self.config.world.width
            self.grid_height = self.config.world.height
            self.target_food_count = self.config.world.target_food_count
            
            self.food_manager.on_grid_resize(old_width, old_height, old_cluster_count)

            portals_changed = (
                "world" in patch and (
                    "portals_enabled" in patch["world"] or
                    "portals_count" in patch["world"] or
                    "portals_radius" in patch["world"]
                )
            )
            if portals_changed:
                self.portal_manager.generate()

            black_holes_changed = (
                "world" in patch and (
                    "black_holes_enabled" in patch["world"] or
                    "black_holes_count" in patch["world"] or
                    "black_holes_pull_radius" in patch["world"] or
                    "black_holes_kill_radius" in patch["world"]
                )
            )
            if black_holes_changed:
                self.bh_manager.update_slots()

            return self.get_config()

    def add_player(self, player_id, nickname="Игрок", skin="#22c55e"):
        with self.lock:
            start_x, start_y = self.food_manager.get_safe_spawn_location()
            self.players[player_id] = Player(start_x, start_y, self.config, nickname, skin)

    def remove_player(self, player_id):
        with self.lock:
            self.players.pop(player_id, None)
            self.client_visibility.pop(player_id, None)
            for visible_players in self.client_visibility.values():
                visible_players.discard(player_id)

    def reset_player_input(self, player_id):
        with self.lock:
            if player_id in self.players:
                p = self.players[player_id]
                p.turn = 0
                p.current_turn = 0.0
                p.accelerating = False

    def update_direction(self, player_id, action):
        with self.lock:
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
        with self.lock:
            self._tick_implementation()

    def _tick_implementation(self):
        self._config_broadcast_needed = self._config_updated_this_tick
        self._config_updated_this_tick = False
        
        self.food_manager.tick_start()
        self.kill_events = []
        
        tick_interval = self.tick_interval
        
        self.food_manager.update_clusters(tick_interval)
        self.portal_manager.update(tick_interval)
        self.bh_manager.update(tick_interval)

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

        for f in self.food_manager.foods.values():
            cx = int(f.x / CELL_SIZE) % grid_width_cells
            cy = int(f.y / CELL_SIZE) % grid_height_cells
            food_grid.setdefault((cx, cy), []).append(f)
            
        dead_players = set()

        for pid, player in self.players.items():
            # Decrement teleport timer once per tick when player is entering or in transit
            if player.teleport_state in ("entering", "in_transit"):
                player.teleport_timer = max(0.0, player.teleport_timer - tick_interval)

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
                        self.food_manager.spawn_specific_food(
                            (tail["x"] + random.uniform(-0.5, 0.5)) % self.grid_width,
                            (tail["y"] + random.uniform(-0.5, 0.5)) % self.grid_height,
                            self.config.boost.food_drop_value
                        )
                        self.food_manager.trim_overflow()
            else:
                player.boost_drop = 0.0

            effective_radius = min_turn_radius_cfg + player.head_radius * thickness_coeff
            max_turn_from_radius = self.config.simulation.base_speed_per_second / max(effective_radius, 0.01)
            turn_speed = min(max_turn_deg_rad, max_turn_from_radius) * tick_interval

            player.pending_steps += player.speed_mult
            steps_this_tick = int(player.pending_steps)
            player.pending_steps -= steps_this_tick

            for _ in range(steps_this_tick):
                if player.teleport_state in ("none", "exiting"):
                    target_turn = player.turn * turn_speed
                    if getattr(player, "steered_by_mouse", False):
                        player.current_turn = target_turn
                    else:
                        if player.turn == 0:
                            player.current_turn += (0 - player.current_turn) * idle_turn_smoothing
                        else:
                            player.current_turn += (target_turn - player.current_turn) * active_turn_smoothing
                    
                    player.angle += player.current_turn
                else:
                    player.current_turn = 0.0
                head = player.body[0]
                
                if player.teleport_state == "none" and player.last_portal_exited is not None:
                    portal_id, ep_idx = player.last_portal_exited
                    target_portal = next((op for op in self.portal_manager.portal_slots if op is not None and op.id == portal_id), None)
                    if target_portal:
                        ex_x = target_portal.x2 if ep_idx == 1 else target_portal.x1
                        ex_y = target_portal.y2 if ep_idx == 1 else target_portal.y1
                        dist = math.hypot(head["x"] - ex_x, head["y"] - ex_y)
                        if dist > target_portal.radius:
                            player.last_portal_exited = None
                    else:
                        player.last_portal_exited = None

                bend_angle = self.bh_manager.get_gravity_bend(head, player.angle, tick_interval)
                player.angle += bend_angle

                if player.teleport_state == "none":
                    dx = math.cos(player.angle) * base_speed
                    dy = math.sin(player.angle) * base_speed
                    
                    new_head = {
                        "x": (head["x"] + dx) % self.grid_width,
                        "y": (head["y"] + dy) % self.grid_height
                    }
                    
                    tp_check = self.portal_manager.check_teleport_start(new_head, player)
                    if tp_check:
                        player.teleport_state = "entering"
                        player.length = len(player.body)  # Record pre-teleport length!
                        player.teleport_pos = new_head
                        player.teleport_out_pos = tp_check["out_pos"]
                        player.last_portal_exited = tp_check["portal_id"]
                        player.teleport_delay = self.config.world.portals_teleport_delay_ms / 1000.0
                        player.teleport_timer = player.teleport_delay
                        
                elif player.teleport_state == "entering":
                    if player.teleport_timer <= 0:
                        player.teleport_state = "exiting"
                        # Start emerging immediately
                        ref_x, ref_y = player.teleport_out_pos[0], player.teleport_out_pos[1]
                        dx = math.cos(player.angle) * base_speed
                        dy = math.sin(player.angle) * base_speed
                        new_head = {
                            "x": (ref_x + dx) % self.grid_width,
                            "y": (ref_y + dy) % self.grid_height
                        }
                        if len(player.body) >= player.length:
                            if len(player.body) > 0:
                                player.body.pop()
                    else:
                        all_at_portal = all(
                            math.hypot(pt["x"] - player.teleport_pos["x"], pt["y"] - player.teleport_pos["y"]) < 0.1
                            for pt in player.body
                        )
                        if all_at_portal:
                            player.teleport_state = "in_transit"
                            # Process in_transit immediately
                            new_head = {"x": player.teleport_out_pos[0], "y": player.teleport_out_pos[1]}
                            player.body.clear()
                            player.body.appendleft(new_head)
                            player.new_heads_this_tick.insert(0, new_head)
                            player.pending_steps -= 1.0
                            continue
                        else:
                            new_head = {"x": player.teleport_pos["x"], "y": player.teleport_pos["y"]}
                            # Maintain constant length (pop 1 segment as we append 1 at the end of the step)
                            if len(player.body) > 0:
                                player.body.pop()
                        
                elif player.teleport_state == "in_transit":
                    new_head = {"x": player.teleport_out_pos[0], "y": player.teleport_out_pos[1]}
                    player.body.clear()
                    player.body.appendleft(new_head)
                    player.new_heads_this_tick.insert(0, new_head)
                    if player.teleport_timer <= 0:
                        player.teleport_state = "exiting"
                    player.pending_steps -= 1.0
                    continue
                    
                elif player.teleport_state == "exiting":
                    # Determine where head starts emerging from
                    dist_to_entrance = math.hypot(head["x"] - player.teleport_pos["x"], head["y"] - player.teleport_pos["y"])
                    if dist_to_entrance < 1.0:
                        # Use exit portal as reference if head is still at the entrance portal
                        ref_x, ref_y = player.teleport_out_pos[0], player.teleport_out_pos[1]
                    else:
                        ref_x, ref_y = head["x"], head["y"]

                    dx = math.cos(player.angle) * base_speed
                    dy = math.sin(player.angle) * base_speed
                    new_head = {
                        "x": (ref_x + dx) % self.grid_width,
                        "y": (ref_y + dy) % self.grid_height
                    }
                    
                    # Exit condition: body is at least player.length, and all segments have cleared the entrance portal
                    if len(player.body) >= player.length:
                        all_cleared = all(
                            math.hypot(pt["x"] - player.teleport_pos["x"], pt["y"] - player.teleport_pos["y"]) >= 1.0
                            for pt in player.body
                        )
                        if all_cleared:
                            player.teleport_state = "none"
                            player.teleport_pos = None
                            player.teleport_out_pos = None

                    # If we have reached full length, pop the tail to maintain length
                    if len(player.body) >= player.length:
                        if len(player.body) > 0:
                            player.body.pop()

                hit_black_hole = self.bh_manager.check_kill(new_head)
                if hit_black_hole:
                    player.deaths += 1
                    dead_players.add(pid)
                    self.kill_events.append({"killer": "black_hole", "victim": pid})
                    
                    self.food_manager.drop_food_on_death(player)
                        
                    start_x, start_y = self.food_manager.get_safe_spawn_location()
                    player.respawn(start_x, start_y)
                    break

                player.body.appendleft(new_head)
                player.new_heads_this_tick.insert(0, new_head)

                # Only run growth/shrink logic when not entering or exiting teleportation
                if player.teleport_state not in ("entering", "exiting"):
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
            if player.teleport_state == "in_transit":
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
                
                self.food_manager.drop_food_on_death(player)

                start_x, start_y = self.food_manager.get_safe_spawn_location()
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
                                self.food_manager.eaten_foods.append(f.id)
            
            if eaten_value > 0:
                player.score += eaten_value
                player.pending_growth += eaten_value

        if self.config.world.black_holes_enabled and self.bh_manager.black_hole_slots:
            for bh in self.bh_manager.black_hole_slots:
                if bh is None or bh.state == "dead" or bh.current_scale <= 0.01:
                    continue
                eff_pull_radius = bh.pull_radius * bh.current_scale
                eff_kill_radius = bh.kill_radius * bh.current_scale
                
                bh_grid_x = int(bh.x / CELL_SIZE) % grid_width_cells
                bh_grid_y = int(bh.y / CELL_SIZE) % grid_height_cells
                radius_in_cells = math.ceil(eff_pull_radius / CELL_SIZE)
                
                for dx in range(-radius_in_cells, radius_in_cells + 1):
                    for dy in range(-radius_in_cells, radius_in_cells + 1):
                        cell = ((bh_grid_x + dx) % grid_width_cells, (bh_grid_y + dy) % grid_height_cells)
                        if cell in food_grid:
                            for f in food_grid[cell]:
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
                                    self.food_manager.eaten_foods.append(f.id)
                                elif dist < eff_pull_radius:
                                    pull_dist_factor = (eff_pull_radius - dist) / eff_pull_radius
                                    pull_mag = self.config.world.black_holes_pull_force * bh.current_scale * pull_dist_factor * tick_interval
                                    pull_mag *= 12.0  # Compensation multiplier to match the updated black hole strength
                                    f.x = (f.x + (fdx / dist) * pull_mag) % self.grid_width
                                    f.y = (f.y + (fdy / dist) * pull_mag) % self.grid_height
                                    self.food_manager.moved_foods.append({"id": f.id, "x": round(f.x, 2), "y": round(f.y, 2)})

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
                                    self.food_manager.eaten_foods.append(f.id)
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
                                        self.food_manager.eaten_foods.append(f.id)
                                        player.score += f.value
                                        player.pending_growth += f.value
                                    else:
                                        self.food_manager.moved_foods.append({"id": f.id, "x": f.x, "y": f.y})

        self.food_manager.ensure_target_count()

        self.full_players_dict = {pid: p.to_dict(in_aoi=True, is_full=False) for pid, p in self.players.items()}
        self.mini_players_dict = {pid: p.to_dict(in_aoi=False, is_full=False) for pid, p in self.players.items()}
        
        self.full_players_packed = {pid: msgpack.packb(p_dict) for pid, p_dict in self.full_players_dict.items()}
        self.mini_players_packed = {pid: msgpack.packb(p_dict) for pid, p_dict in self.mini_players_dict.items()}

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
        with self.lock:
            return self._get_delta_state_implementation(client_id, is_full, update_visibility, return_visibility, serialize_msgpack)

    def _get_delta_state_implementation(self, client_id, is_full=False, update_visibility=True, return_visibility=False, serialize_msgpack=False):
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
            
            portals_list = self.portal_manager.get_cached_list()
            black_holes_list = self.bh_manager.get_cached_list()

            include_config = is_full or getattr(self, '_config_broadcast_needed', False)
            state = {
                "type": "FULL" if is_full else "DELTA",
                "server_tick_rate": self.config.simulation.tick_rate,
                "players": b"PLAYERS_PLACEHOLDER",
                "new_foods": self.food_manager.new_foods,
                "eaten_foods": self.food_manager.eaten_foods,
                "moved_foods": self.food_manager.moved_foods,
                "kill_events": self.kill_events,
                "portals": portals_list,
                "black_holes": black_holes_list
            }
            if include_config:
                state["server_world"] = cfg["world"]
                state["server_simulation"] = cfg["simulation"]
                state["server_snake"] = cfg["snake"]
                state["server_visual"] = cfg["visual"]
                state["server_food"] = cfg["food"]
            packed_state = msgpack.packb(state)
            final_state = packed_state.replace(b"\xc4\x13PLAYERS_PLACEHOLDER", players_packed)
        else:
            portals_list = self.portal_manager.get_cached_list()
            black_holes_list = self.bh_manager.get_cached_list()

            include_config = is_full or getattr(self, '_config_broadcast_needed', False)
            state = {
                "type": "FULL" if is_full else "DELTA",
                "server_tick_rate": self.config.simulation.tick_rate,
                "players": players_data,
                "new_foods": self.food_manager.new_foods,
                "eaten_foods": self.food_manager.eaten_foods,
                "moved_foods": self.food_manager.moved_foods,
                "kill_events": self.kill_events,
                "portals": portals_list,
                "black_holes": black_holes_list
            }
            if include_config:
                state["server_world"] = cfg["world"]
                state["server_simulation"] = cfg["simulation"]
                state["server_snake"] = cfg["snake"]
                state["server_visual"] = cfg["visual"]
                state["server_food"] = cfg["food"]
            final_state = state

        if client_id and update_visibility:
            self.client_visibility[client_id] = current_visible

        if return_visibility:
            return final_state, current_visible

        return final_state
        
    def get_full_state(self, client_id):
        with self.lock:
            state = self.get_delta_state(client_id, is_full=True)
            state["foods"] = [f.to_dict() for f in self.food_manager.foods.values()]
            return state

    def set_client_visibility(self, client_id, visible_players):
        with self.lock:
            self.client_visibility[client_id] = visible_players

    def update_player_score(self, player_id, score):
        with self.lock:
            if player_id in self.players:
                p = self.players[player_id]
                p.score = score
                self.align_player_growth(p)

    def get_health_info(self):
        with self.lock:
            return {
                "players_count": len(self.players),
                "foods_count": len(self.food_manager.foods),
                "tick_rate": self.config.simulation.tick_rate
            }

    def reset_state(self):
        with self.lock:
            self.players.clear()
            self.client_visibility.clear()
            self.kill_events.clear()
            self.player_grid.clear()
            self.full_players_dict.clear()
            self.mini_players_dict.clear()
            self._max_player_body_len = 1
            
            self.food_manager.clear()
            self.portal_manager.generate()
            self.bh_manager.update_slots(force_roll=True)

game = GameState()
