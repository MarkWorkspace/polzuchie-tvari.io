import asyncio
import contextlib
import msgpack
import random
import math
import uvicorn
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем подключения с любых IP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Food:
    def __init__(self, fid, x, y, value):
        self.id = fid
        self.x = x
        self.y = y
        self.value = value
        self.eaten = False
        self.radius = 0.2 + math.sqrt(value) * 0.1

    def to_dict(self):
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "value": self.value
        }

class Player:
    def __init__(self, start_x, start_y, skin="#22c55e"):
        self.skin = skin
        self.kills = 0
        self.deaths = 0
        self.new_heads_this_tick = []
        self.just_respawned = False
        self.respawn(start_x, start_y)
        
    def respawn(self, start_x, start_y):
        # Стартовая длина 9 (в 3 раза длиннее), номинальный размер головы зависит от score (остается 10, не утолщается)
        self.body = [{"x": start_x - i, "y": start_y} for i in range(9)]
        self.angle = 0.0
        self.turn = 0
        self.current_turn = 0.0
        self.score = 1
        self.pending_growth = 0.0
        self.accelerating = False
        self.speed_mult = 1.0
        self.boost_drop = 0.0
        self.pending_steps = 0.0
        self.new_heads_this_tick = []
        self.just_respawned = True
        
    @property
    def is_accelerating_valid(self):
        return self.accelerating and self.score > 15
        
    @property
    def head_radius(self):
        return 0.2 + self.score * 0.0005
        
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
    TICK_INTERVAL = 0.05
    BOOST_DRAIN_INTERVAL = 1.0

    def __init__(self):
        self.players = {}
        self.client_visibility = {}
        self.grid_width = 100  # Увеличиваем ширину карты
        self.grid_height = 100 # Увеличиваем высоту карты
        self.target_food_count = 250  # В 5 раз больше еды
        # Создаем 8 случайных точек интереса (кучек)
        self.clusters = [(random.uniform(10, self.grid_width - 10), random.uniform(10, self.grid_height - 10)) for _ in range(8)]
        self.food_id_counter = 0
        self.foods = {}
        self.new_foods = []
        self.eaten_foods = []
        self.kill_events = []
        self.full_players_dict = {}
        self.mini_players_dict = {}
        for _ in range(self.target_food_count):
            f = self._spawn_food()
            self.foods[f.id] = f

    def _spawn_food(self):
        self.food_id_counter += 1
        val = random.choices([1, 2, 5, 10, 20, 50], weights=[50, 25, 15, 6, 3, 1])[0] 
        
        if random.random() < 0.8: # 80% еды спавнится кучками (точками интереса)
            cx, cy = random.choice(self.clusters)
            x = random.gauss(cx, 5) # Нормальное распределение с радиусом разброса ~5
            y = random.gauss(cy, 5)
        else: # 20% еды спавнится равномерно по всей карте
            x = random.uniform(1, self.grid_width - 1)
            y = random.uniform(1, self.grid_height - 1)
            
        # Ограничиваем координаты границами карты, чтобы еда не вылетела за края
        x = max(1, min(self.grid_width - 1, x))
        y = max(1, min(self.grid_height - 1, y))
        
        return Food(self.food_id_counter, x, y, val)

    def _get_safe_spawn_location(self):
        safe_distance_sq = 15.0 ** 2 # Квадрат безопасного радиуса
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
        self.players[player_id] = Player(start_x, start_y, skin)

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
        self.eaten_foods = []
        self.kill_events = []
        
        # Периодически смещаем одну из точек интереса (2.5% шанс на 20Hz)
        if random.random() < 0.025:
            idx = random.randint(0, len(self.clusters) - 1)
            self.clusters[idx] = (random.uniform(10, self.grid_width - 10), random.uniform(10, self.grid_height - 10))

        # Обновляем координаты для всех игроков одновременно
        base_speed = 0.3  # Скорость движения (единиц за шаг)
        turn_speed = 0.25  # Скорость поворота (радиан за шаг)
        
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
            
            player.speed_mult = 2.0 if is_accelerating else 1.0
            
            if is_accelerating:
                player.boost_drop += self.TICK_INTERVAL
                if player.boost_drop >= self.BOOST_DRAIN_INTERVAL:
                    player.boost_drop -= self.BOOST_DRAIN_INTERVAL
                    player.score -= 1
                    player.pending_growth -= 1
                    if len(player.body) > 0:
                        tail = player.body[-1]
                        self.food_id_counter += 1
                        new_f = Food(
                            self.food_id_counter,
                            (tail["x"] + random.uniform(-0.5, 0.5)) % self.grid_width,
                            (tail["y"] + random.uniform(-0.5, 0.5)) % self.grid_height,
                            1
                        )
                        self.foods[new_f.id] = new_f
                        self.new_foods.append(new_f.to_dict())
                        # Ограничиваем количество еды, чтобы избежать лагов сервера
                        if len(self.foods) > self.target_food_count + 150:
                            oldest_id = next(iter(self.foods))
                            self.foods[oldest_id].eaten = True
                            self.eaten_foods.append(oldest_id)
            else:
                player.boost_drop = 0.0

            # Накапливаем шаги (чтобы при ускорении не растягивать змейку)
            player.pending_steps += player.speed_mult
            steps_this_tick = int(player.pending_steps)
            player.pending_steps -= steps_this_tick

            for _ in range(steps_this_tick):
                # Плавно меняем угол
                target_turn = player.turn * turn_speed
                if player.turn == 0:
                    player.current_turn += (0 - player.current_turn) * 0.3
                else:
                    player.current_turn += (target_turn - player.current_turn) * 0.15
                
                player.angle += player.current_turn
                
                head = player.body[0]
                new_head = {
                    "x": (head["x"] + math.cos(player.angle) * base_speed) % self.grid_width,
                    "y": (head["y"] + math.sin(player.angle) * base_speed) % self.grid_height
                }
                
                player.body.insert(0, new_head)
                player.new_heads_this_tick.insert(0, new_head)

                if player.pending_growth >= 10:
                    player.pending_growth -= 10
                else:
                    if len(player.body) > 0:
                        player.body.pop()
                    
                    if player.pending_growth <= -10:
                        player.pending_growth += 10
                        if len(player.body) > 9:  # Защита от сжатия меньше стартовых 9 сегментов
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
                drop_amount = player.score // 2
                body_len = len(player.body)
                while drop_amount > 0 and body_len > 0:
                    segment = random.choice(player.body)
                    val = min(random.choices([1, 2, 5, 10, 20, 50], weights=[50, 25, 15, 6, 3, 1])[0], drop_amount)
                    drop_amount -= val
                    self.food_id_counter += 1
                    new_f = Food(
                        self.food_id_counter,
                        (segment["x"] + random.uniform(-1.5, 1.5)) % self.grid_width,
                        (segment["y"] + random.uniform(-1.5, 1.5)) % self.grid_height,
                        val
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
                

        # Очистка съеденной еды одним проходом
        self.foods = {fid: f for fid, f in self.foods.items() if not f.eaten}

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
            # Радиус видимости ~60 (для 3D камеры) + небольшой запас на длину самой змеи
            safe_radius = 60.0 + (len(p.body) * 0.5)
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
            "players": players_data,
            "new_foods": self.new_foods,
            "eaten_foods": self.eaten_foods,
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
        await asyncio.sleep(max(0.0, game.TICK_INTERVAL - elapsed))

@app.on_event("startup")
async def startup_event():
    # Запускаем цикл параллельно с сервером
    asyncio.create_task(game_loop())

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
