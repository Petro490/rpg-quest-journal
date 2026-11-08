import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Date,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class UserDB(Base):
    """Учётная запись игрока. У каждого пользователя — свой герой и свой журнал."""

    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    # Премиум-статус: фундамент для будущей монетизации (платные фичи без рекламы и т.п.)
    is_premium = Column(Boolean, default=False)

    hero = relationship("HeroDB", back_populates="user", uselist=False, cascade="all, delete-orphan")
    tasks = relationship("TaskDB", back_populates="user", cascade="all, delete-orphan")
    dailies = relationship("DailyTaskDB", back_populates="user", cascade="all, delete-orphan")
    activity = relationship("ActivityDB", back_populates="user", cascade="all, delete-orphan")


class HeroDB(Base):
    __tablename__ = "hero"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    xp_to_next_level = Column(Integer, default=100)
    gold = Column(Integer, default=0)

    # Очки Здоровья: при падении до нуля герой «падает» и получает штраф
    hp = Column(Integer, default=100)
    max_hp = Column(Integer, default=100)
    # Счётчик «смертей» — чтобы наглядно показать штрафы в портфолио
    deaths = Column(Integer, default=0)

    strength = Column(Integer, default=10)
    intellect = Column(Integer, default=10)
    agility = Column(Integer, default=10)

    user = relationship("UserDB", back_populates="hero")

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class CategoryDB(Base):
    """Общие шаблоны квестов с формулой наград (видны всем пользователям)."""

    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    stat_reward = Column(String)  # strength, intellect, agility
    xp_reward = Column(Integer)
    gold_reward = Column(Integer)

    tasks = relationship("TaskDB", back_populates="category")
    dailies = relationship("DailyTaskDB", back_populates="category")

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class TaskDB(Base):
    """Обычный (одноразовый) квест, принадлежит конкретному пользователю."""

    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    done = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    user = relationship("UserDB", back_populates="tasks")
    category = relationship("CategoryDB", back_populates="tasks")


class DailyTaskDB(Base):
    """Ежедневная привычка. Отслеживает серию выполнений (streak)."""

    __tablename__ = "daily_tasks"
    __table_args__ = (UniqueConstraint("user_id", "title", name="uq_daily_user_title"),)
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    done = Column(Boolean, default=False)
    last_completed_date = Column(Date, nullable=True)
    # Серия подряд идущих дней выполнения — основа для множителя наград
    streak_count = Column(Integer, default=0)
    # Для календаря активности: сколько раз привычка закрывалась (по приросту)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    user = relationship("UserDB", back_populates="dailies")
    category = relationship("CategoryDB", back_populates="dailies")


class ShopItemDB(Base):
    """Предметы в Лавке Наград.

    rtype:
      - 'reward' — трата золота на отдых/награду
      - 'potion' — Зелье лечения, восстанавливает HP
    """

    __tablename__ = "shop_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    cost = Column(Integer)
    rtype = Column(String, default="reward")
    # premium_only=True — награда доступна только премиум-пользователям
    premium_only = Column(Boolean, default=False)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class ActivityDB(Base):
    """Дневник активности — помогает рисовать GitHub-style календарь.

    Каждая строка считает количество закрытых квестов (обычных + дейликов)
    за конкретный день конкретного пользователя.
    """

    __tablename__ = "activity"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_activity_user_date"),)
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    quests_completed = Column(Integer, default=0)

    user = relationship("UserDB", back_populates="activity")


class EventLogDB(Base):
    """Журнал событий для будущей аналитики монетизации/пользовательского пути.

    События: 'register', 'login', 'task_done', 'daily_done', 'shop_buy',
    'level_up', 'premium_upgrade', 'hero_death' и т.д. Заполняется опционально.
    """

    __tablename__ = "event_log"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event = Column(String, nullable=False, index=True)
    meta = Column(String, nullable=True)  # компактный JSON-строкой
    created_at = Column(String, default=lambda: datetime.datetime.now().isoformat())


def today():
    return datetime.date.today()