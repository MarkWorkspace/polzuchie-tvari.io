import math
import random
from app.engine.entities import Portal, BlackHole

class PortalManager:
    def __init__(self, state):
        self.state = state
        self.portal_id_counter = 0
        self.portal_timers = []
        self.portal_slots = []
        self._cached_portals_list = []
        self.update_slots(force_roll=True)

    def _spawn_portal(self, slot_idx):
        self.portal_id_counter += 1
        pid = self.portal_id_counter
        radius = self.state.config.world.portals_radius
        colors = ["#3b82f6", "#f97316", "#a855f7", "#ec4899", "#14b8a6"]
        color = colors[slot_idx % len(colors)]
        min_dist = max(self.state.grid_width, self.state.grid_height) * 0.3

        p1 = None
        p2 = None
        for _ in range(100):
            candidate1 = (random.uniform(5, self.state.grid_width - 5), random.uniform(5, self.state.grid_height - 5))
            too_close = False
            for op in self.portal_slots:
                if op is not None and op.state != "dead":
                    if math.hypot(candidate1[0] - op.x1, candidate1[1] - op.y1) < op.radius * 3 or \
                       math.hypot(candidate1[0] - op.x2, candidate1[1] - op.y2) < op.radius * 3:
                        too_close = True
                        break
            if not too_close and hasattr(self.state, 'black_hole_manager') and self.state.black_hole_manager:
                for obh in self.state.black_hole_manager.black_hole_slots:
                    if obh is not None and obh.state != "dead":
                        if math.hypot(candidate1[0] - obh.x, candidate1[1] - obh.y) < obh.pull_radius * 1.5:
                            too_close = True
                            break
            if not too_close:
                p1 = candidate1
                break
                
        if not p1:
            p1 = (random.uniform(5, self.state.grid_width - 5), random.uniform(5, self.state.grid_height - 5))
            
        for _ in range(100):
            candidate2 = (random.uniform(5, self.state.grid_width - 5), random.uniform(5, self.state.grid_height - 5))
            if math.hypot(candidate2[0] - p1[0], candidate2[1] - p1[1]) < min_dist:
                continue
            too_close = False
            for op in self.portal_slots:
                if op is not None and op.state != "dead":
                    if math.hypot(candidate2[0] - op.x1, candidate2[1] - op.y1) < op.radius * 3 or \
                       math.hypot(candidate2[0] - op.x2, candidate2[1] - op.y2) < op.radius * 3:
                        too_close = True
                        break
            if not too_close and hasattr(self.state, 'black_hole_manager') and self.state.black_hole_manager:
                for obh in self.state.black_hole_manager.black_hole_slots:
                    if obh is not None and obh.state != "dead":
                        if math.hypot(candidate2[0] - obh.x, candidate2[1] - obh.y) < obh.pull_radius * 1.5:
                            too_close = True
                            break
            if not too_close:
                p2 = candidate2
                break
                
        if not p2:
            p2 = ((p1[0] + min_dist) % self.state.grid_width, (p1[1] + min_dist) % self.state.grid_height)
            
        return Portal(pid, p1[0], p1[1], p2[0], p2[1], radius, color)

    def update_slots(self, force_roll=False):
        target_count = self.state.config.world.portals_count
        while len(self.portal_slots) < target_count:
            self.portal_slots.append(None)
        while len(self.portal_slots) > target_count:
            self.portal_slots.pop()
        
        while len(self.portal_timers) < target_count:
            self.portal_timers.append(random.uniform(0.0, 60.0))
        while len(self.portal_timers) > target_count:
            self.portal_timers.pop()
        
        if not self.state.config.world.portals_enabled:
            for i in range(len(self.portal_slots)):
                self.portal_slots[i] = None
            self._cached_portals_list = []
            return

        if force_roll:
            self.portal_timers = [random.uniform(0.0, 60.0) for _ in range(target_count)]
            for i in range(target_count):
                if random.random() < self.state.config.world.portals_spawn_chance:
                    self.portal_slots[i] = self._spawn_portal(i)
                else:
                    self.portal_slots[i] = None
                    
        self._cache_list()

    def update(self, tick_interval):
        if self.state.config.world.portals_enabled:
            for i in range(len(self.portal_slots)):
                self.portal_timers[i] += tick_interval
                if self.portal_timers[i] >= 60.0:
                    self.portal_timers[i] = 0.0
                    should_exist = random.random() < self.state.config.world.portals_spawn_chance
                    p = self.portal_slots[i]
                    if should_exist:
                        if p is None or p.state == "dead" or p.state == "collapsing":
                            self.portal_slots[i] = self._spawn_portal(i)
                    else:
                        if p is not None and p.state != "dead" and p.target_scale == 1.0:
                            # Safe closing check: Is any player using this portal?
                            in_use = False
                            for pid, player in self.state.players.items():
                                if player.teleport_state != "none" and player.last_portal_exited is not None:
                                    if player.last_portal_exited[0] == p.id:
                                        in_use = True
                                        break
                            if in_use:
                                # Wait another cycle or just delay timer slightly
                                self.portal_timers[i] -= 1.0 # Try again in 1 second
                            else:
                                p.target_scale = 0.0
                                p.state = "collapsing"
            
            growth_time = max(0.1, self.state.config.world.portals_growth_time)
            for i, p in enumerate(self.portal_slots):
                if p is None or p.state == "dead":
                    continue
                if p.target_scale == 1.0 and p.current_scale < 1.0:
                    p.current_scale = min(1.0, p.current_scale + tick_interval / growth_time)
                    if p.current_scale >= 1.0:
                        p.state = "active"
                elif p.target_scale == 0.0 and p.current_scale > 0.0:
                    p.current_scale = max(0.0, p.current_scale - tick_interval / growth_time)
                    if p.current_scale <= 0.0:
                        p.state = "dead"
                        self.portal_slots[i] = None
        else:
            for i in range(len(self.portal_slots)):
                self.portal_slots[i] = None
                
        self._cache_list()

    def _cache_list(self):
        if self.state.config.world.portals_enabled == 1:
            self._cached_portals_list = [p.to_dict() for p in self.portal_slots if p is not None and p.state != "dead"]
        else:
            self._cached_portals_list = []
            
    def get_cached_list(self):
        return self._cached_portals_list

    def check_teleport_start(self, new_head, player):
        if self.state.config.world.portals_enabled == 1 and self.portal_slots:
            for portal in self.portal_slots:
                if portal is None or portal.state == "dead" or portal.current_scale <= 0.01:
                    continue
                eff_radius = portal.radius * portal.current_scale
                dist1 = math.hypot(new_head["x"] - portal.x1, new_head["y"] - portal.y1)
                if dist1 < eff_radius:
                    if player.last_portal_exited != (portal.id, 0):
                        return {"out_pos": (portal.x2, portal.y2), "portal_id": (portal.id, 1)}
                dist2 = math.hypot(new_head["x"] - portal.x2, new_head["y"] - portal.y2)
                if dist2 < eff_radius:
                    if player.last_portal_exited != (portal.id, 1):
                        return {"out_pos": (portal.x1, portal.y1), "portal_id": (portal.id, 0)}
        return None


