import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  quickRow: { marginTop: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", zIndex: 1, minHeight: 70 },
  quickRowCompact: { justifyContent: "space-around" },
  quickBtn: { alignItems: "center" },
  quickLabel: { marginTop: 4, fontWeight: "600", fontSize: 11, color: "#BD202E" },
  degreeTitle: { fontWeight: "800" },

  compassWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 0 },
  dialContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    overflow: "hidden",
  },
  dial: { overflow: "hidden", alignSelf: "center" },
  needle: { position: "absolute" },
  zoneStepItem: {
    position: "absolute",
    borderRadius: 999,
    overflow: "hidden",
  },
  zoneStepItemActive: {
    borderWidth: 1,
    borderColor: "#BD202E",
  },
  zoneStepImage: {
    width: "100%",
    height: "100%",
  },
  
  infoRowBelow: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  infoBoxBelow: { flex: 1, backgroundColor: "transparent", padding: 0, borderRadius: 0 },

  infoRow: { marginTop: 18, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", gap: 10, zIndex: 1 },
  infoRowCompact: { flexDirection: "column" },
  infoBox: { flex: 1 },
  infoTitle: { fontWeight: "800", color: "#000" },
  infoValue: { marginTop: 4, color: "#000" },
  red: { color: "#000", fontWeight: "800" },

  bottomNav: { marginTop: "auto", paddingVertical: 14, borderTopWidth: 1, borderColor: "#CBD5E1", flexDirection: "row", justifyContent: "space-around", alignItems: "center", zIndex: 1 },
  navItem: { alignItems: "center", flex: 1 },
  navLabel: { marginTop: 4, color: "#BD202E", fontWeight: "700" },
  captureBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },

  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  previewShot: { flex: 1 },
  previewImage: { flex: 1, resizeMode: "cover" },
  cameraDialWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraDial: { opacity: 0.95 },
  cameraNeedle: { position: "absolute" },
  cameraOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cameraOverlayRow: { flexDirection: "row", gap: 6 },
  cameraOverlayLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cameraOverlayValue: { color: "#fff", fontSize: 12 },
  
  /* Top Center Degree */
  degreeTopCenter: {
    position: "absolute",
    top: 30,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  degreeTopText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  
  /* Bottom Left - Geo Info */
  geoInfoBottom: {
    position: "absolute",
    bottom: 40,
    left: 20,
    backgroundColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  geoLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
  },
  geoValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
    marginTop: 2,
  },
  
  /* Bottom Right - Magnetic Field */
  magneticInfoBottom: {
    position: "absolute",
    bottom: 40,
    right: 20,
    backgroundColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  magneticLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
  },
  magneticValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
    marginTop: 2,
  },
  
  cameraControls: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: 16, backgroundColor: "#000" },
  camBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#BD202E", borderRadius: 8 },
  camBtnText: { color: "#fff", fontWeight: "600" },
  capture: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", borderWidth: 4, borderColor: "#CBD5E1" },

  cameraPermission: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  permissionText: { color: "#fff", fontSize: 16 },

  drawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
  },
  drawerContainer: {
    width: "70%",
    height: "100%",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  drawerHeader: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
  },
  drawerLogo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  drawerBrand: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 5,
  },
  drawerVersion: {
    fontSize: 13,
    color: "#888",
    marginBottom: 15,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  menuList: {
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    backgroundColor: "#BD202E",
    borderWidth: 1,
    borderColor: "#a01b26",
  },
  menuIconStyle: {
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    fontFamily: "Poppins",
  },
  menuArrow: {
    fontSize: 24,
    color: "#ffffff",
  },

  previewContainer: { flex: 1, backgroundColor: "#000" },
  previewControls: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: 16, backgroundColor: "#000", borderTopWidth: 1, borderTopColor: "#CBD5E1" },
  previewBtn: { alignItems: "center", paddingVertical: 12, paddingHorizontal: 20, backgroundColor: "#BD202E", borderRadius: 8 },
  previewBtnLabel: { fontSize: 12, fontWeight: "600", color: "#fff" },
});
