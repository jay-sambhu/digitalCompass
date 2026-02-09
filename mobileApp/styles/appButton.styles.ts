import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#BD202E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  primary: { backgroundColor: "#BD202E" },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#2596be" },
  text: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  outlineText: { color: "#BD202E" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
