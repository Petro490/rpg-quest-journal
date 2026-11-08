import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { colors, spacing } from "../theme";
import { authApi, saveToken } from "../api/client";

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (username.trim().length === 0 || password.length === 0) {
      setError("Заполните логин и пароль");
      return;
    }
    setError("");
    setLoading(true);
    try {
      let res;
      if (mode === "login") {
        res = await authApi.login(username.trim(), password);
        // Сохраняем JWT и сообщаем о входе
        await saveToken(res.access_token);
      } else {
        await authApi.register(username.trim(), password);
        // После регистрации сразу логинимся и берём токен
        res = await authApi.login(username.trim(), password);
        await saveToken(res.access_token);
      }
      onAuthed();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.bg}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>⚔ RPG Quest</Text>
        <Text style={styles.subtitle}>Менеджер задач, который делает рутину игрой</Text>

        <View style={styles.card}>
          <View style={styles.tabs}>
            {[
              { id: "login", label: "Вход" },
              { id: "register", label: "Регистрация" },
            ].map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tab, mode === t.id && styles.tabActive]}
                onPress={() => { setMode(t.id); setError(""); }}
              >
                <Text style={[styles.tabText, mode === t.id && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Логин (мин. 3 символа)"
            placeholderTextColor="#888"
            value={username}
            autoCapitalize="none"
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Пароль (мин. 4 символа)"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Пожалуйста, подождите..." : mode === "login" ? "Войти в игру" : "Создать героя"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Каждому герою — свой журнал. Регистрируйтесь и начинайте прокачку!
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  wrap: { flexGrow: 1, justifyContent: "center", padding: spacing.xxl },
  title: { fontSize: 32, color: colors.accent, textAlign: "center", fontWeight: "bold" },
  subtitle: { color: colors.muted, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.xxl },
  card: { backgroundColor: colors.panel, borderRadius: 12, padding: spacing.xl },
  tabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  tab: { flex: 1, padding: spacing.md, borderRadius: 6, backgroundColor: colors.panel2 },
  tabActive: { backgroundColor: colors.link },
  tabText: { color: colors.muted, textAlign: "center", fontWeight: "600" },
  tabTextActive: { color: colors.bg },
  input: {
    backgroundColor: colors.panel2,
    color: colors.text,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.accent,
    padding: spacing.lg,
    borderRadius: 8,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  buttonText: { color: colors.bg, fontWeight: "bold", fontSize: 16 },
  error: { color: colors.danger, textAlign: "center", marginBottom: spacing.md, minHeight: 18 },
  hint: { color: colors.muted, textAlign: "center", marginTop: spacing.lg, fontSize: 13 },
});