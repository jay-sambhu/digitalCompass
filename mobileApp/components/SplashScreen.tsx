import React, { useEffect, useRef } from "react";
import {
  View,
  Image,
  Text,
  Animated,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number;
}

export const SplashScreenComponent = ({
  onFinish,
  duration = 3500,
}: SplashScreenProps) => {
  const { width } = useWindowDimensions();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const sloganTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const animations = Animated.sequence([
      // Logo fade in and scale
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Slogan fade in and slide up
      Animated.parallel([
        Animated.timing(sloganOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(sloganTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animations.start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(sloganOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onFinish();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require("../assets/splashScreen/splash-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Slogan */}
        <Animated.View
          style={[
            styles.sloganContainer,
            {
              opacity: sloganOpacity,
              transform: [{ translateY: sloganTranslateY }],
            },
          ]}
        >
          <Text style={styles.sloganText}>
            नेपालमा Numerology & Vastu काे {"\n"}Course सुरुवात गर्ने नेपालको
{"\n"}पहिलो संस्था & एक मात्र सस्था-- Sanskar Academy
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};
//function part
//css for splash screen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
  },
  sloganContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  sloganText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    color: "#333333",
    lineHeight: 22,
    letterSpacing: 0.3,
  },
});
