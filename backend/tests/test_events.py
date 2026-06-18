import pytest
from app.engine.events import EventBus

def test_event_bus():
    bus = EventBus()
    
    events_received = []
    
    def on_test_event(data):
        events_received.append(data)
        
    bus.subscribe("test_event", on_test_event)
    
    bus.emit("test_event", data="hello")
    bus.emit("test_event", data="world")
    
    assert len(events_received) == 2
    assert events_received[0] == "hello"
    assert events_received[1] == "world"

def test_event_bus_no_subscribers():
    bus = EventBus()
    # Should not raise any error
    bus.emit("no_one_listening")
