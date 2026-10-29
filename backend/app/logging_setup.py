# ROLE: Process-wide logging configuration for the backend. Not game logic and not request handling.
import logging
import os
import sys

_DEFAULT_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


def configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(_DEFAULT_FORMAT))
        root.addHandler(handler)
    root.setLevel(level)
