import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Alert, Image, Animated, useWindowDimensions, Linking, Modal, ScrollView, Share, Platform } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import { Href, router, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { getCompassAssets } from "../../utils/compassAssets";
import { styles } from "../../styles/camera.styles";

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
  const { type } = useLocalSearchParams<{ type?: string }>();
  const cameraRef = useRef<CameraView>(null);
  const previewShotRef = useRef<ViewShot>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const assets = getCompassAssets(type);

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [mediaPerm, setMediaPerm] = useState<MediaLibrary.PermissionResponse | null>(null);
  const isExpoGoAndroid = Platform.OS === "android" && Constants.appOwnership === "expo";
  
  const [heading, setHeading] = useState(0);
  const [strength, setStrength] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [capturedHeading, setCapturedHeading] = useState<number | null>(null);
  const [capturedStrength, setCapturedStrength] = useState<number | null>(null);
  const [capturedCoords, setCapturedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const prevHeadingRef = useRef(0);
  
  const dialSize = Math.max(200, Math.min(Math.min(width, height) * 0.92, 420));
  const needleSize = Math.round(dialSize * 0.68);

  // Create interpolated rotation string for animated value
  const needleRotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const requestMediaPerm = async () => {
    if (isExpoGoAndroid) {
      const denied = {
        status: "denied",
        granted: false,
        canAskAgain: false,
        expires: "never",
      } as MediaLibrary.PermissionResponse;
      setMediaPerm(denied);
      return denied;
    }

    try {
      const result = await MediaLibrary.requestPermissionsAsync();
      setMediaPerm(result);
      return result;
    } catch (e: any) {
      console.log("Media permission request failed:", e?.message ?? "Unknown error");
      const denied = {
        status: "denied",
        granted: false,
        canAskAgain: false,
        expires: "never",
      } as MediaLibrary.PermissionResponse;
      setMediaPerm(denied);
      return denied;
    }
  };

  const capturePreviewWithOverlay = async () => {
    if (!previewShotRef.current?.capture) {
      console.warn("ViewShot capture not available, returning raw image");
      return previewUri;
    }
    
    try {
      // Add a small delay to ensure rendering
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const uri = await previewShotRef.current.capture();
      if (uri) {
        console.log("✅ Successfully captured overlay image:", uri);
        return uri;
      }
    } catch (e: any) {
      console.warn("❌ ViewShot capture failed:", e?.message || e);
      console.warn("Stack:", e?.stack);
    }
    
    // Fallback to raw image
    console.warn("⚠️ Falling back to raw preview image");
    return previewUri;
  };

  useEffect(() => {
    const requestPermissions = async () => {
      try {
        if (camPerm && !camPerm.granted) {
          await requestCamPerm();
        }
      } catch (e: any) {
        console.log("Permission request skipped:", e?.message ?? "Unknown error");
      }
    };
    requestPermissions();
  }, [camPerm?.granted, requestCamPerm]);

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
      const finalUri = await capturePreviewWithOverlay();
      if (!finalUri) {
        Alert.alert("Save Error", "Unable to capture the overlaid image. Please try again.");
        return;
      }

      console.log("Starting save with URI:", previewUri);

      // Try to save directly without requesting permission first
      try {
        console.log("Attempting to create asset from URI");
        
        // Create the asset - this saves to the gallery
        const asset = await MediaLibrary.createAssetAsync(finalUri);
        console.log("Asset created successfully:", asset.id);
        
        // Try to add to Camera album, but don't fail if it doesn't work
        // Skip album operations in Expo Go on Android - not supported
        if (!isExpoGoAndroid) {
          try {
            console.log("[CAMERA] 📁 Adding photo to Camera album...");
            const album = await MediaLibrary.getAlbumAsync("Camera");
            if (album) {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
              console.log("[CAMERA] ✅ Photo added to Camera album");
            } else {
              await MediaLibrary.createAlbumAsync("Camera", asset, false);
              console.log("[CAMERA] ✅ Camera album created with photo");
            }
          } catch (albumErr: any) {
            console.log("[CAMERA] ⚠️ Album operation failed:", albumErr?.message ?? "Unknown error");
            // Silently ignore - asset is already saved to gallery
          }
        } else {
          console.log("[CAMERA] ℹ️ Album operation skipped: Expo Go limitation");
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
              const asset = await MediaLibrary.createAssetAsync(finalUri);
              console.log("Asset created successfully after permission:", asset.id);
              
              // Skip album operations in Expo Go on Android
              if (!isExpoGoAndroid) {
                try {
                  console.log("[CAMERA] 📁 Adding photo to Camera album...");
                  const album = await MediaLibrary.getAlbumAsync("Camera");
                  if (album) {
                    await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                    console.log("[CAMERA] ✅ Photo added to Camera album");
                  } else {
                    await MediaLibrary.createAlbumAsync("Camera", asset, false);
                    console.log("[CAMERA] ✅ Camera album created with photo");
                  }
                } catch (albumErr: any) {
                  console.log("[CAMERA] ⚠️ Album operation failed:", albumErr?.message ?? "Unknown error");
                  // Silently ignore - asset is already saved to gallery
                }
              } else {
                console.log("[CAMERA] ℹ️ Album operation skipped: Expo Go limitation");
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
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Share unavailable", "Sharing is not available on this device.");
        return;
      }
      const finalUri = await capturePreviewWithOverlay();
      if (!finalUri) {
        Alert.alert("Share Error", "Unable to capture the overlaid image. Please try again.");
        return;
      }
      await Sharing.shareAsync(finalUri, {
        mimeType: "image/jpeg",
        dialogTitle: "Share Compass Photo",
      });
    } catch (e: any) {
      Alert.alert("Share error", e?.message ?? "Failed to share photo");
    }
  };

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) return;

      setCapturedHeading(heading);
      setCapturedStrength(strength);
      setCapturedCoords(coords ? { ...coords } : null);

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
      try {
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
      } catch (albumErr: any) {
        console.log("Could not access media library:", albumErr?.message);
        Alert.alert("Error", "Unable to access gallery. This feature requires a development build.");
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
    const previewHeading = capturedHeading ?? heading;
    const previewStrength = capturedStrength ?? strength;
    const previewCoords = capturedCoords ?? coords;
    const previewNeedleRotate = `${-previewHeading}deg`;

    return (
      <View style={styles.container}>
        <ViewShot
          ref={previewShotRef}
          options={{ format: "jpg", quality: 0.9 }}
          style={styles.previewShot}
        >
          <View style={styles.previewShotInner}>
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
                source={assets.dial}
                style={[
                  styles.cameraDial,
                  {
                    width: dialSize,
                    height: dialSize,
                    transform: [
                      { translateX: assets.dialOffset.x },
                      { translateY: assets.dialOffset.y },
                      { scale: assets.dialScale },
                    ],
                  },
                ]}
                resizeMode="contain"
              />
              <Image
                source={assets.needle}
                style={[
                  styles.cameraNeedle,
                  {
                    width: needleSize,
                    height: needleSize,
                    transform: [{ rotate: previewNeedleRotate }],
                  },
                ]}
                resizeMode="contain"
              />
            </View>

            {/* Magnetic field and coordinates overlay */}
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraOverlayRow}>
                <Text style={styles.cameraOverlayLabel}>Degree:</Text>
                <Text style={styles.cameraOverlayValue}>{Math.round(previewHeading)}°</Text>
              </View>
              <View style={styles.cameraOverlayRow}>
                <Text style={styles.cameraOverlayLabel}>Lat:</Text>
                <Text style={styles.cameraOverlayValue}>{previewCoords ? previewCoords.lat.toFixed(6) : "—"}</Text>
              </View>
              <View style={styles.cameraOverlayRow}>
                <Text style={styles.cameraOverlayLabel}>Lon:</Text>
                <Text style={styles.cameraOverlayValue}>{previewCoords ? previewCoords.lon.toFixed(6) : "—"}</Text>
              </View>
              <View style={styles.cameraOverlayRow}>
                <Text style={styles.cameraOverlayLabel}>Mag:</Text>
                <Text style={styles.cameraOverlayValue}>{previewStrength.toFixed(0)} µT</Text>
              </View>
            </View>
          </View>
        </ViewShot>

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
                    source={assets.icon}
                    style={styles.drawerLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.drawerBrand}>sanskarvastu.com</Text>
                  <Text style={styles.drawerVersion}>Version: 3.1.3</Text>
                  <Text style={styles.drawerTitle}>Vastu Compass</Text>
                </View>
                <View style={styles.menuList}>
                  <Pressable style={styles.menuItem}>
                    <MaterialIcons name="info-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                    <Text style={styles.menuText}>About AppliedVastu</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <MaterialIcons name="computer" size={24} color="#0f172a" style={styles.menuIconStyle} />
                    <Text style={styles.menuText}>Access Vastu Software</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <MaterialIcons name="smartphone" size={24} color="#0f172a" style={styles.menuIconStyle} />
                    <Text style={styles.menuText}>More Apps</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={shareApp}>
                    <MaterialIcons name="share" size={24} color="#0f172a" style={styles.menuIconStyle} />
                    <Text style={styles.menuText}>Share</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <MaterialIcons name="mail-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                    <Text style={styles.menuText}>Send Feedback</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <MaterialIcons name="star-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                    <Text style={styles.menuText}>Review Us</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={openPermissionsManager}>
                    <MaterialIcons name="lock-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                    <Text style={styles.menuText}>Manage Permissions</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={openUserGuide}>
                    <MaterialIcons name="help-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                    <Text style={styles.menuText}>How to use Vastu Compass</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem}>
                    <MaterialIcons name="school" size={24} color="#0f172a" style={styles.menuIconStyle} />
                    <Text style={styles.menuText}>Join AppliedVastu Course</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={() => setDrawerOpen(false)}>
                    <MaterialIcons name="arrow-back" size={24} color="#0f172a" style={styles.menuIconStyle} />
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

      {/* Top Header with Menu, Search, and Location */}
      <View style={styles.topHeader}>
        <Pressable onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
          <MaterialIcons name="menu" size={24} color="#fff" />
        </Pressable>
        
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.searchText}>
            {coords ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : "Locating..."}
          </Text>
        </View>

        <Pressable style={styles.locationBtn} onPress={openMap}>
          <MaterialIcons name="location-on" size={24} color="#FF4444" />
        </Pressable>
      </View>

      {/* Flip button - moved away from top bar */}
      <Pressable
        style={styles.flipBtn}
        onPress={() => setFacing((p) => (p === "back" ? "front" : "back"))}
      >
        <MaterialCommunityIcons name="camera-flip" size={28} color="#fff" />
      </Pressable>

      {/* Compass dial overlay */}
      <View style={[styles.compassContainer, { transform: [{ translateY: -dialSize / 2 }] }]}>
        <Animated.Image
          source={assets.dial}
          style={[
            styles.compassDial,
            { width: dialSize, height: dialSize },
            {
              transform: [
                { translateX: assets.dialOffset.x },
                { translateY: assets.dialOffset.y },
                { scale: assets.dialScale },
                { rotate: rotateAnim.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }) },
              ],
            },
          ]}
          resizeMode="contain"
        />
        <Animated.Image
          source={assets.needle}
          style={[
            styles.compassNeedle,
            {
              width: needleSize,
              height: needleSize,
              transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }) }],
            },
          ]}
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
                  source={assets.icon}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                />
                <Text style={styles.drawerBrand}>sanskarvastu.com</Text>
                <Text style={styles.drawerVersion}>Version: 3.1.3</Text>
                <Text style={styles.drawerTitle}>Vastu Compass</Text>
              </View>

              <View style={styles.menuList}>
                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="info-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>About AppliedVastu</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="computer" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Access Vastu Software</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="smartphone" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>More Apps</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={shareApp}>
                  <MaterialIcons name="share" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Share</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="mail-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Send Feedback</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="star-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Review Us</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={openPermissionsManager}>
                  <MaterialIcons name="lock-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Manage Permissions</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={openUserGuide}>
                  <MaterialIcons name="help-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>How to use Vastu Compass</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="school" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Join AppliedVastu Course</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={() => setDrawerOpen(false)}>
                  <MaterialIcons name="arrow-back" size={24} color="#0f172a" style={styles.menuIconStyle} />
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


