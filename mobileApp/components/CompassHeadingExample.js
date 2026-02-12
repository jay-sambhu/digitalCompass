import React, { useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, Animated } from "react-native";
import useAdvancedCompass from "../hooks/useAdvancedCompass";

export default function CompassHeadingExample() {
  const heading = useAdvancedCompass();
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: heading,
      duration: 70,
      useNativeDriver: false,
    }).start();
  }, [heading, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{Math.round(heading)}°</Text>

      <View style={styles.dial}>
        <Animated.Image
          source={require("../assets/normalCompass/needle.png")}
          style={[styles.needle, { transform: [{ rotate }] }]}
          resizeMode="contain"
        />
      </View>

      <Image
        source={require("../assets/normalCompass/dial.png")}
        style={styles.dialImage}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  text: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 16,
    color: "#111",
  },
  dial: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  needle: {
    width: 160,
    height: 160,
    position: "absolute",
  },
  dialImage: {
    width: 240,
    height: 240,
    position: "absolute",
  },
});
