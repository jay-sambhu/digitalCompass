import { useEffect, useRef, useState } from "react";
import { Accelerometer, Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

const normalizeHeading = (deg) => ((deg % 360) + 360) % 360;

// Returns the shortest signed angular difference in degrees [-180, 180]
const shortestDelta = (fromDeg, toDeg) => ((toDeg - fromDeg + 540) % 360) - 180;

// Smooth across 0<->360 boundaries without jumps
const smoothHeading = (prevDeg, nextDeg, alpha = 0.2) =>
  normalizeHeading(prevDeg + alpha * shortestDelta(prevDeg, nextDeg));

const normalizeVector = (v) => {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (!mag) return null;
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
};

// Tilt compensation math:
// 1) Normalize gravity (accelerometer) and magnetic vectors.
// 2) Compute roll/pitch from gravity.
// 3) Rotate magnetic vector into horizontal plane using roll/pitch.
// 4) Heading = atan2(Yh, Xh), then convert to [0..360).
const computeTiltCompensatedHeading = (magRaw, accRaw) => {
  const m = normalizeVector(magRaw);
  const g = normalizeVector(accRaw);
  if (!m || !g) return null;

  const roll = Math.atan2(g.y, g.z);
  const pitch = Math.atan2(-g.x, Math.sqrt(g.y * g.y + g.z * g.z));

  const xh = m.x * Math.cos(pitch) + m.z * Math.sin(pitch);
  const yh =
    m.x * Math.sin(roll) * Math.sin(pitch) +
    m.y * Math.cos(roll) -
    m.z * Math.sin(roll) * Math.cos(pitch);

  const headingRad = Math.atan2(yh, xh);
  return normalizeHeading((headingRad * 180) / Math.PI);
};

export function useCompassHeading() {
  const [heading, setHeading] = useState(0);

  const headingRef = useRef(0);
  const lastTrueHeadingTsRef = useRef(0);
  const latestAccRef = useRef(null);
  const latestMagRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let locationHeadingSub = null;
    let accelSub = null;
    let magSub = null;

    const pushHeading = (rawDeg, alpha = 0.2) => {
      if (!isMounted || rawDeg == null || Number.isNaN(rawDeg)) return;
      const smoothed = smoothHeading(headingRef.current, rawDeg, alpha);
      headingRef.current = smoothed;
      setHeading(smoothed);
    };

    const maybeUpdateFallback = () => {
      // Prefer trueHeading if we got one recently.
      const trueHeadingIsRecent = Date.now() - lastTrueHeadingTsRef.current < 2000;
      if (trueHeadingIsRecent) return;

      if (!latestAccRef.current || !latestMagRef.current) return;

      const tiltHeading = computeTiltCompensatedHeading(
        latestMagRef.current,
        latestAccRef.current
      );
      pushHeading(tiltHeading, 0.18);
    };

    const start = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          locationHeadingSub = await Location.watchHeadingAsync((data) => {
            // trueHeading is preferred when available (>= 0).
            // On some devices trueHeading may be -1; then we use magHeading/fallback.
            const hasTrueHeading =
              typeof data?.trueHeading === "number" && data.trueHeading >= 0;
            if (hasTrueHeading) {
              lastTrueHeadingTsRef.current = Date.now();
              pushHeading(data.trueHeading, 0.25);
              return;
            }

            if (typeof data?.magHeading === "number") {
              pushHeading(data.magHeading, 0.2);
            }
          });
        }
      } catch {
        // Ignore and keep sensor fallback.
      }

      Accelerometer.setUpdateInterval(50);
      Magnetometer.setUpdateInterval(50);

      accelSub = Accelerometer.addListener((accData) => {
        latestAccRef.current = accData;
        maybeUpdateFallback();
      });

      magSub = Magnetometer.addListener((magData) => {
        latestMagRef.current = magData;
        maybeUpdateFallback();
      });
    };

    start();

    return () => {
      isMounted = false;
      locationHeadingSub?.remove?.();
      accelSub?.remove?.();
      magSub?.remove?.();
    };
  }, []);

  return heading;
}

export default useCompassHeading;
