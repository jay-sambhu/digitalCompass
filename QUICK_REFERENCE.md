# Quick Reference: useAdvancedCompass Hook

## Basic Usage

### In a Functional Component
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";

export default function MyCompassComponent() {
  const heading = useAdvancedCompass(); // Returns 0-360 degrees
  
  return (
    <View>
      <Text>{Math.round(heading)}°</Text>
    </View>
  );
}
```

## Common Patterns

### 1. Display with Direction Names
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";
import { degreeToDirection16 } from "../utils/direction";

export default function DirectionDisplay() {
  const heading = useAdvancedCompass();
  
  return (
    <View>
      <Text>{Math.round(heading)}°</Text>
      <Text>{degreeToDirection16(heading)}</Text>
    </View>
  );
}
```

### 2. Animated Rotation (Already Used in CompassScreen)
```typescript
import Animated from "react-native-reanimated";
import useAdvancedCompass from "../hooks/useAdvancedCompass";

export default function RotatingCompass() {
  const heading = useAdvancedCompass();
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: heading,
      duration: 70,
      useNativeDriver: false,
    }).start();
  }, [heading]);

  const rotate = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.Image
      style={[{ transform: [{ rotate }] }]}
      source={require("../assets/needle.png")}
    />
  );
}
```

### 3. Conditional Rendering Based on Direction
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";

export default function DirectionAlert() {
  const heading = useAdvancedCompass();
  
  const isNorth = heading < 22.5 || heading > 337.5;
  const isSouth = heading >= 157.5 && heading < 202.5;
  const isEast = heading >= 67.5 && heading < 112.5;
  const isWest = heading >= 247.5 && heading < 292.5;

  return (
    <View>
      {isNorth && <Text>Facing North</Text>}
      {isSouth && <Text>Facing South</Text>}
      {isEast && <Text>Facing East</Text>}
      {isWest && <Text>Facing West</Text>}
    </View>
  );
}
```

### 4. With Camera (for AR Features)
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";
import { CameraView } from "expo-camera";

export default function ARCamera() {
  const heading = useAdvancedCompass();
  
  return (
    <CameraView style={{flex: 1}}>
      <Text style={{position: 'absolute', top: 20, left: 20}}>
        Heading: {Math.round(heading)}°
      </Text>
    </CameraView>
  );
}
```

### 5. Watch for Pointer Location (Rotate Arrow)
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";

export default function DirectionPointer() {
  const heading = useAdvancedCompass();
  
  // Helper function: get angle to point from north
  const angleToPoint = (targetHeading) => {
    const angle = targetHeading - heading;
    // Normalize to -180..180
    return ((angle + 180) % 360) - 180;
  };
  
  return (
    <View>
      <Text>
        {angleToPoint(90) > 0 ? "Turn right" : "Turn left"}
      </Text>
    </View>
  );
}
```

### 6. With State Management (Redux/Context)
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";
import { useAppDispatch } from "../store"; // or your state management
import { updateHeading } from "../store/compassSlice";

export default function CompassStateManager() {
  const heading = useAdvancedCompass();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(updateHeading(heading));
  }, [heading, dispatch]);

  return null; // Just manages state, doesn't render
}
```

### 7. Background Service (if needed)
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";

export default function HeadingService() {
  const heading = useAdvancedCompass();
  
  useEffect(() => {
    // Send to server, log, or trigger background tasks
    console.log("Current heading:", heading);
    
    // Example: API call
    // fetch(`/api/location/heading?value=${heading}`);
  }, [heading]);

  return null; // Invisible component that just updates state/server
}
```

## Combining with Other Hooks

### With useEffect for Specific Actions
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";

export default function HeadingChangeDetector() {
  const heading = useAdvancedCompass();
  const prevHeadingRef = useRef(0);

  useEffect(() => {
    const headingChange = heading - prevHeadingRef.current;
    const normalizedChange = ((headingChange + 180) % 360) - 180;
    
    if (Math.abs(normalizedChange) > 45) {
      // User rotated significantly
      console.log("Major rotation detected:", normalizedChange);
      // Trigger action
    }
    
    prevHeadingRef.current = heading;
  }, [heading]);

  return <Text>{Math.round(heading)}°</Text>;
}
```

