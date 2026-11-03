# ROLE: Загрузка, компиляция формул роста и транзакционное сохранение runtime-конфигурации.
# Не владеет игроками, сеткой, менеджерами или тик-состоянием — только конфиг и его производные.

import errno
import json
import logging
import os
import shutil
import tempfile
from copy import deepcopy
from pathlib import Path

from game_config import GameConfig
from app.engine.systems.formula_parser import MIN_GROWTH_COST, compile_growth_formula

logger = logging.getLogger(__name__)


class ConfigStore:
    """Own ``World`` configuration and every transactional file/live update.

    ``world`` is a back-reference, not ownership. Public write paths go through
    the world's thin wrappers so instance-level monkeypatching in tests keeps
    working; this store never owns players, managers or tick metrics.
    """

    def __init__(self, world):
        self.world = world
        # Runtime containment for growth formulas: validation cannot prove
        # totality, so the first evaluation failure is logged loudly once.
        self._growth_formula_error_logged = False
        self.config = GameConfig()
        self.config_file_path = os.getenv("CONFIG_PATH", "config.json")
        self._load_config_from_disk()

    def _load_config_from_disk(self):
        if not os.path.exists(self.config_file_path):
            self._update_compiled_formulas()
            return
        try:
            with open(self.config_file_path, "r", encoding="utf-8") as f:
                patch = json.load(f)
            if not isinstance(patch, dict):
                raise ValueError("Config file must contain a JSON object")
            self.config.apply_patch(patch)
        except Exception as e:
            logger.error("Failed to load config from %s: %s", self.config_file_path, e)
            raise RuntimeError(f"Invalid config file {self.config_file_path}: {e}") from e
        logger.info("Successfully loaded config from %s", self.config_file_path)
        self._update_compiled_formulas()

    def _update_compiled_formulas(self):
        formula = self.config.snake.growth_score_per_segment
        # Fail fast on invalid expressions: GameConfig.validate() already
        # compiles the formula. Runtime poles are contained by
        # _safe_growth_cost so an accepted formula can never freeze a tick.
        self._compiled_growth_cost = compile_growth_formula(formula).evaluate
        self.growth_segment_cost_func = self._safe_growth_cost
        logger.info("Bound growth segment cost function: %s", formula)

    def _safe_growth_cost(self, score, length):
        try:
            return max(
                MIN_GROWTH_COST,
                float(self._compiled_growth_cost(score, length)),
            )
        except Exception:
            if not self._growth_formula_error_logged:
                logger.exception(
                    "Growth formula failed at score=%s length=%s; using minimum cost",
                    score,
                    length,
                )
                self._growth_formula_error_logged = True
            return MIN_GROWTH_COST

    def align_player_growth(self, player):
        start_score = self.config.snake.start_score
        start_length = self.config.snake.start_length
        max_growth_score = self.config.snake.max_growth_score

        if player.score <= start_score:
            ideal_length = start_length
            ideal_pending = 0.0
        else:
            current_score = start_score
            current_length = start_length
            ideal_pending = 0.0

            max_iter = 10000
            while max_iter > 0:
                max_iter -= 1
                cost = max(
                    0.1,
                    float(self.growth_segment_cost_func(current_score, current_length)),
                )
                if current_score + cost > player.score:
                    ideal_pending = player.score - current_score
                    ideal_length = current_length
                    break
                if current_score >= max_growth_score:
                    ideal_pending = 0.0
                    ideal_length = current_length
                    break
                current_score += cost
                current_length += 1
            else:
                ideal_length = current_length
                ideal_pending = player.score - current_score

        current_length = player.body_len
        score_offset = 0.0
        if ideal_length > current_length:
            for length in range(current_length, ideal_length):
                cost = max(0.1, float(self.growth_segment_cost_func(player.score, length)))
                score_offset += cost
            player.pending_growth = ideal_pending + score_offset
        elif ideal_length < current_length:
            for length in range(ideal_length, current_length):
                cost = max(0.1, float(self.growth_segment_cost_func(player.score, length)))
                score_offset += cost
            player.pending_growth = ideal_pending - score_offset
        else:
            player.pending_growth = ideal_pending

    @staticmethod
    def _fsync_file(path):
        """Best-effort fsync of an existing file.

        Windows cannot fsync a read-only handle, so reopen for writing; a
        read-only config must not turn a completed copy into a failed update.
        """
        try:
            with open(path, "r+b") as f:
                os.fsync(f.fileno())
        except OSError:
            logger.debug("Could not fsync %s", path, exc_info=True)

    @staticmethod
    def _fsync_directory(directory):
        """Best-effort directory fsync after a rename; skipped on Windows."""
        if os.name == "nt" or not hasattr(os, "O_DIRECTORY"):
            return
        try:
            dir_fd = os.open(str(directory), os.O_RDONLY | os.O_DIRECTORY)
        except OSError:
            logger.debug("Could not open %s for fsync", directory, exc_info=True)
            return
        try:
            os.fsync(dir_fd)
        except OSError:
            logger.debug("Could not fsync directory %s", directory, exc_info=True)
        finally:
            os.close(dir_fd)

    def _backup_config_file(self):
        """Copy the current config file to ``<name>.bak``.

        Returns True when a backup exists for this transaction. A missing
        config file is a no-op: there is no previous version to restore.
        """
        path = Path(self.config_file_path)
        if not path.exists():
            return False
        backup_path = path.with_name(f"{path.name}.bak")
        shutil.copy2(path, backup_path)
        self._fsync_file(backup_path)
        logger.info("Backed up config to %s", backup_path)
        return True

    def _restore_config_file(self, old_config, config_existed, backup_ok):
        """Best-effort disk rollback after a failed save.

        Prefers the backup written before the save. If the config file did not
        exist before the failed transaction, any partially created file is
        removed. Errors are logged and never mask the original save failure.
        """
        path = Path(self.config_file_path)
        backup_path = path.with_name(f"{path.name}.bak")
        if backup_ok and backup_path.exists():
            try:
                shutil.copy2(backup_path, path)
                self._fsync_file(path)
                logger.info("Restored config from %s after failed save", backup_path)
                return
            except OSError:
                logger.exception("Failed to restore config from %s", backup_path)
        if not config_existed:
            try:
                path.unlink()
            except FileNotFoundError:
                pass
            except OSError:
                logger.exception("Failed to remove partial config %s", path)
            return
        try:
            # Route through the world so an instance-level monkeypatch of the
            # save method still observes the rollback rewrite.
            self.world._save_config_to_disk(old_config)
        except Exception:
            logger.exception("Failed to rewrite previous config to %s", path)

    def _save_config_to_disk(self, config=None):
        path = Path(self.config_file_path)
        payload = (config or self.config).to_dict()
        temp_path = None
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            target_mode = path.stat().st_mode & 0o777 if path.exists() else 0o644
            fd, temp_path = tempfile.mkstemp(
                dir=str(path.parent),
                prefix=f".{path.name}.",
                suffix=".tmp",
                text=True,
            )
            os.chmod(temp_path, target_mode)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=4, ensure_ascii=False, allow_nan=False)
                f.write("\n")
                f.flush()
                os.fsync(f.fileno())
            try:
                os.replace(temp_path, path)
            except OSError as exc:
                # A single-file bind mount is a mount point: rename(2)
                # can fail with EXDEV/EBUSY. Fall back to an in-place write.
                if exc.errno not in (errno.EXDEV, errno.EBUSY):
                    raise
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=4, ensure_ascii=False, allow_nan=False)
                    f.write("\n")
                    f.flush()
                    os.fsync(f.fileno())
            else:
                temp_path = None
            self._fsync_directory(path.parent)
            logger.info("Successfully saved config to %s", self.config_file_path)
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

    def get_config(self):
        return self.config.to_dict()

    def _apply_live_config(self, candidate, patch, old_width, old_height, old_cluster_count):
        """Bind ``candidate`` to the live world and refresh derived state."""
        self.config = candidate
        # Players (including bots) hold a reference, not a snapshot: keep them
        # on the live config before recalculating derived growth state.
        for player in self.world.players.values():
            player.config = candidate
        self._update_compiled_formulas()

        for player in self.world.players.values():
            self.align_player_growth(player)

        self.world.grid_width = candidate.world.width
        self.world.grid_height = candidate.world.height
        self.world.target_food_count = candidate.world.target_food_count
        size_changed = old_width != self.world.grid_width or old_height != self.world.grid_height
        self.world._recompute_grid_cells()
        self.world.spatial_grid = {}

        self.world.food_manager.on_grid_resize(old_width, old_height, old_cluster_count)
        self.world.food_manager.apply_config()

        # Radius-only changes must not re-roll slots; apply_config() refreshes
        # derived fields on existing entities after any update_slots() call.
        portals_changed = "world" in patch and (
            "portals_enabled" in patch["world"] or "portals_count" in patch["world"]
        )
        if portals_changed or size_changed:
            self.world.portal_manager.update_slots(force_roll=True)
        self.world.portal_manager.apply_config()

        black_holes_changed = "world" in patch and (
            "black_holes_enabled" in patch["world"] or "black_holes_count" in patch["world"]
        )
        if black_holes_changed or size_changed:
            self.world.bh_manager.update_slots(force_roll=size_changed)
        self.world.bh_manager.apply_config()

        self.world.bot_manager.sync()

    def _restore_live_config(self, old_config, pending_growth_snapshot):
        """Best-effort rollback of live state after a failed apply/save.

        Restores config/player ownership, the compiled growth formula, grid
        scalars, pending growth, derived radii and slot counts. Portal/black
        hole positions may be reconciled, and food removed by
        ``on_grid_resize`` is not resurrected. Each manager step is isolated so
        a rollback failure never masks the original exception.
        """
        self.config = old_config
        for player_id, player in self.world.players.items():
            player.config = old_config
            if player_id in pending_growth_snapshot:
                player.pending_growth = pending_growth_snapshot[player_id]
        self._update_compiled_formulas()

        self.world.grid_width = old_config.world.width
        self.world.grid_height = old_config.world.height
        self.world.target_food_count = old_config.world.target_food_count
        self.world._recompute_grid_cells()
        self.world.spatial_grid = {}

        try:
            self.world.food_manager.apply_config()
        except Exception:
            logger.exception("Failed to restore food radii during config rollback")
        try:
            self.world.portal_manager.update_slots(force_roll=False)
        except Exception:
            logger.exception("Failed to restore portal slot count during config rollback")
        try:
            self.world.portal_manager.apply_config()
        except Exception:
            logger.exception("Failed to restore portal radii during config rollback")
        try:
            self.world.bh_manager.update_slots(force_roll=False)
        except Exception:
            logger.exception("Failed to restore black-hole slot count during config rollback")
        try:
            self.world.bh_manager.apply_config()
        except Exception:
            logger.exception("Failed to restore black-hole radii during config rollback")
        try:
            self.world.bot_manager.sync()
        except Exception:
            logger.exception("Failed to re-sync bots during config rollback")

    def update_config(self, patch):
        """Validate, apply live and then persist a config patch.

        Validation happens on a deep copy before any live state changes. The
        candidate is then applied in memory and only afterwards written to
        disk (with a ``.bak`` of the previous file). A failed apply leaves the
        file untouched; a failed save rolls memory back to ``old_config`` and
        restores the file from the backup. See ``_restore_live_config`` for the
        best-effort rollback scope.

        Every live/file step goes through the world facade so tests can
        monkeypatch these methods on a ``World`` instance.
        """
        old_config = self.config
        old_width = self.world.grid_width
        old_height = self.world.grid_height
        old_cluster_count = old_config.world.cluster_count

        candidate = deepcopy(old_config)
        candidate.apply_patch(patch)
        pending_growth_snapshot = {
            player_id: player.pending_growth for player_id, player in self.world.players.items()
        }

        try:
            self.world._apply_live_config(
                candidate, patch, old_width, old_height, old_cluster_count
            )
        except Exception:
            try:
                self.world._restore_live_config(old_config, pending_growth_snapshot)
            except Exception:
                logger.exception("Config rollback failed")
            raise

        config_existed = os.path.exists(self.config_file_path)
        try:
            backup_ok = self.world._backup_config_file()
        except Exception:
            try:
                self.world._restore_live_config(old_config, pending_growth_snapshot)
            except Exception:
                logger.exception("Config rollback failed")
            raise

        try:
            self.world._save_config_to_disk(candidate)
        except Exception:
            try:
                self.world._restore_live_config(old_config, pending_growth_snapshot)
            except Exception:
                logger.exception("Config rollback failed")
            try:
                self.world._restore_config_file(old_config, config_existed, backup_ok)
            except Exception:
                logger.exception("Config rollback failed")
            raise

        self.world._config_updated_this_tick = True
        return self.get_config()
