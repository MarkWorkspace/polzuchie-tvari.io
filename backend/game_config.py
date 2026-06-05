import copy
import typing
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
    portals_enabled: int = 1
    portals_count: int = 2
    portals_radius: float = 2.5
    portals_teleport_delay_ms: int = 1500
    portals_spawn_chance: float = 0.5
    portals_growth_time: float = 3.0
    black_holes_enabled: int = 1
    black_holes_count: int = 2
    black_holes_spawn_chance: float = 0.5
    black_holes_pull_radius: float = 12.0
    black_holes_pull_force: float = 6.0
    black_holes_kill_radius: float = 1.8
    black_holes_growth_time: float = 5.0



@dataclass
class SimulationConfig:
    tick_rate: int = 30
    base_speed_per_second: float = 6.0
    max_turn_speed_deg_per_second: float = 290.0
    min_turn_radius: float = 0.5
    turn_radius_thickness_coeff: float = 1.0
    turn_idle_smoothing_at_20hz: float = 0.3
    turn_active_smoothing_at_20hz: float = 0.15


@dataclass
class SnakeConfig:
    start_length: int = 9
    start_score: int = 1
    base_head_radius: float = 0.2
    score_thickness_scale: float = 0.0005
    camera_zoom_out_coeff: float = 200.0
    growth_score_per_segment: str = "10.0"
    min_body_length: int = 9
    safe_spawn_distance: float = 15.0
    max_growth_score: int = 5000


@dataclass
class BoostConfig:
    min_score: int = 15
    speed_multiplier: float = 2.0
    drain_interval_seconds: float = 1.0
    drain_per_interval: float = 1.0
    food_drop_value: int = 1


@dataclass
class FoodTypeConfig:
    value: int = 1
    weight: int = 50
    color: str = "#ef4444"


@dataclass
class FoodConfig:
    types: list[FoodTypeConfig] = field(default_factory=lambda: [
        FoodTypeConfig(value=1, weight=50, color="#ef4444"),
        FoodTypeConfig(value=2, weight=25, color="#f97316"),
        FoodTypeConfig(value=5, weight=15, color="#fbbf24"),
        FoodTypeConfig(value=10, weight=6, color="#4ade80"),
        FoodTypeConfig(value=20, weight=3, color="#3b82f6"),
        FoodTypeConfig(value=50, weight=1, color="#a855f7"),
    ])
    base_radius: float = 0.2
    radius_value_scale: float = 0.1
    death_drop_score_fraction: float = 0.5
    attraction_radius: float = 3.0
    attraction_speed: float = 8.0


@dataclass
class VisualConfig:
    min_fog_radius: float = 900.0
    fog_score_expansion_coeff: float = 0.5
    camera_base_zoom: float = 1.0
    camera_pitch_angle: float = 55.0
    camera_z_height: float = 0.0
    camera_y_offset: float = 0.25
    mouse_sensitivity: float = 1.0


