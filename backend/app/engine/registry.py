from typing import Protocol, Callable, Any, runtime_checkable
import importlib
import pkgutil
from pathlib import Path
import app.engine.systems

@runtime_checkable
class System(Protocol):
    name: str
    order: int
    
    def update(self, world: Any) -> None:
        pass

class SystemRegistry:
    def __init__(self):
        self.systems: list[System] = []

    def register(self, system: System):
        self.systems.append(system)
        self.systems.sort(key=lambda s: s.order)

    def update_all(self, world: Any):
        for system in self.systems:
            system.update(world)

    def autodiscover(self):
        package = app.engine.systems
        package_path = Path(package.__file__).parent
        for _, module_name, _ in pkgutil.iter_modules([str(package_path)]):
            module = importlib.import_module(f"{package.__name__}.{module_name}")
            if hasattr(module, "system") and isinstance(module.system, System):
                self.register(module.system)

registry = SystemRegistry()
