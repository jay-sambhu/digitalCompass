import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import useCompass from "../hooks/useCompass";

export default function MapCompass() {
  const heading = useCompass();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Permission to access location was denied");
          setLoading(false);
          return;
        }

        // Get current location
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
        setLoading(false);

        // Watch position for updates
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (newLocation) => {
            setLocation(newLocation);
          },
        );
      } catch (error) {
        setErrorMsg("Error getting location");
        setLoading(false);
        console.error(error);
      }
    })();
  }, []);

  // Convert heading to cardinal direction
  const getCardinalDirection = (degrees: number): string => {
    const directions = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Map...</Text>
      </View>
    );
  }

  if (errorMsg || !location) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="map-marker-off"
          size={64}
          color="#FF3B30"
        />
        <Text style={styles.errorText}>
          {errorMsg || "Unable to get location"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map View with Satellite Imagery */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005, // Zoomed in for detail
          longitudeDelta: 0.005,
        }}
        mapType="hybrid" // Satellite view with roads overlay
        showsUserLocation
        showsMyLocationButton
        showsCompass
        showsBuildings // Enable 3D buildings
        pitchEnabled // Allow 3D tilt
        rotateEnabled
        toolbarEnabled={Platform.OS === "android"}
      >
        {/* User location marker with compass direction */}
        <Marker
          coordinate={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
          rotation={heading}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.markerContainer}>
            <MaterialCommunityIcons
              name="navigation"
              size={40}
              color="#007AFF"
              style={{ transform: [{ rotate: `${heading}deg` }] }}
            />
          </View>
        </Marker>
      </MapView>

      {/* Compass Heading Overlay */}
      <View style={styles.compassOverlay}>
        <View style={styles.compassCard}>
          <MaterialCommunityIcons name="compass" size={32} color="#007AFF" />
          <Text style={styles.headingText}>{heading}°</Text>
          <Text style={styles.directionText}>
            {getCardinalDirection(heading)}
          </Text>
        </View>
      </View>

      {/* GPS Coordinates Display */}
      <View style={styles.coordinatesOverlay}>
        <View style={styles.coordinatesCard}>
          <Text style={styles.coordinatesTitle}>GPS Coordinates</Text>
          <View style={styles.coordinateRow}>
            <Text style={styles.coordinateLabel}>Latitude:</Text>
            <Text style={styles.coordinateValue}>
              {location.coords.latitude.toFixed(6)}°
            </Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={styles.coordinateLabel}>Longitude:</Text>
            <Text style={styles.coordinateValue}>
              {location.coords.longitude.toFixed(6)}°
            </Text>
          </View>
          {location.coords.altitude && (
            <View style={styles.coordinateRow}>
              <Text style={styles.coordinateLabel}>Altitude:</Text>
              <Text style={styles.coordinateValue}>
                {location.coords.altitude.toFixed(1)}m
              </Text>
            </View>
          )}
          {location.coords.accuracy && (
            <View style={styles.coordinateRow}>
              <Text style={styles.coordinateLabel}>Accuracy:</Text>
              <Text style={styles.coordinateValue}>
                ±{location.coords.accuracy.toFixed(1)}m
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Map Type Info */}
      <View style={styles.mapTypeInfo}>
        <Text style={styles.mapTypeText}>📡 Satellite View • 3D Buildings</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#8E8E93",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#FF3B30",
    textAlign: "center",
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  compassOverlay: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 20,
    right: 20,
  },
  compassCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 100,
  },
  headingText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginTop: 8,
  },
  directionText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
    marginTop: 4,
  },
  coordinatesOverlay: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 100 : 80,
    left: 20,
    right: 20,
  },
  coordinatesCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  coordinatesTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 12,
  },
  coordinateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  coordinateLabel: {
    fontSize: 14,
    color: "#8E8E93",
    fontWeight: "500",
  },
  coordinateValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  mapTypeInfo: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 20,
    left: 20,
    backgroundColor: "rgba(0, 122, 255, 0.9)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapTypeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
