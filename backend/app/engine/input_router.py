# ROLE: Разбор и применение игрового ввода (turn/boost/respawn/control mode) к игрокам.
# Не содержит тик-логики, сети, сериализации или состояния мира.

import math

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


class InputRouter:
    """Route validated input actions to players owned by ``world``."""

    def __init__(self, world):
        self.world = world

    def reset_player_input(self, player_id):
        players = self.world.players
        if player_id in players:
            p = players[player_id]
            p.turn = 0
            p.current_turn = 0.0
            p.accelerating = False

    def update_direction(self, player_id, action):
        players = self.world.players
        if action == "RESPAWN":
            if player_id in players:
                p = players[player_id]
                if p.is_dead:
                    start_x, start_y = self.world.food_manager.get_safe_spawn_location()
                    p.respawn(start_x, start_y)
            return

        if action.startswith("TURN:"):
            try:
                val = float(action[5:])
                if math.isnan(val) or math.isinf(val):
                    return
                if -1.0 <= val <= 1.0:
                    if player_id in players:
                        players[player_id].turn = val
                        players[player_id].steered_by_mouse = True
            except ValueError:
                pass
            return

        if action.startswith("CONTROL_MODE:"):
            if player_id in players:
                players[player_id].turn = 0
                players[player_id].current_turn = 0.0
                mode = action.split(":")[1]
                players[player_id].steered_by_mouse = mode in ("mouse", "tilt")
            return

        if action not in VALID_ACTIONS:
            return
        if player_id in players:
            p = players[player_id]
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
