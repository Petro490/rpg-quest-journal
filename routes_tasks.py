import datetime

from flask import Blueprint, jsonify, request
from pydantic import BaseModel, Field, ValidationError
from models import ActivityDB, CategoryDB, DailyTaskDB, HeroDB, TaskDB
from models import today
import game_logic

bp = Blueprint("tasks", __name__)


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    category_id: int


class DailyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    category_id: int


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    stat_reward: str
    xp_reward: int = Field(..., ge=1)
    gold_reward: int = Field(..., ge=1)


# === КАТЕГОРИИ ===

@bp.route("/categories", methods=["GET", "POST"])
def manage_categories():
    if request.method == "GET":
        categories = request.db.query(CategoryDB).all()
        return jsonify([cat.to_dict() for cat in categories])

    try:
        data = CategoryCreate(**request.get_json())
    except ValidationError as e:
        return jsonify({"detail": e.errors()}), 400

    if data.stat_reward not in ["strength", "intellect", "agility"]:
        return jsonify({"detail": "Неверная характеристика!"}), 400

    existing = request.db.query(CategoryDB).filter(CategoryDB.name == data.name).first()
    if existing:
        return jsonify({"detail": "Категория уже существует"}), 400

    new_cat = CategoryDB(**data.model_dump())
    request.db.add(new_cat)
    request.db.commit()
    return jsonify({"status": "Новая ветка квестов создана!"}), 201


def _apply_stat_reward(hero: HeroDB, stat_reward: str):
    if stat_reward == "intellect":
        hero.intellect += 1
    elif stat_reward == "strength":
        hero.strength += 1
    elif stat_reward == "agility":
        hero.agility += 1


def _complete_quest(db, task):
    """Общая логика начисления наград обычному квесту с учётом случайного события."""
    hero = db.query(HeroDB).filter(HeroDB.user_id == request.user_id).first()
    category = task.category

    hero.xp += category.xp_reward
    hero.gold += category.gold_reward
    _apply_stat_reward(hero, category.stat_reward)

    encounter = game_logic.roll_random_encounter(hero, category.xp_reward)

    level_up = game_logic.level_up_progress(hero)
    game_logic.record_activity(db, request.user_id)

    db.commit()
    return {
        "status": "Квест выполнен!",
        "level_up": level_up,
        "encounter": encounter,
    }


# === ОБЫЧНЫЕ КВЕСТЫ ===

@bp.route("/tasks", methods=["GET", "POST"])
def manage_tasks():
    if request.method == "GET":
        tasks = (
            request.db.query(TaskDB)
            .filter(TaskDB.user_id == request.user_id)
            .all()
        )
        return jsonify([{
            "id": t.id,
            "title": t.title,
            "done": t.done,
            "category_name": t.category.name,
            "reward_info": f"+{t.category.xp_reward}XP / +{t.category.gold_reward}G",
        } for t in tasks])

    try:
        data = TaskCreate(**request.get_json())
    except ValidationError as e:
        return jsonify({"detail": e.errors()}), 400

    new_task = TaskDB(title=data.title, category_id=data.category_id, user_id=request.user_id)
    request.db.add(new_task)
    request.db.commit()
    return jsonify({"status": "Квест успешно занесен в журнал"}), 201


@bp.route("/tasks/<int:task_id>", methods=["PATCH", "DELETE"])
def modify_task(task_id):
    task = (
        request.db.query(TaskDB)
        .filter(TaskDB.id == task_id, TaskDB.user_id == request.user_id)
        .first()
    )
    if not task:
        return jsonify({"detail": "Квест не найден"}), 404

    if request.method == "DELETE":
        # Отмена обычного квеста — герой теряет немного здоровья (штраф)
        hero = (
            request.db.query(HeroDB)
            .filter(HeroDB.user_id == request.user_id)
            .first()
        )
        request.db.delete(task)
        if not task.done and hero is not None:
            game_logic.damage_hero(hero, game_logic.CANCEL_QUEST_HP_COST)
        request.db.commit()
        return jsonify({"status": "Квест отменен"})

    if task.done:
        return jsonify({"status": "Квест уже был выполнен ранее"})

    task.done = True
    return jsonify(_complete_quest(request.db, task))


# === ЕЖЕДНЕВНЫЕ ПРИВЫЧКИ ===

@bp.route("/dailies", methods=["GET", "POST"])
def manage_dailies():
    if request.method == "GET":
        dailies = (
            request.db.query(DailyTaskDB)
            .filter(DailyTaskDB.user_id == request.user_id)
            .all()
        )
        return jsonify([{
            "id": d.id,
            "title": d.title,
            "done": d.done,
            "streak_count": d.streak_count,
            "category_name": d.category.name,
            "reward_info": f"+{d.category.xp_reward}XP / +{d.category.gold_reward}G",
        } for d in dailies])

    try:
        data = DailyCreate(**request.get_json())
    except ValidationError as e:
        return jsonify({"detail": e.errors()}), 400

    duplicate = (
        request.db.query(DailyTaskDB)
        .filter(
            DailyTaskDB.user_id == request.user_id,
            DailyTaskDB.title == data.title,
        )
        .first()
    )
    if duplicate:
        return jsonify({"detail": "Такая привычка уже есть у вас в расписании."}), 400

    new_daily = DailyTaskDB(
        title=data.title,
        category_id=data.category_id,
        user_id=request.user_id,
    )
    request.db.add(new_daily)
    request.db.commit()
    return jsonify({"status": "Регулярная привычка закреплена"}), 201


@bp.route("/dailies/<int:daily_id>", methods=["PATCH", "DELETE"])
def modify_daily(daily_id):
    daily = (
        request.db.query(DailyTaskDB)
        .filter(DailyTaskDB.id == daily_id, DailyTaskDB.user_id == request.user_id)
        .first()
    )
    if not daily:
        return jsonify({"detail": "Ежедневное задание не найдено"}), 404

    if request.method == "DELETE":
        request.db.delete(daily)
        request.db.commit()
        return jsonify({"status": "Ежедневный квест удален"})

    if daily.done:
        return jsonify({"detail": "Этот квест уже выполнен сегодня!"}), 400

    daily.done = True
    game_logic.update_streak(daily)  # сам проставит last_completed_date = today

    hero = request.db.query(HeroDB).filter(HeroDB.user_id == request.user_id).first()
    category = daily.category

    mult = game_logic.streak_multiplier(daily.streak_count)
    base_xp, base_gold = category.xp_reward, category.gold_reward
    xp_gain, gold_gain = game_logic.buffed_rewards(base_xp, base_gold, mult)

    hero.xp += xp_gain
    hero.gold += gold_gain
    _apply_stat_reward(hero, category.stat_reward)
    game_logic.record_activity(request.db, request.user_id)

    encounter = game_logic.roll_random_encounter(hero, xp_gain)
    level_up = game_logic.level_up_progress(hero)

    request.db.commit()
    return jsonify({
        "status": "Ежедневный квест выполнен!",
        "level_up": level_up,
        "streak_count": daily.streak_count,
        "multiplier": mult,
        "xp_gain": xp_gain,
        "gold_gain": gold_gain,
        "encounter": encounter,
    })