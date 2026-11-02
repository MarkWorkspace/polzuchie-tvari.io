# ADR-003: Единый владелец конфига и транзакционное сохранение

- **Status:** Accepted
- **Date:** 2026-11-02
- **Decision owners:** backend/ops maintainers

## Context

`World.config` был единственным источником, но `Player.config` оставался
старым снимком после live-update, а Food/Portal/BlackHole фиксировали
производные радиусы при спавне. Сохранение из админки писало файл до apply:
ошибка применения оставляла диск и память рассинхронизированными. Runtime
`backend/config.json` при этом лежал в git и монтировался bind-mount'ом, из-за
чего `git pull`/rebuild могли влиять на live-состояние, а non-root пользователь
мог не иметь права записи.

Нужно было сделать один источник истины, обновлять производные поля и
обеспечить предсказуемый backup/rollback без потери live-конфига при деплое.

## Decision

1. **Владелец — `World.config`.** `GameConfig` — dataclass-дерево; `Player.config`
   хранит ссылку на живой конфиг, а не независимый снимок. После замены
   `World.config` все игроки/боты перепривязываются, затем выполняется
   `align_player_growth`.
2. **Производные поля обновляются.** У Food/Portal/BlackHole есть
   `apply_config()`, который пересчитывает радиусы/параметры без ре-ролла
   позиций. Изменение только радиуса не вызывает `update_slots(force_roll=True)`;
   изменение count/enabled/size — вызывает. Позиции не прыгают без
   необходимости.
3. **Транзакционный update.** `World.update_config`:
   - валидирует `deepcopy`-кандидат до мутаций;
   - применяет кандидат к live state;
   - только затем копирует текущий файл в `config.json.bak` и пишет новый
     `config.json`;
   - при ошибке apply откатывает память, не трогая файл;
   - при ошибке backup/save откатывает память и файл из `.bak` (best-effort),
     удаляет частично созданный файл/`.tmp`; на POSIX делает fsync каталога,
     на Windows пропускает.
   `PATCH /admin/config` возвращает `400` на validation и `503` на apply/save,
   не `500`.
4. **Один путь изменения.** Конфиг меняется через admin API/UI, а не ручной
   правкой файла: только API проходит Pydantic-схему, audit и транзакционный
   backup/rollback. `GameConfig` при сохранении перезаписывает JSON целиком,
   поэтому схема версии хранится отдельным файлом `config.schema-version`.
5. **Deployment ownership.** `backend/config.json` не в git;
   `config.example.json` — seed. Docker монтирует named volume
   `backend_config` в `/app/data`, entrypoint копирует seed только если
   `CONFIG_PATH` ещё не существует, проверяет записываемость и не перезаписывает
   live-файл/`.bak`. `/app/data` создан и принадлежит non-root `appuser`.
6. **Rollback ограничен.** Откат гарантирует конфиг/игроков/производные
   параметры и файл; он **не** воскрешает еду, удалённую при resize, и может
   пересоздать позиции порталов/ЧД. Это документированное best-effort
   поведение, а не полная транзакция мира.

## Consequences

**Положительные:**

- Live-изменения сразу видны старым игрокам и сущностям; нет расхождения
  `Player.config` и `World.config`.
- Сбой apply/save не оставляет «полуконфиг»; оператор получает `.bak` и
  понятный HTTP-статус.
- `git pull`/rebuild не перезаписывают live-настройки; конфиг переживает
  пересоздание контейнера без `-v`.

**Отрицательные и ограничения:**

- Автоматических миграций схемы нет: несовместимое изменение требует поднять
  `config.schema-version`, обновить `config.example.json` и перенести volume
  вручную.
- `.bak` — только предыдущая версия и перезаписывается следующим сохранением;
  для истории нужны внешние backup'ы.
- Конфиг не секретное хранилище: файл `0644` доступен пользователям хоста с
  доступом к volume.
- Single-process: несколько backend-реплик имели бы независимые in-memory
  `World.config`, а общая запись в один volume потребовала бы отдельного
  решения (гонки/лок); горизонтальное масштабирование вне текущего контракта.
- Ручное редактирование файла обходит валидацию, audit и backup; после него
  возможен fail-fast на старте.

## References

- [`backend/app/engine/state.py`](../../backend/app/engine/state.py)
- [`backend/app/api/admin.py`](../../backend/app/api/admin.py)
- [`backend/app/api/config_schema.py`](../../backend/app/api/config_schema.py)
- [`backend/game_config.py`](../../backend/game_config.py)
- [`backend/docker-entrypoint.sh`](../../backend/docker-entrypoint.sh)
- [`backend/config.example.json`](../../backend/config.example.json)
- [`docker-compose.yml`](../../docker-compose.yml)
- [`backend/tests/test_config_persistence.py`](../../backend/tests/test_config_persistence.py)
- [`backend/tests/test_live_config.py`](../../backend/tests/test_live_config.py)
- [`backend/tests/test_config_validation.py`](../../backend/tests/test_config_validation.py)
