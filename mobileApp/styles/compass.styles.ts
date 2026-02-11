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
  title: { color: "#ffffff", fontSize: 20, marginBottom: 10, letterSpacing: 0.3, fontFamily: "Poppins" },
  degree: { color: "#ffffff", fontSize: 54, fontWeight: "800", letterSpacing: 0.5, fontFamily: "Poppins" },
  dir: { color: "#ffffff", fontSize: 28, marginTop: 6, letterSpacing: 0.4, fontFamily: "Poppins" },
  hint: { color: "#ffffff", marginTop: 14, fontSize: 12, fontFamily: "Poppins" },
});