@dataclass
class GameConfig:
    world: WorldConfig = field(default_factory=WorldConfig)
    simulation: SimulationConfig = field(default_factory=SimulationConfig)
    snake: SnakeConfig = field(default_factory=SnakeConfig)
    boost: BoostConfig = field(default_factory=BoostConfig)
    food: FoodConfig = field(default_factory=FoodConfig)
    visual: VisualConfig = field(default_factory=VisualConfig)

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
        _require_range("world.portals_enabled", self.world.portals_enabled, 0, 1)
        _require_range("world.portals_count", self.world.portals_count, 1, 10)
        _require_range("world.portals_radius", self.world.portals_radius, 0.5, 50.0)
        _require_range("world.portals_spawn_chance", self.world.portals_spawn_chance, 0.0, 1.0)
        _require_range("world.portals_growth_time", self.world.portals_growth_time, 0.1, 300.0)
        _require_range("world.black_holes_enabled", self.world.black_holes_enabled, 0, 1)
        _require_range("world.black_holes_count", self.world.black_holes_count, 1, 10)
        _require_range("world.black_holes_spawn_chance", self.world.black_holes_spawn_chance, 0.0, 1.0)
        _require_range("world.black_holes_pull_radius", self.world.black_holes_pull_radius, 1.0, 100.0)
        _require_range("world.black_holes_pull_force", self.world.black_holes_pull_force, 0.0, 100.0)
        _require_range("world.black_holes_kill_radius", self.world.black_holes_kill_radius, 0.1, 50.0)
        _require_range("world.black_holes_growth_time", self.world.black_holes_growth_time, 0.1, 300.0)


        _require_range("simulation.tick_rate", self.simulation.tick_rate, 5, 120)
        _require_range("simulation.base_speed_per_second", self.simulation.base_speed_per_second, 0.1, 200)
        _require_range("simulation.max_turn_speed_deg_per_second", self.simulation.max_turn_speed_deg_per_second, 10, 3600)
        _require_range("simulation.min_turn_radius", self.simulation.min_turn_radius, 0, 100)
        _require_range("simulation.turn_radius_thickness_coeff", self.simulation.turn_radius_thickness_coeff, 0, 10)
        _require_range("simulation.turn_idle_smoothing_at_20hz", self.simulation.turn_idle_smoothing_at_20hz, 0, 1)
        _require_range("simulation.turn_active_smoothing_at_20hz", self.simulation.turn_active_smoothing_at_20hz, 0, 1)

        _require_range("snake.start_length", self.snake.start_length, 1, 10000)
        _require_range("snake.start_score", self.snake.start_score, 0, 1000000)
        _require_range("snake.base_head_radius", self.snake.base_head_radius, 0.01, 100)
        _require_range("snake.score_thickness_scale", self.snake.score_thickness_scale, 0, 10)
        _require_range("snake.camera_zoom_out_coeff", self.snake.camera_zoom_out_coeff, 0.0, 100000.0)
        validate_growth_formula(self.snake.growth_score_per_segment)
        _require_range("snake.min_body_length", self.snake.min_body_length, 1, 10000)
        _require_range("snake.safe_spawn_distance", self.snake.safe_spawn_distance, 0, 10000)
        _require_range("snake.max_growth_score", self.snake.max_growth_score, 1, 1000000000)

        _require_range("boost.min_score", self.boost.min_score, 0, 1000000)
        _require_range("boost.speed_multiplier", self.boost.speed_multiplier, 1, 20)
        _require_range("boost.drain_interval_seconds", self.boost.drain_interval_seconds, 0.01, 3600)
        _require_range("boost.drain_per_interval", self.boost.drain_per_interval, 0, 1000000)
        _require_range("boost.food_drop_value", self.boost.food_drop_value, 1, 1000000)

        if len(self.food.types) == 0:
            raise ValueError("food.types must not be empty")
        for i, ft in enumerate(self.food.types):
            _require_range(f"food.types[{i}].value", ft.value, 1, 1000000)
            _require_range(f"food.types[{i}].weight", ft.weight, 1, 1000000)
        _require_range("food.base_radius", self.food.base_radius, 0.01, 100)
        _require_range("food.radius_value_scale", self.food.radius_value_scale, 0, 100)
        _require_range("food.death_drop_score_fraction", self.food.death_drop_score_fraction, 0, 1)
        _require_range("food.attraction_radius", self.food.attraction_radius, 0, 100)
        _require_range("food.attraction_speed", self.food.attraction_speed, 0, 200)

        _require_range("visual.min_fog_radius", self.visual.min_fog_radius, 100, 5000)
        _require_range("visual.fog_score_expansion_coeff", self.visual.fog_score_expansion_coeff, 0.0, 100.0)
        _require_range("visual.camera_base_zoom", self.visual.camera_base_zoom, 0.1, 10.0)
        _require_range("visual.camera_pitch_angle", self.visual.camera_pitch_angle, 0, 89.9)
        _require_range("visual.camera_z_height", self.visual.camera_z_height, -1000, 1000)
        _require_range("visual.camera_y_offset", self.visual.camera_y_offset, -1.0, 1.0)
        _require_range("visual.mouse_sensitivity", self.visual.mouse_sensitivity, 0.1, 10.0)


def _apply_dataclass_patch(target, patch):
    field_map = {item.name: item for item in fields(target)}
    hints = typing.get_type_hints(type(target))
    for key, value in patch.items():
        if key not in field_map:
            print(f"[Config] Warning: Skipping unknown config key '{key}'")
            continue
        current_value = getattr(target, key)
        if is_dataclass(current_value):
            if not isinstance(value, dict):
                raise ValueError(f"Config section {key} must be an object")
            _apply_dataclass_patch(current_value, value)
        elif isinstance(value, list):
            hint = hints.get(key)
            args = getattr(hint, '__args__', ())
            if args and is_dataclass(args[0]):
                dc_type = args[0]
                new_list = []
                for item in value:
                    if isinstance(item, dict):
                        new_list.append(dc_type(**item))
                    else:
                        raise ValueError(f"Each item in {key} must be an object")
                setattr(target, key, new_list)
            else:
                setattr(target, key, value)
        else:
            expected_type = hints.get(key)
            if expected_type is str and not isinstance(value, str):
                setattr(target, key, str(value))
            else:
                setattr(target, key, value)


