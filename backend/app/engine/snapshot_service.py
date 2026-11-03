# ROLE: Фасад снимков состояния для клиентов: делегирует снимки в serialization и записывает AoI-видимость в world.
# Не хранит видимость сам, не строит кадры, не владеет игроками и не содержит игровой логики.


class SnapshotService:
    """Thin adapter between ``World`` and the protobuf serialization layer."""

    def __init__(self, world):
        self.world = world

    def get_delta_state(
        self,
        client_id,
        is_full=False,
        update_visibility=True,
        return_visibility=False,
        serialize_proto=False,
    ):
        from app.engine.systems.serialization import get_delta_state

        return get_delta_state(
            self.world,
            client_id,
            is_full,
            update_visibility,
            return_visibility,
            serialize_proto,
        )

    def get_full_state(self, client_id, serialize_proto=False):
        from app.engine.systems.serialization import get_full_state

        return get_full_state(self.world, client_id, serialize_proto)

    def set_client_visibility(self, client_id, visible_players):
        self.world.client_visibility[client_id] = visible_players
