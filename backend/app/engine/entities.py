# ROLE: Датаклассы Player, Food, Portal, BlackHole. Только структуры данных.
import math
from collections import deque

from app.engine.systems.math_utils import wrap_coordinate


class Food:
    def __init__(self, fid, x, y, value, config, color="#ef4444", image=""):
        self.id = fid
        self.x = x
        self.y = y
        self.value = value
        self.color = color
        self.image = image
        self.eaten = False
        self.radius = config.food.base_radius + math.sqrt(value) * config.food.radius_value_scale
        self.vx = 0.0
        self.vy = 0.0

    def to_dict(self):
        d = {
            "id": self.id,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "value": self.value,
            "color": self.color,
        }
        if self.image:
            d["image"] = self.image
        return d


class Portal:
    def __init__(self, pid, x1, y1, x2, y2, radius, color):
        self.id = pid
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
        self.radius = radius
        self.color = color
        self.current_scale = 0.0
        self.target_scale = 1.0
        self.state = "spawning"

    def to_dict(self):
        return {
            "id": self.id,
            "color": self.color,
            "x1": round(self.x1, 2),
            "y1": round(self.y1, 2),
            "x2": round(self.x2, 2),
            "y2": round(self.y2, 2),
            "radius": round(self.radius, 2),
            "current_scale": round(self.current_scale, 2),
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
        self.consumed_food_value = 0

    def to_dict(self):
        return {
            "id": self.id,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "pull_radius": round(self.pull_radius * self.current_scale, 2),
            "kill_radius": round(self.kill_radius * self.current_scale, 2),
        }


class Player:
    def __init__(self, pid, start_x, start_y, config, nickname="Игрок", skin="#22c55e"):
        self.id = pid
        self.config = config
        self.nickname = nickname
        self.skin = skin
        self.kills = 0
        self.deaths = 0
        self.new_heads_this_tick = []
        self.just_respawned = False
        self.respawn(start_x, start_y)

    def respawn(self, start_x, start_y):
        self.body = deque()
        # Wrap each segment so a spawn near the left edge does not put the
        # body outside [0, width); the client would draw it across the seam.
        # y is trusted to be in range because spawn points are generated there.
        width = self.config.world.width
        for i in range(self.config.snake.start_length):
            self.body.append(wrap_coordinate(start_x - i, width))
            self.body.append(start_y)
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
        self.is_dead = False
        self.final_length = 0
        self.steered_by_mouse = False
        self.last_portal_exited = None
        self.length = self.config.snake.start_length
        self.teleport_state = "none"
        self.teleport_pos = None
        self.teleport_out_pos = None
        self.teleport_timer = 0.0
        self.teleport_delay = 0.0

    @property
    def is_accelerating_valid(self):
        return (
            not self.is_dead
            and self.accelerating
            and self.score > self.config.boost.min_score
            and self.teleport_state == "none"
        )

    @property
    def body_len(self):
        return len(self.body) // 2

    @property
    def head_x(self):
        return self.body[0] if self.body else 0.0

    @property
    def head_y(self):
        return self.body[1] if len(self.body) > 1 else 0.0

    @property
    def head_radius(self):
        effective_score = max(0, self.body_len - self.config.snake.start_length) * 10.0
        return (
            self.config.snake.base_head_radius
            + effective_score * self.config.snake.score_thickness_scale
        )
