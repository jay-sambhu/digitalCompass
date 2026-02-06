import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export default function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.outline,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, variant === "outline" && styles.outlineText]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  primary: { backgroundColor: "#2563eb" },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#2563eb" },
  text: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  outlineText: { color: "#0f172a" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
