import React, { useEffect } from "react";
import { Slot } from "expo-router";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
//import of different layout
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = React.useState(false);
//state management
  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          Poppins: require("../assets/normalCompass/icon.png"), // Fallback - Poppins is system font on most devices
        });
      } catch (e) {
        console.warn("Font loading error:", e);
      } finally {
        setFontsLoaded(true);
        await SplashScreen.hideAsync();
      }
    }

    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }
//returning
  return <Slot />;
}