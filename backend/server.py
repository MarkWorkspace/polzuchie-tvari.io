import asyncio
import contextlib
import msgpack
import random
import math
import uvicorn
import os
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from game_config import GameConfig

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем подключения с любых IP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Food:
    def __init__(self, fid, x, y, value, config, color="#ef4444"):
        self.id = fid
        self.x = x
        self.y = y
        self.value = value
        self.color = color
        self.eaten = False
        self.radius = config.food.base_radius + math.sqrt(value) * config.food.radius_value_scale

    def to_dict(self):
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "value": self.value,
            "color": self.color
        }

class Player:
    def __init__(self, start_x, start_y, config, skin="#22c55e"):
        self.config = config
        self.skin = skin
        self.kills = 0
        self.deaths = 0
        self.new_heads_this_tick = []
        self.just_respawned = False
        self.respawn(start_x, start_y)
        
    def respawn(self, start_x, start_y):
        self.body = [{"x": start_x - i, "y": start_y} for i in range(self.config.snake.start_length)]
        self.angle = 0.0
        self.turn = 0
        self.current_turn = 0.0
        self.score = self.config.snake.start_score
        self.pending_growth = 0.0
        self.accelerating = False
        self.speed_mult = 1.0
        self.boost_drop = 0.0
        self.pending_steps = 0.0
        self.new_heads_this_tick = []
        self.just_respawned = True
        
    @property
    def is_accelerating_valid(self):
        return self.accelerating and self.score > self.config.boost.min_score
        
    @property
    def head_radius(self):
        return self.config.snake.base_head_radius + self.score * self.config.snake.score_thickness_scale
        
    def to_dict(self, in_aoi=True, is_full=False):
        data = {
            "angle": self.angle,
            "score": self.score,
            "kills": self.kills,
            "deaths": self.deaths,
            "accelerating": self.is_accelerating_valid if in_aoi else False,
            "skin": self.skin
        }
        # При первом подключении или после гибели отправляем массив тела целиком
        if is_full or self.just_respawned:
            data["body"] = self.body if in_aoi else ([self.body[0]] if self.body else [])
        else:
            # Дельта: отправляем только новые добавленные точки головы и целевую длину
            data["new_heads"] = self.new_heads_this_tick if in_aoi else (self.new_heads_this_tick[:1] if self.new_heads_this_tick else [])
            data["length"] = len(self.body) if in_aoi else 1
        return data

