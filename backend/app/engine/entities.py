import math
from collections import deque

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
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "value": self.value,
            "color": self.color
        }

class Portal:
    def __init__(self, pid, x1, y1, x2, y2, radius, color):
        self.id = pid
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
        self.radius = radius
        self.color = color

    def to_dict(self):
        return {
            "id": self.id,
            "color": self.color,
            "x1": round(self.x1, 2),
            "y1": round(self.y1, 2),
            "x2": round(self.x2, 2),
            "y2": round(self.y2, 2),
            "radius": round(self.radius, 2)
        }

class BlackHole:
    def __init__(self, bh_id, x, y, pull_radius, kill_radius):
        self.id = bh_id
        self.x = x
        self.y = y
        self.pull_radius = pull_radius
        self.kill_radius = kill_radius
        self.current_scale = 0.0
        self.target_scale = 1.0
        self.state = "spawning"

    def to_dict(self):
        return {
            "id": self.id,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "pull_radius": round(self.pull_radius * self.current_scale, 2),
            "kill_radius": round(self.kill_radius * self.current_scale, 2)
        }

class Player:
    def __init__(self, start_x, start_y, config, nickname="Игрок", skin="#22c55e"):
        self.config = config
        self.nickname = nickname
        self.skin = skin
        self.kills = 0
        self.deaths = 0
        self.new_heads_this_tick = []
        self.just_respawned = False
        self.respawn(start_x, start_y)
        
    def respawn(self, start_x, start_y):
        self.body = deque({"x": start_x - i, "y": start_y} for i in range(self.config.snake.start_length))
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
        self.steered_by_mouse = False
        self.last_portal_exited = None

    @property
    def is_accelerating_valid(self):
        return self.accelerating and self.score > self.config.boost.min_score
        
    @property
    def head_radius(self):
        effective_score = max(0, len(self.body) - self.config.snake.start_length) * 10.0
        return self.config.snake.base_head_radius + effective_score * self.config.snake.score_thickness_scale
        
    def to_dict(self, in_aoi=True, is_full=False):
        data = {
            "angle": round(self.angle, 2),
            "score": self.score,
            "kills": self.kills,
            "deaths": self.deaths,
            "accelerating": self.is_accelerating_valid if in_aoi else False,
        }
        if is_full:
            data["skin"] = self.skin
            data["nickname"] = self.nickname
            
        if is_full or self.just_respawned:
            if in_aoi:
                data["body"] = [round(coord, 2) for pt in self.body for coord in (pt["x"], pt["y"])]
            else:
                data["body"] = [round(self.body[0]["x"], 2), round(self.body[0]["y"], 2)] if self.body else []
        else:
            if in_aoi:
                data["new_heads"] = [round(coord, 2) for pt in self.new_heads_this_tick for coord in (pt["x"], pt["y"])]
            else:
                data["new_heads"] = [round(self.new_heads_this_tick[0]["x"], 2), round(self.new_heads_this_tick[0]["y"], 2)] if self.new_heads_this_tick else []
            data["length"] = len(self.body) if in_aoi else 1
        return data
