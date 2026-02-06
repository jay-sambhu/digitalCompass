import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Magnetometer } from "expo-sensors";
import { degreeToDirection16 } from "../utils/direction";

type MagData = { x: number; y: number; z: number };

function headingFromMag({ x, y }: MagData): number {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  angle = angle >= 0 ? angle : angle + 360;
  return angle;
}

// Smooth across 0/360 boundary correctly
function smoothAngle(prev: number, next: number, alpha: number): number {
  // shortest signed difference in degrees (-180..180)
  let diff = ((next - prev + 540) % 360) - 180;
  const smoothed = prev + alpha * diff;
  return (smoothed + 360) % 360;
}

export default function Compass() {
  const [heading, setHeading] = useState<number>(0);
  const prevRef = useRef<number>(0);

  useEffect(() => {
    Magnetometer.setUpdateInterval(50); // faster updates

    const sub = Magnetometer.addListener((data) => {
      if (!data || typeof data.x !== "number" || typeof data.y !== "number") return;

      const raw = headingFromMag(data as MagData);

      // alpha: 0.15–0.30 is usually good (higher = faster but more jitter)
      const alpha = 0.22;
      const smooth = smoothAngle(prevRef.current, raw, alpha);

      prevRef.current = smooth;
      setHeading(smooth);
    });

    return () => sub?.remove();
  }, []);

  const deg = Math.round(heading);
  const dir = degreeToDirection16(heading);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Real-time Compass</Text>
      <Text style={styles.degree}>{deg}°</Text>
      <Text style={styles.dir}>{dir}</Text>
      <Text style={styles.hint}>Move phone slowly for stable reading.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "90%",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  title: { color: "#f8fafc", fontSize: 20, marginBottom: 10, letterSpacing: 0.3 },
  degree: { color: "#4ade80", fontSize: 54, fontWeight: "800", letterSpacing: 0.5 },
  dir: { color: "#e2e8f0", fontSize: 28, marginTop: 6, letterSpacing: 0.4 },
  hint: { color: "#94a3b8", marginTop: 14, fontSize: 12 },
});
