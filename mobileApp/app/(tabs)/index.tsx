import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
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
import { styles } from "../../styles/index.styles";
import { SplashScreenComponent } from "../../components/SplashScreen";
import {
  requestMediaLibraryPermission,
  getMediaLibraryPermissionStatus,
  requestCameraWithFeedback,
  requestLocationWithFeedback,
  requestMediaLibraryWithFeedback,
  getLocationPermissionStatus,
} from "../../utils/permissionHandler";

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
  const [isDarkMode, setIsDarkMode] = useState(true); // Theme state
  const [showSplash, setShowSplash] = useState(true); // Splash screen state
  const appVersion = Constants.expoConfig?.version ?? (Constants as any)?.manifest?.version ?? "1.0.0";

  const [tempCameraPhoto, setTempCameraPhoto] = useState<string | null>(null);
  const compositeRef = useRef<ViewShot>(null);
  const previewShotRef = useRef<ViewShot>(null);
  const [isCompositePhoto, setIsCompositePhoto] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [mediaPerm, setMediaPerm] = useState<MediaLibrary.PermissionResponse | null>(null);
  const isExpoGoAndroid = Platform.OS === "android" && Constants.appOwnership === "expo";

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

  const refreshMediaPerm = async () => {
    try {
      const status = await getMediaLibraryPermissionStatus();
      if (status) {
        setMediaPerm(status);
        return status;
      }
      return mediaPerm;
    } catch (e: any) {
      console.error("[Permission Error] Failed to refresh media permission:", e?.message ?? "Unknown error");
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
      if (camPerm?.granted) {
        setActiveCompass(compassIndex);
        setCapturedPhoto(null);
        setIsCompositePhoto(false);
        setCameraOpen(true);
        return;
      }

      // Request camera permission with safe error handling
      const granted = await requestCameraWithFeedback(
        requestCamPerm,
        () => {
          setActiveCompass(compassIndex);
          setCapturedPhoto(null);
          setIsCompositePhoto(false);
          setCameraOpen(true);
        }
      );
      
      if (!granted) {
        console.log("Camera permission not granted");
      }
    } catch (e: any) {
      console.error("[Camera Error] Failed to open camera:", e?.message ?? "Unknown error");
      Alert.alert("Camera error", "Failed to open camera. Please try again.");
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
        message: "Check out Sanskar Compass - Vastu Compass App! Download now: https://sanskarvastu.com",
        title: "Sanskar Compass App",
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
    try {
      // Refresh all permissions status safely
      const locPerm = await getLocationPermissionStatus();
      setLocationPerm(locPerm);
      await refreshMediaPerm();
      setShowPermissions(true);
    } catch (e: any) {
      console.error("[Permission Error] Failed to open permissions manager:", e?.message ?? "Unknown error");
      Alert.alert("Error", "Failed to load permission status. Please try again.");
    }
  };

  const handleCameraPermission = async (value: boolean) => {
    try {
      if (value && !camPerm?.granted) {
        await requestCameraWithFeedback(requestCamPerm);
      } else if (!value && camPerm?.granted) {
        openAppSettings();
      }
    } catch (e: any) {
      console.error("[Permission Error] Camera permission toggle failed:", e?.message ?? "Unknown error");
      Alert.alert("Error", "Failed to update camera permission. Please try again.");
    }
  };

  const handleLocationPermission = async (value: boolean) => {
    try {
      if (value && !locationPerm?.granted) {
        await requestLocationWithFeedback(
          async () => {
            const status = await getLocationPermissionStatus();
            setLocationPerm(status);
          }
        );
      } else if (!value && locationPerm?.granted) {
        openAppSettings();
      }
    } catch (e: any) {
      console.error("[Permission Error] Location permission toggle failed:", e?.message ?? "Unknown error");
      Alert.alert("Error", "Failed to update location permission. Please try again.");
    }
  };

  const handleMediaLibraryPermission = async (value: boolean) => {
    try {
      if (value && !mediaPerm?.granted) {
        await requestMediaLibraryWithFeedback(
          async () => {
            await refreshMediaPerm();
          }
        );
      } else if (!value && mediaPerm?.granted) {
        openAppSettings();
      }
    } catch (e: any) {
      console.error("[Permission Error] Media library permission toggle failed:", e?.message ?? "Unknown error");
      Alert.alert("Error", "Failed to update media library permission. Please try again.");
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

  // Show splash screen if needed
  if (showSplash) {
    return (
      <SplashScreenComponent
        onFinish={() => setShowSplash(false)}
        duration={3500}
      />
    );
  }

  const headerIconColor = isDarkMode ? "#ffffff" : "#BD202E";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? "#f5f5f5" : "#1a1a2e" }]} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[
          styles.header,
          {
            backgroundColor: isDarkMode ? "#BD202E" : "#f5f5f5",
            borderBottomColor: isDarkMode ? "#a01b26" : "#CBD5E1",
          },
        ]}>
          <Pressable onPress={() => setDrawerOpen(true)}>
            <MaterialIcons name="menu" size={28} color={headerIconColor} />
          </Pressable>
          <Text style={[styles.appTitle, { color: isDarkMode ? "#ffffff" : "#BD202E" }]}>Sanskar Compass</Text>
          <View style={styles.headerIcons}>
            <Pressable style={styles.iconBtn} onPress={() => setIsDarkMode(!isDarkMode)}>
              <MaterialIcons name={isDarkMode ? "lightbulb-outline" : "lightbulb"} size={24} color={headerIconColor} />
            </Pressable>
            <Pressable style={styles.iconBtn}>
              <MaterialIcons name="star-outline" size={24} color={headerIconColor} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={shareApp}>
              <MaterialIcons name="share" size={24} color={headerIconColor} />
            </Pressable>
          </View>
        </View>

        {/* Section Title */}
        <View style={[styles.sectionTitleContainer, { backgroundColor: isDarkMode ? "#f5f5f5" : "#1a1a2e" }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? "#BD202E" : "#f5f5f5" }]}>Select Compasses Type</Text>
        </View>

        {/* Compass Grid */}
        <View style={styles.compassGrid}>
          {[
            { label: "Normal Compass", route: "/(tabs)/compass" as Href, type: "normal" },
            { label: "16 Zone Vastu\nCompass", route: "/(tabs)/compass2" as Href, type: "zone16" },
            { label: "32 Zone Vastu\nCompass", route: "/(tabs)/compass3" as Href, type: "zone32" },
            { label: "SanskarVastu\nCharka", route: "/(tabs)/compass4" as Href, type: "chakra" },
          ].map((item) => {
            const assets = getCompassAssets(item.type);
            return (
              <Pressable
                key={item.label}
                style={[
                  styles.compassCard,
                  {
                    backgroundColor: "#BD202E",
                    borderColor: isDarkMode ? "#CBD5E1" : "#3a3a5a",
                  },
                ]}
                onPress={() => {
                  if (item.type === "zone16") {
                    Alert.alert(
                      "Under Maintenance",
                      "16 Zone Compass is under maintenance, but you can open and test the compass."
                    );
                  }
                  router.push(item.route);
                }}
              >
                <View style={[styles.compassImageContainer, { borderColor: isDarkMode ? "#CBD5E1" : "#3a3a5a" }]}>
                  <Image
                    source={assets.dial}
                    style={[
                      styles.compassDial,
                      {
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
                      styles.compassNeedle,
                      { 
                        transform: [
                          { translateX }, 
                          { translateY }, 
                          { rotate: needleRotate },
                          { scale: assets.dialScale * 0.74 },
                        ],
                      },
                    ]}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.compassLabel, { color: "#ffffff" }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Bottom Buttons */}
        <View style={styles.bottomButtons}>
          <Pressable style={[styles.bottomBtn, { backgroundColor: "#BD202E", borderColor: "#a01b26" }]} onPress={() => setShowUserGuide(true)}>
            <Text style={[styles.bottomBtnText, { color: "#ffffff" }]}>User Guide</Text>
          </Pressable>
          <Pressable style={[styles.bottomBtn, { backgroundColor: "#BD202E", borderColor: "#a01b26" }]} onPress={() => openWebsite('https://sanskarvastu.com/consultancy')}>
            <Text style={[styles.bottomBtnText, { color: "#ffffff" }]}>Vastu Consultancy Services</Text>
          </Pressable>
        </View>

        <View style={styles.bottomButtons}>
          <Pressable style={[styles.bottomBtn, { backgroundColor: "#BD202E", borderColor: "#a01b26" }]}>
            <Text style={[styles.bottomBtnText, { color: "#ffffff" }]}>Vastu Courses</Text>
          </Pressable>
          <Pressable style={[styles.bottomBtn, { backgroundColor: "#BD202E", borderColor: "#a01b26" }]} onPress={() => openWebsite('https://sanskarvastu.com/contact')}>
            <Text style={[styles.bottomBtnText, { color: "#ffffff" }]}>Contact Us</Text>
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
                <Text style={styles.drawerVersion}>Version: {appVersion}</Text>
                <Text style={styles.drawerTitle}>Vastu Compass</Text>
              </View>

              {/* Menu Items */}
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

                <Pressable style={styles.menuItem} onPress={() => { setDrawerOpen(false); setShowUserGuide(true); }}>
                  <MaterialIcons name="help-outline" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>How to use Sanskar Compass</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </Pressable>

                <Pressable style={styles.menuItem}>
                  <MaterialIcons name="school" size={24} color="#ffffff" style={styles.menuIconStyle} />
                  <Text style={styles.menuText}>Join SanskarVastu Course</Text>
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
            <Text style={styles.userGuideTitle}>How to Use Sanskar Compass</Text>
            <Pressable onPress={() => setShowUserGuide(false)}>
              <Text style={styles.userGuideClose}>✕</Text>
            </Pressable>
          </View>
          
          <ScrollView style={styles.userGuideContent} showsVerticalScrollIndicator={false}>
            {/* What's New */}
            <View style={[styles.guideSection, { backgroundColor: '#E3F2FD', padding: 16, borderRadius: 12, marginBottom: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="new-releases" size={24} color="#1976D2" style={{ marginRight: 8 }} />
                <Text style={[styles.guideSectionTitle, { color: '#1565C0', fontSize: 18 }]}>What's New - Enhanced Safety!</Text>
              </View>
              <View style={styles.guideList}>
                <Text style={[styles.guideListItem, { marginBottom: 8 }]}>
                  <Text style={[styles.guideListText, { color: '#0D47A1' }]}>
                    <MaterialIcons name="check-circle" size={16} color="#4CAF50" /> <Text style={{ fontWeight: '700' }}>Never Crashes:</Text> Advanced error protection prevents all permission-related crashes
                  </Text>
                </Text>
                <Text style={[styles.guideListItem, { marginBottom: 8 }]}>
                  <Text style={[styles.guideListText, { color: '#0D47A1' }]}>
                    <MaterialIcons name="check-circle" size={16} color="#4CAF50" /> <Text style={{ fontWeight: '700' }}>Works Without Permissions:</Text> All features gracefully degrade if you deny permissions
                  </Text>
                </Text>
                <Text style={[styles.guideListItem, { marginBottom: 8 }]}>
                  <Text style={[styles.guideListText, { color: '#0D47A1' }]}>
                    <MaterialIcons name="check-circle" size={16} color="#4CAF50" /> <Text style={{ fontWeight: '700' }}>Smart Fallbacks:</Text> Automatically uses alternative sensors when permissions denied
                  </Text>
                </Text>
                <Text style={styles.guideListItem}>
                  <Text style={[styles.guideListText, { color: '#0D47A1' }]}>
                    <MaterialIcons name="check-circle" size={16} color="#4CAF50" /> <Text style={{ fontWeight: '700' }}>Clear Messages:</Text> User-friendly alerts instead of technical errors
                  </Text>
                </Text>
              </View>
            </View>

            {/* Getting Started */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="location-on" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Welcome!</Text>
              </View>
              <Text style={styles.guideText}>
                This app helps you find directions and apply Vastu Shastra (ancient science of architecture) to your home, office, or any space. It's like having a compass and Vastu expert in your pocket! Let's get started.
              </Text>
            </View>

            {/* Permissions */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="lock" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Permissions - Smart & Safe</Text>
              </View>
              <Text style={styles.guideSubtitle}>To give you the best experience, we request a few permissions:</Text>
              <View style={styles.guideList}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <MaterialIcons name="camera-alt" size={16} color="#4CAF50" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.guideListText, { fontWeight: '600' }]}>Camera (Optional)</Text>
                    <Text style={[styles.guideListText, { fontSize: 12, color: '#666' }]}>Take photos with compass directions overlaid. If denied, compass still works - you just can't take photos.</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <MaterialIcons name="location-on" size={16} color="#2196F3" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.guideListText, { fontWeight: '600' }]}>Location (Recommended)</Text>
                    <Text style={[styles.guideListText, { fontSize: 12, color: '#666' }]}>Improves compass accuracy with true heading. If denied, app uses magnetometer sensors - compass still works!</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <MaterialIcons name="image" size={16} color="#FF9800" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.guideListText, { fontWeight: '600' }]}>Media Library (Optional)</Text>
                    <Text style={[styles.guideListText, { fontSize: 12, color: '#666' }]}>Save compass photos to your gallery. If denied, you can still share photos without saving.</Text>
                  </View>
                </View>
              </View>
              <View style={{ backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginTop: 8, marginBottom: 8 }}>
                <Text style={[styles.guideText, { fontSize: 13, color: '#2E7D32' }]}>
                  <MaterialIcons name="check-circle" size={14} color="#4CAF50" /> <Text style={{ fontWeight: '600' }}>Good News:</Text> The app works even if you deny all permissions! Basic compass functionality always available.
                </Text>
              </View>
              <Text style={styles.guideText}>
                Manage permissions anytime: Menu (☰) → "Manage Permissions". You can toggle them on/off as needed.
              </Text>
            </View>

            {/* Compass Types */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="explore" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Choose Your Compass</Text>
              </View>
              <Text style={[styles.guideText, { marginBottom: 12 }]}>
                We have 4 different compasses for different needs:
              </Text>
              <View style={styles.guideList}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.guideListItem}>
                    <Text style={{fontWeight: '700', fontSize: 15}}>
                      <MaterialIcons name="explore" size={16} color="#000" />{' '}
                      Normal Compass
                    </Text>
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4 }]}>
                    A basic compass showing the 4 main directions (North, South, East, West). Perfect for everyday use - just like the compass you learned about in school!
                  </Text>
                </View>
                
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.guideListItem}>
                    <Text style={{fontWeight: '700', fontSize: 15}}>
                      <MaterialIcons name="view-module" size={16} color="#000" />{' '}
                      16 Zone Vastu Compass
                    </Text>
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4 }]}>
                    Divides your space into 16 sections. Good for checking basic Vastu for rooms like bedroom, kitchen, or living room. Great for beginners!
                  </Text>
                </View>
                
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.guideListItem}>
                    <Text style={{fontWeight: '700', fontSize: 15}}>
                      <MaterialIcons name="grid-view" size={16} color="#000" />{' '}
                      32 Zone Vastu Compass
                    </Text>
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4 }]}>
                    Divides your space into 32 detailed sections. For advanced Vastu analysis of your entire property. Recommended for serious Vastu practitioners or consultants.
                  </Text>
                </View>
                
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.guideListItem}>
                    <Text style={{fontWeight: '700', fontSize: 15}}>
                      <MaterialIcons name="flare" size={16} color="#000" />{' '}
                      SanskarVastu Chakra
                    </Text>
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4 }]}>
                    A special energy wheel used in Sanskar Vastu science. Shows energy flow patterns in your space. Perfect for Vastu experts and energy healers.
                  </Text>
                </View>
              </View>
            </View>

            {/* Using Compass */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="smartphone" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>How to Use</Text>
              </View>
              <Text style={[styles.guideText, { marginBottom: 12 }]}>
                It's super easy! Just follow these steps:
              </Text>
              <View style={styles.guideSteps}>
                <Text style={styles.guideStep}><Text style={{fontWeight: '700'}}>1.</Text> On the main screen, tap on any compass card (Normal, 16 Zone, 32 Zone, or Chakra)</Text>
                <Text style={styles.guideStep}><Text style={{fontWeight: '700'}}>2.</Text> The compass will open - hold your phone flat like a tray</Text>
                <Text style={styles.guideStep}><Text style={{fontWeight: '700'}}>3.</Text> The red needle points to North. Rotate yourself (not the phone) to face any direction</Text>
                <Text style={styles.guideStep}><Text style={{fontWeight: '700'}}>4.</Text> Tap the camera icon to take a photo with the compass overlay</Text>
                <Text style={styles.guideStep}><Text style={{fontWeight: '700'}}>5.</Text> Your photo will be saved with directions marked - perfect for sharing or Vastu analysis!</Text>
              </View>
            </View>

            {/* Features */}
            <View style={styles.guideSection}>
              <Text style={styles.guideSectionTitle}>
                <MaterialIcons name="star" size={18} color="#000" />{' '}
                Cool Features
              </Text>
              <View style={styles.guideList}>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><MaterialIcons name="explore" size={14} color="#000" /> <Text style={{fontWeight: '700'}}>Live Direction:</Text> Watch the needle move as you turn - shows where you're facing right now</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><MaterialIcons name="my-location" size={14} color="#000" /> <Text style={{fontWeight: '700'}}>Your Location:</Text> See your exact GPS coordinates (those long numbers are your location on Earth!)</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><MaterialIcons name="battery-full" size={14} color="#000" /> <Text style={{fontWeight: '700'}}>Signal Strength:</Text> Shows how strong the magnetic field is around you</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><MaterialIcons name="photo-camera" size={14} color="#000" /> <Text style={{fontWeight: '700'}}>Save Photos:</Text> Take pictures with compass directions on them - save and share easily</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><MaterialIcons name="share" size={14} color="#000" /> <Text style={{fontWeight: '700'}}>Share App:</Text> Love the app? Share it with friends and family from the menu</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><MaterialIcons name="shield" size={14} color="#4CAF50" /> <Text style={{fontWeight: '700'}}>Smart Error Protection:</Text> Never crashes! Built-in safety handles permission errors gracefully</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><MaterialIcons name="settings" size={14} color="#FF9800" /> <Text style={{fontWeight: '700'}}>Easy Permission Control:</Text> Toggle permissions on/off anytime from the menu</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}><MaterialIcons name="layers" size={14} color="#2196F3" /> <Text style={{fontWeight: '700'}}>Sensor Fusion:</Text> Uses gyroscope + accelerometer + magnetometer for maximum accuracy</Text></Text>
              </View>
            </View>

            {/* Tips */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="lightbulb-outline" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Tips for Best Results</Text>
              </View>
              <View style={styles.guideList}>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>✓ Hold phone flat and steady (like holding a plate of food)</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>✓ Stay away from metal things, magnets, speakers, or electronic devices</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>✓ Works best outside or near windows (better GPS signal)</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>✓ Wait 3-5 seconds for the needle to stop moving before taking a photo</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>✓ Compass acting weird? Wave your phone in a figure-8 pattern to reset it</Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>✓ Grant location permission for best accuracy (but compass works without it too!)</Text></Text>
              </View>
            </View>

            {/* Troubleshooting */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="build" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Troubleshooting & Common Issues</Text>
              </View>
              
              <Text style={[styles.guideSubtitle, { marginTop: 8 }]}>Permission Issues:</Text>
              <View style={styles.guideList}>
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.guideListText, { fontWeight: '600' }]}>
                    <MaterialIcons name="block" size={14} color="#F44336" /> App asks for permission but I denied it:
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4, fontSize: 13 }]}>
                    Don't worry! The app will continue working with reduced features. You can grant permission later from Menu → Manage Permissions or your phone's Settings → Apps → Sanskar Compass → Permissions.
                  </Text>
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.guideListText, { fontWeight: '600' }]}>
                    <MaterialIcons name="error-outline" size={14} color="#FF9800" /> Getting "Permission Denied" errors:
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4, fontSize: 13 }]}>
                    This is normal and won't crash the app! We've built smart error handling. The app automatically switches to backup sensors when permissions are denied. Just tap "Open Settings" in the alert to enable permissions if you want full features.
                  </Text>
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.guideListText, { fontWeight: '600' }]}>
                    <MaterialIcons name="warning" size={14} color="#FF5722" /> Can't save photos even with permission:
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4, fontSize: 13 }]}>
                    If you're using Expo Go on Android, media library isn't supported. Use the "Share" button instead to send photos to other apps. For full functionality, ask your developer for a development build.
                  </Text>
                </View>
              </View>

              <Text style={[styles.guideSubtitle, { marginTop: 16 }]}>Compass Issues:</Text>
              <View style={styles.guideList}>
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.guideListText, { fontWeight: '600' }]}>
                    <MaterialIcons name="rotate-left" size={14} color="#2196F3" /> Needle spinning or jumping around:
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4, fontSize: 13 }]}>
                    Move away from magnetic interference (metal furniture, speakers, chargers). Calibrate your phone's compass by moving it in a figure-8 pattern in the air.
                  </Text>
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.guideListText, { fontWeight: '600' }]}>
                    <MaterialIcons name="gps-off" size={14} color="#9E9E9E" /> Shows wrong direction:
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4, fontSize: 13 }]}>
                    Enable location permission for true heading accuracy. Without it, the compass uses magnetic north which can vary by location. Also ensure you're holding the phone flat, not tilted.
                  </Text>
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.guideListText, { fontWeight: '600' }]}>
                    <MaterialIcons name="camera-alt" size={14} color="#4CAF50" /> Camera won't open:
                  </Text>
                  <Text style={[styles.guideListText, { marginLeft: 0, marginTop: 4, fontSize: 13 }]}>
                    Grant camera permission when asked. If you accidentally denied it, go to Menu → Manage Permissions and toggle Camera ON. If still not working, check phone Settings → Apps → Sanskar Compass → Permissions.
                  </Text>
                </View>
              </View>

              <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginTop: 12 }}>
                <Text style={[styles.guideText, { fontSize: 13, color: '#E65100' }]}>
                  <MaterialIcons name="info" size={14} color="#FF9800" /> <Text style={{ fontWeight: '600' }}>Remember:</Text> Even if something goes wrong, the app won't crash! We've added advanced error protection so you can always use the basic compass features.
                </Text>
              </View>
            </View>

            {/* Which Compass When */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="help-outline" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Which Compass Should I Use?</Text>
              </View>
              <View style={styles.guideList}>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>
                  <MaterialIcons name="home" size={14} color="#000" /> <Text style={{fontWeight: '700'}}>For checking room direction:</Text> Use Normal Compass
                </Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>
                  <MaterialIcons name="weekend" size={14} color="#000" /> <Text style={{fontWeight: '700'}}>For basic Vastu (furniture placement):</Text> Use 16 Zone Compass
                </Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>
                  <MaterialIcons name="apartment" size={14} color="#000" /> <Text style={{fontWeight: '700'}}>For complete home/office Vastu:</Text> Use 32 Zone Compass
                </Text></Text>
                <Text style={styles.guideListItem}><Text style={styles.guideListText}>
                  <MaterialIcons name="auto-fix-high" size={14} color="#000" /> <Text style={{fontWeight: '700'}}>For energy and chakra analysis:</Text> Use SanskarVastu Chakra
                </Text></Text>
              </View>
            </View>

            {/* Vastu Consultancy */}
            <View style={styles.guideSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="business" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.guideSectionTitle}>Need Expert Help?</Text>
              </View>
              <Text style={styles.guideText}>
                Want a professional Vastu consultant to analyze your property? We offer personalized Vastu services! Just tap on "Vastu Consultancy Services" button on the home screen or contact us through the menu. Our experts will guide you step by step.
              </Text>
            </View>

            {/* Support */}
            <View style={styles.guideSection}>
              <Text style={styles.guideSectionTitle}>
                <MaterialIcons name="chat" size={18} color="#000" />{' '}
                Have Questions?
              </Text>
              <Text style={styles.guideText}>
                Confused about something? Want to suggest a new feature? Tap the menu (☰) and select "Send Feedback". We read every message and reply quickly - usually within 24 hours!
              </Text>
            </View>

            <View style={{ marginBottom: 20, padding: 16, backgroundColor: '#f0f9ff', borderRadius: 12 }}>
              <Text style={{ fontSize: 14, color: '#BD202E', textAlign: 'center', fontWeight: '600' }}>
                <MaterialIcons name="favorite" size={18} color="#000" />{' '}Thank you for using Sanskar Compass!{'\n'}
                <Text style={{ fontWeight: '400', fontSize: 13 }}>May your space bring prosperity and peace</Text>
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
                <MaterialIcons name="camera-alt" size={32} color="#000" style={styles.permissionIconStyle} />
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
                <MaterialIcons name="location-on" size={32} color="#000" style={styles.permissionIconStyle} />
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
                <MaterialIcons name="image" size={32} color="#000" style={styles.permissionIconStyle} />
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
