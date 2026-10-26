# ROLE: Один сбой сериализации клиента не должен останавливать game loop.
import pytest

import server


@pytest.mark.asyncio
async def test_safe_process_client_swallows_errors(monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("serialization failed")

    monkeypatch.setattr(server, "process_client", boom)

    await server._safe_process_client("client", {"queue": None}, object())
