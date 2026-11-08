import os
import secrets
import datetime
from datetime import timedelta

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

import jwt as pyjwt

from flask import Flask, jsonify, make_response, request, send_from_directory, session
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from werkzeug.security import check_password_hash, generate_password_hash

from models import Base, CategoryDB, HeroDB, ShopItemDB, UserDB
import game_logic

DATABASE_URL = "sqlite:///./rpg_game.db"

app = Flask(__name__, static_folder="static", static_url_path="/static")


# === АВТОРИЗАЦИЯ ===

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=4, max_length=100)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


def create_app():
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    # В продакшене обязательно задайте RPG_SECRET через переменную окружения.
    # Для локальной разработки генерируем надёжный ключ автоматически.
    rpg_secret = os.environ.get("RPG_SECRET")
    if rpg_secret:
        app.config["SECRET_KEY"] = rpg_secret
    else:
        app.config["SECRET_KEY"] = secrets.token_hex(32)
        app.config["SECRET_KEY_DEV"] = True

    app.config["PROD"] = os.environ.get("RPG_ENV", "development") == "production"

    app.db_engine = engine
    app.session_factory = SessionLocal

    # Стартовое наполнение общего мира (категории и лавка)
    _seed_world(SessionLocal)

    # --- Blueprints ---
    from routes_hero import bp as hero_bp
    from routes_shop import bp as shop_bp
    from routes_tasks import bp as tasks_bp

    app.register_blueprint(hero_bp)
    app.register_blueprint(shop_bp)
    app.register_blueprint(tasks_bp)

    # --- JWT: безопасный ключ и хелперы ---
    jwt_secret = app.config["SECRET_KEY"]
    jwt_ttl = timedelta(days=int(os.environ.get("RPG_JWT_TTL_DAYS", "7")))

    def make_token(user_id: int) -> str:
        return pyjwt.encode(
            {"user_id": user_id, "exp": datetime.datetime.now(datetime.timezone.utc) + jwt_ttl},
            jwt_secret,
            algorithm="HS256",
        )

    def resolve_user_id():
        """Определяет пользователя по JWT (Bearer) или cookie-сессии."""
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
            try:
                payload = pyjwt.decode(token, jwt_secret, algorithms=["HS256"])
                return payload.get("user_id")
            except Exception:
                return None
        return session.get("user_id")

    # --- Middleware для сессий БД и авторизации ---
    @app.before_request
    def attach_db_and_user():
        request.db = SessionLocal()
        request.user_id = None
        # На публичные маршруты (работают без входа) авторизация не распространяется
        if request.endpoint in ("register", "login", "token", "read_root", "static"):
            return None
        user_id = resolve_user_id()
        if user_id is None:
            return jsonify({"detail": "Требуется вход в систему"}), 401
        request.user_id = user_id
        game_logic.check_and_reset_dailies(request.db)
        return None

    @app.teardown_request
    def teardown(exception=None):
        db = getattr(request, "db", None)
        if db is not None:
            db.close()

    # --- Публичные маршруты ---
    @app.route("/")
    def read_root():
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/auth/register", methods=["POST"])
    def register():
        try:
            data = RegisterRequest(**request.get_json())
        except ValidationError as e:
            return jsonify({"detail": e.errors()}), 400

        if request.db.query(UserDB).filter(UserDB.username == data.username).first():
            return jsonify({"detail": "Это имя уже занято. Придумайте другое."}), 400

        user = UserDB(
            username=data.username,
            password_hash=generate_password_hash(data.password),
        )
        request.db.add(user)
        request.db.flush()
        request.db.add(HeroDB(user_id=user.id))
        request.db.commit()
        return jsonify({"status": "Герой создан! Теперь войдите в систему."}), 201

    @app.route("/auth/login", methods=["POST"])
    def login():
        try:
            data = LoginRequest(**request.get_json())
        except ValidationError as e:
            return jsonify({"detail": e.errors()}), 400

        user = request.db.query(UserDB).filter(UserDB.username == data.username).first()
        if not user or not check_password_hash(user.password_hash, data.password):
            return jsonify({"detail": "Неверный логин или пароль"}), 401

        session["user_id"] = user.id
        return jsonify({"status": "Добро пожаловать, герой!", "username": user.username})

    @app.route("/auth/token", methods=["POST"])
    def token():
        """Выдаёт JWT-токен для нативных клиентов (React Native и т.п.).

        Тело: {"username": ..., "password": ...}. Ответ: {access_token, token_type, username}.
        ВАЖНО: в этом режиме сессия (cookie) не создаётся — токен следует хранить
        на клиенте и передавать в заголовке Authorization: Bearer <token>.
        """
        try:
            data = LoginRequest(**request.get_json())
        except ValidationError as e:
            return jsonify({"detail": e.errors()}), 400

        user = request.db.query(UserDB).filter(UserDB.username == data.username).first()
        if not user or not check_password_hash(user.password_hash, data.password):
            return jsonify({"detail": "Неверный логин или пароль"}), 401

        access_token = make_token(user.id)
        return jsonify({
            "access_token": access_token,
            "token_type": "bearer",
            "username": user.username,
        }), 200

    @app.route("/auth/me", methods=["GET"])
    def me():
        user_id = session.get("user_id")
        if user_id is None:
            return jsonify({"username": None}), 200
        user = request.db.query(UserDB).filter(UserDB.id == user_id).first()
        if user is None:
            return jsonify({"username": None}), 200
        return jsonify({"username": user.username})

    @app.route("/auth/logout", methods=["POST"])
    def logout():
        session.clear()
        return jsonify({"status": "Вы вышли из игры. Доброго дня!"})

    return app


def _seed_world(SessionLocal):
    """Кладём стартовые категории и товары лавки (общие для всех героев)."""
    db = SessionLocal()
    try:
        if db.query(CategoryDB).count() == 0:
            db.add(CategoryDB(name="Учеба 🧠", stat_reward="intellect", xp_reward=30, gold_reward=15))
            db.add(CategoryDB(name="Спорт и Дом 💪", stat_reward="strength", xp_reward=25, gold_reward=10))
            db.add(CategoryDB(name="Дела и Работа ⚡", stat_reward="agility", xp_reward=35, gold_reward=20))
        if db.query(ShopItemDB).count() == 0:
            db.add(ShopItemDB(name="Посмотреть серию сериала 🍿", cost=30))
            db.add(ShopItemDB(name="Съесть любимую вкусняшку 🍰", cost=45))
            db.add(ShopItemDB(name="1 час отдыха в видеоиграх 🎮", cost=60))
            db.add(ShopItemDB(name="🧪 Зелье лечения (полное HP)", cost=25, rtype="potion"))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    app_ = create_app()
    host = os.environ.get("RPG_HOST", "127.0.0.1")
    port = int(os.environ.get("RPG_PORT", "8000"))
    app_.run(host=host, port=port, debug=not app_.config.get("PROD"))