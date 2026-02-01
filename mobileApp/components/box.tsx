import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export default function Box({ children, style }: Props) {
  return <View style={[styles.box, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  box: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#eee",

    // Android shadow
    elevation: 3,

    // iOS shadow
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