def _require_range(name, value, minimum, maximum):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{name} must be a number")
    if value < minimum or value > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")


def validate_growth_formula(formula_str: str) -> None:
    import ast
    if not isinstance(formula_str, str):
        formula_str = str(formula_str)
    
    # Try parsing as a raw float/int first. If it's just a number, it's always valid!
    try:
        val = float(formula_str)
        if val < 0.1 or val > 1000000:
            raise ValueError("Growth segment cost must be between 0.1 and 1,000,000")
        return
    except ValueError as e:
        if "Growth segment cost" in str(e):
            raise e
        # Otherwise, proceed with AST formula validation
        pass
        
    try:
        tree = ast.parse(formula_str, mode="eval")
    except Exception as e:
        raise ValueError(f"Syntax error in formula: {str(e)}")
        
    allowed_names = {"s", "S", "score", "SCORE", "l", "L", "len", "LEN", "pi", "e"}
    allowed_funcs = {"log", "log10", "sin", "cos", "tan", "sqrt", "exp", "abs", "min", "max", "pow"}
    
    for node in ast.walk(tree):
        if isinstance(node, ast.Expression):
            continue
        elif isinstance(node, ast.BinOp):
            if not isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow)):
                raise ValueError(f"Operator '{type(node.op).__name__}' is not allowed in formula")
        elif isinstance(node, ast.UnaryOp):
            if not isinstance(node.op, (ast.UAdd, ast.USub)):
                raise ValueError(f"Unary operator '{type(node.op).__name__}' is not allowed")
        elif isinstance(node, (ast.Num, ast.Constant)):
            continue
        elif isinstance(node, ast.Name):
            if node.id not in allowed_names and node.id not in allowed_funcs:
                raise ValueError(f"Variable or math constant '{node.id}' is not allowed. Use s (score) or l (length)")
        elif isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in allowed_funcs:
                func_name = node.func.id if isinstance(node.func, ast.Name) else "complex expression"
                raise ValueError(f"Math function '{func_name}' is not allowed. Allowed: {', '.join(sorted(allowed_funcs))}")
        elif isinstance(node, ast.Load):
            continue
        elif isinstance(node, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow, ast.UAdd, ast.USub)):
            continue
        else:
            raise ValueError(f"Expression type '{type(node).__name__}' is not allowed in formula")
            
    # Test evaluation
    import math
    safe_env = {
        "s": 10.0, "S": 10.0, "score": 10.0, "SCORE": 10.0,
        "l": 9.0, "L": 9.0, "len": 9.0, "LEN": 9.0,
        "pi": math.pi, "e": math.e,
        "log": lambda x: math.log(max(0.001, x)),
        "log10": lambda x: math.log10(max(0.001, x)),
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "sqrt": lambda x: math.sqrt(max(0.0, x)),
        "exp": math.exp, "abs": abs, "min": min, "max": max, "pow": pow
    }
    
    try:
        compiled = compile(tree, "<string>", "eval")
        # Test 1: baseline
        res1 = eval(compiled, {"__builtins__": {}}, safe_env)
        if not isinstance(res1, (int, float)) or math.isnan(res1) or math.isinf(res1):
            raise ValueError("Formula must evaluate to a valid finite number")
        if res1 <= 0:
            raise ValueError("Formula must evaluate to a positive growth cost (greater than 0)")
        
        # Test 2: higher values
        test_env_2 = {**safe_env, "s": 1000.0, "S": 1000.0, "score": 1000.0, "SCORE": 1000.0, "l": 100.0, "L": 100.0, "len": 100.0, "LEN": 100.0}
        res2 = eval(compiled, {"__builtins__": {}}, test_env_2)
        if not isinstance(res2, (int, float)) or math.isnan(res2) or math.isinf(res2):
            raise ValueError("Formula must evaluate to a valid finite number")
        if res2 <= 0:
            raise ValueError("Formula must evaluate to a positive growth cost (greater than 0)")
            
    except Exception as e:
        if not isinstance(e, ValueError):
            raise ValueError(f"Failed to evaluate formula: {str(e)}")
        raise e
