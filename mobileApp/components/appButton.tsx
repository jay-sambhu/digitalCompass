import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";
import { styles } from "../styles/appButton.styles";

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


