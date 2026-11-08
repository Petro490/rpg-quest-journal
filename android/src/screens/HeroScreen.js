import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { colors, spacing } from "../theme";
import { Card, Row } from "../components/ui";
import { heroApi } from "../api/client";

export default function HeroScreen() {
  const [hero, setHero] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const h = await heroApi.get();
      setHero(h);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (error && !hero) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!hero) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loading}>Загрузка...</Text>
      </View>
    );
  }

  const xpPct = Math.min(100, (hero.xp / hero.xp_to_next_level) * 100);
  const hpPct = Math.min(100, (hero.hp / hero.max_hp) * 100);
  const hpInDanger = hero.hp <= 25;

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Премиум-бейдж */}
      {hero.is_premium && (
        <Text style={styles.premium}>👑 PREMIUM</Text>
      )}

      <Card>
        <Text style={styles.cardTitle}>🛡 Карточка героя</Text>
        <Row label="🌟 Уровень" value={String(hero.level)} valueColor={colors.accent} />
        <Row label="🪙 Золото" value={`${hero.gold} G`} valueColor={colors.accent} />

        <View style={styles.statBlock}>
          <View style={styles.statLabelRow}>
            <Text style={styles.statLabel}>❤️ Здоровье</Text>
            <Text style={[styles.statValue, hpInDanger && { color: colors.hp }]}>
              {hero.hp} / {hero.max_hp}
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${hpPct}%`, backgroundColor: hpInDanger ? colors.hp : "#4CAF50" }]} />
          </View>
        </View>

        <View style={styles.statBlock}>
          <View style={styles.statLabelRow}>
            <Text style={styles.statLabel}>Опыт (XP)</Text>
            <Text style={styles.statValue}>
              {hero.xp} / {hero.xp_to_next_level}
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${xpPct}%`, backgroundColor: colors.link }]} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Характеристики</Text>
        <Row label="🧠 Интеллект (Учеба)" value={String(hero.intellect)} />
        <Row label="💪 Сила (Спорт/Дом)" value={String(hero.strength)} />
        <Row label="⚡ Ловкость (Работа)" value={String(hero.agility)} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>🔥 Серии дейликов</Text>
        <Text style={styles.note}>
          Хотите множитель наград x1.5? Выполняйте ежедневные привычки несколько дней подряд. Пропущен день — серия сбрасывается.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  centered: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  loading: { color: colors.muted },
  error: { color: colors.hp },
  premium: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    color: colors.bg,
    fontWeight: "bold",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 16, color: colors.accent, fontWeight: "bold", marginBottom: spacing.sm },
  statBlock: { marginVertical: spacing.sm },
  statLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  statLabel: { color: colors.muted, fontSize: 13 },
  statValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  bar: {
    height: 12,
    backgroundColor: colors.panel2,
    borderRadius: 6,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 6 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});