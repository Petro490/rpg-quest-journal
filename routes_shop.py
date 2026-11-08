from flask import Blueprint, jsonify, request
from pydantic import BaseModel, Field, ValidationError
from models import HeroDB, ShopItemDB
import game_logic

bp = Blueprint("shop", __name__)


class ShopItemCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    cost: int = Field(..., ge=1)
    rtype: str = "reward"


class BuyItemRequest(BaseModel):
    item_id: int


@bp.route("/shop", methods=["GET", "POST"])
def manage_shop():
    if request.method == "GET":
        items = request.db.query(ShopItemDB).all()
        return jsonify([item.to_dict() for item in items])

    try:
        data = ShopItemCreate(**request.get_json())
    except ValidationError as e:
        return jsonify({"detail": e.errors()}), 400

    if data.rtype not in ("reward", "potion"):
        data.rtype = "reward"

    new_item = ShopItemDB(name=data.name, cost=data.cost, rtype=data.rtype)
    request.db.add(new_item)
    request.db.commit()
    return jsonify({"status": "Товар добавлен в лавку"}), 201


@bp.route("/shop/buy", methods=["POST"])
def buy_reward():
    try:
        req = BuyItemRequest(**request.get_json())
    except ValidationError as e:
        return jsonify({"detail": e.errors()}), 400

    hero = request.db.query(HeroDB).filter(HeroDB.user_id == request.user_id).first()
    item = request.db.query(ShopItemDB).filter(ShopItemDB.id == req.item_id).first()

    if not item:
        return jsonify({"detail": "Товар не найден"}), 404
    # Премиум-награды покупают только премиум-пользователи
    if item.premium_only and not (hero.user and hero.user.is_premium):
        return jsonify({"detail": "Эта награда доступна только премиум-пользователям."}), 403
    if hero.gold < item.cost:
        return jsonify({"detail": "Недостаточно золота!"}), 400

    hero.gold -= item.cost

    if item.rtype == "potion":
        game_logic.heal_hero(hero, game_logic.MAX_HP)
        message = f"🧪 Вы выпили '{item.name}' и восстановили здоровье!"
    else:
        message = f"Вы успешно приобрели награду: '{item.name}'!"

    request.db.commit()
    return jsonify({
        "message": message,
        "gold_left": hero.gold,
        "hp": hero.hp,
    })