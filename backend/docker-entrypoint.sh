#!/bin/sh
# ROLE: Seed the writable runtime config volume from the image template and start the server.
# It never overwrites an existing config or schema marker: live admin edits and backups must survive restarts.

set -eu

CONFIG_PATH=${CONFIG_PATH:-/app/data/config.json}
CONFIG_DIR=${CONFIG_DIR:-$(dirname "$CONFIG_PATH")}
SCHEMA_VERSION_PATH="${CONFIG_DIR}/config.schema-version"

mkdir -p "$CONFIG_DIR"

if [ ! -w "$CONFIG_DIR" ]; then
    echo "ERROR: config directory ${CONFIG_DIR} is not writable by uid $(id -u); check volume ownership" >&2
    exit 1
fi

if [ ! -f "$CONFIG_PATH" ]; then
    cp /app/config.example.json "$CONFIG_PATH"
    chmod 0644 "$CONFIG_PATH"
    echo "Seeded runtime config at ${CONFIG_PATH} from /app/config.example.json"
elif [ ! -w "$CONFIG_PATH" ]; then
    echo "ERROR: runtime config ${CONFIG_PATH} is not writable by uid $(id -u); check volume ownership" >&2
    exit 1
else
    echo "Using existing runtime config at ${CONFIG_PATH}"
fi

# The schema version is a separate file: GameConfig owns the JSON and rewrites
# it whole, so an extra JSON field would be dropped on the next admin save.
if [ ! -f "$SCHEMA_VERSION_PATH" ] && [ -f /app/config.schema-version ]; then
    cp /app/config.schema-version "$SCHEMA_VERSION_PATH"
    chmod 0644 "$SCHEMA_VERSION_PATH"
fi

exec "$@"
