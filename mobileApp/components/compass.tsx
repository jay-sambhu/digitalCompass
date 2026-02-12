import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { Accelerometer, Gyroscope, Magnetometer } from "expo-sensors";
import { degreeToDirection16 } from "../utils/direction";
import { styles } from "../styles/compass.styles";
import useAdvancedCompass from "../hooks/useAdvancedCompass";

type MagData = { x: number; y: number; z: number };

// Smooth across 0/360 boundary correctly
function smoothAngle(prev: number, next: number, alpha: number): number {
  // shortest signed difference in degrees (-180..180)
  let diff = ((next - prev + 540) % 360) - 180;
  const smoothed = prev + alpha * diff;
  return (smoothed + 360) % 360;
}

export default function Compass() {
  // Use advanced compass with gyroscope + accelerometer + magnetometer
  const heading = useAdvancedCompass();

  const deg = Math.round(heading);
  const dir = degreeToDirection16(heading);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Real-time Compass (Advanced)</Text>
      <Text style={styles.degree}>{deg}°</Text>
      <Text style={styles.dir}>{dir}</Text>
      <Text style={styles.hint}>Uses gyroscope + sensors for accurate direction</Text>
    </View>
  );
}


