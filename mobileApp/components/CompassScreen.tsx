import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  Modal,
  Alert,
  Linking,
  useWindowDimensions,
  ScrollView,
  Platform,
  ImageSourcePropType,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, type LatLng, type Region } from "react-native-maps";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import { Href, router } from "expo-router";
import Constants from "expo-constants";
import { getCompassAssets, type CompassType } from "../utils/compassAssets";
import { MaterialIcons } from "@expo/vector-icons";
import { styles } from "../styles/CompassScreen.styles";
import useAdvancedCompass from "../hooks/useAdvancedCompass";
import { degreeToDirection16, degreeToDirection8 } from "../utils/direction";
import {
  requestMediaLibraryPermission,
  getMediaLibraryPermissionStatus,
  requestLocationPermission,
} from "../utils/permissionHandler";

type Props = {
  type: CompassType;
};

// zone16-specific compass assets - no longer used, replaced with single dial
// Keeping references for backwards compatibility
const zone16StepImages: ImageSourcePropType[] = [];

const zone16DirectionNames = [];

export default function CompassScreen({ type }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 360;
  const assets = getCompassAssets(type);
  const isInlineMap = true; // Enable map for all compass types
  
  // Calculate responsive dial size based on available space
  const topBarHeight = 0;
  const bottomNavHeight = 80;
  const baseAvailableHeight = height - insets.top - insets.bottom - topBarHeight - bottomNavHeight;
  const zone16ReservedVerticalSpace = 220;
  const zone16AvailableHeight = height - insets.top - insets.bottom - zone16ReservedVerticalSpace;
  const availableHeight = type === "zone16" ? zone16AvailableHeight : baseAvailableHeight;
  const dialHorizontalPadding = width < 360 ? 6 : 10;
  const availableWidth = width - dialHorizontalPadding * 2;
  const dialSize =
    type === "zone16"
      ? Math.max(200, Math.min(availableWidth, availableHeight))
      : Math.max(220, Math.min(availableWidth, availableHeight * 0.98));
  const dialWidth = dialSize;
  const dialHeight = dialSize;
  const needleSize = Math.round(dialSize * 0.68);
  const overlayDialSize = Math.min(width, height) * 0.65;
  const overlayNeedleSize = Math.round(overlayDialSize * 0.68);
  
  // Responsive font sizes
  const degreeFontSize = width < 360 ? 14 : width < 600 ? 16 : 18;
  const quickBtnWidth = width < 360 ? 90 : width < 600 ? 100 : 110;
  const infoBoxFontSize = width < 360 ? 12 : width < 600 ? 13 : 14;

  const heading = useAdvancedCompass();             // 0..360 - uses gyroscope + accelerometer + magnetometer
  const [strength, setStrength] = useState(0);       // microTesla approx
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [mapVisible, setMapVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [drawPath, setDrawPath] = useState<LatLng[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const previewShotRef = useRef<ViewShot>(null);
  const mapShotRef = useRef<ViewShot>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [mediaPerm, setMediaPerm] = useState<MediaLibrary.PermissionResponse | null>(null);
  const isExpoGoAndroid = Platform.OS === "android" && Constants.appOwnership === "expo";
  const [selectedZoneStep, setSelectedZoneStep] = useState<number | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const appVersion = Constants.expoConfig?.version ?? (Constants as any)?.manifest?.version ?? "1.0.0";
  const hasGoogleMapsApiKey = Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey);

  // Animated rotation (degrees)
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Reset map state when component mounts
  useEffect(() => {
    setMapVisible(false);
    setDrawEnabled(false);
    setDrawPath([]);
  }, []);

  const requestMediaPerm = async () => {
    try {
      const status = await getMediaLibraryPermissionStatus();
      if (status) {
        setMediaPerm(status);
        return status;
      }
      
      const result = await requestMediaLibraryPermission();
      const permResponse: MediaLibrary.PermissionResponse = {
        status: result.granted ? "granted" : "denied",
        granted: result.granted,
        canAskAgain: result.canAskAgain,
        expires: "never",
      } as MediaLibrary.PermissionResponse;
      
      setMediaPerm(permResponse);
      return permResponse;
    } catch (e: any) {
      console.error("[Permission Error] Media permission request failed:", e?.message ?? "Unknown error");
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

  useEffect(() => {
    let locSub: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const permissionResponse = await requestLocationPermission();
        if (permissionResponse.granted) {
          locSub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
            (pos) => {
              setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
            }
          ).catch((error) => {
            console.warn("[Location Error] Watch position failed:", error?.message ?? "Unknown error");
            return null;
          });
        } else {
          console.log("Location permission not granted");
        }
      } catch (e: any) {
        console.error("[Permission Error] Location setup failed:", e?.message ?? "Unknown error");
      }
    })();

    return () => {
      try {
        locSub?.remove();
      } catch (e: any) {
        console.warn("[Location Error] Failed to remove location subscription:", e?.message ?? "Unknown error");
      }
    };
  }, []);

  useEffect(() => {
    Magnetometer.setUpdateInterval(50);

    const sub = Magnetometer.addListener((data) => {
      if (!data || typeof data.x !== "number" || typeof data.y !== "number" || typeof data.z !== "number") return;

      // field strength magnitude (approx, units depend on platform; expo usually close to µT)
      const mag = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
      setStrength(mag);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: heading,
      duration: 70,
      useNativeDriver: false,
    }).start();
  }, [heading, rotateAnim]);

  const headingText = useMemo(() => {
    const deg = Math.round(heading);
    const direction = type === "normal" || type === "zone16"
      ? degreeToDirection8(heading)
      : degreeToDirection16(heading);
    return `${deg}° · ${direction}`;
  }, [heading, type]);
  const showInlineMap = isInlineMap && mapVisible && hasGoogleMapsApiKey;
  const mapControlsTop = Math.max(insets.top + 80, 120);
  const zoneTouchSize = useMemo(() => Math.max(26, Math.round(dialSize * 0.14)), [dialSize]);
  const zoneTouchRadius = useMemo(() => (dialSize / 2) - (zoneTouchSize * 0.85), [dialSize, zoneTouchSize]);

  const needleRotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });
  const dialRotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "-360deg"],
  });

  useEffect(() => {
    if (!coords || !isInlineMap) return;
    if (!mapRegion) {
      setMapRegion({
        latitude: coords.lat,
        longitude: coords.lon,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }
  }, [coords, isInlineMap, mapRegion]);

  const openCamera = async (preferredFacing: CameraType = "back") => {
    try {
      const camGranted =
        camPerm?.granted ?? (await requestCamPerm()).granted;

      if (!camGranted) {
        Alert.alert("Permission required", "Camera permission is required to open the camera.");
        return;
      }

      // Navigate to camera screen instead of modal
      router.push({ pathname: "/(tabs)/camera", params: { type } } as Href);
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to open camera");
    }
  };

  const openMap = async () => {
    console.log("[COMPASS] 🗺️ Toggle Map");
    try {
      let current = coords;
      if (!current) {
        console.log("[COMPASS] 📍 No location available, requesting permission");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("[COMPASS] ❌ Location permission denied");
          Alert.alert("Permission required", "Location permission is required to open maps.");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(current);
      }
      if (!hasGoogleMapsApiKey) {
        const query = current ? `${current.lat},${current.lon}` : "";
        const url = query
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
          : "https://www.google.com/maps";
        await Linking.openURL(url);
        console.log("[COMPASS] ✅ Opened external Google Maps");
        return;
      }

      setMapVisible((prev) => !prev);
      console.log("[COMPASS] ✅ Inline map toggled");
    } catch (e: any) {
      Alert.alert("Maps error", e?.message ?? "Failed to toggle map");
    }
  };

  const searchLocation = async () => {
    const query = locationQuery.trim();
    if (!query) {
      Alert.alert("Search required", "Enter a location in the search bar.");
      return;
    }

    try {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Search error", e?.message ?? "Failed to open search");
    }
  };

  const openMapWithFallback = async () => {
    await openMap();
  };

  const openLastCaptured = async () => {
    console.log("[COMPASS] 🖼️ View Last Photo button clicked");
    try {
      let perm: boolean;
      try {
        perm = mediaPerm?.granted ?? (await requestMediaPerm()).granted;
      } catch (err) {
        console.error("[COMPASS] ❌ Media permission request failed");
        Alert.alert(
          "Media permission error",
          "Media permission could not be requested. Please rebuild the app with updated Android permissions."
        );
        return;
      }
      if (!perm) {
        console.log("[COMPASS] ❌ Media permission denied");
        Alert.alert("Permission required", "Media library permission is required.");
        return;
      }
      console.log("[COMPASS] ✅ Media permission granted, fetching last photo");
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
    console.log("[COMPASS] 💾 Save Photo button clicked");
    try {
      if (!previewUri) {
        console.log("[COMPASS] ❌ No photo URI available");
        Alert.alert("Error", "No photo to save");
        return;
      }

      console.log("[COMPASS] 📸 Photo URI to save:", previewUri);

      const addToCameraAlbumIfPossible = async (asset: MediaLibrary.Asset) => {
        // Skip album operations in Expo Go on Android - not supported
        if (isExpoGoAndroid) {
          console.log("[COMPASS] ℹ️ Album operation skipped: Expo Go limitation");
          return;
        }
        
        try {
          const granted = mediaPerm?.granted ?? (await requestMediaPerm()).granted;
          if (!granted) {
            console.log("[COMPASS] ℹ️ Album operation skipped: No media permission");
            return;
          }
          console.log("[COMPASS] 📁 Adding photo to Camera album...");
          const album = await MediaLibrary.getAlbumAsync("Camera");
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            console.log("[COMPASS] ✅ Photo added to Camera album");
          } else {
            await MediaLibrary.createAlbumAsync("Camera", asset, false);
            console.log("[COMPASS] ✅ Camera album created with photo");
          }
        } catch (albumErr: any) {
          console.log("[COMPASS] ⚠️ Album operation failed:", albumErr?.message ?? "Unknown error");
          // Silently ignore - asset is already saved to gallery
        }
      };

      console.log("Starting save process...");
      let finalImageUri = previewUri;

      // Capture the preview with all overlays (dial + geo + magnetic field)
      try {
        console.log("[COMPASS] 📸 Attempting to capture preview with overlays...");
        // Add a small delay to ensure rendering
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          const capturedWithOverlays = await previewShotRef.current?.capture?.();
          
          if (capturedWithOverlays) {
            console.log("[COMPASS] ✅ Captured overlaid preview:", capturedWithOverlays);
            finalImageUri = capturedWithOverlays;
          } else {
            console.warn("[COMPASS] ⚠️ ViewShot returned null, using raw image");
          }
        } catch (captureErr: any) {
          console.warn("[COMPASS] ⚠️ ViewShot capture failed:", captureErr?.message);
          console.warn("Stack:", captureErr?.stack);
          console.warn("[COMPASS] Using raw image as fallback");
        }
      } catch (e: any) {
        console.warn("[COMPASS] ⚠️ Error in capture block:", e?.message, "Using raw image");
      }

      console.log("[COMPASS] 📁 Final image URI to save:", finalImageUri);

      // Try to save directly without requesting permission first
      try {
        console.log("Attempting to create asset from URI");
        
        // Create the asset - this saves to the gallery
        const asset = await MediaLibrary.createAssetAsync(finalImageUri);
        console.log("Asset created successfully:", asset.id);
        
        // Try to add to Camera album, but don't fail if it doesn't work
        await addToCameraAlbumIfPossible(asset);

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
              const asset = await MediaLibrary.createAssetAsync(finalImageUri);
              console.log("Asset created successfully after permission:", asset.id);
              
              await addToCameraAlbumIfPossible(asset);
              
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
    console.log("[COMPASS] 📤 Share Photo button clicked");
    try {
      if (!previewUri) {
        console.log("[COMPASS] ❌ No photo to share");
        Alert.alert("Error", "No photo to share");
        return;
      }

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.log("[COMPASS] ❌ Sharing not available on this device");
        Alert.alert("Error", "Sharing is not available on this device");
        return;
      }

      console.log("[COMPASS] 📸 Capturing preview with overlays for sharing...");
      let shareUri = previewUri;

      // Capture the preview with all overlays
      try {
        // Add delay to ensure rendering
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const capturedWithOverlays = await previewShotRef.current?.capture?.();
        if (capturedWithOverlays) {
          console.log("[COMPASS] ✅ Captured overlaid preview for sharing:", capturedWithOverlays);
          shareUri = capturedWithOverlays;
        } else {
          console.warn("[COMPASS] ⚠️ ViewShot returned null for sharing, using raw image");
        }
      } catch (captureErr: any) {
        console.warn("[COMPASS] ⚠️ ViewShot capture failed for sharing:", captureErr?.message);
        console.warn("Stack:", captureErr?.stack);
        console.warn("[COMPASS] Sharing raw image as fallback");
      }

      console.log("[COMPASS] 📤 Opening share dialog with image:", shareUri);
      await Sharing.shareAsync(shareUri, {
        mimeType: "image/jpeg",
        dialogTitle: "Share Compass Photo",
      });
      console.log("[COMPASS] ✅ Share completed successfully");
    } catch (e: any) {
      console.error("[COMPASS] ❌ Share error:", e?.message);
      Alert.alert("Share Error", e?.message ?? "Failed to share photo");
    }
  };

  const shareApp = async () => {
    console.log("[COMPASS] 📤 Share App button clicked");
    try {
      await Sharing.shareAsync("Try Sanskar Compass: https://sanskarvastu.com");
      console.log("[COMPASS] ✅ Share dialog opened");
    } catch (e: any) {
      console.log("[COMPASS] ❌ Share cancelled or failed:", e?.message);
    }
  };

  const openPermissionsManager = () => {
    console.log("[COMPASS] ⚙️ Open Settings button clicked");
    Linking.openSettings();
  };

  const openUserGuide = () => {
    console.log("[COMPASS] 📖 Open User Guide button clicked");
    router.push({ pathname: "/", params: { openUserGuide: "1" } } as Href);
  };

  const takePhoto = async () => {
    console.log("[COMPASS] 📷 Take Photo button clicked");
    try {
      if (!cameraRef.current) {
        console.log("[COMPASS] ❌ Camera ref not available");
        return;
      }

      console.log("[COMPASS] 📸 Capturing photo...");
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });

      console.log("[COMPASS] ✅ Photo captured:", photo.uri);
      setPreviewUri(photo.uri);
    } catch (e: any) {
      console.error("[COMPASS] ❌ Camera error:", e?.message);
      Alert.alert("Camera error", e?.message ?? "Failed to take photo");
    }
  };

  const captureMapDrawing = async () => {
    console.log("[COMPASS] 🗺️ Capture Map Drawing button clicked");
    try {
      if (!mapShotRef.current) {
        console.log("[COMPASS] ❌ Map ref not available");
        Alert.alert("Error", "Unable to capture map. Please try again.");
        return;
      }

      console.log("[COMPASS] 📸 Capturing map with drawings...");
      const mapImage = await mapShotRef.current.capture?.();

      if (!mapImage) {
        console.log("[COMPASS] ❌ Map capture returned null");
        Alert.alert("Capture Error", "Failed to capture map. Please try again.");
        return;
      }

      console.log("[COMPASS] ✅ Map drawing captured:", mapImage);
      setPreviewUri(mapImage);
      Alert.alert("✅ Captured", "Map drawing captured successfully! You can now save or share it.", [
        { text: "Save", onPress: savePreviewPhoto },
        { text: "Share", onPress: sharePreviewPhoto },
        { text: "Close", onPress: () => {} },
      ]);
    } catch (e: any) {
      console.error("[COMPASS] ❌ Map capture error:", e?.message);
      Alert.alert("Capture Error", e?.message ?? "Failed to capture map");
    }
  };

  const centerButtonAction = async () => {
    // If map is visible, capture the drawn map; otherwise open camera
    if (showInlineMap) {
      await captureMapDrawing();
    } else {
      await openCamera("back");
    }
  };

  return (
    <SafeAreaView style={[styles.container]} edges={['top']}>
      {/* Top Header: menu + search + location */}
      <View style={[styles.topHeader, showInlineMap && styles.topHeaderCompact]}>
        <Pressable style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>
          <MaterialIcons name="menu" size={28} color="#ffffff" />
        </Pressable>

        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={22} color="#ffffff" />
          <TextInput
            style={styles.searchInput}
            value={locationQuery}
            onChangeText={setLocationQuery}
            placeholder="Search location..."
            placeholderTextColor="rgba(255,255,255,0.75)"
            returnKeyType="search"
            onSubmitEditing={searchLocation}
          />
          <Pressable onPress={searchLocation}>
            <MaterialIcons name="arrow-forward" size={22} color="#ffffff" />
          </Pressable>
        </View>

        <Pressable style={styles.locationBtn} onPress={openMapWithFallback}>
          <MaterialIcons name="location-on" size={28} color="#ffffff" />
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
          <MaterialIcons name="location-on" size={width < 360 ? 24 : 30} color="#000" />
          <Text style={[styles.quickLabel, { fontSize: width < 360 ? 10 : 11 }]}>
            {showInlineMap ? "Hide map" : "Google map"}
          </Text>
        </Pressable>

        <Text style={[styles.degreeTitle, { fontSize: degreeFontSize }]}>{headingText}</Text>

        <Pressable style={[styles.quickBtn, { width: quickBtnWidth }]} onPress={centerButtonAction}>
          <MaterialIcons name="camera-alt" size={width < 360 ? 24 : 30} color="#000" />
          <Text style={[styles.quickLabel, { fontSize: width < 360 ? 10 : 11 }]}>
            {showInlineMap ? "Capture Map" : "Rear Camera"}
          </Text>
        </Pressable>
      </View>

      {showInlineMap && (
        <View style={styles.mapFullscreen}>
          {mapRegion ? (
            <>
              <ViewShot ref={mapShotRef} style={styles.map} options={{ format: "jpg", quality: 0.95 }}>
                <MapView
                  style={styles.map}
                  mapType="satellite"
                  region={mapRegion}
                  onRegionChangeComplete={setMapRegion}
                  showsUserLocation
                  showsMyLocationButton={false}
                  toolbarEnabled={false}
                  zoomEnabled={!drawEnabled}
                  zoomControlEnabled
                  rotateEnabled={!drawEnabled}
                  pitchEnabled={!drawEnabled}
                  scrollEnabled={!drawEnabled}
                  onPress={(event) => {
                    if (!drawEnabled) return;
                    const coordinate = event.nativeEvent.coordinate;
                    setDrawPath((prev) => [...prev, coordinate]);
                  }}
                >
                  <Marker coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }} />
                  {drawPath.length > 1 && (
                    <Polyline coordinates={drawPath} strokeColor="#BD202E" strokeWidth={3} />
                  )}
                </MapView>
              </ViewShot>
              <View style={[styles.mapControls, { top: mapControlsTop }]}>
                <Pressable
                  style={[styles.mapControlBtn, drawEnabled && styles.mapControlBtnActive]}
                  onPress={() => setDrawEnabled((prev) => !prev)}
                >
                  <MaterialIcons name="edit" size={18} color={drawEnabled ? "#fff" : "#BD202E"} />
                  {drawEnabled && <View style={styles.drawColorIndicator} />}
                </Pressable>
                <Pressable
                  style={styles.mapControlBtn}
                  onPress={() => setDrawPath([])}
                >
                  <MaterialIcons name="delete" size={18} color="#BD202E" />
                </Pressable>
                {drawEnabled && <Text style={styles.drawColorLabel}>Red Pen</Text>}
              </View>
            </>
          ) : (
            <View style={styles.mapLoading}>
              <Text style={styles.mapLoadingText}>Locating...</Text>
            </View>
          )}
        </View>
      )}

      {/* Compass display */}
      <View style={styles.compassWrap} pointerEvents={showInlineMap ? "none" : "auto"}>
        {/* small pointer on top */}
        <MaterialIcons name="arrow-drop-down" size={width < 360 ? 14 : 18} color="#000" style={{ marginBottom: 6 }} />

        {/* Dial */}
        <View style={[styles.dialContainer, { width: dialWidth, height: dialHeight }]}>        
          <Animated.View
            style={{ width: dialWidth, height: dialHeight, transform: [{ rotate: dialRotate }] }}
            pointerEvents={showInlineMap ? "none" : "auto"}
          >
            {!showInlineMap && (
              <Image
                source={assets.dial}
                style={[
                  styles.dial,
                  {
                    width: dialWidth,
                    height: dialHeight,
                    borderRadius: dialSize / 2,
                    transform: [
                      { translateX: assets.dialOffset.x },
                      { translateY: assets.dialOffset.y },
                      { scale: assets.dialScale },
                    ],
                  },
                ]}
                resizeMode="contain"
              />
            )}

            {/* zone16 compass disabled - using single dial for all compassses */}
            {false &&
              zone16StepImages.map((source, index) => {
                const angle = (-90 + index * (360 / zone16StepImages.length)) * (Math.PI / 180);
                const x = zoneTouchRadius * Math.cos(angle);
                const y = zoneTouchRadius * Math.sin(angle);
                const isActive = selectedZoneStep === index + 1;

                return (
                  <React.Fragment key={`zone16-step-${index + 1}`}>
                    {/* All 16 equal-size parts are stacked to compose full 16-zone dial */}
                    <Image
                      source={source}
                      style={[
                        styles.zoneStepCompositeImage,
                        {
                          width: dialWidth,
                          height: dialHeight,
                          transform: [
                            { translateX: assets.dialOffset.x },
                            { translateY: assets.dialOffset.y },
                            { scale: assets.dialScale },
                          ],
                        },
                      ]}
                      resizeMode="contain"
                      pointerEvents="none"
                    />

                    {/* Clickable zone points (disabled while camera modal is open) */}
                    <Pressable
                      disabled={cameraOpen}
                      onPress={() => {
                        const zoneNumber = index + 1;
                        setSelectedZoneStep(zoneNumber);
                        Alert.alert(
                          "16 Zone Direction",
                          `Zone ${zoneNumber}: ${zone16DirectionNames[index]}`
                        );
                      }}
                      style={[
                        styles.zoneStepItem,
                        {
                          width: zoneTouchSize,
                          height: zoneTouchSize,
                          left: dialWidth / 2 - zoneTouchSize / 2 + x,
                          top: dialHeight / 2 - zoneTouchSize / 2 + y,
                          opacity: cameraOpen ? 0.5 : 1,
                        },
                        isActive && styles.zoneStepItemActive,
                      ]}
                    />
                  </React.Fragment>
                );
              })}
          </Animated.View>
        </View>
        
        {!showInlineMap && type !== "zone16" && (
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
        )}
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
                  source={assets.dial}
                  style={[
                    styles.cameraDial,
                    {
                      width: overlayDialSize,
                      height: overlayDialSize,
                      transform: [
                        { translateX: assets.dialOffset.x },
                        { translateY: assets.dialOffset.y },
                        { scale: assets.dialScale },
                      ],
                    },
                  ]}
                  resizeMode="contain"
                />
                <Animated.Image
                  source={assets.needle}
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
                <Pressable style={styles.camBtn} onPress={() => setCameraOpen(false)}>
                  <Text style={styles.camBtnText}>Close</Text>
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
                  source={assets.dial}
                  style={[
                    styles.cameraDial,
                    {
                      width: overlayDialSize,
                      height: overlayDialSize,
                      transform: [
                        { translateX: assets.dialOffset.x },
                        { translateY: assets.dialOffset.y },
                        { scale: assets.dialScale },
                      ],
                    },
                  ]}
                  resizeMode="contain"
                />
                <Animated.Image
                  source={assets.needle}
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
                  source={assets.icon}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                />
                <Text style={styles.drawerBrand}>sanskarvastu.com</Text>
                <Text style={styles.drawerVersion}>Version: {appVersion}</Text>
                <Text style={styles.drawerTitle}>Vastu Compass</Text>
              </View>

              <View style={styles.menuList}>
                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="info-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>About Us</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="computer" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Access Our Website</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="smartphone" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>More Apps</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={shareApp}>
                  <MaterialIcons name="share" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Share</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="mail-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Send Feedback</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="star-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Review Us</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={openPermissionsManager}>
                  <MaterialIcons name="lock-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Permissions</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={openUserGuide}>
                  <MaterialIcons name="help-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>How to use Sanskar Compass</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="school" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Join SanskarVastu Course</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={() => setDrawerOpen(false)}>
                  <MaterialIcons name="arrow-back" size={24} color="#ffffff" style={styles.menuIconStyle} />
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
          <ViewShot ref={previewShotRef} style={styles.previewShot} options={{ format: "jpg", quality: 0.95 }}>
            {/* Preview Imagessss */}
            {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} />}

            {/* Compasssssss dial overlay on preview */}
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
                source={assets.dial}
                style={[
                  styles.cameraDial,
                  {
                    width: overlayDialSize,
                    height: overlayDialSize,
                    transform: [
                      { translateX: assets.dialOffset.x },
                      { translateY: assets.dialOffset.y },
                      { scale: assets.dialScale },
                    ],
                  },
                ]}
                resizeMode="contain"
              />
              <Animated.Image
                source={assets.needle}
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
                <Text style={styles.cameraOverlayLabel}>Direction:</Text>
                <Text style={styles.cameraOverlayValue}>{headingText}</Text>
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
            
            {/* Top Center Degree Display */}
            <View style={styles.degreeTopCenter}>
              <Text style={styles.degreeTopText}>{headingText}</Text>
            </View>
            
            {/* Bottom Left - Geo Coordinates */}
            <View style={styles.geoInfoBottom}>
              <Text style={styles.geoLabel}>Geo-Coordinate:</Text>
              <Text style={styles.geoValue}>Latitude: {coords ? coords.lat.toFixed(6) : "—"}</Text>
              <Text style={styles.geoValue}>Longitude: {coords ? coords.lon.toFixed(6) : "—"}</Text>
            </View>
            
            {/* Bottom Right - Magnetic Field */}
            <View style={styles.magneticInfoBottom}>
              <Text style={styles.magneticLabel}>Magnetic Field:</Text>
              <Text style={styles.magneticValue}>Strength: {strength.toFixed(2)} µT</Text>
            </View>
          </ViewShot>

          {/* Bottom Controls */}
          <View style={styles.previewControls}>
            <Pressable style={styles.previewBtn} onPress={() => setPreviewUri(null)}>
              <MaterialIcons name="refresh" size={24} color="#000" />
              <Text style={styles.previewBtnLabel}>Retake</Text>
            </Pressable>

            <Pressable style={styles.previewBtn} onPress={savePreviewPhoto}>
              <MaterialIcons name="save" size={24} color="#000" />
              <Text style={styles.previewBtnLabel}>Save</Text>
            </Pressable>

            <Pressable style={styles.previewBtn} onPress={sharePreviewPhoto}>
              <MaterialIcons name="share" size={24} color="#000" />
              <Text style={styles.previewBtnLabel}>Share</Text>
            </Pressable>
          </View>

          {/* Drawer Menu Modal */}
          <Modal visible={drawerOpen} animationType="slide" transparent onRequestClose={() => setDrawerOpen(false)}>
            <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
              <Pressable style={styles.drawerContainer} onPress={(e) => e.stopPropagation()}>
                <ScrollView>
                  <View style={styles.drawerHeader}>
                    <Image source={assets.icon} style={styles.drawerLogo} resizeMode="contain" />
                    <Text style={styles.drawerBrand}>sanskarvastu.com</Text>
                    <Text style={styles.drawerVersion}>Version: {appVersion}</Text>
                    <Text style={styles.drawerTitle}>Vastu Compass</Text>
                  </View>

                  <View style={styles.menuList}>
                    <Pressable style={styles.menuItem}>
                      <MaterialIcons name="info-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                      <Text style={styles.menuText}>About SanskarVastu</Text>
                      <Text style={styles.menuArrow}>›</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem}>
                      <MaterialIcons name="computer" size={24} color="#ffffff" style={styles.menuIconStyle} />
                      <Text style={styles.menuText}>Access Vastu Software</Text>
                      <Text style={styles.menuArrow}>›</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem}>
                      <MaterialIcons name="smartphone" size={24} color="#ffffff" style={styles.menuIconStyle} />
                      <Text style={styles.menuText}>More Apps</Text>
                      <Text style={styles.menuArrow}>›</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={shareApp}>
                      <MaterialIcons name="share" size={24} color="#ffffff" style={styles.menuIconStyle} />
                      <Text style={styles.menuText}>Share</Text>
                      <Text style={styles.menuArrow}>›</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem}>
                      <MaterialIcons name="mail-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                      <Text style={styles.menuText}>Send Feedback</Text>
                      <Text style={styles.menuArrow}>›</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem}>
                      <MaterialIcons name="star-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                      <Text style={styles.menuText}>Review Us</Text>
                      <Text style={styles.menuArrow}>›</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={openPermissionsManager}>
                      <MaterialIcons name="lock-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                      <Text style={styles.menuText}>Manage Permissions</Text>
                      <Text style={styles.menuArrow}>›</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={openUserGuide}>
                      <MaterialIcons name="help-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                      <Text style={styles.menuText}>How to use Vastu Compass</Text>
                      <Text style={styles.menuArrow}>›</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem}>
                      <MaterialIcons name="school" size={24} color="#ffffff" style={styles.menuIconStyle} />
                      <Text style={styles.menuText}>Join SanskarVastu Course</Text>
                      <Text style={styles.menuArrow}>›</Text>
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={() => setDrawerOpen(false)}>
                      <MaterialIcons name="arrow-back" size={24} color="#ffffff" style={styles.menuIconStyle} />
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

      {/* Bottom nav mock - hidden when map is visible */}
      <View style={[styles.bottomNav, showInlineMap && styles.bottomNavOnMap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Pressable
            style={styles.navItem}
            onPress={() => {
              if (mapVisible) {
                // If map is open, just close it
                setMapVisible(false);
                setDrawEnabled(false);
                setDrawPath([]);
              } else {
                // If map is closed, navigate to home
                router.push("/");
              }
            }}
          >
            <MaterialIcons name="home" size={28} color="#000000" />
            <Text style={styles.navLabel}>Home Page</Text>
          </Pressable>

          <Pressable style={styles.captureBtn} onPress={centerButtonAction}>
            <MaterialIcons name="camera-alt" size={28} color="#000000" />
          </Pressable>

          <Pressable style={styles.navItem} onPress={openLastCaptured}>
            <MaterialIcons name="image" size={28} color="#000000" />
            <Text style={styles.navLabel}>Last Captured</Text>
          </Pressable>
      </View>
    </SafeAreaView>
  );
}
