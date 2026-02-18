import React, { useEffect } from "react";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { installGlobalErrorHandlers } from "../utils/errorHandling";
// Keep native splash visible until base app setup is done.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    installGlobalErrorHandlers();
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch((e) => {
      console.warn("Splash hide error:", e);
    });
  }, [ready]);

  if (!ready) {
    return null;
  }

  return <Slot />;
}
