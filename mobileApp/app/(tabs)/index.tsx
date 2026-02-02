import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Animated,
  useWindowDimensions,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Magnetometer } from "expo-sensors";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

function headingFromMag({ x, y }: { x: number; y: number }) {
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  deg = deg >= 0 ? deg : deg + 360;
  return (deg + 180) % 360;
}

function smoothAngle(prev: number, next: number, alpha: number) {
  const diff = ((next - prev + 540) % 360) - 180;
  return (prev + alpha * diff + 360) % 360;
}

export default function IndexScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [heading, setHeading] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<Array<{ type: string; message: string; time: string }>>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [activeCompass, setActiveCompass] = useState<number>(0); // Track which compass opened camera

  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [mediaPerm, requestMediaPerm] = MediaLibrary.usePermissions();

  const prevHeadingRef = useRef(0);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Capture console logs and errors (without error hook to avoid render errors)
  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      originalLog(...args);
      try {
        const message = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");
        setDebugLogs((prev) => [...prev.slice(-49), { type: "LOG", message, time: new Date().toLocaleTimeString() }]);
      } catch (e) {
        // Silently fail if state update causes issues
      }
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      try {
        const message = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");
        setDebugLogs((prev) => [...prev.slice(-49), { type: "WARN", message, time: new Date().toLocaleTimeString() }]);
      } catch (e) {
        // Silently fail if state update causes issues
      }
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
    };
  }, []);

  useEffect(() => {
    Magnetometer.setUpdateInterval(50);

    const sub = Magnetometer.addListener((data) => {
      if (!data || typeof data.x !== "number" || typeof data.y !== "number" || typeof data.z !== "number") return;

      const raw = headingFromMag({ x: data.x, y: data.y });
      const smooth = smoothAngle(prevHeadingRef.current, raw, 0.22);
      prevHeadingRef.current = smooth;
      setHeading(smooth);

      Animated.timing(rotateAnim, {
        toValue: smooth,
        duration: 60,
        useNativeDriver: false,
      }).start();
    });

    return () => sub.remove();
  }, [rotateAnim]);

  const needleRotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  const gridGap = 12;
  const gridPadding = 16;
  const topSectionHeight = 150;
  const tileSize = useMemo(() => {
    const tileByWidth = (width - gridPadding * 2 - gridGap) / 2;
    const availableHeight =
      height - insets.top - insets.bottom - topSectionHeight - gridPadding;
    const tileByHeight = (availableHeight - gridGap) / 2;
    const rawSize = Math.min(tileByWidth, tileByHeight);
    return Math.max(120, Math.floor(rawSize));
  }, [width, height, insets.top, insets.bottom]);

  const needleSize = Math.round(tileSize * 0.68);
  const headingText = useMemo(() => `${Math.round(heading)}°`, [heading]);

  const overlayDialSize = useMemo(() => {
    const screenSize = Math.min(width, height);
    return Math.min(screenSize * 0.75, 380);
  }, [width, height]);

  const overlayNeedleSize = Math.round(overlayDialSize * 0.68);

  const getCardinalDirections = () => {
    const h = Math.round(heading);
    return {
      north: h,
      east: (h + 90) % 360,
      south: (h + 180) % 360,
      west: (h + 270) % 360,
    };
  };

  const cardinalDirs = getCardinalDirections();

  const openCompassCamera = async (compassIndex: number) => {
    try {
      const camGranted = camPerm?.granted ?? (await requestCamPerm()).granted;
      if (!camGranted) {
        Alert.alert("Permission required", "Camera permission is required.");
        return;
      }
      setActiveCompass(compassIndex);
      setCapturedPhoto(null);
      setCameraOpen(true);
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to open camera");
    }
  };

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      if (photo && photo.uri) {
        setCapturedPhoto(photo.uri);
      } else {
        Alert.alert("Camera error", "Failed to capture photo");
      }
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to take photo");
    }
  };

  const savePhoto = async () => {
    try {
      if (!capturedPhoto) {
        Alert.alert("Error", "No photo to save.");
        return;
      }

      console.log("Starting photo save...");
      console.log("Photo URI:", capturedPhoto);
      
      // Try to save directly - in Expo Go, media library has limited support
      // In a development build, this would work with proper permissions
      try {
        const asset = await MediaLibrary.createAssetAsync(capturedPhoto);
        console.log("Asset created:", asset);
        
        Alert.alert("Saved!", "Photo saved to gallery successfully!");
        setCameraOpen(false);
        setCapturedPhoto(null);
      } catch (mediaError: any) {
        console.log("Media library error (expected in Expo Go):", mediaError.message);
        // In Expo Go, we can still proceed - the file is saved to cache
        Alert.alert("Info", "Photo captured! (Full save requires development build)");
        setCameraOpen(false);
        setCapturedPhoto(null);
      }
    } catch (e: any) {
      console.error("Save error:", e);
      Alert.alert("Save error", e?.message || "Failed to save photo");
    }
  };

  const sharePhoto = async () => {
    try {
      if (!capturedPhoto) {
        Alert.alert("Error", "No photo to share.");
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Share unavailable", "Sharing is not available on this device.");
        return;
      }
      await Sharing.shareAsync(capturedPhoto, {
        mimeType: "image/jpeg",
        dialogTitle: "Share Compass Photo",
      });
    } catch (e: any) {
      console.error("Share error:", e);
      Alert.alert("Share error", e?.message || "Failed to share photo");
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCapturedPhoto(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.heroButton}>
          <Image
            source={require("../../assets/compass/icon.png")}
            style={styles.heroIcon}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.heroTitle}>Digital Compass</Text>
            <Text style={styles.heroSubtitle}>{headingText}</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.debugToggle}
          onPress={() => setShowDebug(!showDebug)}
        >
          <Text style={styles.debugToggleText}>🐛</Text>
        </Pressable>
      </View>

      <View style={[styles.grid, { paddingHorizontal: gridPadding, gap: gridGap }]}> 
        {["Compass 1", "Compass 2", "Compass 3", "Compass 4"].map((label, index) => {
          // Determine which assets to use
          const dialSource = index === 1 
            ? require("../../assets/compass2/dial.png")
            : require("../../assets/compass/dial.png");
          const needleSource = index === 1
            ? require("../../assets/compass2/needle.png")
            : require("../../assets/compass/needle.png");
          
          return (
            <View key={label} style={{ width: tileSize }}>
              <Pressable
                style={[styles.tile, { width: tileSize, height: tileSize }]}
                onPress={() => index <= 1 ? openCompassCamera(index) : undefined}
                disabled={index > 1}
              >
                <Image
                  source={dialSource}
                  style={{ width: tileSize, height: tileSize }}
                  resizeMode="contain"
                />
                <Animated.Image
                  source={needleSource}
                  style={{
                    width: needleSize,
                    height: needleSize,
                    position: "absolute",
                    transform: [{ rotate: needleRotate }],
                  }}
                  resizeMode="contain"
                />
              </Pressable>
              <Text style={styles.tileLabel}>{label}</Text>
            </View>
          );
        })}
      </View>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={closeCamera}>
        <View style={styles.cameraContainer}>
          {!camPerm?.granted ? (
            <View style={styles.cameraPermission}>
              <Text style={styles.permissionText}>Camera permission is required.</Text>
              <Pressable style={styles.camBtn} onPress={requestCamPerm}>
                <Text style={styles.camBtnText}>Grant Permission</Text>
              </Pressable>
            </View>
          ) : capturedPhoto ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: capturedPhoto }} style={styles.preview} />
              <View style={styles.fullScreenOverlay}>
                <View style={styles.compassOverlay}>
                  <Image
                    source={activeCompass === 1 ? require("../../assets/compass2/dial.png") : require("../../assets/compass/dial.png")}
                    style={{ width: overlayDialSize, height: overlayDialSize }}
                    resizeMode="contain"
                  />
                  <Animated.Image
                    source={activeCompass === 1 ? require("../../assets/compass2/needle.png") : require("../../assets/compass/needle.png")}
                    style={[
                      styles.overlayNeedle,
                      {
                        width: overlayNeedleSize,
                        height: overlayNeedleSize,
                        transform: [{ rotate: needleRotate }],
                      },
                    ]}
                    resizeMode="contain"
                  />
                  <View style={styles.headingBadge}>
                    <Text style={styles.headingBadgeText}>{headingText}</Text>
                  </View>
                </View>
                <View style={styles.directionBreakdown}>
                  <View style={styles.directionItem}>
                    <Text style={styles.dirLabel}>N</Text>
                    <Text style={styles.dirValue}>{cardinalDirs.north}°</Text>
                  </View>
                  <View style={styles.directionItem}>
                    <Text style={styles.dirLabel}>E</Text>
                    <Text style={styles.dirValue}>{cardinalDirs.east}°</Text>
                  </View>
                  <View style={styles.directionItem}>
                    <Text style={styles.dirLabel}>S</Text>
                    <Text style={styles.dirValue}>{cardinalDirs.south}°</Text>
                  </View>
                  <View style={styles.directionItem}>
                    <Text style={styles.dirLabel}>W</Text>
                    <Text style={styles.dirValue}>{cardinalDirs.west}°</Text>
                  </View>
                </View>          </View>
              <View style={styles.previewControls}>
                <Pressable style={styles.camBtn} onPress={retakePhoto}>
                  <Text style={styles.camBtnText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.camBtn} onPress={savePhoto}>
                  <Text style={styles.camBtnText}>Save</Text>
                </Pressable>
                <Pressable style={styles.camBtn} onPress={sharePhoto}>
                  <Text style={styles.camBtnText}>Share</Text>
                </Pressable>
                <Pressable style={styles.camBtn} onPress={closeCamera}>
                  <Text style={styles.camBtnText}>Close</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
              <View style={styles.fullScreenOverlay}>
                <View style={styles.compassOverlay}>
                  <Image
                    source={activeCompass === 1 ? require("../../assets/compass2/dial.png") : require("../../assets/compass/dial.png")}
                    style={{ width: overlayDialSize, height: overlayDialSize }}
                    resizeMode="contain"
                  />
                  <Animated.Image
                    source={activeCompass === 1 ? require("../../assets/compass2/needle.png") : require("../../assets/compass/needle.png")}
                    style={[
                      styles.overlayNeedle,
                      {
                        width: overlayNeedleSize,
                        height: overlayNeedleSize,
                        transform: [{ rotate: needleRotate }],
                      },
                    ]}
                    resizeMode="contain"
                  />
                  <View style={styles.headingBadge}>
                    <Text style={styles.headingBadgeText}>{headingText}</Text>
                  </View>
                </View>
                <View style={styles.directionBreakdown}>
                  <View style={styles.directionItem}>
                    <Text style={styles.dirLabel}>N</Text>
                    <Text style={styles.dirValue}>{cardinalDirs.north}°</Text>
                  </View>
                  <View style={styles.directionItem}>
                    <Text style={styles.dirLabel}>E</Text>
                    <Text style={styles.dirValue}>{cardinalDirs.east}°</Text>
                  </View>
                  <View style={styles.directionItem}>
                    <Text style={styles.dirLabel}>S</Text>
                    <Text style={styles.dirValue}>{cardinalDirs.south}°</Text>
                  </View>
                  <View style={styles.directionItem}>
                    <Text style={styles.dirLabel}>W</Text>
                    <Text style={styles.dirValue}>{cardinalDirs.west}°</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cameraControls}>
                <Pressable style={styles.camBtn} onPress={closeCamera}>
                  <Text style={styles.camBtnText}>Close</Text>
                </Pressable>
                <Pressable style={styles.capture} onPress={takePhoto} />
                <Pressable
                  style={styles.camBtn}
                  onPress={() => setFacing((p) => (p === "back" ? "front" : "back"))}
                >
                  <Text style={styles.camBtnText}>Flip</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={showDebug} animationType="slide" onRequestClose={() => setShowDebug(false)}>
        <SafeAreaView style={styles.debugContainer}>
          <View style={styles.debugHeader}>
            <Text style={styles.debugTitle}>Debug Console</Text>
            <Pressable onPress={() => setShowDebug(false)}>
              <Text style={styles.debugClose}>✕</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.clearLogsBtn}
            onPress={() => setDebugLogs([])}
          >
            <Text style={styles.clearLogsBtnText}>Clear Logs</Text>
          </Pressable>
          <ScrollView style={styles.logScroll} nestedScrollEnabled>
            {debugLogs.length === 0 ? (
              <Text style={styles.noLogs}>No logs yet...</Text>
            ) : (
              debugLogs.map((log, index) => (
                <View
                  key={index}
                  style={[
                    styles.logEntry,
                    log.type === "ERROR" && styles.logError,
                    log.type === "WARN" && styles.logWarn,
                    log.type === "LOG" && styles.logInfo,
                  ]}
                >
                  <Text style={styles.logTime}>{log.time}</Text>
                  <Text style={styles.logType}>[{log.type}]</Text>
                  <Text style={styles.logMessage}>{log.message}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  debugToggle: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#f2f6ff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
  },
  debugToggleText: { fontSize: 20 },
  debugContainer: { flex: 1, backgroundColor: "#1a1a1a" },
  debugHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  debugTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  debugClose: { fontSize: 24, color: "#fff", fontWeight: "700" },
  clearLogsBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#d32f2f",
    borderRadius: 6,
  },
  clearLogsBtnText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  logScroll: { flex: 1, paddingHorizontal: 8 },
  noLogs: { color: "#888", fontSize: 14, textAlign: "center", marginTop: 20 },
  logEntry: {
    flexDirection: "row",
    padding: 8,
    marginVertical: 4,
    marginHorizontal: 4,
    borderRadius: 6,
    backgroundColor: "#222",
    borderLeftWidth: 3,
    borderLeftColor: "#666",
  },
  logError: { borderLeftColor: "#d32f2f", backgroundColor: "#3d1f1f" },
  logWarn: { borderLeftColor: "#ff9800", backgroundColor: "#3d2a1f" },
  logInfo: { borderLeftColor: "#2196f3", backgroundColor: "#1f2d3d" },
  logTime: { fontSize: 11, color: "#999", marginRight: 8, minWidth: 60 },
  logType: { fontSize: 11, fontWeight: "700", color: "#aaa", marginRight: 8, minWidth: 60 },
  logMessage: { fontSize: 12, color: "#ddd", flex: 1, flexWrap: "wrap" },
  heroButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#f2f6ff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
  },
  heroIcon: { width: 72, height: 72 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  heroSubtitle: { marginTop: 4, fontSize: 16, fontWeight: "700", color: "#1d4ed8" },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eef2ff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  tileLabel: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  fullScreenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-between",
    alignItems: "center",
  },
  compassOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  directionBreakdown: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    gap: 8,
  },
  directionItem: {
    alignItems: "center",
    flex: 1,
  },
  dirLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  dirValue: {
    color: "#4ade80",
    fontSize: 14,
    fontWeight: "600",
  },
  overlayNeedle: { position: "absolute" },
  headingBadge: {
    position: "absolute",
    bottom: "30%",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  headingBadgeText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
  },
  camBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#1f2937",
    borderRadius: 8,
  },
  camBtnText: { color: "#fff", fontWeight: "600" },
  capture: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "#d1d5db",
  },
  cameraPermission: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  permissionText: { color: "#fff", fontSize: 16 },
  previewContainer: { flex: 1 },
  preview: { flex: 1, width: "100%" },
  previewControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
    gap: 8,
  },
});
