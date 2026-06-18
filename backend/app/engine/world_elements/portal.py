import random
from app.engine.entities import Portal
from app.engine.systems.math_utils import toroidal_distance
from app.engine.world_elements.base import PeriodicEntityManager

class PortalManager(PeriodicEntityManager):
    def __init__(self, state):
        super().__init__(state, "portals")

    @property
    def portal_slots(self):
        return self.slots

    def _spawn_entity(self, slot_idx: int):
        self.id_counter += 1
        pid = self.id_counter
        radius = self.state.config.world.portals_radius
        colors = ["#3b82f6", "#f97316", "#a855f7", "#ec4899", "#14b8a6"]
        color = colors[slot_idx % len(colors)]
        min_dist = max(self.state.grid_width, self.state.grid_height) * 0.3

        p1 = None
        p2 = None
        for _ in range(100):
            candidate1 = (
                random.uniform(5, self.state.grid_width - 5),
                random.uniform(5, self.state.grid_height - 5),
            )
            too_close = False
            for op in self.slots:
                if op is not None and op.state != "dead":
                    if (
                        toroidal_distance(candidate1[0], candidate1[1], op.x1, op.y1, self.state.grid_width, self.state.grid_height) < op.radius * 3
                        or toroidal_distance(candidate1[0], candidate1[1], op.x2, op.y2, self.state.grid_width, self.state.grid_height) < op.radius * 3
                    ):
                        too_close = True
                        break
            if not too_close and getattr(self.state, "bh_manager", None):
                for obh in getattr(self.state.bh_manager, "slots", []):
                    if obh is not None and obh.state != "dead":
                        if toroidal_distance(candidate1[0], candidate1[1], obh.x, obh.y, self.state.grid_width, self.state.grid_height) < obh.pull_radius * 1.5:
                            too_close = True
                            break
            if not too_close:
                p1 = candidate1
                break

        if not p1:
            p1 = (
                random.uniform(5, self.state.grid_width - 5),
                random.uniform(5, self.state.grid_height - 5),
            )

        for _ in range(100):
            candidate2 = (
                random.uniform(5, self.state.grid_width - 5),
                random.uniform(5, self.state.grid_height - 5),
            )
            if toroidal_distance(candidate2[0], candidate2[1], p1[0], p1[1], self.state.grid_width, self.state.grid_height) < min_dist:
                continue
            too_close = False
            for op in self.slots:
                if op is not None and op.state != "dead":
                    if (
                        toroidal_distance(candidate2[0], candidate2[1], op.x1, op.y1, self.state.grid_width, self.state.grid_height) < op.radius * 3
                        or toroidal_distance(candidate2[0], candidate2[1], op.x2, op.y2, self.state.grid_width, self.state.grid_height) < op.radius * 3
                    ):
                        too_close = True
                        break
            if not too_close and getattr(self.state, "bh_manager", None):
                for obh in getattr(self.state.bh_manager, "slots", []):
                    if obh is not None and obh.state != "dead":
                        if toroidal_distance(candidate2[0], candidate2[1], obh.x, obh.y, self.state.grid_width, self.state.grid_height) < obh.pull_radius * 1.5:
                            too_close = True
                            break
            if not too_close:
                p2 = candidate2
                break

        if not p2:
            p2 = (
                random.uniform(5, self.state.grid_width - 5),
                random.uniform(5, self.state.grid_height - 5),
            )

        return Portal(f"portal_{pid}", p1[0], p1[1], p2[0], p2[1], radius, color)

    def check_teleport_start(self, new_head, player):
        if self.enabled and self.slots:
            for portal in self.slots:
                if portal is None or portal.state == "dead" or portal.current_scale <= 0.01:
                    continue
                eff_radius = portal.radius * portal.current_scale
                dist1 = toroidal_distance(
                    new_head["x"], new_head["y"], portal.x1, portal.y1, self.state.grid_width, self.state.grid_height
                )
                if dist1 < eff_radius:
                    if player.last_portal_exited != (portal.id, 0):
                        return {"out_pos": (portal.x2, portal.y2), "portal_id": (portal.id, 1)}
                dist2 = toroidal_distance(
                    new_head["x"], new_head["y"], portal.x2, portal.y2, self.state.grid_width, self.state.grid_height
                )
                if dist2 < eff_radius:
                    if player.last_portal_exited != (portal.id, 1):
                        return {"out_pos": (portal.x1, portal.y1), "portal_id": (portal.id, 0)}
        return None
