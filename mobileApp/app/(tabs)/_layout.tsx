import { Tabs } from "expo-router";
import React from "react";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarStyle: { display: "none" } }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="compass"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="compass2"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="compass3"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="compass4"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          href: null,
          headerShown: false,
          title: "Map View",
        }}
      />
    </Tabs>
  );
}
