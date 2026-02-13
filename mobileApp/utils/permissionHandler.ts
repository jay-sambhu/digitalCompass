import { Alert, Platform, Linking } from "react-native";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import { PermissionResponse } from "expo-camera";
import Constants from "expo-constants";

/**
 * Permission Handler Utility
 * Provides safe wrappers for all permission requests with proper error handling
 */

interface PermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  error?: string;
}

/**
 * Safe wrapper for location permission request
 */
export const requestLocationPermission = async (): Promise<PermissionResult> => {
  try {
    const response = await Location.requestForegroundPermissionsAsync();
    return {
      granted: response.granted,
      canAskAgain: response.canAskAgain,
    };
  } catch (error: any) {
    console.error("[Permission Error] Location:", error);
    return {
      granted: false,
      canAskAgain: false,
      error: error?.message || "Failed to request location permission",
    };
  }
};

/**
 * Safe wrapper for getting current location permission status
 */
export const getLocationPermissionStatus = async (): Promise<Location.LocationPermissionResponse | null> => {
  try {
    return await Location.getForegroundPermissionsAsync();
  } catch (error: any) {
    console.error("[Permission Error] Get Location Status:", error);
    return null;
  }
};

/**
 * Safe wrapper for camera permission request
 */
export const requestCameraPermissionSafe = async (
  requestCamPerm: () => Promise<PermissionResponse>
): Promise<PermissionResult> => {
  try {
    const response = await requestCamPerm();
    return {
      granted: response.granted,
      canAskAgain: response.canAskAgain,
    };
  } catch (error: any) {
    console.error("[Permission Error] Camera:", error);
    return {
      granted: false,
      canAskAgain: false,
      error: error?.message || "Failed to request camera permission",
    };
  }
};

/**
 * Safe wrapper for media library permission request
 */
export const requestMediaLibraryPermission = async (): Promise<PermissionResult> => {
  // Check if running in Expo Go on Android (media library not supported)
  const isExpoGoAndroid = Platform.OS === "android" && Constants.appOwnership === "expo";
  
  if (isExpoGoAndroid) {
    return {
      granted: false,
      canAskAgain: false,
      error: "Media library not available in Expo Go. Please use a development build.",
    };
  }

  try {
    const response = await MediaLibrary.requestPermissionsAsync();
    return {
      granted: response.granted,
      canAskAgain: response.canAskAgain,
    };
  } catch (error: any) {
    console.error("[Permission Error] Media Library:", error);
    return {
      granted: false,
      canAskAgain: false,
      error: error?.message || "Failed to request media library permission",
    };
  }
};

/**
 * Safe wrapper for getting media library permission status
 */
export const getMediaLibraryPermissionStatus = async (): Promise<MediaLibrary.PermissionResponse | null> => {
  const isExpoGoAndroid = Platform.OS === "android" && Constants.appOwnership === "expo";
  
  if (isExpoGoAndroid) {
    return {
      status: "denied",
      granted: false,
      canAskAgain: false,
      expires: "never",
    } as MediaLibrary.PermissionResponse;
  }

  try {
    return await MediaLibrary.getPermissionsAsync();
  } catch (error: any) {
    console.error("[Permission Error] Get Media Library Status:", error);
    return null;
  }
};

/**
 * Show permission denied alert with option to open settings
 */
export const showPermissionDeniedAlert = (
  permissionName: string,
  canAskAgain: boolean = true
) => {
  const title = "Permission Required";
  const message = canAskAgain
    ? `${permissionName} permission is required for this feature. Please grant permission.`
    : `${permissionName} permission was permanently denied. Please enable it from device settings.`;

  Alert.alert(
    title,
    message,
    canAskAgain
      ? [{ text: "OK", style: "cancel" }]
      : [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
  );
};

/**
 * Show generic permission error alert
 */
export const showPermissionErrorAlert = (error: string) => {
  Alert.alert(
    "Permission Error",
    `An error occurred while requesting permission: ${error}`,
    [{ text: "OK", style: "cancel" }]
  );
};

/**
 * Handle permission result and show appropriate alerts
 */
export const handlePermissionResult = (
  result: PermissionResult,
  permissionName: string,
  onGranted?: () => void,
  onDenied?: () => void
): boolean => {
  if (result.error) {
    showPermissionErrorAlert(result.error);
    onDenied?.();
    return false;
  }

  if (!result.granted) {
    showPermissionDeniedAlert(permissionName, result.canAskAgain);
    onDenied?.();
    return false;
  }

  onGranted?.();
  return true;
};

/**
 * Request location permission with error handling and user feedback
 */
export const requestLocationWithFeedback = async (
  onGranted?: () => void,
  onDenied?: () => void
): Promise<boolean> => {
  const result = await requestLocationPermission();
  return handlePermissionResult(result, "Location", onGranted, onDenied);
};

/**
 * Request camera permission with error handling and user feedback
 */
export const requestCameraWithFeedback = async (
  requestCamPerm: () => Promise<PermissionResponse>,
  onGranted?: () => void,
  onDenied?: () => void
): Promise<boolean> => {
  const result = await requestCameraPermissionSafe(requestCamPerm);
  return handlePermissionResult(result, "Camera", onGranted, onDenied);
};

/**
 * Request media library permission with error handling and user feedback
 */
export const requestMediaLibraryWithFeedback = async (
  onGranted?: () => void,
  onDenied?: () => void
): Promise<boolean> => {
  const result = await requestMediaLibraryPermission();
  return handlePermissionResult(result, "Media Library", onGranted, onDenied);
};