class GameState:
    def __init__(self):
        self.config = GameConfig()
        self.players = {}
        self.client_visibility = {}
        self.grid_width = self.config.world.width
        self.grid_height = self.config.world.height
        self.target_food_count = self.config.world.target_food_count
        self.clusters = self._create_clusters()
        self.food_id_counter = 0
        self.foods = {}
        self.new_foods = []
        self.eaten_foods = []
        self.pending_eaten_foods = []
        self.kill_events = []
        self.moved_foods = []
        self.full_players_dict = {}
        self.mini_players_dict = {}
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

    def get_config(self):
        return self.config.to_dict()

    def update_config(self, patch):
        old_width = self.grid_width
        old_height = self.grid_height
        old_cluster_count = len(self.clusters)
        self.config.apply_patch(patch)
        self.grid_width = self.config.world.width
        self.grid_height = self.config.world.height
        self.target_food_count = self.config.world.target_food_count
        if self.grid_width != old_width or self.grid_height != old_height or len(self.clusters) != self.config.world.cluster_count:
            self.clusters = self._create_clusters()
        elif old_cluster_count != self.config.world.cluster_count:
            self.clusters = self._create_clusters()
        self._trim_food_overflow(defer_events=True)
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
        else: # 20% еды спавнится равномерно по всей карте
            x = random.uniform(1, self.grid_width - 1)
            y = random.uniform(1, self.grid_height - 1)
            
        # Ограничиваем координаты границами карты, чтобы еда не вылетела за края
        x = max(1, min(self.grid_width - 1, x))
        y = max(1, min(self.grid_height - 1, y))
        
        return Food(self.food_id_counter, x, y, chosen.value, self.config, chosen.color)

    def _get_food_color(self, value):
        """Получить цвет еды по номиналу из конфигурации"""
        for ft in self.config.food.types:
            if ft.value == value:
                return ft.color
        if self.config.food.types:
            return min(self.config.food.types, key=lambda ft: abs(ft.value - value)).color
        return "#ef4444"

    def _get_safe_spawn_location(self):
        safe_distance_sq = self.config.snake.safe_spawn_distance ** 2
        max_attempts = 50
        
        for _ in range(max_attempts):
            x = random.uniform(5, self.grid_width - 5)
            y = random.uniform(5, self.grid_height - 5)
            
            is_safe = True
            for p in self.players.values():
                for segment in p.body:
                    dist_sq = (x - segment["x"])**2 + (y - segment["y"])**2
                    if dist_sq < safe_distance_sq:
                        is_safe = False
                        break
                if not is_safe:
                    break
            
            if is_safe:
                return x, y
                
        # Если карта переполнена и безопасное место не найдено за 50 попыток, возвращаем просто случайную точку
        return random.uniform(5, self.grid_width - 5), random.uniform(5, self.grid_height - 5)

    def add_player(self, player_id, skin="#22c55e"):
        start_x, start_y = self._get_safe_spawn_location()
        self.players[player_id] = Player(start_x, start_y, self.config, skin)

    def remove_player(self, player_id):
        self.players.pop(player_id, None)
        self.client_visibility.pop(player_id, None)
        for visible_players in self.client_visibility.values():
            visible_players.discard(player_id)

    def update_direction(self, player_id, action):
        if player_id in self.players:
            p = self.players[player_id]
            if action == "LEFT_DOWN":
                p.turn = -1
            elif action == "LEFT_UP" and p.turn == -1:
                p.turn = 0
            elif action == "RIGHT_DOWN":
                p.turn = 1
            elif action == "RIGHT_UP" and p.turn == 1:
                p.turn = 0
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
        
        # Периодически смещаем одну из точек интереса (2.5% шанс на 20Hz)
        if random.random() < self.config.world.cluster_move_chance:
            idx = random.randint(0, len(self.clusters) - 1)
            self.clusters[idx] = (random.uniform(10, self.grid_width - 10), random.uniform(10, self.grid_height - 10))

        # Обновляем координаты для всех игроков одновременно
        tick_interval = self.tick_interval
        base_speed = self.config.simulation.base_speed_per_second * tick_interval
        max_turn_deg_rad = self.config.simulation.max_turn_speed_deg_per_second * math.pi / 180
        min_turn_radius_cfg = self.config.simulation.min_turn_radius
        thickness_coeff = self.config.simulation.turn_radius_thickness_coeff
        idle_turn_smoothing = self.tick_smoothing(self.config.simulation.turn_idle_smoothing_at_20hz)
        active_turn_smoothing = self.tick_smoothing(self.config.simulation.turn_active_smoothing_at_20hz)
        
        # --- ПРОСТРАНСТВЕННОЕ РАЗДЕЛЕНИЕ (Spatial Partitioning) ---
        # Размер ячейки 10.0 гарантирует, что мы не пропустим коллизии даже у очень толстых змей
        CELL_SIZE = 10.0 
        spatial_grid = {}
        food_grid = {}

        for pid, p in self.players.items():
            p.new_heads_this_tick = []
            for segment in p.body:
                cx, cy = int(segment["x"] / CELL_SIZE), int(segment["y"] / CELL_SIZE)
                if (cx, cy) not in spatial_grid:
                    spatial_grid[(cx, cy)] = []
                spatial_grid[(cx, cy)].append((pid, segment["x"], segment["y"], p.head_radius))

        # Заполняем сетку еды
        for f in self.foods.values():
            cx, cy = int(f.x / CELL_SIZE), int(f.y / CELL_SIZE)
            if (cx, cy) not in food_grid:
                food_grid[(cx, cy)] = []
            food_grid[(cx, cy)].append(f)
            
        dead_players = set()

        for pid, player in self.players.items():
            is_accelerating = player.is_accelerating_valid
            
            player.speed_mult = self.config.boost.speed_multiplier if is_accelerating else 1.0
            
            if is_accelerating:
                player.boost_drop += tick_interval
                if player.boost_drop >= self.config.boost.drain_interval_seconds:
                    player.boost_drop -= self.config.boost.drain_interval_seconds
                    drain = self.config.boost.drain_per_interval
                    player.score -= drain
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
                        # Ограничиваем количество еды, чтобы избежать лагов сервера
                        self._trim_food_overflow()
            else:
                player.boost_drop = 0.0

            # Вычисляем скорость поворота для данной змейки
            # (зависит от толщины: чем толще змея, тем шире минимальный радиус поворота)
            effective_radius = min_turn_radius_cfg + player.head_radius * thickness_coeff
            max_turn_from_radius = self.config.simulation.base_speed_per_second / max(effective_radius, 0.01)
            turn_speed = min(max_turn_deg_rad, max_turn_from_radius) * tick_interval

            # Накапливаем шаги (чтобы при ускорении не растягивать змейку)
            player.pending_steps += player.speed_mult
            steps_this_tick = int(player.pending_steps)
            player.pending_steps -= steps_this_tick

            for _ in range(steps_this_tick):
                # Плавно меняем угол
                target_turn = player.turn * turn_speed
                if player.turn == 0:
                    player.current_turn += (0 - player.current_turn) * idle_turn_smoothing
                else:
                    player.current_turn += (target_turn - player.current_turn) * active_turn_smoothing
                
                player.angle += player.current_turn
                
                head = player.body[0]
                new_head = {
                    "x": (head["x"] + math.cos(player.angle) * base_speed) % self.grid_width,
                    "y": (head["y"] + math.sin(player.angle) * base_speed) % self.grid_height
                }
                
                player.body.insert(0, new_head)
                player.new_heads_this_tick.insert(0, new_head)

                if player.pending_growth >= self.config.snake.growth_score_per_segment:
                    player.pending_growth -= self.config.snake.growth_score_per_segment
                else:
                    if len(player.body) > 0:
                        player.body.pop()
                    
                    if player.pending_growth <= -self.config.snake.growth_score_per_segment:
                        player.pending_growth += self.config.snake.growth_score_per_segment
                        if len(player.body) > self.config.snake.min_body_length:
                            player.body.pop()

            new_head = player.body[0]
            head_radius = player.head_radius
            
            # Проверка столкновений с другими змейками
            is_dead = False
            killer_pid = None
            
            grid_x, grid_y = int(new_head["x"] / CELL_SIZE), int(new_head["y"] / CELL_SIZE)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    cell = (grid_x + dx, grid_y + dy)
                    if cell in spatial_grid:
                        for other_pid, ox, oy, other_radius in spatial_grid[cell]:
                            if pid != other_pid and other_pid not in dead_players:
                                collision_dist = (head_radius + other_radius) * 0.7
                                dist_x = new_head["x"] - ox
                                dist_y = new_head["y"] - oy
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
                # Раскидываем 50% массы змейки в виде еды
                drop_amount = math.floor(player.score * self.config.food.death_drop_score_fraction)
                body_len = len(player.body)
                food_types = self.config.food.types
                ft_weights = [ft.weight for ft in food_types]
                while drop_amount > 0 and body_len > 0:
                    segment = random.choice(player.body)
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

                # Возрождаем змейку
                start_x, start_y = self._get_safe_spawn_location()
                player.respawn(start_x, start_y)
                continue

            # Проверяем, съела ли змейка какое-либо из яблок
            eaten_value = 0
            grid_x, grid_y = int(new_head["x"] / CELL_SIZE), int(new_head["y"] / CELL_SIZE)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    cell = (grid_x + dx, grid_y + dy)
                    if cell in food_grid:
                        for f in food_grid[cell]:
                            if f.eaten: continue
                            dist_x = new_head["x"] - f.x
                            dist_y = new_head["y"] - f.y
                            if (dist_x * dist_x + dist_y * dist_y) < ((head_radius + f.radius) ** 2):
                                eaten_value += f.value
                                f.eaten = True
                                self.eaten_foods.append(f.id)
            
            if eaten_value > 0:
                player.score += eaten_value
                player.pending_growth += eaten_value
                

        # Притяжение еды к головам змей
        attraction_radius = self.config.food.attraction_radius
        attraction_speed = self.config.food.attraction_speed * tick_interval
        if attraction_radius > 0 and attraction_speed > 0:
            attracted_ids = set()
            for pid, player in self.players.items():
                if pid in dead_players or not player.body:
                    continue
                head = player.body[0]
                hx, hy = head["x"], head["y"]
                grid_x, grid_y = int(hx / CELL_SIZE), int(hy / CELL_SIZE)
                radius_cells = int(attraction_radius / CELL_SIZE) + 1
                for dx in range(-radius_cells, radius_cells + 1):
                    for dy in range(-radius_cells, radius_cells + 1):
                        cell = (grid_x + dx, grid_y + dy)
                        if cell in food_grid:
                            for f in food_grid[cell]:
                                if f.eaten or f.id in attracted_ids:
                                    continue
                                fdx = hx - f.x
                                fdy = hy - f.y
                                dist_sq = fdx * fdx + fdy * fdy
                                if dist_sq < attraction_radius * attraction_radius and dist_sq > 0.001:
                                    dist = math.sqrt(dist_sq)
                                    move = min(attraction_speed, dist * 0.5)
                                    f.x += (fdx / dist) * move
                                    f.y += (fdy / dist) * move
                                    attracted_ids.add(f.id)
                                    self.moved_foods.append({"id": f.id, "x": f.x, "y": f.y})

        # Очистка съеденной еды одним проходом
        self.foods = {fid: f for fid, f in self.foods.items() if not f.eaten}
        self._trim_food_overflow()

        # Восполняем еду до целевого значения
        while len(self.foods) < self.target_food_count:
            f = self._spawn_food()
            self.foods[f.id] = f
            self.new_foods.append(f.to_dict())

        # Предварительно кешируем словари игроков для оптимизации рассылки AoI
        self.full_players_dict = {pid: p.to_dict(in_aoi=True, is_full=False) for pid, p in self.players.items()}
        self.mini_players_dict = {pid: p.to_dict(in_aoi=False, is_full=False) for pid, p in self.players.items()}
        
        for p in self.players.values():
            p.just_respawned = False

    def get_delta_state(self, client_id, is_full=False, update_visibility=True, return_visibility=False):
        client_player = self.players.get(client_id)
        if client_player and len(client_player.body) > 0:
            cx, cy = client_player.body[0]["x"], client_player.body[0]["y"]
        else:
            cx, cy = self.grid_width / 2, self.grid_height / 2
            
        previous_visible = self.client_visibility.get(client_id, set())
        current_visible = set()
        players_data = {}
        for pid, p in self.players.items():
            if not p.body:
                continue
                
            head = p.body[0]
            dist_sq = (head["x"] - cx)**2 + (head["y"] - cy)**2
            safe_radius = self.config.network.aoi_radius + (len(p.body) * self.config.network.aoi_length_padding)
            in_aoi = (pid == client_id) or (dist_sq < safe_radius ** 2)
            if in_aoi:
                current_visible.add(pid)
            
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

        state = {
            "type": "FULL" if is_full else "DELTA",
            "server_tick_rate": self.config.simulation.tick_rate,
            "server_simulation": self.config.to_dict()["simulation"],
            "server_snake": self.config.to_dict()["snake"],
            "players": players_data,
            "new_foods": self.new_foods,
            "eaten_foods": self.eaten_foods,
            "moved_foods": self.moved_foods,
            "kill_events": self.kill_events
        }

        if client_id and update_visibility:
            self.client_visibility[client_id] = current_visible

        if return_visibility:
            return state, current_visible

        return state
        
    def get_full_state(self, client_id):
        state = self.get_delta_state(client_id, is_full=True)
        state["foods"] = [f.to_dict() for f in self.foods.values()]
        return state

