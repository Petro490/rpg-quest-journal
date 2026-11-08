import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { colors, spacing } from "../theme";
import { AppButton, Card, SectionTitle, EmptyState } from "../components/ui";
import { shopApi } from "../api/client";

export default function ShopScreen({ onShowToast, hero, onHeroUpdated }) {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyIds, setBusyIds] = useState({});

  const load = useCallback(async () => {
    try {
      const list = await shopApi.list();
      setItems(list);
    } catch (e) {
      onShowToast(e.message);
    }
  }, [onShowToast]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleBuy(id) {
    setBusyIds((b) => ({ ...b, [id]: true }));
    try {
      const data = await shopApi.buy(id);
      onShowToast(data.message);
      if (onHeroUpdated) onHeroUpdated();
    } catch (e) {
      onShowToast(e.message);
    } finally {
      setBusyIds((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  }

  const gold = hero?.gold ?? 0;

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.goldBar}>
        <Text style={styles.goldLabel}>Ваше золото</Text>
        <Text style={styles.goldValue}>{gold} G</Text>
      </View>

      <Card>
        <SectionTitle>🏪 Золотая Лавка Наград</SectionTitle>
        {items.length === 0 ? (
          <EmptyState text="Лавка пуста." />
        ) : (
          items.map((item) => {
            const affordable = gold >= item.cost;
            const isPotion = item.rtype === "potion";
            const isPremium = item.premium_only;
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.info}>
                  <Text style={styles.name}>
                    {isPotion ? "🧪 " : "🎁 "}{item.name}
                    {isPremium ? " 👑" : ""}
                  </Text>
                  <Text style={[styles.cost, !affordable && styles.costUnaffordable]}>
                    Цена: {item.cost} G{isPotion ? " · лечит HP" : ""}
                  </Text>
                  {isPremium && <Text style={styles.premiumTag}>Только для премиум</Text>}
                </View>
                <AppButton
                  title={busyIds[item.id] ? "" : "Купить"}
                  onPress={() => handleBuy(item.id)}
                  loading={busyIds[item.id]}
                  disabled={!affordable}
                  style={styles.buyBtn}
                />
              </View>
            );
          })
        )}
      </Card>

      <Text style={styles.hint}>
        💡 Выполняйте квесты, чтобы зарабатывать золото и тратить его на заслуженные награды.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  goldBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  goldLabel: { color: colors.bg, fontWeight: "bold", fontSize: 14 },
  goldValue: { color: colors.bg, fontWeight: "bold", fontSize: 18 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.panel2,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  info: { flex: 1, marginRight: spacing.sm },
  name: { color: colors.text, fontWeight: "600", fontSize: 15 },
  cost: { color: colors.accent, fontSize: 13, marginTop: 3 },
  costUnaffordable: { color: colors.muted },
  premiumTag: {
    alignSelf: "flex-start",
    color: colors.bg,
    backgroundColor: colors.danger,
    fontSize: 11,
    fontWeight: "bold",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 4,
  },
  buyBtn: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 40 },
  hint: { color: colors.muted, fontSize: 13, textAlign: "center", marginTop: spacing.md },
});