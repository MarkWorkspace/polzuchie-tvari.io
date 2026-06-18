import math
import random
from app.engine.entities import BlackHole
from app.engine.systems.math_utils import toroidal_delta, toroidal_distance
from app.engine.world_elements.base import PeriodicEntityManager

class BlackHoleManager(PeriodicEntityManager):
    def __init__(self, state, portal_manager):
        super().__init__(state, "black_holes")
        self.portal_manager = portal_manager

    @property
    def black_hole_slots(self):
        return self.slots

    def _spawn_entity(self, slot_idx: int):
        self.id_counter += 1
        bh_id = f"bh_{slot_idx}_{self.id_counter}"
        pull_radius = self.state.config.world.black_holes_pull_radius
        kill_radius = self.state.config.world.black_holes_kill_radius

        for _ in range(100):
            x = random.uniform(5, self.state.grid_width - 5)
            y = random.uniform(5, self.state.grid_height - 5)
            too_close = False
            for op in getattr(self.portal_manager, "slots", []):
                if op is not None and op.state != "dead":
                    if (
                        toroidal_distance(x, y, op.x1, op.y1, self.state.grid_width, self.state.grid_height) < op.radius * 3
                        or toroidal_distance(x, y, op.x2, op.y2, self.state.grid_width, self.state.grid_height) < op.radius * 3
                    ):
                        too_close = True
                        break
            for obh in self.slots:
                if obh is not None and obh.state != "dead":
                    if toroidal_distance(x, y, obh.x, obh.y, self.state.grid_width, self.state.grid_height) < obh.pull_radius * 1.5:
                        too_close = True
                        break
            if not too_close:
                return BlackHole(bh_id, x, y, pull_radius, kill_radius)

        return BlackHole(
            bh_id,
            random.uniform(5, self.state.grid_width - 5),
            random.uniform(5, self.state.grid_height - 5),
            pull_radius,
            kill_radius,
        )

    def _on_entity_dead(self, entity):
        if hasattr(self.state, "food_manager") and self.state.food_manager:
            self.state.food_manager.drop_black_hole_food(entity)

    def get_gravity_bend(self, head, current_angle, tick_interval):
        total_bend = 0.0
        if self.enabled and self.slots:
            for bh in self.slots:
                if bh is None or bh.state == "dead" or bh.current_scale <= 0.01:
                    continue

                bh_dx, bh_dy = toroidal_delta(
                    head["x"],
                    head["y"],
                    bh.x,
                    bh.y,
                    self.state.grid_width,
                    self.state.grid_height,
                )

                dist = math.hypot(bh_dx, bh_dy)
                eff_pull_radius = bh.pull_radius * bh.current_scale
                if 0.001 < dist < eff_pull_radius:
                    pull_dist_factor = (eff_pull_radius - dist) / eff_pull_radius

                    target_angle = math.atan2(bh_dy, bh_dx)

                    angle_diff = (target_angle - current_angle + math.pi) % (
                        2 * math.pi
                    ) - math.pi

                    bend_speed = (
                        self.state.config.world.black_holes_pull_force
                        * bh.current_scale
                        * pull_dist_factor
                        * tick_interval
                        * 5.0
                    )

                    if angle_diff > 0:
                        total_bend += min(angle_diff, bend_speed)
                    else:
                        total_bend += max(angle_diff, -bend_speed)

        return total_bend

    def check_kill(self, head):
        if self.enabled and self.slots:
            for bh in self.slots:
                if bh is None or bh.state == "dead" or bh.current_scale <= 0.01:
                    continue

                bh_dx, bh_dy = toroidal_delta(
                    head["x"],
                    head["y"],
                    bh.x,
                    bh.y,
                    self.state.grid_width,
                    self.state.grid_height,
                )

                dist = math.hypot(bh_dx, bh_dy)
                eff_kill_radius = bh.kill_radius * bh.current_scale
                if dist < eff_kill_radius:
                    return True
        return False
