import math
import random
from app.engine.entities import Food

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
        self.moved_foods = []
        
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
                random.uniform(10, self.state.grid_height - 10)
            )
            for _ in range(self.state.config.world.cluster_count)
        ]
        
    def get_safe_spawn_location(self):
        safe_distance = self.state.config.snake.safe_spawn_distance
        safe_distance_sq = safe_distance ** 2
        max_attempts = 50
        
        CELL_SIZE = 10.0
        grid_width_cells = math.ceil(self.state.grid_width / CELL_SIZE)
        grid_height_cells = math.ceil(self.state.grid_height / CELL_SIZE)
        cells_range = math.ceil(safe_distance / CELL_SIZE)
        
        spatial_grid = {}
        for p in self.state.players.values():
            for segment in p.body:
                cx = int(segment["x"] / CELL_SIZE) % max(1, grid_width_cells)
                cy = int(segment["y"] / CELL_SIZE) % max(1, grid_height_cells)
                spatial_grid.setdefault((cx, cy), []).append(segment)
        
        for _ in range(max_attempts):
            x = random.uniform(5, self.state.grid_width - 5)
            y = random.uniform(5, self.state.grid_height - 5)
            
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
                            dist_x = min(dist_x, self.state.grid_width - dist_x)
                            dist_y = abs(y - segment["y"])
                            dist_y = min(dist_y, self.state.grid_height - dist_y)
                            
                            if (dist_x * dist_x + dist_y * dist_y) < safe_distance_sq:
                                is_safe = False
                                break
                    if not is_safe:
                        break
                if not is_safe:
                    break
            
            if is_safe:
                return x, y
                
        return random.uniform(5, self.state.grid_width - 5), random.uniform(5, self.state.grid_height - 5)

    def _spawn_food(self):
        self.food_id_counter += 1
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
        
        return Food(self.food_id_counter, x, y, chosen.value, self.state.config, chosen.color)

    def get_food_color(self, value):
        for ft in self.state.config.food.types:
            if ft.value == value:
                return ft.color
        if self.state.config.food.types:
            return min(self.state.config.food.types, key=lambda ft: abs(ft.value - value)).color
        return "#ef4444"

    def trim_overflow(self, defer_events=False):
        max_food_count = self.state.target_food_count + self.state.config.world.food_overflow_limit
        while len(self.foods) > max_food_count:
            oldest_id = next(iter(self.foods))
            self.foods[oldest_id].eaten = True
            if defer_events:
                self.pending_eaten_foods.append(oldest_id)
            else:
                self.eaten_foods.append(oldest_id)
            self.foods.pop(oldest_id, None)

    def spawn_specific_food(self, x, y, value):
        self.food_id_counter += 1
        new_f = Food(
            self.food_id_counter,
            x,
            y,
            value,
            self.state.config,
            self.get_food_color(value)
        )
        self.foods[new_f.id] = new_f
        self.new_foods.append(new_f.to_dict())
        return new_f

    def drop_food_on_death(self, player):
        drop_amount = math.floor(player.score * self.state.config.food.death_drop_score_fraction)
        food_types = self.state.config.food.types
        ft_weights = [ft.weight for ft in food_types]
        body_list = list(player.body)
        max_drops = 200
        drops = 0
        while drop_amount > 0 and drops < max_drops:
            segment = random.choice(body_list)
            chosen = random.choices(food_types, weights=ft_weights)[0]
            val = min(chosen.value, drop_amount)
            drop_amount -= val
            self.spawn_specific_food(
                (segment["x"] + random.uniform(-1.5, 1.5)) % self.state.grid_width,
                (segment["y"] + random.uniform(-1.5, 1.5)) % self.state.grid_height,
                val
            )
            drops += 1

    def update_clusters(self, tick_interval):
        self.cluster_timer += tick_interval
        if self.cluster_timer >= 60.0:
            self.cluster_timer -= 60.0
            if random.random() < self.state.config.world.cluster_move_chance:
                if len(self.clusters) > 0:
                    idx = random.randint(0, len(self.clusters) - 1)
                    self.clusters[idx] = (random.uniform(10, self.state.grid_width - 10), random.uniform(10, self.state.grid_height - 10))

    def on_grid_resize(self, old_width, old_height, old_cluster_count):
        if self.state.grid_width != old_width or self.state.grid_height != old_height or old_cluster_count != self.state.config.world.cluster_count:
            self.clusters = self._create_clusters()
            
            outside_food_ids = []
            for fid, f in self.foods.items():
                if f.x < 0 or f.x >= self.state.grid_width or f.y < 0 or f.y >= self.state.grid_height:
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
        self.moved_foods = []

    def ensure_target_count(self):
        for fid in self.eaten_foods:
            self.foods.pop(fid, None)
        self.trim_overflow()
        while len(self.foods) < self.state.target_food_count:
            f = self._spawn_food()
            self.foods[f.id] = f
            self.new_foods.append(f.to_dict())
