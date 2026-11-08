"""Точка входа приложения для продакшена и разработки.

Запуск из командной строки:
    python run.py           # разработка (debug on)
    python run.py --prod    # продакшен (debug off)

Внешние параметры берутся из переменных окружения (или файла .env):
    RPG_HOST   — адрес прослушивания (по умолчанию 127.0.0.1)
    RPG_PORT   — порт (по умолчанию 8000)
    RPG_SECRET — секретный ключ сессий (обязателен в продакшене)
    RPG_ENV    — development | production
"""

import os
import sys

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


def main() -> int:
    prod = "--prod" in sys.argv
    if prod:
        os.environ.setdefault("RPG_ENV", "production")
    elif "RPG_ENV" not in os.environ:
        os.environ["RPG_ENV"] = "development"

    if os.environ["RPG_ENV"] == "production":
        secret = os.environ.get("RPG_SECRET")
        if not secret or secret == "dev-secret-key-change-me":
            print("ОШИБКА: в продакшене задайте RPG_SECRET (переменную окружения или в .env).", file=sys.stderr)
            return 1

    from main import create_app

    app = create_app()
    host = os.environ.get("RPG_HOST", "127.0.0.1")
    port = int(os.environ.get("RPG_PORT", "8000"))
    debug = os.environ["RPG_ENV"] != "production"

    print(f"[RPG Quest] режим={'production' if not debug else 'development'} http://{host}:{port}")
    app.run(host=host, port=port, debug=debug)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())