game = GameState()
active_connections = {}

def admin_password():
    password = os.getenv("ADMIN_PASSWORD")
    if password:
        return password
    if os.getenv("ENVIRONMENT") != "production":
        return "admin"
    return None

def require_admin(x_admin_password: str | None = Header(default=None)):
    expected_password = admin_password()
    if not expected_password:
        raise HTTPException(status_code=403, detail="ADMIN_PASSWORD is not configured")
    if x_admin_password != expected_password:
        raise HTTPException(status_code=401, detail="Invalid admin password")

async def sender_loop(client_id, websocket, queue):
    try:
        while True:
            data, visible_players = await queue.get()
            await websocket.send_bytes(data)
            game.client_visibility[client_id] = visible_players
    except asyncio.CancelledError:
        raise
    except Exception:
        active_connections.pop(client_id, None)
        game.remove_player(client_id)

def replace_queued_state(queue, data):
    if queue.full():
        with contextlib.suppress(asyncio.QueueEmpty):
            queue.get_nowait()
    with contextlib.suppress(asyncio.QueueFull):
        queue.put_nowait(data)

async def game_loop():
    """Глобальный цикл игры (Tick Rate)"""
    while True:
        start_time = asyncio.get_event_loop().time()
        try:
            game.tick()
        except Exception as e:
            print(f"Game loop error: {e}")
            
        for client_id, connection in list(active_connections.items()):
            delta_state, visible_players = game.get_delta_state(
                client_id,
                update_visibility=False,
                return_visibility=True
            )
            state_msgpack = msgpack.packb(delta_state)
            replace_queued_state(connection["queue"], (state_msgpack, visible_players))
            
        # Компенсация времени выполнения тика
        elapsed = asyncio.get_event_loop().time() - start_time
        await asyncio.sleep(max(0.0, game.tick_interval - elapsed))