class BlackHoleManager:
    def __init__(self, state, portal_manager):
        self.state = state
        self.portal_manager = portal_manager
        self.black_hole_id_counter = 0
        self.black_hole_timers = []
        self.black_hole_slots = []
        self._cached_black_holes_list = []
        self.update_slots(force_roll=True)

    def _spawn_black_hole(self, slot_idx):
        self.black_hole_id_counter += 1
        bh_id = f"bh_{slot_idx}_{self.black_hole_id_counter}"
        pull_radius = self.state.config.world.black_holes_pull_radius
        kill_radius = self.state.config.world.black_holes_kill_radius

        for _ in range(100):
            x = random.uniform(5, self.state.grid_width - 5)
            y = random.uniform(5, self.state.grid_height - 5)
            too_close = False
            for op in self.portal_manager.portal_slots:
                if op is not None and op.state != "dead":
                    if math.hypot(x - op.x1, y - op.y1) < op.radius * 3 or math.hypot(x - op.x2, y - op.y2) < op.radius * 3:
                        too_close = True
                        break
            for obh in self.black_hole_slots:
                if obh is not None and obh.state != "dead":
                    if math.hypot(x - obh.x, y - obh.y) < obh.pull_radius * 1.5:
                        too_close = True
                        break
            if not too_close:
                return BlackHole(bh_id, x, y, pull_radius, kill_radius)
        
        return BlackHole(
            bh_id,
            random.uniform(5, self.state.grid_width - 5),
            random.uniform(5, self.state.grid_height - 5),
            pull_radius,
            kill_radius
        )

    def update_slots(self, force_roll=False):
        target_count = self.state.config.world.black_holes_count
        while len(self.black_hole_slots) < target_count:
            self.black_hole_slots.append(None)
        while len(self.black_hole_slots) > target_count:
            self.black_hole_slots.pop()
        
        while len(self.black_hole_timers) < target_count:
            self.black_hole_timers.append(random.uniform(0.0, 60.0))
        while len(self.black_hole_timers) > target_count:
            self.black_hole_timers.pop()
        
        if not self.state.config.world.black_holes_enabled:
            for i in range(len(self.black_hole_slots)):
                self.black_hole_slots[i] = None
            self._cached_black_holes_list = []
            return

        if force_roll:
            self.black_hole_timers = [random.uniform(0.0, 60.0) for _ in range(target_count)]
            for i in range(target_count):
                should_exist = random.random() < self.state.config.world.black_holes_spawn_chance
                if should_exist:
                    self.black_hole_slots[i] = self._spawn_black_hole(i)
                else:
                    self.black_hole_slots[i] = None
                    
        self._cache_list()

    def update(self, tick_interval):
        if self.state.config.world.black_holes_enabled:
            for i in range(len(self.black_hole_slots)):
                self.black_hole_timers[i] += tick_interval
                if self.black_hole_timers[i] >= 60.0:
                    self.black_hole_timers[i] = 0.0
                    should_exist = random.random() < self.state.config.world.black_holes_spawn_chance
                    bh = self.black_hole_slots[i]
                    if should_exist:
                        if bh is None or bh.state == "dead" or bh.state == "collapsing":
                            self.black_hole_slots[i] = self._spawn_black_hole(i)
                    else:
                        if bh is not None and bh.state != "dead" and bh.target_scale == 1.0:
                            bh.target_scale = 0.0
                            bh.state = "collapsing"
            
            growth_time = max(0.1, self.state.config.world.black_holes_growth_time)
            for i, bh in enumerate(self.black_hole_slots):
                if bh is None or bh.state == "dead":
                    continue
                if bh.target_scale == 1.0 and bh.current_scale < 1.0:
                    bh.current_scale = min(1.0, bh.current_scale + tick_interval / growth_time)
                    if bh.current_scale >= 1.0:
                        bh.state = "active"
                elif bh.target_scale == 0.0 and bh.current_scale > 0.0:
                    bh.current_scale = max(0.0, bh.current_scale - tick_interval / growth_time)
                    if bh.current_scale <= 0.0:
                        bh.state = "dead"
                        self.black_hole_slots[i] = None
        else:
            for i in range(len(self.black_hole_slots)):
                self.black_hole_slots[i] = None
                
        self._cache_list()

    def get_gravity_bend(self, head, current_angle, tick_interval):
        total_bend = 0.0
        if self.state.config.world.black_holes_enabled and self.black_hole_slots:
            for bh in self.black_hole_slots:
                if bh is None or bh.state == "dead" or bh.current_scale <= 0.01:
                    continue
                
                bh_dx = bh.x - head["x"]
                if bh_dx > self.state.grid_width / 2:
                    bh_dx -= self.state.grid_width
                elif bh_dx < -self.state.grid_width / 2:
                    bh_dx += self.state.grid_width
                    
                bh_dy = bh.y - head["y"]
                if bh_dy > self.state.grid_height / 2:
                    bh_dy -= self.state.grid_height
                elif bh_dy < -self.state.grid_height / 2:
                    bh_dy += self.state.grid_height
                    
                dist = math.hypot(bh_dx, bh_dy)
                eff_pull_radius = bh.pull_radius * bh.current_scale
                if 0.001 < dist < eff_pull_radius:
                    pull_dist_factor = (eff_pull_radius - dist) / eff_pull_radius
                    
                    # Target angle towards the black hole, plus a 45-degree offset to create a natural swirl
                    target_angle = math.atan2(bh_dy, bh_dx) + math.pi / 4
                    
                    angle_diff = (target_angle - current_angle + math.pi) % (2 * math.pi) - math.pi
                    
                    # The pull force acts as a rotational bend speed.
                    # Multiplied by 5.0 so that near the center, the bend overpowers user steering.
                    bend_speed = self.state.config.world.black_holes_pull_force * bh.current_scale * pull_dist_factor * tick_interval * 5.0
                    
                    if angle_diff > 0:
                        total_bend += min(angle_diff, bend_speed)
                    else:
                        total_bend += max(angle_diff, -bend_speed)
                        
        return total_bend

    def check_kill(self, head):
        if self.state.config.world.black_holes_enabled and self.black_hole_slots:
            for bh in self.black_hole_slots:
                if bh is None or bh.state == "dead" or bh.current_scale <= 0.01:
                    continue
                
                bh_dx = bh.x - head["x"]
                if bh_dx > self.state.grid_width / 2:
                    bh_dx -= self.state.grid_width
                elif bh_dx < -self.state.grid_width / 2:
                    bh_dx += self.state.grid_width
                    
                bh_dy = bh.y - head["y"]
                if bh_dy > self.state.grid_height / 2:
                    bh_dy -= self.state.grid_height
                elif bh_dy < -self.state.grid_height / 2:
                    bh_dy += self.state.grid_height
                    
                dist = math.hypot(bh_dx, bh_dy)
                eff_kill_radius = bh.kill_radius * bh.current_scale
                if dist < eff_kill_radius:
                    return True
        return False

    def _cache_list(self):
        if self.state.config.world.black_holes_enabled == 1:
            self._cached_black_holes_list = [bh.to_dict() for bh in self.black_hole_slots if bh is not None and bh.state != "dead"]
        else:
            self._cached_black_holes_list = []
            
    def get_cached_list(self):
        return self._cached_black_holes_list
