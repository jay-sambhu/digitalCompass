import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, Image, Animated, useWindowDimensions, Linking, Modal, ScrollView, Share } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import { Magnetometer } from "expo-sensors";
import { Href, router } from "expo-router";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

function normalize360(deg: number) {
  return (deg + 360) % 360;
}

function headingFromMag({ x, y }: { x: number; y: number }) {
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  deg = deg >= 0 ? deg : deg + 360;
  return (deg + 180) % 360;
}

export default function CameraScreen() {
  const { width, height } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>("back");

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [mediaPerm, requestMediaPerm] = MediaLibrary.usePermissions();
  
  const [heading, setHeading] = useState(0);
  const [strength, setStrength] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const prevHeadingRef = useRef(0);
  
  const dialSize = Math.min(width * 0.65, 320);
  const needleSize = Math.round(dialSize * 0.68);

  // Create interpolated rotation string for animated value
  const needleRotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    const requestPermissions = async () => {
      if (camPerm && !camPerm.granted) {
        await requestCamPerm();
      }
      if (mediaPerm && !mediaPerm.granted) {
        await requestMediaPerm();
      }
    };
    requestPermissions();
  }, [camPerm?.granted, mediaPerm?.granted, requestCamPerm, requestMediaPerm]);

  // Location tracking
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

  // Magnetometer tracking
  useEffect(() => {
    const sub = Magnetometer.addListener((data) => {
      const newHeading = headingFromMag(data);
      setHeading(newHeading);
      setStrength(Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2));

      const prev = prevHeadingRef.current;
      const diff = ((newHeading - prev + 540) % 360) - 180;
      const smoothed = normalize360(prev + 0.2 * diff);
      prevHeadingRef.current = smoothed;

      Animated.timing(rotateAnim, {
        toValue: -smoothed,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });

    Magnetometer.setUpdateInterval(100);
    return () => sub.remove();
  }, []);

  const savePreviewPhoto = async () => {
    try {
      if (!previewUri) {
        Alert.alert("Error", "No photo to save");
        return;
      }

      console.log("Starting save with URI:", previewUri);

      // Try to save directly without requesting permission first
      try {
        console.log("Attempting to create asset from URI");
        
        // Create the asset - this saves to the gallery
        const asset = await MediaLibrary.createAssetAsync(previewUri);
        console.log("Asset created successfully:", asset.id);
        
        // Try to add to Camera album, but don't fail if it doesn't work
        try {
          const album = await MediaLibrary.getAlbumAsync("Camera");
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            console.log("Asset added to Camera album");
          } else {
            await MediaLibrary.createAlbumAsync("Camera", asset, false);
            console.log("Camera album created with asset");
          }
        } catch (albumErr: any) {
          // If album operations fail, the asset is still saved to the gallery
          console.warn("Album operation skipped:", albumErr?.message);
        }

        Alert.alert("✅ Saved", "Photo saved to your device gallery successfully!");
      } catch (saveErr: any) {
        // If save fails due to permissions, try requesting permission
        console.error("Save photo error:", saveErr?.message);
        
        if (saveErr?.message?.includes("Permission") || saveErr?.message?.includes("permission")) {
          console.log("Permission error detected, requesting permission");
          try {
            const permission = await requestMediaPerm();
            if (permission?.granted) {
              // Retry saving with permission granted
              const asset = await MediaLibrary.createAssetAsync(previewUri);
              console.log("Asset created successfully after permission:", asset.id);
              
              try {
                const album = await MediaLibrary.getAlbumAsync("Camera");
                if (album) {
                  await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                } else {
                  await MediaLibrary.createAlbumAsync("Camera", asset, false);
                }
              } catch (albumErr: any) {
                console.warn("Album operation skipped:", albumErr?.message);
              }
              
              Alert.alert("✅ Saved", "Photo saved to your device gallery successfully!");
            } else {
              Alert.alert("Permission Required", "Media library permission is required. Please enable it in app settings.", [
                { text: "OK", onPress: () => {} },
              ]);
            }
          } catch (permErr: any) {
            console.error("Permission request error:", permErr?.message);
            Alert.alert("Save Error", "Unable to save photo. Please check app permissions in settings.", [
              { text: "Try Again", onPress: savePreviewPhoto },
              { text: "Cancel", onPress: () => setPreviewUri(null) },
            ]);
          }
        } else {
          Alert.alert("Save Error", `Unable to save photo: ${saveErr?.message || "Unknown error"}`, [
            { text: "Try Again", onPress: savePreviewPhoto },
            { text: "Cancel", onPress: () => setPreviewUri(null) },
          ]);
        }
      }
    } catch (e: any) {
      console.error("Outer error in savePreviewPhoto:", e?.message);
      Alert.alert("Error", `An unexpected error occurred: ${e?.message || "Unknown error"}. Please try again.`);
    }
  };

  const sharePreviewPhoto = async () => {
    try {
      if (!previewUri) {
        Alert.alert("Error", "No photo to share");
        return;
      }
      await Share.share({
        url: previewUri,
        message: "Check out this photo from Digital Compass",
      });
    } catch (e: any) {
      Alert.alert("Share error", e?.message ?? "Failed to share photo");
    }
  };

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) return;

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });

      setPreviewUri(photo.uri);
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to take photo");
    }
  };

  const openLastCaptured = async () => {
    try {
      if (!mediaPerm?.granted) {
        Alert.alert("Permission required", "Media library permission is required.");
        return;
      }
      const album = await MediaLibrary.getAlbumAsync("Camera");
      if (album) {
        const assets = await MediaLibrary.getAssetsAsync({
          album: album,
          first: 1,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        if (assets.assets.length > 0) {
          setPreviewUri(assets.assets[0].uri);
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to get last photo");
    }
  };

  const openMap = async () => {
    try {
      const query = coords ? `${coords.lat},${coords.lon}` : "";
      const url = query
        ? `https://www.google.com/maps/search/?api=1&query=${query}`
        : "https://www.google.com/maps";
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Map error", e?.message ?? "Failed to open map");
    }
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message: "Try Digital Compass: https://sanskarvastu.com",
      });
    } catch (e) {
      // ignore
    }
  };

  const openPermissionsManager = () => {
    Linking.openSettings();
  };

  const openUserGuide = () => {
    router.push({ pathname: "/(tabs)", params: { openUserGuide: "1" } } as Href);
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

  // Show preview screen if photo is captured
  if (previewUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: previewUri }} style={styles.previewImage} />

        {/* Compass dial overlay on preview */}
        <View
          style={[
            styles.cameraDialWrap,
            {
              transform: [
                { translateX: -dialSize / 2 },
                { translateY: -dialSize / 2 },
              ],
            },
          ]}
        >
          <Image
            source={require("../../assets/compass/dial.png")}
            style={[styles.cameraDial, { width: dialSize, height: dialSize }]}
            resizeMode="contain"
          />
          <Animated.Image
            source={require("../../assets/compass/needle.png")}
            style={[
              styles.cameraNeedle,
              {
                width: needleSize,
                height: needleSize,
                transform: [{ rotate: needleRotate }],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Magnetic field and coordinates overlay */}
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraOverlayRow}>
            <Text style={styles.cameraOverlayLabel}>Degree:</Text>
            <Text style={styles.cameraOverlayValue}>{Math.round(heading)}°</Text>
          </View>
          <View style={styles.cameraOverlayRow}>
            <Text style={styles.cameraOverlayLabel}>Lat:</Text>
            <Text style={styles.cameraOverlayValue}>{coords ? coords.lat.toFixed(6) : "—"}</Text>
          </View>
          <View style={styles.cameraOverlayRow}>
            <Text style={styles.cameraOverlayLabel}>Lon:</Text>
            <Text style={styles.cameraOverlayValue}>{coords ? coords.lon.toFixed(6) : "—"}</Text>
          </View>
          <View style={styles.cameraOverlayRow}>
            <Text style={styles.cameraOverlayLabel}>Mag:</Text>
            <Text style={styles.cameraOverlayValue}>{strength.toFixed(0)} µT</Text>
          </View>
        </View>

        {/* Top bar for preview */}
        <View style={styles.topBar}>
          <Pressable style={styles.topIconBtn} onPress={() => setDrawerOpen(true)}>
            <MaterialIcons name="menu" size={28} color="#fff" />
          </Pressable>
          <Pressable style={styles.searchBtn} onPress={openMap}>
            <MaterialIcons name="search" size={22} color="#fff" />
            <Text style={styles.searchText}>Search location</Text>
          </Pressable>
          <Pressable style={styles.topIconBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={28} color="#fff" />
          </Pressable>
        </View>

        {/* Bottom preview controls */}
        <View style={styles.previewControls}>
          <Pressable style={styles.previewBtn} onPress={() => setPreviewUri(null)}>
            <MaterialIcons name="refresh" size={28} color="#fff" />
            <Text style={styles.previewBtnText}>Retake</Text>
          </Pressable>
          <Pressable style={styles.previewBtn} onPress={savePreviewPhoto}>
            <MaterialIcons name="download" size={28} color="#fff" />
            <Text style={styles.previewBtnText}>Save</Text>
          </Pressable>
          <Pressable style={styles.previewBtn} onPress={sharePreviewPhoto}>
            <MaterialIcons name="share" size={28} color="#fff" />
            <Text style={styles.previewBtnText}>Share</Text>
          </Pressable>
        </View>

        <Modal
          visible={drawerOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setDrawerOpen(false)}
        >
          <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
            <Pressable style={styles.drawerContainer} onPress={(e) => e.stopPropagation()}>
              <ScrollView>
                <View style={styles.drawerHeader}>
                  <Image
                    source={require("../../assets/compass/icon.png")}
                    style={styles.drawerLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.drawerBrand}>sanskarvastu.com</Text>
                  <Text style={styles.drawerVersion}>Version: 3.1.3</Text>
                  <Text style={styles.drawerTitle}>Vastu Compass</Text>
                </View>
                <View style={styles.menuList}>
                  <Pressable style={styles.menuItem}>
                    <Text style={styles.menuIcon}>ℹ️</Text>
                    <Text style={styles.menuText}>About AppliedVastu</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <Text style={styles.menuIcon}>💻</Text>
                    <Text style={styles.menuText}>Access Vastu Software</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <Text style={styles.menuIcon}>📱</Text>
                    <Text style={styles.menuText}>More Apps</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={shareApp}>
                    <Text style={styles.menuIcon}>🔗</Text>
                    <Text style={styles.menuText}>Share</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <Text style={styles.menuIcon}>✉️</Text>
                    <Text style={styles.menuText}>Send Feedback</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <Text style={styles.menuIcon}>⭐</Text>
                    <Text style={styles.menuText}>Review Us</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={openPermissionsManager}>
                    <Text style={styles.menuIcon}>🔒</Text>
                    <Text style={styles.menuText}>Manage Permissions</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={openUserGuide}>
                    <Text style={styles.menuIcon}>❓</Text>
                    <Text style={styles.menuText}>How to use Vastu Compass</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <Text style={styles.menuIcon}>🎓</Text>
                    <Text style={styles.menuText}>Join AppliedVastu Course</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={() => setDrawerOpen(false)}>
                    <Text style={styles.menuIcon}>←</Text>
                    <Text style={styles.menuText}>Back</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

      {/* Top bar: menu, search location, back */}
      <View style={styles.topBar}>
        <Pressable style={styles.topIconBtn} onPress={() => setDrawerOpen(true)}>
          <MaterialIcons name="menu" size={28} color="#fff" />
        </Pressable>

        <Pressable style={styles.searchBtn} onPress={openMap}>
          <MaterialIcons name="search" size={22} color="#fff" />
          <Text style={styles.searchText}>Search location</Text>
        </Pressable>

        <Pressable style={styles.topIconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={28} color="#fff" />
        </Pressable>
      </View>

      {/* Flip button - moved away from top bar */}
      <Pressable
        style={styles.flipBtn}
        onPress={() => setFacing((p) => (p === "back" ? "front" : "back"))}
      >
        <MaterialCommunityIcons name="camera-flip" size={28} color="#fff" />
      </Pressable>

      {/* Center - Degree display */}
      <View style={styles.degreeDisplay}>
        <Text style={styles.degreeText}>{Math.round(heading)}° Degree</Text>
      </View>

      {/* Compass dial overlay */}
      <View style={styles.compassContainer}>
        <Animated.Image
          source={require("../../assets/compass/dial.png")}
          style={[
            styles.compassDial,
            { width: dialSize, height: dialSize },
            { transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }) }] },
          ]}
          resizeMode="contain"
        />
        <Image
          source={require("../../assets/compass/needle.png")}
          style={[styles.compassNeedle, { width: needleSize, height: needleSize }]}
          resizeMode="contain"
        />
      </View>

      {/* Bottom left - Geo-Coordinate */}
      <View style={styles.bottomLeftInfo}>
        <Text style={styles.infoTitle}>Geo-Coordinate:</Text>
        <Text style={styles.infoText}>Latitude: {coords ? coords.lat.toFixed(7) : "—"}</Text>
        <Text style={styles.infoText}>Longitude: {coords ? coords.lon.toFixed(7) : "—"}</Text>
      </View>

      {/* Bottom right - Magnetic Field */}
      <View style={styles.bottomRightInfo}>
        <Text style={styles.infoTitle}>Magnetic Field:</Text>
        <Text style={styles.infoText}>Strength: {strength.toFixed(0)} µT</Text>
      </View>

      {/* Bottom controls */}
      <View style={styles.controls}>
        <Pressable style={styles.navBtn} onPress={() => router.push("/(tabs)")}>
          <MaterialIcons name="home" size={32} color="#4A9EFF" />
          <Text style={styles.navBtnText}>Home Page</Text>
        </Pressable>

        <Pressable style={styles.captureBtn} onPress={takePhoto}>
          <MaterialIcons name="camera" size={40} color="#4A9EFF" />
        </Pressable>

        <Pressable style={styles.navBtn} onPress={openLastCaptured}>
          <MaterialIcons name="photo-library" size={32} color="#4A9EFF" />
          <Text style={styles.navBtnText}>Last Captured</Text>
        </Pressable>
      </View>

      <Modal
        visible={drawerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDrawerOpen(false)}
      >
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawerContainer} onPress={(e) => e.stopPropagation()}>
            <ScrollView>
              <View style={styles.drawerHeader}>
                <Image
                  source={require("../../assets/compass/icon.png")}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                />
                <Text style={styles.drawerBrand}>sanskarvastu.com</Text>
                <Text style={styles.drawerVersion}>Version: 3.1.3</Text>
                <Text style={styles.drawerTitle}>Vastu Compass</Text>
              </View>

              <View style={styles.menuList}>
                <Pressable style={styles.menuItem}>
                  <Text style={styles.menuIcon}>ℹ️</Text>
                  <Text style={styles.menuText}>About AppliedVastu</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <Text style={styles.menuIcon}>💻</Text>
                  <Text style={styles.menuText}>Access Vastu Software</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <Text style={styles.menuIcon}>📱</Text>
                  <Text style={styles.menuText}>More Apps</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={shareApp}>
                  <Text style={styles.menuIcon}>🔗</Text>
                  <Text style={styles.menuText}>Share</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <Text style={styles.menuIcon}>✉️</Text>
                  <Text style={styles.menuText}>Send Feedback</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <Text style={styles.menuIcon}>⭐</Text>
                  <Text style={styles.menuText}>Review Us</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={openPermissionsManager}>
                  <Text style={styles.menuIcon}>🔒</Text>
                  <Text style={styles.menuText}>Manage Permissions</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={openUserGuide}>
                  <Text style={styles.menuIcon}>❓</Text>
                  <Text style={styles.menuText}>How to use Vastu Compass</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <Text style={styles.menuIcon}>🎓</Text>
                  <Text style={styles.menuText}>Join AppliedVastu Course</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={() => setDrawerOpen(false)}>
                  <Text style={styles.menuIcon}>←</Text>
                  <Text style={styles.menuText}>Back</Text>
                  <Text style={styles.menuArrow}></Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  
  topBar: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  topIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  searchText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  
  degreeDisplay: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    zIndex: 5,
  },
  degreeText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  
  compassContainer: {
    position: "absolute",
    top: "30%",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  compassDial: {
    opacity: 0.95,
  },
  compassNeedle: {
    position: "absolute",
  },
  
  bottomLeftInfo: {
    position: "absolute",
    bottom: 120,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 8,
  },
  bottomRightInfo: {
    position: "absolute",
    bottom: 120,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 8,
  },
  infoTitle: {
    color: "#FF4444",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  infoText: {
    color: "#FF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  
  controls: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  navBtn: {
    alignItems: "center",
    gap: 4,
  },
  navBtnText: {
    color: "#4A9EFF",
    fontSize: 12,
    fontWeight: "600",
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  previewControls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  previewBtn: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
  },
  previewBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  flipBtn: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
  },
  drawerContainer: {
    width: "70%",
    height: "100%",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  drawerHeader: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  drawerLogo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  drawerBrand: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 5,
  },
  drawerVersion: {
    fontSize: 13,
    color: "#888",
    marginBottom: 15,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  menuList: {
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuIcon: { fontSize: 24, color: "#000", fontWeight: "600", marginRight: 12 },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  menuArrow: {
    fontSize: 24,
    color: "#ccc",
  },
  
  cameraDialWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraDial: {
    opacity: 0.95,
  },
  cameraNeedle: {
    position: "absolute",
  },
  cameraOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cameraOverlayRow: {
    flexDirection: "row",
    gap: 6,
  },
  cameraOverlayLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  cameraOverlayValue: {
    color: "#fff",
    fontSize: 12,
  },
  
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 20, 
    backgroundColor: "#000" 
  },
  text: { 
    color: "#fff", 
    marginBottom: 12, 
    textAlign: "center" 
  },
  btn: { 
    backgroundColor: "#2b6cff", 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 10 
  },
  btnText: { 
    color: "#fff", 
    fontWeight: "800" 
  },
});
