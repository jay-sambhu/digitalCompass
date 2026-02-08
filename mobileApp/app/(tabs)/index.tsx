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
  Share,
  Linking,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Magnetometer } from "expo-sensors";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as Location from "expo-location";
import ViewShot from "react-native-view-shot";
import Constants from "expo-constants";
import { Href, router, useLocalSearchParams } from "expo-router";
import { getCompassAssets } from "../../utils/compassAssets";
import { MaterialIcons } from "@expo/vector-icons";

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
  const { openDrawer, openUserGuide } = useLocalSearchParams<{ openDrawer?: string; openUserGuide?: string }>();

  const [heading, setHeading] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<Array<{ type: string; message: string; time: string }>>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [activeCompass, setActiveCompass] = useState<number>(0); // Track which compass opened camera
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [locationPerm, setLocationPerm] = useState<Location.LocationPermissionResponse | null>(null);
  const [showUserGuide, setShowUserGuide] = useState(false);

  const [tempCameraPhoto, setTempCameraPhoto] = useState<string | null>(null);
  const compositeRef = useRef<ViewShot>(null);
  const previewShotRef = useRef<ViewShot>(null);
  const [isCompositePhoto, setIsCompositePhoto] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [mediaPerm, setMediaPerm] = useState<MediaLibrary.PermissionResponse | null>(null);
  const isExpoGoAndroid = Platform.OS === "android" && Constants.appOwnership === "expo";

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

  const refreshMediaPerm = async () => {
    if (isExpoGoAndroid) return mediaPerm;
    try {
      return await requestMediaPerm();
    } catch (e: any) {
      console.log("Failed to refresh media permission:", e?.message ?? "Unknown error");
      return mediaPerm;
    }
  };

  const prevHeadingRef = useRef(0);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const tempRotateAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Capture console logs and errors (without error hook to avoid render errors)
  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;

    const pushDebugLog = (type: "LOG" | "WARN", args: any[]) => {
      try {
        const message = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");
        setTimeout(() => {
          setDebugLogs((prev) => [...prev.slice(-49), { type, message, time: new Date().toLocaleTimeString() }]);
        }, 0);
      } catch {
        // ignore
      }
    };

    console.log = (...args: any[]) => {
      originalLog(...args);
      pushDebugLog("LOG", args);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      pushDebugLog("WARN", args);
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

  useEffect(() => {
    if (openDrawer === "1") {
      setDrawerOpen(true);
      router.setParams({ openDrawer: undefined });
    }
  }, [openDrawer]);

  useEffect(() => {
    if (openUserGuide === "1") {
      setShowUserGuide(true);
      router.setParams({ openUserGuide: undefined });
    }
  }, [openUserGuide]);

  const needleRotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  const gridGap = 12;
  const gridPadding = 16;
  const topSectionHeight = 100;
  const tileSize = useMemo(() => {
    const tileByWidth = (width - gridPadding * 2 - gridGap) / 2;
    const availableHeight =
      height - insets.top - insets.bottom - topSectionHeight - gridPadding;
    const tileByHeight = (availableHeight - gridGap) / 2;
    const rawSize = Math.min(tileByWidth, tileByHeight);
    return Math.max(160, Math.floor(rawSize));
  }, [width, height, insets.top, insets.bottom]);

  const needleSize = Math.round(tileSize * 0.68);
  const headingText = useMemo(() => `${Math.round(heading)}°`, [heading]);

  // Detect if device has navigation bar (bottom inset > 0 indicates gesture nav or nav bar)
  const hasNavigationBar = insets.bottom > 0;
  const cameraViewHeightPercent = hasNavigationBar ? 0.9 : 1.0;

  const overlayDialSize = useMemo(() => {
    const screenSize = Math.min(width, height);
    const availableHeight = height * cameraViewHeightPercent;
    const dial = Math.min(screenSize * 0.85, availableHeight * 0.8);
    return dial;
  }, [width, height, cameraViewHeightPercent]);

  const overlayNeedleSize = Math.round(overlayDialSize * 0.68);
  
  // Camera controls padding adjustment for navigation bar
  const cameraControlsPaddingBottom = hasNavigationBar ? insets.bottom + 8 : 16;

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
      setIsCompositePhoto(false);
      setCameraOpen(true);
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to open camera");
    }
  };

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) {
        Alert.alert("Camera error", "Camera not ready");
        return;
      }

      // Step 1: Take camera photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });

      if (!photo || !photo.uri) {
        Alert.alert("Camera error", "Failed to capture photo");
        return;
      }

      console.log("Photo taken, URI:", photo.uri);

      const finishCapture = (uri: string | null, composite: boolean) => {
        if (uri) {
          setCapturedPhoto(uri);
          setIsCompositePhoto(composite);
        } else {
          Alert.alert("Capture error", "Failed to capture photo");
        }
        setTempCameraPhoto(null);
      };

      // Step 2: Set temp photo and wait for composite view to render
      setTempCameraPhoto(photo.uri);
      
      // Step 3: Preload image and then capture composite view
      Image.prefetch(photo.uri)
        .then(() => {
          // Image preloaded successfully, now capture
          setTimeout(async () => {
            try {
              if (compositeRef.current && compositeRef.current.capture) {
                const compositeUri = await compositeRef.current.capture?.();
                if (compositeUri) {
                  console.log("Composite captured:", compositeUri);
                  finishCapture(compositeUri, true);
                } else {
                  console.warn("Composite capture returned no URI, falling back to raw photo");
                  finishCapture(photo.uri, false);
                }
              } else {
                console.warn("Composite ref not ready, falling back to raw photo");
                finishCapture(photo.uri, false);
              }
            } catch (compErr: any) {
              console.error("Composite capture error:", compErr);
              finishCapture(photo.uri, false);
            }
          }, 500);
        })
        .catch((err) => {
          console.error("Image prefetch failed:", err);
          // Try capture anyway
          setTimeout(async () => {
            try {
              if (compositeRef.current && compositeRef.current.capture) {
                const compositeUri = await compositeRef.current.capture?.();
                if (compositeUri) {
                  finishCapture(compositeUri, true);
                } else {
                  finishCapture(photo.uri, false);
                }
              } else {
                finishCapture(photo.uri, false);
              }
            } catch (e: any) {
              console.error("Capture error:", e);
              finishCapture(photo.uri, false);
            }
          }, 500);
        });
    } catch (e: any) {
      console.error("Take photo error:", e);
      Alert.alert("Camera error", e?.message ?? "Failed to take photo");
    }
  };

  const capturePreviewWithOverlay = async () => {
    if (!capturedPhoto) return null;
    if (isCompositePhoto) return capturedPhoto;
    if (previewShotRef.current?.capture) {
      try {
        const uri = await previewShotRef.current.capture?.();
        if (uri) return uri;
      } catch (e: any) {
        console.warn("Preview capture failed, falling back to raw photo:", e?.message);
      }
    }
    return capturedPhoto;
  };

  const savePhoto = async () => {
    try {
      if (!capturedPhoto) {
        Alert.alert("Error", "No photo to save.");
        return;
      }

      const finalUri = await capturePreviewWithOverlay();
      if (!finalUri) {
        Alert.alert("Save error", "Unable to capture the overlaid image. Please try again.");
        return;
      }

      try {
        const asset = await MediaLibrary.createAssetAsync(finalUri);
        console.log("Asset created:", asset);

        Alert.alert("Saved!", "Photo saved to gallery successfully!");
        setCameraOpen(false);
        setCapturedPhoto(null);
        setIsCompositePhoto(false);
      } catch (mediaError: any) {
        console.log("Media library error (expected in Expo Go):", mediaError.message);
        Alert.alert("Info", "Photo captured! (Full save requires development build)");
        setCameraOpen(false);
        setCapturedPhoto(null);
        setIsCompositePhoto(false);
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
      const finalUri = await capturePreviewWithOverlay();
      if (!finalUri) {
        Alert.alert("Share error", "Unable to capture the overlaid image. Please try again.");
        return;
      }
      await Sharing.shareAsync(finalUri, {
        mimeType: "image/jpeg",
        dialogTitle: "Share Compass Photo",
      });
    } catch (e: any) {
      console.error("Share error:", e);
      Alert.alert("Share error", e?.message || "Failed to share photo");
    }
  };

  const shareApp = async () => {
    try {
      const result = await Share.share({
        message: "Check out Digital Compass - Vastu Compass App! Download now: https://sanskarvastu.com",
        title: "Digital Compass App",
      });
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log("Shared with activity type:", result.activityType);
        } else {
          console.log("App shared successfully");
        }
      } else if (result.action === Share.dismissedAction) {
        console.log("Share dismissed");
      }
    } catch (error: any) {
      Alert.alert("Share Error", error.message);
    }
  };

  const openWebsite = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open this URL: " + url);
      }
    } catch (error: any) {
      Alert.alert("Error", "Failed to open website: " + error.message);
    }
  };

  const openPermissionsManager = async () => {
    // Refresh all permissions status
    const locPerm = await Location.getForegroundPermissionsAsync();
    setLocationPerm(locPerm);
    await refreshMediaPerm();
    setShowPermissions(true);
  };

  const handleCameraPermission = async (value: boolean) => {
    if (value && !camPerm?.granted) {
      const result = await requestCamPerm();
      if (!result.granted) {
        Alert.alert(
          "Permission Denied",
          "Camera permission was denied. Please enable it from device settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } else if (!value && camPerm?.granted) {
      openAppSettings();
    }
  };

  const handleLocationPermission = async (value: boolean) => {
    if (value && !locationPerm?.granted) {
      const result = await Location.requestForegroundPermissionsAsync();
      setLocationPerm(result);
      if (!result.granted) {
        Alert.alert(
          "Permission Denied",
          "Location permission was denied. Please enable it from device settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } else if (!value && locationPerm?.granted) {
      openAppSettings();
    }
  };

  const handleMediaLibraryPermission = async (value: boolean) => {
    if (value && !mediaPerm?.granted) {
      const result = await requestMediaPerm();
      if (!result?.granted) {
        Alert.alert(
          "Permission Denied",
          "Media library permission was denied. Please enable it from device settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } else if (!value && mediaPerm?.granted) {
      openAppSettings();
    }
  };

  const openAppSettings = () => {
    Alert.alert(
      "Open Settings",
      "To change permissions, please go to your device settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setIsCompositePhoto(false);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCapturedPhoto(null);
    setIsCompositePhoto(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => setDrawerOpen(true)}>
            <MaterialIcons name="menu" size={28} color="#e2e8f0" />
          </Pressable>
          <Text style={styles.appTitle}>Digital Compass</Text>
          <View style={styles.headerIcons}>
            <Pressable style={styles.iconBtn}>
              <MaterialIcons name="lightbulb-outline" size={24} color="#e2e8f0" />
            </Pressable>
            <Pressable style={styles.iconBtn}>
              <MaterialIcons name="star-outline" size={24} color="#e2e8f0" />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={shareApp}>
              <MaterialIcons name="share" size={24} color="#e2e8f0" />
            </Pressable>
          </View>
        </View>

        {/* Section Title */}
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Select Compasses Type</Text>
        </View>

        {/* Compass Grid */}
        <View style={styles.compassGrid}>
          {[
            { label: "Normal Compass", route: "/(tabs)/compass" as Href, type: "normal" },
            { label: "16 Zone Vastu\nCompass", route: "/(tabs)/compass2" as Href, type: "zone16" },
            { label: "32 Zone Vastu\nCompass", route: "/(tabs)/compass3" as Href, type: "zone32" },
            { label: "AppliedVastu\nCharka", route: "/(tabs)/compass4" as Href, type: "chakra" },
          ].map((item) => {
            const assets = getCompassAssets(item.type);
            return (
              <Pressable
                key={item.label}
                style={styles.compassCard}
                onPress={() => router.push(item.route)}
              >
                <View style={styles.compassImageContainer}>
                  <Image
                    source={assets.dial}
                    style={styles.compassDial}
                    resizeMode="contain"
                  />
                  <Animated.Image
                    source={assets.needle}
                    style={[
                      styles.compassNeedle,
                      { transform: [{ translateX }, { translateY }, { rotate: needleRotate }] },
                    ]}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.compassLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Bottom Buttons */}
        <View style={styles.bottomButtons}>
          <Pressable style={styles.bottomBtn} onPress={() => setShowUserGuide(true)}>
            <Text style={styles.bottomBtnText}>User Guide</Text>
          </Pressable>
          <Pressable style={styles.bottomBtn} onPress={() => openWebsite('https://sanskarvastu.com/consultancy')}>
            <Text style={styles.bottomBtnText}>Vastu Consultancy Services</Text>
          </Pressable>
        </View>

        <View style={styles.bottomButtons}>
          <Pressable style={styles.bottomBtn}>
            <Text style={styles.bottomBtnText}>Vastu Courses</Text>
          </Pressable>
          <Pressable style={styles.bottomBtn} onPress={() => openWebsite('https://sanskarvastu.com/contact')}>
            <Text style={styles.bottomBtnText}>Contact Us</Text>
          </Pressable>
        </View>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/normalCompass/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </ScrollView>

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
              <ViewShot
                ref={previewShotRef}
                options={{ format: "jpg", quality: 0.9 }}
                style={styles.previewShot}
              >
                <View style={styles.previewShotInner}>
                  <Image source={{ uri: capturedPhoto }} style={styles.preview} />
                  {!isCompositePhoto && (
                    <View style={styles.fullScreenOverlay}>
                      <View style={styles.compassOverlay}>
                        <Image
                          source={activeCompass === 1 ? require("../../assets/16ZoneVastuCompass/dial.png") : require("../../assets/normalCompass/dial.png")}
                          style={{ width: overlayDialSize, height: overlayDialSize }}
                          resizeMode="contain"
                        />
                        <Animated.Image
                          source={activeCompass === 1 ? require("../../assets/16ZoneVastuCompass/needle.png") : require("../../assets/normalCompass/needle.png")}
                          style={[
                            styles.overlayNeedle,
                            {
                              width: overlayNeedleSize,
                              height: overlayNeedleSize,
                              transform: [{ translateX }, { translateY }, { rotate: needleRotate }],
                            },
                          ]}
                          resizeMode="contain"
                        />
                        <View style={styles.headingBadge}>
                          <Text style={styles.headingBadgeText}>{headingText}</Text>
                        </View>
                      </View>
                      <View style={[styles.directionBreakdown, { marginBottom: hasNavigationBar ? insets.bottom + 70 : 70 }]}>
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
                  )}
                </View>
              </ViewShot>
              <View style={[styles.previewControls, { paddingBottom: cameraControlsPaddingBottom }]}>
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
              <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
                <View style={styles.fullScreenOverlay}>
                  <View style={styles.compassOverlay}>
                    <Image
                      source={activeCompass === 1 ? require("../../assets/16ZoneVastuCompass/dial.png") : require("../../assets/normalCompass/dial.png")}
                      style={{ width: overlayDialSize, height: overlayDialSize }}
                      resizeMode="contain"
                    />
                    <Animated.Image
                      source={activeCompass === 1 ? require("../../assets/16ZoneVastuCompass/needle.png") : require("../../assets/normalCompass/needle.png")}
                      style={[
                        styles.overlayNeedle,
                        {
                          width: overlayNeedleSize,
                          height: overlayNeedleSize,
                          transform: [{ translateX }, { translateY }, { rotate: needleRotate }],
                        },
                      ]}
                      resizeMode="contain"
                    />
                    <View style={styles.headingBadge}>
                      <Text style={styles.headingBadgeText}>{headingText}</Text>
                    </View>
                  </View>
                  <View style={[styles.directionBreakdown, { marginBottom: hasNavigationBar ? insets.bottom + 70 : 70 }]}>
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
              </CameraView>
              <View style={[styles.cameraControls, { paddingBottom: cameraControlsPaddingBottom }]}>
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

      {/* Drawer Menu */}
      <Modal
        visible={drawerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDrawerOpen(false)}
      >
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawerContainer} onPress={(e) => e.stopPropagation()}>
            <ScrollView>
              {/* Logo and Header */}
              <View style={styles.drawerHeader}>
                <Image
                  source={require("../../assets/normalCompass/icon.png")}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                />
                <Text style={styles.drawerBrand}>sanskarvastu.com</Text>
                <Text style={styles.drawerVersion}>Version: 3.1.3</Text>
                <Text style={styles.drawerTitle}>Vastu Compass</Text>
              </View>

              {/* Menu Items */}
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

                <Pressable style={styles.menuItem} onPress={() => { setDrawerOpen(false); setShowUserGuide(true); }}>
                  <MaterialIcons name="help-outline" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>How to use Vastu Compass</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="school" size={24} color="#0f172a" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Join AppliedVastu Course</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* User Guide Modal */}
      <Modal visible={showUserGuide} animationType="slide" onRequestClose={() => setShowUserGuide(false)}>
        <SafeAreaView style={styles.userGuideContainer}>
          <View style={styles.userGuideHeader}>
            <Text style={styles.userGuideTitle}>How to Use Digital Compass</Text>
            <Pressable onPress={() => setShowUserGuide(false)}>
              <Text style={styles.userGuideClose}>✕</Text>
            </Pressable>
          </View>
          
          <ScrollView style={styles.userGuideContent} showsVerticalScrollIndicator={false}>
            {/* Getting Started */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="location-on" size={20} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Getting Started</Text>
              </View>
              <Text style={styles.guideText}>
                Welcome to Digital Compass! This app helps you understand Vastu principles and directions. Before using the app, please grant the necessary permissions for location, camera, and media access.
              </Text>
            </View>

            {/* Permissions */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="lock" size={20} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Permissions</Text>
              </View>
              <Text style={styles.guideSubtitle}>Why we need permissions:</Text>
              <View style={styles.guideList}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <MaterialIcons name="camera-alt" size={16} color="#0f172a" style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={styles.guideListText}>Camera: To capture photos with compass overlay</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <MaterialIcons name="location-on" size={16} color="#0f172a" style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={styles.guideListText}>Location: To show your coordinates and compass direction</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <MaterialIcons name="image" size={16} color="#0f172a" style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={styles.guideListText}>Media Library: To save captured photos to your gallery</Text>
                </View>
              </View>
              <Text style={styles.guideText}>
                You can manage permissions anytime from the sidebar menu → Manage Permissions.
              </Text>
            </View>

            {/* Compass Types */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="explore" size={20} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Compass Types</Text>
              </View>
              <View style={styles.guideList}>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><Text style={{fontWeight: '700'}}>Normal Compass:</Text> Standard 360° compass showing cardinal directions</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><Text style={{fontWeight: '700'}}>16 Zone Vastu Compass:</Text> Advanced compass divided into 16 zones based on Vastu principles</Text></Text>
              </View>
            </View>

            {/* Using Compass */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="smartphone" size={20} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Using the Compass</Text>
              </View>
              <View style={styles.guideSteps}>
                <Text style={styles.guideStep}><Text style={{fontWeight: '700'}}>Step 1:</Text> Select a compass type from the home screen</Text>
                <Text style={styles.guideStep}><Text style={{fontWeight: '700'}}>Step 2:</Text> Click to open the camera with compass overlay</Text>
                <Text style={styles.guideStep}><Text style={{fontWeight: '700'}}>Step 3:</Text> The compass needle will point to magnetic north</Text>
                <Text style={styles.guideStep}><Text style={{fontWeight: '700'}}>Step 4:</Text> Use this for Vastu analysis of your property or space</Text>
              </View>
            </View>

            {/* Features */}
            <View style={styles.guideSection}>
              <Text style={styles.guideSectionTitle}>✨ Key Features</Text>
              <View style={styles.guideList}>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><Text style={{fontWeight: '700'}}>Real-time Heading:</Text> Live compass direction updates</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><Text style={{fontWeight: '700'}}>Geo-Coordinates:</Text> View your location coordinates</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><Text style={{fontWeight: '700'}}>Magnetic Field:</Text> Monitor magnetic field strength (µT)</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><Text style={{fontWeight: '700'}}>Photo Capture:</Text> Capture photos with compass overlay</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><Text style={{fontWeight: '700'}}>Share Feature:</Text> Share app link with friends</Text></Text>
              </View>
            </View>

            {/* Tips */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="lightbulb-outline" size={20} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Tips for Best Results</Text>
              </View>
              <View style={styles.guideList}>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>Hold your phone steady for accurate readings</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>Keep phone away from metal objects or magnets</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>Outdoor use gives more accurate results</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>Allow a few seconds for calibration after opening compass</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>Move phone in figure-8 pattern if readings seem off</Text></Text>
              </View>
            </View>

            {/* Vastu Consultancy */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="business" size={20} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Need Expert Help?</Text>
              </View>
              <Text style={styles.guideText}>
                For professional Vastu consultation, please visit our Vastu Consultancy Services section or contact us through the app menu.
              </Text>
            </View>

            {/* Support */}
            <View style={styles.guideSection}>
              <Text style={styles.guideSectionTitle}>📞 Support & Feedback</Text>
              <Text style={styles.guideText}>
                Have questions or suggestions? Use the "Send Feedback" option in the sidebar menu to reach us. We'd love to hear from you!
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Permissions Management Modal */}
      <Modal visible={showPermissions} animationType="slide" onRequestClose={() => setShowPermissions(false)}>
        <SafeAreaView style={styles.permissionsContainer}>
          <View style={styles.permissionsHeader}>
            <Text style={styles.permissionsTitle}>Manage Permissions</Text>
            <Pressable onPress={() => setShowPermissions(false)}>
              <Text style={styles.permissionsClose}>✕</Text>
            </Pressable>
          </View>
          
          <ScrollView style={styles.permissionsList}>
            <Text style={styles.permissionsSubtitle}>App Permissions Status</Text>
            
            {/* Camera Permission */}
            <View style={styles.permissionItem}>
              <View style={styles.permissionInfo}>
                <MaterialIcons name="camera-alt" size={32} color="#0f172a" style={styles.permissionIconStyle} />
                <View style={styles.permissionTextContainer}>
                  <Text style={styles.permissionName}>Camera</Text>
                  <Text style={styles.permissionDesc}>Required for capturing photos with compass overlay</Text>
                </View>
              </View>
              <View style={styles.permissionToggle}>
                <Switch
                  value={camPerm?.granted || false}
                  trackColor={{ false: "#ccc", true: "#4CAF50" }}
                  thumbColor={camPerm?.granted ? "#fff" : "#f4f3f4"}
                  onValueChange={handleCameraPermission}
                />
              </View>
            </View>

            {/* Location Permission */}
            <View style={styles.permissionItem}>
              <View style={styles.permissionInfo}>
                <MaterialIcons name="location-on" size={32} color="#0f172a" style={styles.permissionIconStyle} />
                <View style={styles.permissionTextContainer}>
                  <Text style={styles.permissionName}>Location</Text>
                  <Text style={styles.permissionDesc}>Required for getting coordinates and compass direction</Text>
                </View>
              </View>
              <View style={styles.permissionToggle}>
                <Switch
                  value={locationPerm?.granted || false}
                  trackColor={{ false: "#ccc", true: "#4CAF50" }}
                  thumbColor={locationPerm?.granted ? "#fff" : "#f4f3f4"}
                  onValueChange={handleLocationPermission}
                />
              </View>
            </View>

            {/* Media Library Permission */}
            <View style={styles.permissionItem}>
              <View style={styles.permissionInfo}>
                <MaterialIcons name="image" size={32} color="#0f172a" style={styles.permissionIconStyle} />
                <View style={styles.permissionTextContainer}>
                  <Text style={styles.permissionName}>Media Library</Text>
                  <Text style={styles.permissionDesc}>Required for saving photos to gallery</Text>
                </View>
              </View>
              <View style={styles.permissionToggle}>
                <Switch
                  value={mediaPerm?.granted || false}
                  trackColor={{ false: "#ccc", true: "#4CAF50" }}
                  thumbColor={mediaPerm?.granted ? "#fff" : "#f4f3f4"}
                  onValueChange={handleMediaLibraryPermission}
                />
              </View>
            </View>

            <Text style={styles.permissionsNote}>
              Toggle ON to grant permissions. Toggle OFF opens device settings to revoke permissions.
            </Text>

            <Pressable style={styles.openSettingsBtn} onPress={openAppSettings}>
              <Text style={styles.openSettingsBtnText}>Open Device Settings</Text>
            </Pressable>
            
            <Text style={styles.permissionsInfo}>
              Note: To revoke permissions, use device settings. Granting permissions can be done directly from toggles above.
            </Text>
          </ScrollView>
        </SafeAreaView>
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

      {/* Hidden composite view for capturing camera + overlay */}
      {tempCameraPhoto && (
        <View style={{ position: 'absolute', left: 0, top: 0, width, height, zIndex: -1, opacity: 0 }}>
          <ViewShot ref={compositeRef} options={{ format: "jpg", quality: 0.9 }} style={{ width, height }}>
            <View style={{ width, height, backgroundColor: '#000' }}>
              <Image
                source={{ uri: tempCameraPhoto }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              <View style={[styles.fullScreenOverlay, { width, height }]}>
                <View style={styles.compassOverlay}>
                  <Image
                    source={activeCompass === 1 ? require("../../assets/16ZoneVastuCompass/dial.png") : require("../../assets/normalCompass/dial.png")}
                    style={{ width: overlayDialSize, height: overlayDialSize }}
                    resizeMode="contain"
                  />
                  <Animated.Image
                    source={activeCompass === 1 ? require("../../assets/16ZoneVastuCompass/needle.png") : require("../../assets/normalCompass/needle.png")}
                    style={[
                      styles.overlayNeedle,
                      {
                        width: overlayNeedleSize,
                        height: overlayNeedleSize,
                        transform: [{ translateX }, { translateY }, { rotate: needleRotate }],
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
            </View>
          </ViewShot>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#eef2f6"
  },
  scrollContent: { 
    flexGrow: 1,
    paddingBottom: 20 
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  appTitle: { 
    fontSize: 20, 
    fontWeight: "700", 
    color: "#f8fafc",
    letterSpacing: 0.3,
    fontFamily: Platform.select({ ios: "ui-rounded", android: "serif", default: "serif" }),
  },
  headerIcons: { flexDirection: "row", gap: 8 },
  iconBtn: { padding: 4 },
  menuIconStyle: {
    marginRight: 12,
  },
  permissionIconStyle: {
    marginRight: 12,
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
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  drawerHeader: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  drawerLogo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  drawerBrand: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 5,
    letterSpacing: 0.2,
  },
  drawerVersion: {
    fontSize: 13,
    color: "#888",
    marginBottom: 15,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: 0.2,
    fontFamily: Platform.select({ ios: "ui-rounded", android: "serif", default: "serif" }),
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
    borderBottomColor: "#f1f5f9",
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  menuArrow: {
    fontSize: 24,
    color: "#ccc",
  },
  permissionsContainer: {
    flex: 1,
    backgroundColor: "#eef2f6",
  },
  permissionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  permissionsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: Platform.select({ ios: "ui-rounded", android: "serif", default: "serif" }),
  },
  permissionsClose: {
    fontSize: 28,
    color: "#666",
    fontWeight: "700",
  },
  permissionsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  permissionsSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginTop: 20,
    marginBottom: 16,
  },
  permissionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  permissionInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  permissionDesc: {
    fontSize: 12,
    color: "#666",
    lineHeight: 16,
  },
  permissionToggle: {
    marginLeft: 12,
  },
  openSettingsBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 16,
  },
  openSettingsBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  permissionsNote: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 20,
    lineHeight: 18,
    fontWeight: "600",
  },
  permissionsInfo: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  userGuideContainer: {
    flex: 1,
    backgroundColor: "#eef2f6",
  },
  userGuideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  userGuideTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: Platform.select({ ios: "ui-rounded", android: "serif", default: "serif" }),
  },
  userGuideClose: {
    fontSize: 28,
    color: "#666",
    fontWeight: "700",
  },
  userGuideContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  guideSection: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  guideSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 12,
  },
  guideSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  guideText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  guideList: {
    marginTop: 8,
  },
  guideListItem: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
    lineHeight: 20,
  },
  guideListText: {
    color: "#555",
    lineHeight: 20,
  },
  guideSteps: {
    marginTop: 8,
  },
  guideStep: {
    fontSize: 14,
    color: "#555",
    marginBottom: 10,
    lineHeight: 20,
  },
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
  sectionTitleContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: 0.3,
    fontFamily: Platform.select({ ios: "ui-rounded", android: "serif", default: "serif" }),
  },
  compassGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
    justifyContent: "space-between",
  },
  compassCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  compassImageContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 60,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  compassDial: {
    width: 120,
    height: 120,
    alignSelf: "center",
  },
  compassNeedle: {
    width: 80,
    height: 80,
    position: "absolute",
    alignSelf: "center",
  },
  compassLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  bottomButtons: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  bottomBtn: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  bottomBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  logo: {
    width: 150,
    height: 60,
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
    borderRadius: 1000,
    overflow: "hidden",
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
    paddingVertical: 16,
    paddingHorizontal: 16,
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
  previewShot: { flex: 1, width: "100%", height: "100%" },
  previewShotInner: { flex: 1, width: "100%", height: "100%" },
  preview: { flex: 1, width: "100%" },
  previewControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#000",
    gap: 8,
  },
});
