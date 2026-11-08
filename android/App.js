import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { colors, spacing } from "./src/theme";
import AuthScreen from "./src/screens/AuthScreen";
import HeroScreen from "./src/screens/HeroScreen";
import TasksScreen from "./src/screens/TasksScreen";
import DailiesScreen from "./src/screens/DailiesScreen";
import ShopScreen from "./src/screens/ShopScreen";
import Toast from "./src/components/Toast";
import { getToken, clearToken, heroApi } from "./src/api/client";

const Tab = createBottomTabNavigator();

// Кастомные ярлыки вкладок
function TabLabel({ icon, label, focused }) {
  return (
    <View style={styles.tabLabelWrap}>
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(null); // null = проверяем, true/false
  const [hero, setHero] = useState(null);
  const toastRef = useRef(null);

  const showToast = useCallback((msg, dur) => toastRef.current?.show(msg, dur), []);

  // При старте проверяем сохранённый JWT
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        // Опционально: попробуем получить героя — если токен битый, сбросим
        try {
          const h = await heroApi.get();
          setHero(h);
          setAuthed(true);
        } catch (e) {
          await clearToken();
          setAuthed(false);
        }
      } else {
        setAuthed(false);
      }
    })();
  }, []);

  const refreshHero = useCallback(async () => {
    try {
      const h = await heroApi.get();
      setHero(h);
    } catch (e) {
      // ignore
    }
  }, []);

  const handleAuthed = useCallback(() => {
    setAuthed(true);
    refreshHero();
  }, [refreshHero]);

  async function handleLogout() {
    await clearToken();
    setHero(null);
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>⚔ RPG Quest</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  if (authed === false) {
    return (
      <AuthScreen onAuthed={handleAuthed} />
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.bg} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚔ RPG Quest</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Выйти</Text>
          </TouchableOpacity>
        </View>

        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: styles.tabBar,
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: colors.muted,
            }}
          >
            <Tab.Screen name="Герой" options={{ tabBarLabel: ({ focused }) => <TabLabel icon="🛡" label="Герой" focused={focused} /> }}>
              {() => <HeroScreen />}
            </Tab.Screen>
            <Tab.Screen name="Квесты" options={{ tabBarLabel: ({ focused }) => <TabLabel icon="📝" label="Квесты" focused={focused} /> }}>
              {() => <TasksScreen onShowToast={showToast} />}
            </Tab.Screen>
            <Tab.Screen name="Дейлики" options={{ tabBarLabel: ({ focused }) => <TabLabel icon="🔄" label="Дейлики" focused={focused} /> }}>
              {() => <DailiesScreen onShowToast={showToast} />}
            </Tab.Screen>
            <Tab.Screen name="Лавка" options={{ tabBarLabel: ({ focused }) => <TabLabel icon="🏪" label="Лавка" focused={focused} /> }}>
              {() => <ShopScreen onShowToast={showToast} hero={hero} onHeroUpdated={refreshHero} />}
            </Tab.Screen>
          </Tab.Navigator>
        </NavigationContainer>

        <Toast ref={toastRef} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  splashTitle: { color: colors.accent, fontSize: 28, fontWeight: "bold" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.accent, fontWeight: "bold", fontSize: 18 },
  logoutBtn: { backgroundColor: colors.panel2, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  logoutText: { color: colors.text, fontSize: 13 },
  tabBar: {
    backgroundColor: colors.panel,
    borderTopColor: colors.border,
    height: 60,
    paddingBottom: 6,
  },
  tabLabelWrap: { alignItems: "center" },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  tabLabelFocused: { color: colors.accent },
});