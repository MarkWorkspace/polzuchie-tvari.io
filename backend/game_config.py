import copy
from dataclasses import asdict, dataclass, field, fields, is_dataclass


@dataclass
class WorldConfig:
    width: int = 100
    height: int = 100
    target_food_count: int = 250
    food_overflow_limit: int = 150
    cluster_count: int = 8
    cluster_spawn_chance: float = 0.8
    cluster_spread: float = 5.0
    cluster_move_chance: float = 0.025


@dataclass
class SimulationConfig:
    tick_rate: int = 30
    base_speed_per_second: float = 6.0
    turn_speed_per_second: float = 5.0
    turn_idle_smoothing_at_20hz: float = 0.3
    turn_active_smoothing_at_20hz: float = 0.15


@dataclass
class SnakeConfig:
    start_length: int = 9
    start_score: int = 1
    base_head_radius: float = 0.2
    score_radius_scale: float = 0.0005
    growth_score_per_segment: float = 10.0
    min_body_length: int = 9
    safe_spawn_distance: float = 15.0


@dataclass
class BoostConfig:
    min_score: int = 15
    speed_multiplier: float = 2.0
    drain_interval_seconds: float = 1.0
    score_drain: int = 1
    growth_drain: float = 1.0
    food_drop_value: int = 1


@dataclass
class FoodConfig:
    values: list[int] = field(default_factory=lambda: [1, 2, 5, 10, 20, 50])
    weights: list[int] = field(default_factory=lambda: [50, 25, 15, 6, 3, 1])
    base_radius: float = 0.2
    radius_value_scale: float = 0.1
    death_drop_score_fraction: float = 0.5


@dataclass
class NetworkConfig:
    aoi_radius: float = 60.0
    aoi_length_padding: float = 0.5


@dataclass
class GameConfig:
    world: WorldConfig = field(default_factory=WorldConfig)
    simulation: SimulationConfig = field(default_factory=SimulationConfig)
    snake: SnakeConfig = field(default_factory=SnakeConfig)
    boost: BoostConfig = field(default_factory=BoostConfig)
    food: FoodConfig = field(default_factory=FoodConfig)
    network: NetworkConfig = field(default_factory=NetworkConfig)

    def to_dict(self):
        return asdict(self)

    def apply_patch(self, patch):
        if not isinstance(patch, dict):
            raise ValueError("Config patch must be an object")
        next_config = copy.deepcopy(self)
        _apply_dataclass_patch(next_config, patch)
        next_config.validate()
        for item in fields(self):
            setattr(self, item.name, getattr(next_config, item.name))

    def validate(self):
        _require_range("world.width", self.world.width, 20, 10000)
        _require_range("world.height", self.world.height, 20, 10000)
        _require_range("world.target_food_count", self.world.target_food_count, 0, 100000)
        _require_range("world.food_overflow_limit", self.world.food_overflow_limit, 0, 100000)
        _require_range("world.cluster_count", self.world.cluster_count, 1, 1000)
        _require_range("world.cluster_spawn_chance", self.world.cluster_spawn_chance, 0, 1)
        _require_range("world.cluster_spread", self.world.cluster_spread, 0.1, 1000)
        _require_range("world.cluster_move_chance", self.world.cluster_move_chance, 0, 1)

        _require_range("simulation.tick_rate", self.simulation.tick_rate, 5, 120)
        _require_range("simulation.base_speed_per_second", self.simulation.base_speed_per_second, 0.1, 200)
        _require_range("simulation.turn_speed_per_second", self.simulation.turn_speed_per_second, 0.1, 100)
        _require_range("simulation.turn_idle_smoothing_at_20hz", self.simulation.turn_idle_smoothing_at_20hz, 0, 1)
        _require_range("simulation.turn_active_smoothing_at_20hz", self.simulation.turn_active_smoothing_at_20hz, 0, 1)

        _require_range("snake.start_length", self.snake.start_length, 1, 10000)
        _require_range("snake.start_score", self.snake.start_score, 0, 1000000)
        _require_range("snake.base_head_radius", self.snake.base_head_radius, 0.01, 100)
        _require_range("snake.score_radius_scale", self.snake.score_radius_scale, 0, 10)
        _require_range("snake.growth_score_per_segment", self.snake.growth_score_per_segment, 0.1, 1000000)
        _require_range("snake.min_body_length", self.snake.min_body_length, 1, 10000)
        _require_range("snake.safe_spawn_distance", self.snake.safe_spawn_distance, 0, 10000)

        _require_range("boost.min_score", self.boost.min_score, 0, 1000000)
        _require_range("boost.speed_multiplier", self.boost.speed_multiplier, 1, 20)
        _require_range("boost.drain_interval_seconds", self.boost.drain_interval_seconds, 0.01, 3600)
        _require_range("boost.score_drain", self.boost.score_drain, 0, 1000000)
        _require_range("boost.growth_drain", self.boost.growth_drain, 0, 1000000)
        _require_range("boost.food_drop_value", self.boost.food_drop_value, 1, 1000000)

        if len(self.food.values) == 0 or len(self.food.values) != len(self.food.weights):
            raise ValueError("food.values and food.weights must be non-empty arrays with the same length")
        for index, value in enumerate(self.food.values):
            _require_range(f"food.values[{index}]", value, 1, 1000000)
        for index, weight in enumerate(self.food.weights):
            _require_range(f"food.weights[{index}]", weight, 1, 1000000)
        _require_range("food.base_radius", self.food.base_radius, 0.01, 100)
        _require_range("food.radius_value_scale", self.food.radius_value_scale, 0, 100)
        _require_range("food.death_drop_score_fraction", self.food.death_drop_score_fraction, 0, 1)

        _require_range("network.aoi_radius", self.network.aoi_radius, 1, 10000)
        _require_range("network.aoi_length_padding", self.network.aoi_length_padding, 0, 1000)


def _apply_dataclass_patch(target, patch):
    field_map = {item.name: item for item in fields(target)}
    for key, value in patch.items():
        if key not in field_map:
            raise ValueError(f"Unknown config key: {key}")
        current_value = getattr(target, key)
        if is_dataclass(current_value):
            if not isinstance(value, dict):
                raise ValueError(f"Config section {key} must be an object")
            _apply_dataclass_patch(current_value, value)
        else:
            setattr(target, key, value)


def _require_range(name, value, minimum, maximum):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{name} must be a number")
    if value < minimum or value > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
