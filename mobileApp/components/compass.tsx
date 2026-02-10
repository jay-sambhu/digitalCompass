import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { Magnetometer } from "expo-sensors";
import { degreeToDirection16 } from "../utils/direction";
import { styles } from "../styles/compass.styles";

type MagData = { x: number; y: number; z: number };
//function started
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


