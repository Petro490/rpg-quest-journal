import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { colors, spacing } from "../theme";
import { AppButton, Card, SectionTitle, EmptyState } from "../components/ui";
import { dailyApi, categoryApi } from "../api/client";

export default function DailiesScreen({ onShowToast }) {
  const [dailies, setDailies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyIds, setBusyIds] = useState({});

  const load = useCallback(async () => {
    try {
      const [d, cats] = await Promise.all([dailyApi.list(), categoryApi.list()]);
      setDailies(d);
      setCategories(cats);
      if (cats.length) setCategoryId((cur) => cur ?? cats[0].id);
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

  // Отображение множителя по длине серии (совпадает с бэкендом)
  const multiplierFor = (streak) => (streak >= 2 ? 1.5 : streak >= 1 ? 1.2 : 1.0);

  async function handleCreate() {
    if (!title.trim()) { onShowToast("Введите название привычки"); return; }
    setCreating(true);
    try {
      await dailyApi.create(title.trim(), categoryId);
      setTitle("");
      await load();
    } catch (e) { onShowToast(e.message); }
    finally { setCreating(false); }
  }

  async function handleComplete(id) {
    setBusyIds((b) => ({ ...b, [id]: true }));
    try {
      const data = await dailyApi.complete(id);
      if (data.streak_count > 0 && data.multiplier > 1) {
        onShowToast(`🔥 Серия ${data.streak_count}! Множитель x${data.multiplier}`, 2800);
      }
      if (data.encounter?.triggered) onShowToast(data.encounter.message, 3500);
      if (data.level_up) Alert.alert("🎉 LEVEL UP!", "Дисциплина окупается!");
      await load();
    } catch (e) { onShowToast(e.message); }
    finally { setBusyIds((b) => { const n = { ...b }; delete n[id]; return n; }); }
  }

  function handleRemove(id) {
    Alert.alert("Удалить привычку?", "Это действие необратимо.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try { await dailyApi.remove(id); await load(); }
          catch (e) { onShowToast(e.message); }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.tip}>
        🔥 Выполняйте дейлик подряд: множитель растёт до x1.5. Пропустили день — серия сброшена.
      </Text>

      <Card>
        <SectionTitle>🔄 Новая привычка</SectionTitle>
        <TextInput
          style={styles.input}
          placeholder="Например: Утренняя зарядка"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
        />
        <View style={styles.row}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, categoryId === cat.id && styles.chipActive]}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <AppButton title={creating ? "Сохранение..." : "Закрепить в расписании"} onPress={handleCreate} loading={creating} />
      </Card>

      <Card>
        <SectionTitle>🔄 Ежедневные привычки</SectionTitle>
        {dailies.length === 0 ? (
          <EmptyState text="Список ежедневных привычек пуст." />
        ) : (
          dailies.map((daily) => {
            const mult = multiplierFor(daily.streak_count);
            return (
              <View key={daily.id} style={[styles.dailyRow, daily.done && styles.done]}>
                <View style={styles.info}>
                  <Text style={[styles.titleText, daily.done && styles.doneText]}>{daily.title}</Text>
                  <Text style={styles.cat}>{daily.category_name}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.reward}>{daily.reward_info}</Text>
                    {daily.streak_count > 0 && (
                      <Text style={styles.badge}>🔥 x{mult} · серия {daily.streak_count}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.actions}>
                  {!daily.done ? (
                    <AppButton
                      title={busyIds[daily.id] ? "" : "Выполнить"}
                      variant="success"
                      onPress={() => handleComplete(daily.id)}
                      loading={busyIds[daily.id]}
                      style={styles.btnSmall}
                    />
                  ) : (
                    <Text style={styles.doneMark}>🌟 Ок</Text>
                  )}
                  <AppButton title="✕" variant="danger" onPress={() => handleRemove(daily.id)} style={styles.btnX} />
                </View>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  tip: { color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.panel2,
    color: colors.text,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { backgroundColor: colors.panel2, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: 16 },
  chipActive: { backgroundColor: colors.link },
  chipText: { color: colors.muted, fontSize: 13 },
  chipTextActive: { color: colors.bg, fontWeight: "600" },
  dailyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.panel2,
    padding: spacing.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.link,
    marginBottom: spacing.sm,
  },
  done: { opacity: 0.55, borderLeftColor: colors.success },
  info: { flex: 1, marginRight: spacing.sm },
  titleText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  doneText: { textDecorationLine: "line-through" },
  cat: { color: colors.link, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4, flexWrap: "wrap" },
  reward: { color: colors.muted, fontSize: 12 },
  badge: {
    color: colors.bg,
    backgroundColor: colors.accent,
    fontWeight: "bold",
    fontSize: 11,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  actions: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, minHeight: 34 },
  btnX: { paddingVertical: 6, paddingHorizontal: 10, minHeight: 34, width: 40 },
  doneMark: { color: colors.success, fontWeight: "bold", fontSize: 14, paddingHorizontal: spacing.xs },
});