## Error Handling

### Safe Usage
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";

export default function SafeCompass() {
  try {
    const heading = useAdvancedCompass();
    
    if (!heading || isNaN(heading)) {
      return <Text>Location services unavailable</Text>;
    }
    
    return <Text>{Math.round(heading)}°</Text>;
  } catch (error) {
    console.error("Compass error:", error);
    return <Text>Error reading compass</Text>;
  }
}
```

## TypeScript Type Definition

```typescript
// If you need to type the heading value
type CompassHeading = number; // 0-360 degrees

function useAdvancedCompass(): CompassHeading {
  // Returns a value between 0 and 360 inclusive
}
```

## Performance Tips

### 1. Memoize Component to Prevent Unnecessary Renders
```typescript
import React from "react";
import useAdvancedCompass from "../hooks/useAdvancedCompass";

const CompassDisplay = React.memo(({ heading }) => {
  return <Text>{Math.round(heading)}°</Text>;
});

export default function App() {
  const heading = useAdvancedCompass();
  return <CompassDisplay heading={heading} />;
}
```

### 2. Throttle Updates If Processing Heavy Logic
```typescript
import useAdvancedCompass from "../hooks/useAdvancedCompass";

export default function ThrottledCompass() {
  const heading = useAdvancedCompass();
  const [throttledHeading, setThrottledHeading] = useState(heading);
  const timoutRef = useRef(null);

  useEffect(() => {
    if (timoutRef.current) clearTimeout(timoutRef.current);
    
    timoutRef.current = setTimeout(() => {
      setThrottledHeading(heading);
    }, 100); // Update max every 100ms
    
    return () => clearTimeout(timoutRef.current);
  }, [heading]);

  return <Text>{Math.round(throttledHeading)}°</Text>;
}
```

## Migration Checklist

If migrating from old compass implementation:

- [ ] Replace `import useCompass from "../hooks/useCompass"` with `import useAdvancedCompass from "../hooks/useAdvancedCompass"`
- [ ] Replace `import useCompassHeading from "../hooks/useCompassHeading"` with `import useAdvancedCompass from "../hooks/useAdvancedCompass"`
- [ ] Update hook call: `useCompass()` → `useAdvancedCompass()`
- [ ] Update hook call: `useCompassHeading()` → `useAdvancedCompass()`
- [ ] Test rotation responsiveness (should be smooth)
- [ ] Test tilt compensation (heading should stay correct when tilted)
- [ ] Test long-term accuracy (should not drift)

## Sensor Availability Check (Optional)

If you want to check sensor availability on device:

```typescript
import { Accelerometer, Gyroscope, Magnetometer } from "expo-sensors";

export async function checkSensorAvailability() {
  const accelAvailable = await Accelerometer.isAvailableAsync?.();
  const gyroAvailable = await Gyroscope.isAvailableAsync?.();
  const magAvailable = await Magnetometer.isAvailableAsync?.();
  
  console.log({
    accelerometer: accelAvailable ?? "likely yes",
    gyroscope: gyroAvailable ?? "likely yes", 
    magnetometer: magAvailable ?? "likely yes",
  });
}
```

Note: The hook gracefully falls back if gyroscope is unavailable, so checking is optional.

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Heading jumps around | Normal during initial startup (3s calibration period) |
| Unfamiliar values | Ensure heading is 0-360°, not -180 to 180 |
| Getting 0 always | Check Location/sensor permissions required in app.json |
| App crashes on Android | Ensure expo-sensors version matches in package.json |
| Gyroscope not available | Falls back to accelerometer + magnetometer (still good) |

---

For more details, see [SENSOR_FUSION_GUIDE.md](../SENSOR_FUSION_GUIDE.md)