@app.on_event("startup")
async def startup_event():
    # Запускаем цикл параллельно с сервером
    asyncio.create_task(game_loop())

@app.get("/admin/config")
async def get_admin_config(x_admin_password: str | None = Header(default=None, alias="x-admin-password")):
    require_admin(x_admin_password)
    return game.get_config()

@app.patch("/admin/config")
async def patch_admin_config(patch: dict, x_admin_password: str | None = Header(default=None, alias="x-admin-password")):
    require_admin(x_admin_password)
    try:
        return game.update_config(patch)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, skin: str = "#22c55e"):
    await websocket.accept()
    game.add_player(client_id, skin)
    
    # Отправляем полное состояние при первом подключении
    await websocket.send_bytes(msgpack.packb(game.get_full_state(client_id)))

    send_queue = asyncio.Queue(maxsize=1)
    send_task = asyncio.create_task(sender_loop(client_id, websocket, send_queue))
    active_connections[client_id] = {"websocket": websocket, "queue": send_queue, "task": send_task}
    
    try:
        while True:
            data = await websocket.receive_text()
            game.update_direction(client_id, data)
    except Exception:
        pass # Ловим вообще все исключения обрывов связи
    finally:
        # Гарантированная очистка памяти при отключении клиента
        connection = active_connections.pop(client_id, None)
        if connection:
            connection["task"].cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await connection["task"]
        game.remove_player(client_id)

if __name__ == "__main__":
    # Запуск сервера. В проде reload=False
    is_dev = os.getenv("ENVIRONMENT") != "production"
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=is_dev)
