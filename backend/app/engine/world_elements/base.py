import random

class PeriodicEntityManager:
    def __init__(self, state, config_prefix: str):
        self.state = state
        self.config_prefix = config_prefix
        self.id_counter = 0
        self.timers = []
        self.slots = []
        self._cached_list = []

    @property
    def target_count(self) -> int:
        return getattr(self.state.config.world, f"{self.config_prefix}_count")

    @property
    def enabled(self) -> int:
        return getattr(self.state.config.world, f"{self.config_prefix}_enabled")

    @property
    def spawn_chance(self) -> float:
        return getattr(self.state.config.world, f"{self.config_prefix}_spawn_chance")

    @property
    def growth_time(self) -> float:
        return max(0.1, getattr(self.state.config.world, f"{self.config_prefix}_growth_time"))

    def _spawn_entity(self, slot_idx: int):
        raise NotImplementedError

    def _cache_list(self):
        if self.enabled:
            self._cached_list = [
                e.to_dict() for e in self.slots
                if e is not None and e.state != "dead"
            ]
        else:
            self._cached_list = []

    def get_cached_list(self):
        return self._cached_list

    def update_slots(self, force_roll=False):
        target_count = self.target_count
        while len(self.slots) < target_count:
            self.slots.append(None)
        while len(self.slots) > target_count:
            self.slots.pop()

        while len(self.timers) < target_count:
            self.timers.append(random.uniform(0.0, 60.0))
        while len(self.timers) > target_count:
            self.timers.pop()

        if not self.enabled:
            for i in range(len(self.slots)):
                self.slots[i] = None
            self._cached_list = []
            return

        if force_roll:
            self.timers = [random.uniform(0.0, 60.0) for _ in range(target_count)]
            for i in range(target_count):
                should_exist = random.random() < self.spawn_chance
                if should_exist:
                    self.slots[i] = self._spawn_entity(i)
                else:
                    self.slots[i] = None

        self._cache_list()

    def _on_entity_dead(self, entity):
        pass

    def update(self, tick_interval: float):
        if self.enabled:
            for i in range(len(self.slots)):
                self.timers[i] += tick_interval
                if self.timers[i] >= 60.0:
                    self.timers[i] = 0.0
                    should_exist = random.random() < self.spawn_chance
                    entity = self.slots[i]
                    if should_exist:
                        if entity is None or entity.state == "dead" or entity.state == "collapsing":
                            self.slots[i] = self._spawn_entity(i)
                    else:
                        if entity is not None and entity.state != "dead" and entity.target_scale == 1.0:
                            entity.target_scale = 0.0
                            entity.state = "collapsing"

            growth_time = self.growth_time
            for i, entity in enumerate(self.slots):
                if entity is None or entity.state == "dead":
                    continue
                if entity.target_scale == 1.0 and entity.current_scale < 1.0:
                    entity.current_scale = min(1.0, entity.current_scale + tick_interval / growth_time)
                    if entity.current_scale >= 1.0:
                        entity.state = "active"
                elif entity.target_scale == 0.0 and entity.current_scale > 0.0:
                    entity.current_scale = max(0.0, entity.current_scale - tick_interval / growth_time)
                    if entity.current_scale <= 0.0:
                        entity.state = "dead"
                        self._on_entity_dead(entity)
                        self.slots[i] = None
        else:
            for i in range(len(self.slots)):
                self.slots[i] = None
        
        self._cache_list()
