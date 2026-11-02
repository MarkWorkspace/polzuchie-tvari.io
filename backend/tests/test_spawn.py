# ROLE: Регрессионные тесты спавна тела игрока у края карты.
# Проверяет, что Player.respawn и parity-сценарий заворачивают сегменты по
# ширине карты и сохраняют порядок head-first. Не тестирует физику/wrap.

from game_config import GameConfig
from app.engine.entities import Player
from tests.frame_scenario import _set_player_pos


def _xs(player):
    return list(player.body)[0::2]


def _ys(player):
    return list(player.body)[1::2]


def _make_config(width: int) -> GameConfig:
    config = GameConfig()
    config.world.width = width
    return config


def test_respawn_wraps_body_at_left_edge():
    config = _make_config(100)
    player = Player("p", 5, 5, config)

    assert _xs(player) == [5, 4, 3, 2, 1, 0, 99, 98, 97]
    assert _ys(player) == [5] * 9
    assert all(0 <= x < 100 for x in _xs(player))
    # Head-first: the head is exactly the spawn point.
    assert (player.head_x, player.head_y) == (5, 5)


def test_respawn_wraps_body_after_map_shrink():
    config = _make_config(100)
    player = Player("p", 50, 50, config)

    config.world.width = 40
    player.respawn(2, 5)

    assert _xs(player) == [2, 1, 0, 39, 38, 37, 36, 35, 34]
    assert _ys(player) == [5] * 9
    assert all(0 <= x < 40 for x in _xs(player))


def test_set_player_pos_matches_respawn_head_first():
    config = _make_config(100)
    for start_x in (5, 0, 99):
        respawned = Player("respawned", start_x, 5, config)
        scenario = Player("scenario", 50, 50, config)
        _set_player_pos(scenario, start_x, 5)

        assert _xs(scenario) == _xs(respawned)
        assert _ys(scenario) == _ys(respawned)
        assert scenario.head_x == respawned.head_x == start_x
        assert all(0 <= x < 100 for x in _xs(scenario))
