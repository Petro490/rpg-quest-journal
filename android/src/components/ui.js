import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { colors, spacing } from "../theme";

// Универсальная кнопка приложения
export function AppButton({ title, onPress, variant = "primary", disabled, loading }) {
  const bg =
    variant === "primary"
      ? colors.accent
      : variant === "danger"
      ? colors.danger
      : variant === "success"
      ? colors.success
      : colors.panel2;
  const fg = variant === "primary" || variant === "success" || variant === "danger" ? "#fff" : colors.text;

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: bg }, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{title}</Text>}
    </TouchableOpacity>
  );
}

// Карточка-контейнер
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Строка пары ключ/значение (для карточки героя)
export function Row({ label, value, valueColor }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

// Заголовок секции
export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// Пустое состояние списка
export function EmptyState({ text }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  disabled: { opacity: 0.5 },
  btnText: { fontWeight: "bold", fontSize: 15 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { color: colors.muted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  sectionTitle: { fontSize: 16, color: colors.accent, fontWeight: "bold", marginBottom: spacing.md },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: spacing.xxl },
});