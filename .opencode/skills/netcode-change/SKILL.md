---
name: Netcode Parity
description: Change toroidal math or the client-server frame safely across FastAPI and the browser worker
---

Use this skill when a change touches any of these:

- `tests_shared/snake.proto`
- `backend/app/engine/systems/serialization.py`
- `backend/app/engine/systems/visibility.py`
- `backend/app/engine/systems/math_utils.py`
- `frontend/src/worker/DeltaDecoder.ts`
- `frontend/src/worker/shared/ProtoFrameDecoder.ts`
- `frontend/src/worker/shared/MathUtils.ts`
- `tests_shared/golden_frames/` or `tests_shared/golden_vectors/`

## Checklist

1. Read the relevant section of `ARCHITECTURE.md` and the invariants in
   `.opencode/instructions/project.md`.
2. Change both sides of the boundary in the same diff. A frame field is not
   "done" until the decoder, the encoder, and the parity fixture agree.
3. Preserve player body ordering: flat `[x0, y0, x1, y1, ...]`, head first;
   `new_heads_this_tick` is reversed at the end of the server tick.
4. Keep world/grid conversion consistent: server grid units, client world
   units = `grid * gridSize` (`gridSize = 20`), server spatial cells use
   `CELL_SIZE = 10`, AoI/fog conversion uses `world / 20`.
5. Add or update a regression test before declaring the change complete.
6. If the serialized bytes change intentionally:
   - run `python tests/generate_frame_fixtures.py` from `backend/`;
   - review the fixture diff;
   - run backend pytest and frontend vitest.
7. Run `cd backend && python -m pytest tests/ -q`, then from `frontend/`
   `npm test` and `npm run build`.
