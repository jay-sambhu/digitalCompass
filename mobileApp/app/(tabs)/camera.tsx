import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { router } from "expo-router";

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>("back");

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [mediaPerm, requestMediaPerm] = MediaLibrary.usePermissions();

  useEffect(() => {
    if (!camPerm?.granted) requestCamPerm();
    // optional: request gallery permission so you can save photos
    if (!mediaPerm?.granted) requestMediaPerm();
  }, []);

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) return;

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      // Save to gallery (optional)
      if (mediaPerm?.granted) {
        await MediaLibrary.createAssetAsync(photo.uri);
        Alert.alert("Saved", "Photo saved to gallery.");
      } else {
        Alert.alert("Captured", "Photo captured (not saved to gallery).");
      }

      router.back(); // go back to compass screen
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to take photo");
    }
  };

  if (!camPerm) return null;

  if (!camPerm.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission is required.</Text>
        <Pressable style={styles.btn} onPress={requestCamPerm}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

      <View style={styles.controls}>
        <Pressable style={styles.smallBtn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>

        <Pressable style={styles.capture} onPress={takePhoto} />

        <Pressable
          style={styles.smallBtn}
          onPress={() => setFacing((p) => (p === "back" ? "front" : "back"))}
        >
          <Text style={styles.btnText}>Flip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  controls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  capture: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  smallBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
  },
  btnText: { color: "#fff", fontWeight: "800" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#000" },
  text: { color: "#fff", marginBottom: 12, textAlign: "center" },
  btn: { backgroundColor: "#2b6cff", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
});
