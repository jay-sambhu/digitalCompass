import { useEffect, useRef, useState } from "react";
import { Accelerometer, Gyroscope, Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

/**
 * Advanced compass hook that combines:
 * - Gyroscope: Fast rotation updates
 * - Accelerometer: Tilt compensation
 * - Magnetometer: Absolute heading reference
 * Uses complementary filter for sensor fusion
 */

interface SensorData {
  x: number;
  y: number;
  z: number;
}

// Normalize a vector to unit length
const normalizeVector = (v: SensorData): SensorData | null => {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (mag === 0) return null;
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
};

// Clamp value between min and max
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// Normalize heading to 0-360 range
const normalizeHeading = (deg: number): number => {
  let normalized = deg % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
};

// Calculate shortest angular difference
const shortestDelta = (fromDeg: number, toDeg: number): number =>
  ((toDeg - fromDeg + 540) % 360) - 180;

// Smooth heading across 0<->360 boundary
const smoothHeading = (prevDeg: number, nextDeg: number, alpha: number): number =>
  normalizeHeading(prevDeg + alpha * shortestDelta(prevDeg, nextDeg));

// Compute tilt-compensated heading from sensor data
const computeTiltCompensatedHeading = (magRaw: SensorData, accRaw: SensorData): number | null => {
  const m = normalizeVector(magRaw);
  const g = normalizeVector(accRaw);
  
  if (!m || !g) return null;

  // Calculate roll and pitch from accelerometer
  const roll = Math.atan2(g.y, g.z);
  const pitch = Math.atan2(-g.x, Math.sqrt(g.y * g.y + g.z * g.z));

  // Rotate magnetic vector to horizontal plane
  const xh = m.x * Math.cos(pitch) + m.z * Math.sin(pitch);
  const yh =
    m.x * Math.sin(roll) * Math.sin(pitch) +
    m.y * Math.cos(roll) -
    m.z * Math.sin(roll) * Math.cos(pitch);

  const headingRad = Math.atan2(yh, xh);
  return normalizeHeading((headingRad * 180) / Math.PI);
};

// Complementary filter: combines gyroscope (fast updates) with other sensors (absolute reference)
const complementaryFilter = (
  gyroHeading: number,
  absoluteHeading: number | null,
  alpha: number = 0.98 // 0-1: higher = trust gyro more, lower = trust absolute more
): number => {
  if (absoluteHeading === null) return gyroHeading;
  
  // Use shortest path across 0<->360 boundary
  const delta = shortestDelta(gyroHeading, absoluteHeading);
  return normalizeHeading(gyroHeading + (1 - alpha) * delta);
};

export function useAdvancedCompass() {
  const [heading, setHeading] = useState(0);

  // Sensor data refs
  const headingRef = useRef(0);
  const lastLocationHeadingRef = useRef<number | null>(null);
  const lastLocationHeadingTimestampRef = useRef(0);
  
  const latestAccRef = useRef<SensorData | null>(null);
  const latestGyroRef = useRef<SensorData | null>(null);
  const latestMagRef = useRef<SensorData | null>(null);

  // Gyroscope integration
  const lastGyroTimestampRef = useRef(Date.now());
  const integratedHeadingRef = useRef(0);

  useEffect(() => {
    let isMounted = true;
    let locationHeadingSub: Location.LocationSubscription | null = null;
    let accelSub: any = null;
    let gyroSub: any = null;
    let magSub: any = null;

    const updateHeading = (newHeading: number, smoothFactor: number = 0.15) => {
      if (!isMounted || newHeading == null || isNaN(newHeading)) return;
      const smoothed = smoothHeading(headingRef.current, newHeading, smoothFactor);
      headingRef.current = smoothed;
      setHeading(smoothed);
    };

    // Process gyroscope data (fast updates)
    const processGyroData = (gyroData: SensorData) => {
      const now = Date.now();
      const dt = (now - lastGyroTimestampRef.current) / 1000; // Convert to seconds
      lastGyroTimestampRef.current = now;

      // Integrate gyroscope's rotation rate around Z-axis (heading change)
      // Gyroscope Z-axis is perpendicular to the screen in landscape orientation
      // Negative rotation = clockwise (positive heading direction)
      const rotationZ = gyroData.z; // rad/s
      const headingChange = (-rotationZ * 180) / Math.PI * dt; // Convert to degrees
      
      integratedHeadingRef.current = normalizeHeading(
        integratedHeadingRef.current + headingChange
      );
    };

    // Fallback: use sensor fusion when location heading is not available
    const maybeUpdateSensorFusion = () => {
      const locationHeadingIsRecent =
        lastLocationHeadingRef.current !== null &&
        Date.now() - lastLocationHeadingTimestampRef.current < 3000;

      if (locationHeadingIsRecent) return;

      if (!latestAccRef.current || !latestMagRef.current) return;

      // Compute tilt-compensated heading
      const sensorFusionHeading = computeTiltCompensatedHeading(
        latestMagRef.current,
        latestAccRef.current
      );

      if (sensorFusionHeading === null) return;

      // If gyroscope is available, use complementary filter
      if (latestGyroRef.current) {
        const filtered = complementaryFilter(
          integratedHeadingRef.current,
          sensorFusionHeading,
          0.95 // Trust gyro 95%, magnetometer 5%
        );
        updateHeading(filtered, 0.1);
      } else {
        // Without gyroscope, rely more heavily on magnetometer
        updateHeading(sensorFusionHeading, 0.2);
      }
    };

    const startSensors = async () => {
      try {
        // Request location permissions for true heading
        const permissionResponse = await Location.requestForegroundPermissionsAsync().catch((error) => {
          console.warn("Location permission request error:", error?.message || "Unknown error");
          return { status: "denied", granted: false, canAskAgain: false } as Location.LocationPermissionResponse;
        });
        
        if (permissionResponse?.granted) {
          try {
            locationHeadingSub = await Location.watchHeadingAsync((data) => {
              const hasTrueHeading =
                typeof data?.trueHeading === "number" && data.trueHeading >= 0;

              if (hasTrueHeading) {
                lastLocationHeadingRef.current = data.trueHeading;
                lastLocationHeadingTimestampRef.current = Date.now();
                // Sync integrated heading with true heading
                integratedHeadingRef.current = data.trueHeading;
                updateHeading(data.trueHeading, 0.25);
                return;
              }

              if (typeof data?.magHeading === "number") {
                lastLocationHeadingRef.current = data.magHeading;
                lastLocationHeadingTimestampRef.current = Date.now();
                integratedHeadingRef.current = data.magHeading;
                updateHeading(data.magHeading, 0.2);
              }
            }).catch((error) => {
              console.warn("Location heading watch failed:", error?.message || "Unknown error");
              return null;
            });
          } catch (e: any) {
            console.warn("Location heading watch setup failed:", e?.message || "Unknown error");
          }
        } else {
          console.log("Location permission not granted, using sensor fallback");
        }
      } catch (e: any) {
        console.warn("Location permission failed, using sensor fallback:", e?.message || "Unknown error");
      }

      // Set sensor update intervals
      // Accelerometer: 50ms (20 Hz)
      // Gyroscope: 30ms (33 Hz) - faster for smooth rotation updates
      // Magnetometer: 50ms (20 Hz)
      try {
        Accelerometer.setUpdateInterval(50);
      } catch (e) {
        console.warn("Failed to set accelerometer interval:", e);
      }

      try {
        Gyroscope.setUpdateInterval(30);
      } catch (e) {
        console.warn("Gyroscope not available or failed to set interval:", e);
      }

      try {
        Magnetometer.setUpdateInterval(50);
      } catch (e) {
        console.warn("Failed to set magnetometer interval:", e);
      }

      // Subscribe to accelerometer
      try {
        accelSub = Accelerometer.addListener((accData) => {
          latestAccRef.current = accData;
          maybeUpdateSensorFusion();
        });
      } catch (e) {
        console.warn("Accelerometer subscription failed:", e);
      }

      // Subscribe to gyroscope
      try {
        gyroSub = Gyroscope.addListener((gyroData) => {
          latestGyroRef.current = gyroData;
          processGyroData(gyroData);
          maybeUpdateSensorFusion();
        });
      } catch (e) {
        console.warn("Gyroscope not available on this device:", e);
      }

      // Subscribe to magnetometer
      try {
        magSub = Magnetometer.addListener((magData) => {
          latestMagRef.current = magData;
          maybeUpdateSensorFusion();
        });
      } catch (e) {
        console.warn("Magnetometer subscription failed:", e);
      }
    };

    startSensors();

    return () => {
      isMounted = false;
      locationHeadingSub?.remove?.();
      accelSub?.remove?.();
      gyroSub?.remove?.();
      magSub?.remove?.();
    };
  }, []);

  return heading;
}

export default useAdvancedCompass;
