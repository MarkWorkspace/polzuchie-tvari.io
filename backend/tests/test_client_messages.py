# ROLE: Длина текстовых команд клиента должна вмещать CONTROL_MODE:keyboard.
from app.api.websocket import MAX_CLIENT_MESSAGE_LENGTH


def test_keyboard_mode_command_fits_limit():
    assert len("CONTROL_MODE:keyboard") <= MAX_CLIENT_MESSAGE_LENGTH


def test_required_commands_fit_limit():
    for command in ("LEFT_DOWN", "RIGHT_UP", "SPACE_DOWN", "SPACE_UP", "RESPAWN", "TURN:-1.000"):
        assert len(command) <= MAX_CLIENT_MESSAGE_LENGTH
