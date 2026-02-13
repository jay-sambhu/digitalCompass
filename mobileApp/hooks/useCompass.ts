import { useEffect, useState } from "react";
import { Magnetometer } from "expo-sensors";

export default function useCompass() {
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    try {
      Magnetometer.setUpdateInterval(150);
    } catch (error: any) {
      console.warn("[Sensor Error] Failed to set magnetometer interval:", error?.message || "Unknown error");
    }
    
    let sub: any;
    try {
      sub = Magnetometer.addListener(data => {
        try {
          if (!data || typeof data.x !== "number" || typeof data.y !== "number") {
            return;
          }
          let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
          if (angle < 0) angle += 360;
          setHeading(Math.round(angle));
        } catch (error: any) {
          console.warn("[Sensor Error] Magnetometer data processing failed:", error?.message || "Unknown error");
        }
      });
    } catch (error: any) {
      console.error("[Sensor Error] Failed to subscribe to magnetometer:", error?.message || "Unknown error");
    }

    return () => {
      try {
        sub?.remove?.();
      } catch (error: any) {
        console.warn("[Sensor Error] Failed to remove magnetometer subscription:", error?.message || "Unknown error");
      }
    };
  }, []);

  return heading;
}
