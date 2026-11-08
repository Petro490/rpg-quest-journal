import datetime

from flask import Blueprint, jsonify, request
from models import ActivityDB, HeroDB, today
import game_logic

bp = Blueprint("hero", __name__)


def get_hero_or_404(db):
    user_id = request.user_id
    hero = db.query(HeroDB).filter(HeroDB.user_id == user_id).first()
    return hero


@bp.route("/hero", methods=["GET"])
def get_hero():
    hero = get_hero_or_404(request.db)
    if hero is None:
        return jsonify({"detail": "Герой не найден"}), 404
    return jsonify(game_logic.hero_stats_and_counts_for(hero, request.db))


@bp.route("/hero/potion", methods=["POST"])
def buy_potion():
    """Покупка Зелья лечения: восстанавливает HP, списывает золото."""
    hero = get_hero_or_404(request.db)
    if hero is None:
        return jsonify({"detail": "Герой не найден"}), 404

    from models import ShopItemDB

    potion_cost = 25
    potion = (
        request.db.query(ShopItemDB)
        .filter(ShopItemDB.rtype == "potion")
        .first()
    )
    if potion is not None:
        potion_cost = potion.cost

    if hero.gold < potion_cost:
        return jsonify({"detail": "Недостаточно золота для зелья лечения!"}), 400
    if hero.hp >= hero.max_hp:
        return jsonify({"detail": "Здоровье уже полное — зелье не нужно."}), 400

    hero.gold -= potion_cost
    hero.hp = hero.max_hp
    request.db.commit()
    return jsonify({
        "message": "🧪 Вы выпили зелье лечения и полностью восстановили здоровье!",
        "gold_left": hero.gold,
        "hp": hero.hp,
    })


@bp.route("/activity", methods=["GET"])
def get_activity():
    """Возвращает число закрытых квестов по дням за последние ~35 дней."""
    hero = get_hero_or_404(request.db)
    if hero is None:
        return jsonify({"detail": "Герой не найден"}), 404

    days = 35
    start = today() - datetime.timedelta(days=days - 1)
    rows = (
        request.db.query(ActivityDB)
        .filter(
            ActivityDB.user_id == request.user_id,
            ActivityDB.date >= start,
        )
        .all()
    )
    counts = {row.date.isoformat(): row.quests_completed for row in rows}
    return jsonify({
        "start": start.isoformat(),
        "end": today().isoformat(),
        "counts": counts,
    })