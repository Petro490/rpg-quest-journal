import React, { useRef, useState, useEffect } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../theme";

// Всплывающее уведомление внизу экрана (аналог toast из веба).
export default function Toast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);

  const show = (msg, duration = 2400) => {
    setMessage(msg);
    clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setVisible(true);
    timer.current = setTimeout(hide, duration);
  };

  const hide = () => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

export { Toast };

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 80,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.panel2,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    zIndex: 100, // no-op on Android but harmless
  },
  text: { color: colors.text, textAlign: "center", fontSize: 14 },
});