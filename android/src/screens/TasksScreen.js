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
  ActivityIndicator,
} from "react-native";
import { colors, spacing } from "../theme";
import { AppButton, Card, SectionTitle, EmptyState } from "../components/ui";
import { taskApi, categoryApi } from "../api/client";

export default function TasksScreen({ onShowToast }) {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState("all"); // all | active | completed
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyIds, setBusyIds] = useState({});

  const load = useCallback(async () => {
    try {
      const [t, cats] = await Promise.all([taskApi.list(), categoryApi.list()]);
      setTasks(t);
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

  async function handleCreate() {
    if (!title.trim()) { onShowToast("Введите название квеста"); return; }
    setCreating(true);
    try {
      await taskApi.create(title.trim(), categoryId);
      setTitle("");
      await load();
    } catch (e) { onShowToast(e.message); }
    finally { setCreating(false); }
  }

  async function handleComplete(id) {
    setBusyIds((b) => ({ ...b, [id]: true }));
    try {
      const data = await taskApi.complete(id);
      if (data.encounter?.triggered) onShowToast(data.encounter.message, 3500);
      if (data.level_up) {
        Alert.alert("🎉 LEVEL UP!", "Вы стали сильнее!");
      }
      await load();
    } catch (e) { onShowToast(e.message); }
    finally { setBusyIds((b) => { const n = { ...b }; delete n[id]; return n; }); }
  }

  function handleRemove(id) {
    Alert.alert("Отменить квест?", "Герой потеряет 5 HP.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Отменить",
        style: "destructive",
        onPress: async () => {
          try {
            await taskApi.remove(id);
            await load();
          } catch (e) { onShowToast(e.message); }
        },
      },
    ]);
  }

  let shown = tasks;
  if (filter === "active") shown = tasks.filter((t) => !t.done);
  if (filter === "completed") shown = tasks.filter((t) => t.done);

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card>
        <SectionTitle>📜 Взять новое задание</SectionTitle>
        <TextInput
          style={styles.input}
          placeholder="Что нужно сделать?"
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
              <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <AppButton title={creating ? "Сохранение..." : "Занести в журнал квестов"} onPress={handleCreate} loading={creating} />
      </Card>

      <View style={styles.filters}>
        {[
          { id: "all", label: "Все" },
          { id: "active", label: "Активные" },
          { id: "completed", label: "Выполненные" },
        ].map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card>
        <SectionTitle>📝 Журнал обычных квестов</SectionTitle>
        {shown.length === 0 ? (
          <EmptyState text="Нет квестов в этой категории." />
        ) : (
          shown.map((task) => (
            <View key={task.id} style={[styles.taskRow, task.done && styles.taskDone]}>
              <View style={styles.taskInfo}>
                <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text>
                <Text style={styles.taskCat}>{task.category_name}</Text>
                <Text style={styles.taskReward}>{task.reward_info}</Text>
              </View>
              <View style={styles.actions}>
                {!task.done && (
                  <AppButton
                    title={busyIds[task.id] ? "" : "Сдать"}
                    variant="success"
                    onPress={() => handleComplete(task.id)}
                    loading={busyIds[task.id]}
                    style={styles.btnSmall}
                  />
                )}
                <AppButton
                  title="✕"
                  variant="danger"
                  onPress={() => handleRemove(task.id)}
                  style={styles.btnX}
                />
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
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
  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  filterBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 6, backgroundColor: colors.panel2, alignItems: "center" },
  filterBtnActive: { backgroundColor: colors.link },
  filterText: { color: colors.muted, fontWeight: "600" },
  filterTextActive: { color: colors.bg },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.panel2,
    padding: spacing.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    marginBottom: spacing.sm,
  },
  taskDone: { opacity: 0.5, borderLeftColor: colors.success },
  taskInfo: { flex: 1, marginRight: spacing.sm },
  taskTitle: { color: colors.text, fontWeight: "600", fontSize: 15 },
  taskTitleDone: { textDecorationLine: "line-through" },
  taskCat: { color: colors.accent, fontSize: 12, marginTop: 2 },
  taskReward: { color: colors.muted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, minHeight: 34 },
  btnX: { paddingVertical: 6, paddingHorizontal: 10, minHeight: 34, width: 40 },
});