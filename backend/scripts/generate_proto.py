# ROLE: Regenerates the committed Python protobuf code from tests_shared/snake.proto. Not runtime code.
from pathlib import Path

from grpc_tools import protoc

REPO_ROOT = Path(__file__).resolve().parents[2]
PROTO_ROOT = REPO_ROOT / "tests_shared"
OUTPUT_DIR = REPO_ROOT / "backend" / "app" / "engine" / "systems"


def main() -> int:
    return protoc.main(
        [
            "grpc_tools.protoc",
            f"-I{PROTO_ROOT}",
            f"--python_out={OUTPUT_DIR}",
            str(PROTO_ROOT / "snake.proto"),
        ]
    )


if __name__ == "__main__":
    raise SystemExit(main())
