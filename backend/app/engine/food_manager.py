# ROLE: Жизненный цикл еды, кластеры, спавн.
import math
import random
from app.engine.entities import Food
from app.engine.systems.math_utils import toroidal_distance
class FoodManager:
    def __init__(self, state):
        self.state = state
        self.food_id_counter = 0
        self.foods = {}
        self.clusters = self._create_clusters()
        self.cluster_timer = 0.0
        self.new_foods = []
        self.eaten_foods = []
        self.pending_eaten_foods = []
        self.moved_foods = {}

        for _ in range(self.state.target_food_count):
            f = self._spawn_food()
            self.foods[f.id] = f

    def clear(self):
        self.foods.clear()
        self.food_id_counter = 0
        self.new_foods.clear()
        self.eaten_foods.clear()
        self.pending_eaten_foods.clear()
        self.moved_foods.clear()
        self.cluster_timer = 0.0
        self.clusters = self._create_clusters()
        for _ in range(self.state.target_food_count):
            f = self._spawn_food()
            self.foods[f.id] = f

    def _create_clusters(self):
        return [
            (
                random.uniform(10, self.state.grid_width - 10),
                random.uniform(10, self.state.grid_height - 10),
            )
            for _ in range(self.state.config.world.cluster_count)
        ]

    def get_safe_spawn_location(self):
        safe_dist = self.state.config.snake.safe_spawn_distance
        safe_dist_sq = safe_dist**2

        CELL_SIZE = 10.0
        grid_w = math.ceil(self.state.grid_width / CELL_SIZE)
        grid_h = math.ceil(self.state.grid_height / CELL_SIZE)

        spatial_grid = self._build_spatial_grid(CELL_SIZE, grid_w, grid_h)
        cells_range = math.ceil(safe_dist / CELL_SIZE)

        for _ in range(50):
            x = random.uniform(5, self.state.grid_width - 5)
            y = random.uniform(5, self.state.grid_height - 5)
            if self._is_pos_safe(
                x, y, spatial_grid, CELL_SIZE, grid_w, grid_h, cells_range, safe_dist_sq
            ):
                return x, y

        return random.uniform(5, self.state.grid_width - 5), random.uniform(
            5, self.state.grid_height - 5
        )

    def _build_spatial_grid(self, cell_size: float, grid_w: int, grid_h: int) -> dict:
        spatial_grid = {}
        for p in self.state.players.values():
            for i in range(0, len(p.body), 2):
                seg_x, seg_y = p.body[i], p.body[i + 1]
                cx = int(seg_x / cell_size) % max(1, grid_w)
                cy = int(seg_y / cell_size) % max(1, grid_h)
                spatial_grid.setdefault((cx, cy), []).append((seg_x, seg_y))
        return spatial_grid

    def _is_pos_safe(
        self,
        x: float,
        y: float,
        spatial_grid: dict,
        cell_size: float,
        grid_w: int,
        grid_h: int,
        cells_range: int,
        safe_dist_sq: float,
    ) -> bool:
        if hasattr(self.state, "bh_manager") and self.state.bh_manager:
            for bh in self.state.bh_manager.black_hole_slots:
                if bh is not None and bh.state != "dead":
                    dist = toroidal_distance(x, y, bh.x, bh.y, self.state.grid_width, self.state.grid_height)
                    if dist < bh.pull_radius * 1.5:
                        return False

        if hasattr(self.state, "portal_manager") and self.state.portal_manager:
            for p in self.state.portal_manager.portal_slots:
                if p is not None and p.state != "dead":
                    dist1 = toroidal_distance(x, y, p.x1, p.y1, self.state.grid_width, self.state.grid_height)
                    dist2 = toroidal_distance(x, y, p.x2, p.y2, self.state.grid_width, self.state.grid_height)
                    if dist1 < p.radius * 3 or dist2 < p.radius * 3:
                        return False

        grid_x = int(x / cell_size) % max(1, grid_w)
        grid_y = int(y / cell_size) % max(1, grid_h)
        for dx in range(-cells_range, cells_range + 1):
            for dy in range(-cells_range, cells_range + 1):
                cx = (grid_x + dx) % max(1, grid_w)
                cy = (grid_y + dy) % max(1, grid_h)
                if (cx, cy) not in spatial_grid:
                    continue
                for seg_x, seg_y in spatial_grid[(cx, cy)]:
                    dx_w = min(abs(x - seg_x), self.state.grid_width - abs(x - seg_x))
                    dy_h = min(abs(y - seg_y), self.state.grid_height - abs(y - seg_y))
                    if (dx_w * dx_w + dy_h * dy_h) < safe_dist_sq:
                        return False
        return True

    def _spawn_food(self):
        self.food_id_counter = (self.food_id_counter + 1) % 2_000_000_000
        food_types = self.state.config.food.types
        weights = [ft.weight for ft in food_types]
        chosen = random.choices(food_types, weights=weights)[0]

        if random.random() < self.state.config.world.cluster_spawn_chance:
            cx, cy = random.choice(self.clusters)
            x = random.gauss(cx, self.state.config.world.cluster_spread)
            y = random.gauss(cy, self.state.config.world.cluster_spread)
        else:
            x = random.uniform(1, self.state.grid_width - 1)
            y = random.uniform(1, self.state.grid_height - 1)

        x = max(1, min(self.state.grid_width - 1, x))
        y = max(1, min(self.state.grid_height - 1, y))

        return Food(
            self.food_id_counter, x, y, chosen.value, self.state.config,
            chosen.color, chosen.image
        )

    def get_food_color(self, value):
        for ft in self.state.config.food.types:
            if ft.value == value:
                return ft.color
        if self.state.config.food.types:
            return min(
                self.state.config.food.types, key=lambda ft: abs(ft.value - value)
            ).color
        return "#ef4444"

    def get_food_image(self, value):
        for ft in self.state.config.food.types:
            if ft.value == value:
                return ft.image
        if self.state.config.food.types:
            return min(
                self.state.config.food.types, key=lambda ft: abs(ft.value - value)
            ).image
        return ""

    def trim_overflow(self, defer_events=False):
        max_food_count = (
            self.state.target_food_count + self.state.config.world.food_overflow_limit
        )
        while len(self.foods) > max_food_count:
            oldest_id = next(iter(self.foods))
            self.foods[oldest_id].eaten = True
            if defer_events:
                self.pending_eaten_foods.append(oldest_id)
            else:
                self.eaten_foods.append(oldest_id)
            self.foods.pop(oldest_id, None)

    def spawn_specific_food(self, x, y, value):
        self.food_id_counter = (self.food_id_counter + 1) % 2_000_000_000
        new_f = Food(
            self.food_id_counter,
            x,
            y,
            value,
            self.state.config,
            self.get_food_color(value),
            self.get_food_image(value),
        )
        self.foods[new_f.id] = new_f
        self.new_foods.append(new_f.to_dict())
        return new_f

    def drop_food_on_death(self, player):
        drop_amount = math.floor(
            player.score * self.state.config.food.death_drop_score_fraction
        )
        food_types = self.state.config.food.types
        ft_weights = [ft.weight for ft in food_types]
        max_drops = 200
        drops = 0
        b_len = player.body_len
        if b_len == 0:
            return

        while drop_amount > 0 and drops < max_drops:
            idx = random.randint(0, b_len - 1)
            sx = player.body[2 * idx]
            sy = player.body[2 * idx + 1]
            chosen = random.choices(food_types, weights=ft_weights)[0]
            val = min(chosen.value, drop_amount)
            drop_amount -= val
            self.spawn_specific_food(
                (sx + random.uniform(-1.5, 1.5)) % self.state.grid_width,
                (sy + random.uniform(-1.5, 1.5)) % self.state.grid_height,
                val,
            )
            drops += 1

    def drop_black_hole_food(self, bh):
        drop_amount = bh.consumed_food_value
        if drop_amount <= 0:
            return

        food_types = self.state.config.food.types
        ft_weights = [ft.weight for ft in food_types]
        max_drops = 200
        drops = 0

        while drop_amount > 0 and drops < max_drops:
            chosen = random.choices(food_types, weights=ft_weights)[0]
            val = min(chosen.value, drop_amount)
            drop_amount -= val

            angle = random.uniform(0, 2 * math.pi)
            speed = random.uniform(10.0, 25.0)

            f = self.spawn_specific_food(bh.x, bh.y, val)
            f.vx = math.cos(angle) * speed
            f.vy = math.sin(angle) * speed
            drops += 1

    def update_moving_food(self, tick_interval):
        for f in self.foods.values():
            if f.vx != 0.0 or f.vy != 0.0:
                f.x = (f.x + f.vx * tick_interval) % self.state.grid_width
                f.y = (f.y + f.vy * tick_interval) % self.state.grid_height
                self.moved_foods[f.id] = (
                    {"id": f.id, "x": round(f.x, 2), "y": round(f.y, 2)}
                )

                f.vx *= max(0.0, 1.0 - 5.0 * tick_interval)
                f.vy *= max(0.0, 1.0 - 5.0 * tick_interval)
                if abs(f.vx) < 0.1 and abs(f.vy) < 0.1:
                    f.vx = 0.0
                    f.vy = 0.0

    def update_clusters(self, tick_interval):
        self.cluster_timer += tick_interval
        if self.cluster_timer >= 60.0:
            self.cluster_timer -= 60.0
            if random.random() < self.state.config.world.cluster_move_chance:
                if len(self.clusters) > 0:
                    idx = random.randint(0, len(self.clusters) - 1)
                    self.clusters[idx] = (
                        random.uniform(10, self.state.grid_width - 10),
                        random.uniform(10, self.state.grid_height - 10),
                    )

    def on_grid_resize(self, old_width, old_height, old_cluster_count):
        if (
            self.state.grid_width != old_width
            or self.state.grid_height != old_height
            or old_cluster_count != self.state.config.world.cluster_count
        ):
            self.clusters = self._create_clusters()

            outside_food_ids = []
            for fid, f in self.foods.items():
                if (
                    f.x < 0
                    or f.x >= self.state.grid_width
                    or f.y < 0
                    or f.y >= self.state.grid_height
                ):
                    f.eaten = True
                    outside_food_ids.append(fid)
            for fid in outside_food_ids:
                self.pending_eaten_foods.append(fid)
                self.foods.pop(fid, None)
        self.trim_overflow(defer_events=True)

    def tick_start(self):
        self.new_foods = []
        self.eaten_foods = self.pending_eaten_foods
        self.pending_eaten_foods = []
        self.moved_foods = {}

    def ensure_target_count(self):
        for fid in self.eaten_foods:
            self.foods.pop(fid, None)
        self.trim_overflow()
        while len(self.foods) < self.state.target_food_count:
            f = self._spawn_food()
            self.foods[f.id] = f
            self.new_foods.append(f.to_dict())
