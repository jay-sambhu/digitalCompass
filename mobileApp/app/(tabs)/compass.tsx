import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Animated,
  Modal,
  Alert,
  Linking,
  SafeAreaView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { Href, router } from "expo-router";




function normalize360(deg: number) {
  return (deg + 360) % 360;
}

// 🔴 NEW FUNCTION: Calculate heading from magnetic vector with 180° correction
function headingFromMag({ x, y }: { x: number; y: number }) {
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  deg = deg >= 0 ? deg : deg + 360;
  // THIS LINE FIXES OPPOSITE DIRECTION (N↔S, E↔W)
  return (deg + 180) % 360;
}

// smooth across 0/360
function smoothAngle(prev: number, next: number, alpha: number) {
  const diff = ((next - prev + 540) % 360) - 180;
  return normalize360(prev + alpha * diff);
}

export default function CompassScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 360;
  const dialSize = Math.min(width * 0.78, 320);
  const needleSize = Math.round(dialSize * 0.68);

  const [heading, setHeading] = useState(0);         // 0..360
  const [strength, setStrength] = useState(0);       // microTesla approx
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [mediaPerm, requestMediaPerm] = MediaLibrary.usePermissions();

  const prevHeadingRef = useRef(0);

  // Animated rotation (degrees)
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let locSub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        locSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
          (pos) => {
            setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          }
        );
      }
    })();

    return () => {
      locSub?.remove();
    };
  }, []);

  useEffect(() => {
    Magnetometer.setUpdateInterval(50);

    const sub = Magnetometer.addListener((data) => {
      if (!data || typeof data.x !== "number" || typeof data.y !== "number" || typeof data.z !== "number") return;

      // 🔴 USE NEW FUNCTION: Heading from magnetic vector with 180° correction
      const raw = headingFromMag({ x: data.x, y: data.y });

      // smooth it
      const smooth = smoothAngle(prevHeadingRef.current, raw, 0.22);
      prevHeadingRef.current = smooth;
      setHeading(smooth);

      // field strength magnitude (approx, units depend on platform; expo usually close to µT)
      const mag = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
      setStrength(mag);

      // animate needle rotation
      Animated.timing(rotateAnim, {
        toValue: smooth,
        duration: 60,
        useNativeDriver: false,
      }).start();
    });

    return () => sub.remove();
  }, [rotateAnim]);

  const headingText = useMemo(() => `${Math.round(heading)}° Degree`, [heading]);

  const needleRotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  const openCamera = async () => {
    try {
      const camGranted =
        camPerm?.granted ?? (await requestCamPerm()).granted;

      if (!camGranted) {
        Alert.alert("Permission required", "Camera permission is required to open the camera.");
        return;
      }

      if (!mediaPerm?.granted) {
        await requestMediaPerm();
      }

      setCameraOpen(true);
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to open camera");
    }
  };

  const openMap = async () => {
    try {
      let current = coords;
      if (!current) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission required", "Location permission is required to open maps.");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(current);
      }
      const query = `${current.lat},${current.lon}`;
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Maps error", e?.message ?? "Failed to open maps");
    }
  };

  const openLastCaptured = async () => {
    try {
      const perm = mediaPerm?.granted ?? (await requestMediaPerm()).granted;
      if (!perm) {
        Alert.alert("Permission required", "Media library permission is required.");
        return;
      }
      const assets = await MediaLibrary.getAssetsAsync({
        first: 1,
        sortBy: [MediaLibrary.SortBy.creationTime],
        mediaType: MediaLibrary.MediaType.photo,
      });
      const latest = assets.assets[0];
      if (!latest) {
        Alert.alert("No photos", "No photos found in your library.");
        return;
      }
      const info = await MediaLibrary.getAssetInfoAsync(latest);
      const uri = info.localUri ?? latest.uri;
      await Linking.openURL(uri);
    } catch (e: any) {
      Alert.alert("Gallery error", e?.message ?? "Failed to open last captured photo");
    }
  };

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) return;

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });

      if (mediaPerm?.granted) {
        await MediaLibrary.createAssetAsync(photo.uri);
        Alert.alert("Saved", "Photo saved to gallery.");
      } else {
        Alert.alert("Captured", "Photo captured (not saved).");
      }

      setCameraOpen(false);
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to take photo");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar (simple like screenshot) */}
      <View style={styles.topBar}>
        <Text style={styles.icon}>☰</Text>
        <View style={styles.search}>
          <Text style={styles.searchText}>Search Location</Text>
        </View>
        <Text style={styles.icon}>⋮</Text>
      </View>

      {/* Shortcut icons row */}
      <View style={[styles.quickRow, isCompact && styles.quickRowCompact]}>
        <Pressable style={styles.quickBtn} onPress={openMap}>
          <Text style={styles.quickCircle}>📍</Text>
          <Text style={styles.quickLabel}>Google map</Text>
        </Pressable>

        <Text style={styles.degreeTitle}>{headingText}</Text>

        <Pressable style={styles.quickBtn} onPress={openCamera}>
          <Text style={styles.quickCircle}>📷</Text>
          <Text style={styles.quickLabel}>Rear Camera</Text>
        </Pressable>


      </View>

      {/* Compass display */}
      <View style={styles.compassWrap}>
        {/* small pointer on top */}
        <Text style={styles.topPointer}>▼</Text>

        {/* Dial */}
        <Image
          source={require("../../assets/compass/dial.png")}
          style={[styles.dial, { width: dialSize, height: dialSize }]}
          resizeMode="contain"
        />

        {/* Needle (rotates) */}
        <Animated.Image
          source={require("../../assets/compass/needle.png")}
          style={[
            styles.needle,
            { width: needleSize, height: needleSize, transform: [{ rotate: needleRotate }] },
          ]}
          resizeMode="contain"
        />
      </View>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraContainer}>
          {!camPerm?.granted ? (
            <View style={styles.cameraPermission}>
              <Text style={styles.permissionText}>Camera permission is required.</Text>
              <Pressable style={styles.camBtn} onPress={requestCamPerm}>
                <Text style={styles.camBtnText}>Grant Permission</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
              <View style={styles.cameraControls}>
                <Pressable style={styles.camBtn} onPress={() => setCameraOpen(false)}>
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

      {/* Bottom info */}
      <View style={[styles.infoRow, isCompact && styles.infoRowCompact]}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Geo-Coordinate:</Text>
          <Text style={styles.infoValue}>
            {coords ? `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}` : "—"}
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Magnetic Field:</Text>
          <Text style={styles.infoValue}>
            Strength: <Text style={styles.red}>{strength.toFixed(0)} µT</Text>
          </Text>
        </View>
      </View>

      {/* Bottom nav mock */}
      <View style={[styles.bottomNav, { paddingBottom: 14 + insets.bottom }]}>
        <Pressable style={styles.navItem} onPress={() => router.push("/(tabs)" as Href)}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Home Page</Text>
        </Pressable>

        <Pressable style={styles.captureBtn} onPress={openCamera}>
          <Text style={styles.captureIcon}>▣</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={openLastCaptured}>
          <Text style={styles.navIcon}>🖼️</Text>
          <Text style={styles.navLabel}>Last Captured</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 },
  icon: { fontSize: 22 },
  search: { flex: 1, height: 42, borderRadius: 10, backgroundColor: "#e9e9e9", justifyContent: "center", paddingHorizontal: 14 },
  searchText: { color: "#888" },

  quickRow: { marginTop: 18, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 12 },
  quickRowCompact: { justifyContent: "space-around" },
  quickBtn: { alignItems: "center", width: 110 },
  quickCircle: { fontSize: 30 },
  quickLabel: { marginTop: 6, fontWeight: "600" },
  degreeTitle: { fontSize: 22, fontWeight: "800" },

  compassWrap: { marginTop: 10, alignItems: "center", justifyContent: "center" },
  topPointer: { fontSize: 18, color: "#1e90ff", marginBottom: 6 },
  dial: { width: 320, height: 320 },
  needle: { position: "absolute" },

  infoRow: { marginTop: 18, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  infoRowCompact: { flexDirection: "column" },
  infoBox: { flex: 1 },
  infoTitle: { fontSize: 16, fontWeight: "800" },
  infoValue: { marginTop: 6, fontSize: 14, color: "#333" },
  red: { color: "red", fontWeight: "800" },

  bottomNav: { marginTop: "auto", paddingVertical: 14, borderTopWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  navItem: { alignItems: "center", flex: 1 },
  navIcon: { fontSize: 22 },
  navLabel: { marginTop: 4, color: "#2b6cff", fontWeight: "700" },
  captureBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", borderWidth: 2, borderColor: "#dbe7ff", alignItems: "center", justifyContent: "center" },
  captureIcon: { fontSize: 22, color: "#2b6cff", fontWeight: "900" },

  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  cameraControls: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: 16, backgroundColor: "#000" },
  camBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#1f2937", borderRadius: 8 },
  camBtnText: { color: "#fff", fontWeight: "600" },
  capture: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", borderWidth: 4, borderColor: "#d1d5db" },

  cameraPermission: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  permissionText: { color: "#fff", fontSize: 16 },
});
