# ROLE: Server-controlled bots. Isolated feature module: delete this package and its three engine hooks to remove bots.
from app.bots.manager import BotManager

__all__ = ["BotManager"]
