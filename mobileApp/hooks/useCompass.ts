import { useEffect, useState } from "react";
import { Magnetometer } from "expo-sensors";

export default function useCompass() {
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    Magnetometer.setUpdateInterval(150);
    
    const sub = Magnetometer.addListener(data => {
      let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      setHeading(Math.round(angle));
    });

    return () => sub.remove();
  }, []);

  return heading;
}
