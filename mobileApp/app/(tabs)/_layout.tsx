import React from "react";
import { Text } from "react-native";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="compass"
        options={{
          title: "Compass 1",
          headerShown: false,
          tabBarLabel: "Compass 1",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🧭</Text>,
        }}
      />
      <Tabs.Screen
        name="compass2"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
