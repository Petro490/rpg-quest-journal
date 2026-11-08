import datetime
import random

from sqlalchemy.orm import Session

from models import ActivityDB, DailyTaskDB, HeroDB
from models import today

# === ИГРОВЫЕ КОНСТАНТЫ ===

# Множитель наград за серию (streak) выполнений дейлика
STREAK_MULTIPLIERS = {
    0: 1.0,
    1: 1.2,  # выполнен впервые или только 1 день подряд
    2: 1.5,  # 2 дня подряд
}
STREAK_MAX_MULTIPLIER = 1.5

# Настройки случайных событий при сдаче квеста
RANDOM_ENCOUNTER_CHANCE = 0.10  # 10% — верхняя граница из ТЗ (5-10%)
ENCOUNTER_LOOT_MIN_GOLD = 10
ENCOUNTER_LOOT_MAX_GOLD = 50
ENCOUNTER_HP_LOSS = 5
ENCOUNTER_XP_BONUS = 2  # удвоение опыта за квест при встрече со слаймом

# Штрафы за проступки
MISSED_DAILY_HP_COST = 10  # урон герою за невыполненный дейлик
CANCEL_QUEST_HP_COST = 5  # урон за отмену обычного квеста
MAX_HP = 100

# Коэффициент прогресса уровня — 40% сверху к текущей планке
LEVEL_GROWTH = 1.4


# === НАГРАДЫ ===

def streak_multiplier(streak: int) -> float:
    """Возвращает множитель наград для текущей длины серии."""
    if streak >= 3:
        return STREAK_MAX_MULTIPLIER
    return STREAK_MULTIPLIERS.get(streak, 1.0)


def buffed_rewards(base_xp: int, base_gold: int, multiplier: float):
    """Применяет множитель серии к базовым наградам (с округлением вверх)."""
    if multiplier <= 1.0:
        return base_xp, base_gold
    return int(round(base_xp * multiplier)), int(round(base_gold * multiplier))


def level_up_progress(hero: HeroDB) -> bool:
    """Проверяет планку опыта и повышает уровень. True — если было повышение."""
    level_up = False
    while hero.xp >= hero.xp_to_next_level:
        hero.xp -= hero.xp_to_next_level
        hero.level += 1
        hero.xp_to_next_level = int(hero.xp_to_next_level * LEVEL_GROWTH)
        level_up = True
    return level_up


# === СЕРИИ (STREAKS) ===

def update_streak(daily: DailyTaskDB) -> None:
    """Продлевает или сбрасывает серию дейлика при выполнении.

    Устанавливает last_completed_date на сегодня и корректирует серию:
      - выполнен вчера  -> streak + 1
      - выполнен сегодня -> без изменений (повторная защита)
      - иначе           -> новая серия = 1
    """
    today_dt = today()
    yesterday = today_dt - datetime.timedelta(days=1)
    if daily.last_completed_date == yesterday:
        daily.streak_count += 1
    elif daily.last_completed_date == today_dt:
        pass  # уже сегодня — не меняем серию
    else:
        daily.streak_count = 1
    daily.last_completed_date = today_dt


# === ЗДОРОВЬЕ (HP) И ШТРАФЫ ===

def damage_hero(hero: HeroDB, amount: int) -> None:
    """Наносит урон. Если HP падает до нуля — герой «падает»: теряет половину золота."""
    if hero.hp <= 0:
        return
    hero.hp = max(0, hero.hp - amount)
    if hero.hp == 0:
        apply_death_penalty(hero)


def apply_death_penalty(hero: HeroDB) -> None:
    """Штраф за падение до нуля здоровья: теряется половина золота."""
    hero.gold = hero.gold // 2
    hero.deaths += 1


def heal_hero(hero: HeroDB, amount: int) -> None:
    """Восстанавливает здоровье, не превышая максимум."""
    hero.hp = min(MAX_HP, hero.hp + amount)


# === СЛУЧАЙНЫЕ СОБЫТИЯ ===

