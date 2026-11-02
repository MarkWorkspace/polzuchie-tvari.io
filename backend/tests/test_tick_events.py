# ROLE: Regression tests for tick-boundary player removals: a disconnect
# between ticks must still produce its killfeed entry and food drop in the
# next tick, failed handshakes must not, and reset/reconnect clear the queue.
# Not a test of gameplay physics or serialization.
import asyncio

import pytest

from app.api import websocket as ws_module
from app.engine.state import World


def _death_listener(world):
    deaths = []

    def listener(player, killer_pid):
        deaths.append((player.id, killer_pid))

    world.events.subscribe("player_died", listener)
    return deaths


def test_queued_remove_drops_food_and_kill_event_in_next_tick():
    world = World()
    world.add_player("p", "Player", "#22c55e")
    world.players["p"].score = 100
    food_count_before = len(world.food_manager.foods)

    world.queue_player_removal("p")
    world.tick()

    assert "p" not in world.players
    assert world.pending_removals == set()
    assert world.kill_events == [{"killer": None, "victim": "p"}]
    # The death drop is emitted during this tick, after tick_start() cleared
    # new_foods, so it is part of the frame that reports the removal.
    assert world.food_manager.new_foods
    assert len(world.food_manager.foods) > food_count_before


def test_remove_player_without_death_emits_no_events_or_food():
    world = World()
    world.add_player("p", "Player", "#22c55e")
    player = world.players["p"]
    player.score = 100
    deaths = _death_listener(world)
    food_count_before = len(world.food_manager.foods)

    world.remove_player("p", emit_death=False)

    assert "p" not in world.players
    assert world.kill_events == []
    assert deaths == []
    assert world.food_manager.new_foods == []
    assert len(world.food_manager.foods) == food_count_before
    assert player.is_dead is False


def test_reset_state_clears_pending_removals():
    world = World()
    world.queue_player_removal("p")

    world.reset_state()

    assert world.pending_removals == set()


@pytest.mark.asyncio
async def test_delayed_remove_only_queues_until_pending_removals_run(monkeypatch):
    monkeypatch.setattr(ws_module, "RECONNECT_GRACE_SECONDS", 0.01)
    world = World()
    world.add_player("p", "Player", "#22c55e")

    removal = asyncio.create_task(ws_module.delayed_remove("p", 0, world))
    ws_module.pending_disconnects["p"] = removal
    await removal

    # The timer no longer mutates the world directly: the tick owns removal.
    assert "p" in world.players
    assert "p" in world.pending_removals
    assert "p" not in ws_module.pending_disconnects

    world.process_pending_removals()

    assert "p" not in world.players
    assert "p" not in world.pending_removals
    assert world.kill_events == [{"killer": None, "victim": "p"}]


def test_cancelled_removal_survives_next_tick():
    world = World()
    world.add_player("p", "Player", "#22c55e")

    world.queue_player_removal("p")
    world.cancel_pending_removal("p")
    world.tick()

    assert "p" in world.players
    assert world.pending_removals == set()
    assert world.kill_events == []
