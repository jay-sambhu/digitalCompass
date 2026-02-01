import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Box from "../../components/box";
import AppButton from "../../components/appButton";

export default function Home() {
  return (
    <View style={styles.page}>
      <Box>
        <Text style={styles.title}>Digital Compass</Text>
        <Text style={styles.sub}>Home screen UI with boxes + buttons</Text>
      </Box>

      <Box style={styles.row}>
        <Box style={styles.small}>
          <Text>Box 1</Text>
        </Box>
        <Box style={styles.small}>
          <Text>Box 2</Text>
        </Box>
        
      
      </Box>

      <AppButton title="Start Compass" onPress={() => console.log("Start")} />
      <AppButton title="Settings" variant="outline" onPress={() => console.log("Settings")} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, gap: 12, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700" },
  sub: { marginTop: 6, color: "#444" },
  row: { flexDirection: "row", gap: 12, backgroundColor: "transparent", borderWidth: 0, elevation: 0 },
  small: { flex: 1, height: 90 },
});
