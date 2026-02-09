import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  card: {
    width: "90%",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#BD202E",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#a01b26",
    shadowColor: "#BD202E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  title: { color: "#f8fafc", fontSize: 20, marginBottom: 10, letterSpacing: 0.3 },
  degree: { color: "#4ade80", fontSize: 54, fontWeight: "800", letterSpacing: 0.5 },
  dir: { color: "#e2e8f0", fontSize: 28, marginTop: 6, letterSpacing: 0.4 },
  hint: { color: "#94a3b8", marginTop: 14, fontSize: 12 },
});
