from typing import Callable, Any

class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = {}

    def subscribe(self, event_type: str, callback: Callable) -> None:
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    def emit(self, event_type: str, *args, **kwargs) -> None:
        if event_type in self._subscribers:
            for callback in self._subscribers[event_type]:
                callback(*args, **kwargs)