def roll_random_encounter(hero: HeroDB, base_xp: int):
    """С шансом 10% выдаёт игровое событие на время сдачи квеста.

    Возвращает dict с полями:
      - triggered: bool
      - message:  str (что случилось)
      - xp_bonus: int (добавочный опыт, может быть отрицательным/нулевым)
      - hp_cost:  int (урон за событие)
      - gold_bonus: int (дополнительное золото)
    """
    if random.random() > RANDOM_ENCOUNTER_CHANCE:
        return {
            "triggered": False,
            "message": "",
            "xp_bonus": 0,
            "hp_cost": 0,
            "gold_bonus": 0,
        }

    if random.random() < 0.5:
        # Позитивное: старый сундук
        gold_bonus = random.randint(ENCOUNTER_LOOT_MIN_GOLD, ENCOUNTER_LOOT_MAX_GOLD)
        hero.gold += gold_bonus
        return {
            "triggered": True,
            "message": f"🗄 Вы нашли старый сундук: +{gold_bonus} золота!",
            "xp_bonus": 0,
            "hp_cost": 0,
            "gold_bonus": gold_bonus,
        }

    # Негативное: атака слайма — герой теряет HP, но получает удвоенный опыт
    xp_bonus = base_xp
    hero.xp += xp_bonus
    damage_hero(hero, ENCOUNTER_HP_LOSS)
    return {
        "triggered": True,
        "message": f"🟢 На вас напал слайм: −{ENCOUNTER_HP_LOSS} HP, но опыт удвоен (+{xp_bonus} XP)!",
        "xp_bonus": xp_bonus,
        "hp_cost": ENCOUNTER_HP_LOSS,
        "gold_bonus": 0,
    }


# === АКТИВНОСТЬ (для календаря) ===

def record_activity(db: Session, user_id: int, count: int = 1) -> None:
    """Инкрементирует счётчик закрытых квестов за сегодняшний день."""
    row = (
        db.query(ActivityDB)
        .filter(ActivityDB.user_id == user_id, ActivityDB.date == today())
        .first()
    )
    if row is None:
        row = ActivityDB(user_id=user_id, date=today(), quests_completed=count)
        db.add(row)
    else:
        row.quests_completed += count


# === ПРОВЕРКА ДЕЙЛИКОВ ПРИ НОВОМ ДНЕ ===

def check_and_reset_dailies(db: Session):
    """Сбрасывает выполненные дейлики предыдущих дней и штрафует за пропущенные.

    Если пользователь не выполнил вчерашний дейлик — его герой теряет HP.
    Серия (streak) при пропуске обнуляется.
    """
    today_dt = today()
    yesterday = today_dt - datetime.timedelta(days=1)
    completed_dailies = db.query(DailyTaskDB).filter(DailyTaskDB.done == True).all()

    for daily in completed_dailies:
        if daily.last_completed_date and daily.last_completed_date < today_dt:
            daily.done = False
            # Если квест должен был быть выполнен вчера, но после него был
            # пропущен целый день — это «пропуск» для штрафа и сброса серии.
            if daily.last_completed_date < yesterday:
                hero = (
                    db.query(HeroDB).filter(HeroDB.user_id == daily.user_id).first()
                )
                if hero is not None:
                    damage_hero(hero, MISSED_DAILY_HP_COST)
                daily.streak_count = 0
            db.add(daily)
    db.commit()


def hero_stats_and_counts_for(hero: HeroDB, db: Session):
    """Собирает в один ответ статистику героя + инфо серий для интерфейса."""
    from models import DailyTaskDB

    active_dailies = db.query(DailyTaskDB).filter(
        DailyTaskDB.user_id == hero.user_id,
        DailyTaskDB.done == False,
    )
    data = hero.to_dict()
    data["active_dailies"] = active_dailies.count()
    data["mobile_max_multiplier"] = STREAK_MAX_MULTIPLIER
    # Премиум-статус пользователя (для будущей монетизации)
    data["is_premium"] = bool(getattr(hero.user, "is_premium", False)) if hero.user else False
    return data


def log_event(db: Session, user_id, event: str, meta: str | None = None) -> None:
    """Записывает событие в журнал для будущей аналитики (монетизация/путь пользователя)."""
    from models import EventLogDB

    db.add(EventLogDB(user_id=user_id, event=event, meta=meta or ""))
    db.commit()