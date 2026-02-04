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
  ScrollView,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 360;
  
  // Calculate responsive dial size based on available space
  const topBarHeight = 80; // Top bar + quick row
  const bottomNavHeight = 80;
  const availableHeight = height - insets.top - insets.bottom - topBarHeight - bottomNavHeight;
  const availableWidth = width - 32; // 16px padding on each side
  const maxDialSize = Math.min(availableWidth, availableHeight);
  const dialSize = Math.max(200, Math.min(maxDialSize * 0.85, 380));
  const dialWidth = dialSize;
  const dialHeight = dialSize;
  const needleSize = Math.round(dialSize * 0.68);
  const overlayDialSize = Math.min(width, height) * 0.65;
  const overlayNeedleSize = Math.round(overlayDialSize * 0.68);
  
  // Responsive font sizes
  const degreeFontSize = width < 360 ? 14 : width < 600 ? 16 : 18;
  const quickBtnWidth = width < 360 ? 90 : width < 600 ? 100 : 110;
  const infoBoxFontSize = width < 360 ? 12 : width < 600 ? 13 : 14;

  const [heading, setHeading] = useState(0);         // 0..360
  const [strength, setStrength] = useState(0);       // microTesla approx
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const openCamera = async (preferredFacing: CameraType = "back") => {
    try {
      const camGranted =
        camPerm?.granted ?? (await requestCamPerm()).granted;

      if (!camGranted) {
        Alert.alert("Permission required", "Camera permission is required to open the camera.");
        return;
      }

      // Navigate to camera screen instead of modal
      router.push("/(tabs)/camera");
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
      const url = `https://www.google.com/maps/@?api=1&map_action=map&center=${current.lat},${current.lon}&zoom=18&basemap=satellite`;
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Maps error", e?.message ?? "Failed to open maps");
    }
  };

  const openLastCaptured = async () => {
    try {
      let perm: boolean;
      try {
        perm = mediaPerm?.granted ?? (await requestMediaPerm()).granted;
      } catch (err) {
        Alert.alert(
          "Media permission error",
          "Media permission could not be requested. Please rebuild the app with updated Android permissions."
        );
        return;
      }
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
      setPreviewUri(uri);
      setPreviewModalOpen(true);
    } catch (e: any) {
      Alert.alert("Gallery error", e?.message ?? "Failed to open last captured photo");
    }
  };

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
    router.push({ pathname: "/", params: { openUserGuide: "1" } } as Href);
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

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      {/* Top bar (simple like screenshot) */}
      <View
        style={[
          styles.topBar,
          {
            paddingHorizontal: width < 360 ? 10 : 16,
            gap: width < 360 ? 8 : 12,
            paddingVertical: width < 360 ? 8 : 12,
            marginBottom: width < 360 ? 6 : 8,
          },
        ]}
      >
        <Pressable onPress={() => setDrawerOpen(true)}>
          <Text style={[styles.icon, { fontSize: width < 360 ? 18 : width < 600 ? 20 : 22 }]}>☰</Text>
        </Pressable>
        <View
          style={[
            styles.search,
            {
              height: width < 360 ? 36 : width < 600 ? 40 : 42,
              borderRadius: 8,
              paddingHorizontal: width < 360 ? 10 : 14,
            },
          ]}
        >
          <Text style={[styles.searchText, { fontSize: width < 360 ? 12 : 13 }]}>Search Location</Text>
        </View>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.icon, { fontSize: width < 360 ? 18 : width < 600 ? 20 : 22 }]}>←</Text>
        </Pressable>
      </View>

      {/* Shortcut icons row */}
      <View
        style={[
          styles.quickRow,
          isCompact && styles.quickRowCompact,
          {
            marginTop: width < 360 ? 8 : 12,
            paddingHorizontal: width < 360 ? 8 : 12,
            minHeight: width < 360 ? 60 : 70,
          },
        ]}
      >
        <Pressable style={[styles.quickBtn, { width: quickBtnWidth }]} onPress={openMap}>
          <Text style={[styles.quickCircle, { fontSize: width < 360 ? 24 : 30 }]}>📍</Text>
          <Text style={[styles.quickLabel, { fontSize: width < 360 ? 10 : 11 }]}>Google map</Text>
        </Pressable>

        <Text style={[styles.degreeTitle, { fontSize: degreeFontSize }]}>{headingText}</Text>

        <Pressable style={[styles.quickBtn, { width: quickBtnWidth }]} onPress={() => openCamera("back")}>
          <Text style={[styles.quickCircle, { fontSize: width < 360 ? 24 : 30 }]}>📷</Text>
          <Text style={[styles.quickLabel, { fontSize: width < 360 ? 10 : 11 }]}>Rear Camera</Text>
        </Pressable>
      </View>

      {/* Compass display */}
      <View style={styles.compassWrap}>
        {/* small pointer on top */}
        <Text style={[styles.topPointer, { fontSize: width < 360 ? 14 : 18 }]}>▼</Text>

        {/* Dial */}
        <Image
          source={require("../../assets/compass/dial.png")}
          style={[styles.dial, { width: dialWidth, height: dialHeight, borderRadius: dialSize / 2 }]}
          resizeMode="cover"
        />
        
        {/* Info below compass */}
        <View style={[styles.infoRowBelow, { bottom: Math.max(120, height * 0.22) }]}>
          <View style={styles.infoBoxBelow}>
            <Text style={[styles.infoTitle, { fontSize: width < 360 ? 13 : width < 600 ? 14 : 16 }]}>Geo-Coordinate:</Text>
            <Text style={[styles.infoValue, { fontSize: infoBoxFontSize }]}>
              Latitude: {coords ? coords.lat.toFixed(6) : "—"}
            </Text>
            <Text style={[styles.infoValue, { fontSize: infoBoxFontSize }]}>
              Longitude: {coords ? coords.lon.toFixed(6) : "—"}
            </Text>
          </View>

          <View style={styles.infoBoxBelow}>
            <Text style={[styles.infoTitle, { fontSize: width < 360 ? 13 : width < 600 ? 14 : 16 }]}>Magnetic Field:</Text>
            <Text style={[styles.infoValue, { fontSize: infoBoxFontSize }]}>
              Strength: <Text style={styles.red}>{strength.toFixed(0)} µT</Text>
            </Text>
          </View>
        </View>
      </View>

      <Modal visible={cameraOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraContainer}>
          {!camPerm?.granted ? (
            <View style={styles.cameraPermission}>
              <Text style={styles.permissionText}>Camera permission is required.</Text>
              <Pressable style={styles.camBtn} onPress={requestCamPerm}>
                <Text style={styles.camBtnText}>Grant Permission</Text>
              </Pressable>
            </View>
          ) : previewUri ? (
            <>
              <Image source={{ uri: previewUri }} style={styles.previewImage} />
              <View
                style={[
                  styles.cameraDialWrap,
                  {
                    transform: [
                      { translateX: -overlayDialSize / 2 },
                      { translateY: -overlayDialSize / 2 },
                    ],
                  },
                ]}
              >
                <Image
                  source={require("../../assets/compass/dial.png")}
                  style={[styles.cameraDial, { width: overlayDialSize, height: overlayDialSize }]}
                  resizeMode="contain"
                />
                <Animated.Image
                  source={require("../../assets/compass/needle.png")}
                  style={[
                    styles.cameraNeedle,
                    {
                      width: overlayNeedleSize,
                      height: overlayNeedleSize,
                      transform: [{ rotate: needleRotate }],
                    },
                  ]}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.cameraOverlay}>
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
              <View style={styles.cameraControls}>
                <Pressable style={styles.camBtn} onPress={() => setPreviewUri(null)}>
                  <Text style={styles.camBtnText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.camBtn} onPress={savePreviewPhoto}>
                  <Text style={styles.camBtnText}>Save</Text>
                </Pressable>
                <Pressable style={styles.camBtn} onPress={sharePreviewPhoto}>
                  <Text style={styles.camBtnText}>Share</Text>
                </Pressable>
                <Pressable style={styles.camBtn} onPress={openLastCaptured}>
                  <Text style={styles.camBtnText}>Last Captured</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
              <View
                style={[
                  styles.cameraDialWrap,
                  {
                    transform: [
                      { translateX: -overlayDialSize / 2 },
                      { translateY: -overlayDialSize / 2 },
                    ],
                  },
                ]}
              >
                <Image
                  source={require("../../assets/compass/dial.png")}
                  style={[styles.cameraDial, { width: overlayDialSize, height: overlayDialSize }]}
                  resizeMode="contain"
                />
                <Animated.Image
                  source={require("../../assets/compass/needle.png")}
                  style={[
                    styles.cameraNeedle,
                    {
                      width: overlayNeedleSize,
                      height: overlayNeedleSize,
                      transform: [{ rotate: needleRotate }],
                    },
                  ]}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.cameraOverlay}>
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
                <Pressable style={styles.camBtn} onPress={openLastCaptured}>
                  <Text style={styles.camBtnText}>Last Captured</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>

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

      {/* Preview Modal for Last Captured Photo */}
      <Modal visible={previewModalOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setPreviewModalOpen(false)}>
        <SafeAreaView style={styles.previewContainer}>
          {/* Top bar */}
          <View style={[styles.topBar, { paddingHorizontal: 16, gap: 12, paddingVertical: 12, marginBottom: 8 }]}>
            <Pressable onPress={() => setDrawerOpen(true)}>
              <Text style={[styles.icon, { fontSize: 22 }]}>☰</Text>
            </Pressable>
            <View style={[styles.search, { height: 42, borderRadius: 8, paddingHorizontal: 14 }]}>
              <Text style={[styles.searchText, { fontSize: 13 }]}>Search Location</Text>
            </View>
            <Pressable onPress={() => setPreviewModalOpen(false)}>
              <Text style={[styles.icon, { fontSize: 22 }]}>←</Text>
            </Pressable>
          </View>

          {/* Preview Image */}
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} />}

          {/* Compass dial overlay on preview */}
          <View
            style={[
              styles.cameraDialWrap,
              {
                transform: [
                  { translateX: -overlayDialSize / 2 },
                  { translateY: -overlayDialSize / 2 },
                ],
              },
            ]}
          >
            <Image
              source={require("../../assets/compass/dial.png")}
              style={[styles.cameraDial, { width: overlayDialSize, height: overlayDialSize }]}
              resizeMode="contain"
            />
            <Animated.Image
              source={require("../../assets/compass/needle.png")}
              style={[
                styles.cameraNeedle,
                {
                  width: overlayNeedleSize,
                  height: overlayNeedleSize,
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

          {/* Bottom Controls */}
          <View style={styles.previewControls}>
            <Pressable style={styles.previewBtn} onPress={() => setPreviewUri(null)}>
              <Text style={styles.previewBtnText}>↶</Text>
              <Text style={styles.previewBtnLabel}>Retake</Text>
            </Pressable>

            <Pressable style={styles.previewBtn} onPress={savePreviewPhoto}>
              <Text style={styles.previewBtnText}>💾</Text>
              <Text style={styles.previewBtnLabel}>Save</Text>
            </Pressable>

            <Pressable style={styles.previewBtn} onPress={sharePreviewPhoto}>
              <Text style={styles.previewBtnText}>🔗</Text>
              <Text style={styles.previewBtnLabel}>Share</Text>
            </Pressable>
          </View>

          {/* Drawer Menu Modal */}
          <Modal visible={drawerOpen} animationType="slide" transparent onRequestClose={() => setDrawerOpen(false)}>
            <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
              <Pressable style={styles.drawerContainer} onPress={(e) => e.stopPropagation()}>
                <ScrollView>
                  <View style={styles.drawerHeader}>
                    <Image source={require("../../assets/compass/icon.png")} style={styles.drawerLogo} resizeMode="contain" />
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
        </SafeAreaView>
      </Modal>

      {/* Bottom nav mock */}
      <View style={[styles.bottomNav, { paddingBottom: 14 + insets.bottom }]}>
        <Pressable style={styles.navItem} onPress={() => router.push("/")}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Home Page</Text>
        </Pressable>

        <Pressable style={styles.captureBtn} onPress={() => openCamera("back")}>
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
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12, zIndex: 1 },
  icon: { fontSize: 22 },
  search: { flex: 1, height: 42, borderRadius: 10, backgroundColor: "#e9e9e9", justifyContent: "center", paddingHorizontal: 14 },
  searchText: { color: "#888" },

  quickRow: { marginTop: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", zIndex: 1, minHeight: 70 },
  quickRowCompact: { justifyContent: "space-around" },
  quickBtn: { alignItems: "center" },
  quickCircle: { fontSize: 30 },
  quickLabel: { marginTop: 4, fontWeight: "600", fontSize: 11 },
  degreeTitle: { fontWeight: "800" },

  compassWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 0 },
  topPointer: { fontSize: 18, color: "#1e90ff", marginBottom: 6 },
  dial: { overflow: "hidden" },
  needle: { position: "absolute" },
  
  infoRowBelow: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  infoBoxBelow: { flex: 1, backgroundColor: "transparent", padding: 0, borderRadius: 0 },

  infoRow: { marginTop: 18, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", gap: 10, zIndex: 1 },
  infoRowCompact: { flexDirection: "column" },
  infoBox: { flex: 1 },
  infoTitle: { fontWeight: "800" },
  infoValue: { marginTop: 4, color: "#333" },
  red: { color: "red", fontWeight: "800" },

  bottomNav: { marginTop: "auto", paddingVertical: 14, borderTopWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-around", alignItems: "center", zIndex: 1 },
  navItem: { alignItems: "center", flex: 1 },
  navIcon: { fontSize: 22 },
  navLabel: { marginTop: 4, color: "#2b6cff", fontWeight: "700" },
  captureBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", borderWidth: 2, borderColor: "#dbe7ff", alignItems: "center", justifyContent: "center" },
  captureIcon: { fontSize: 22, color: "#2b6cff", fontWeight: "900" },

  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  previewImage: { flex: 1, resizeMode: "cover" },
  cameraDialWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraDial: { opacity: 0.95 },
  cameraNeedle: { position: "absolute" },
  cameraOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cameraOverlayRow: { flexDirection: "row", gap: 6 },
  cameraOverlayLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cameraOverlayValue: { color: "#fff", fontSize: 12 },
  cameraControls: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: 16, backgroundColor: "#000" },
  camBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#1f2937", borderRadius: 8 },
  camBtnText: { color: "#fff", fontWeight: "600" },
  capture: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", borderWidth: 4, borderColor: "#d1d5db" },

  cameraPermission: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  permissionText: { color: "#fff", fontSize: 16 },

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

  previewContainer: { flex: 1, backgroundColor: "#000" },
  previewControls: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: 16, backgroundColor: "#000", borderTopWidth: 1, borderTopColor: "#333" },
  previewBtn: { alignItems: "center", paddingVertical: 12, paddingHorizontal: 20, backgroundColor: "#1f2937", borderRadius: 8 },
  previewBtnText: { fontSize: 24, marginBottom: 6 },
  previewBtnLabel: { fontSize: 12, fontWeight: "600", color: "#fff" },
});
