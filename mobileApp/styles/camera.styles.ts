import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  
  topHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    zIndex: 10,
  },
  
  menuBtn: {
    padding: 8,
  },
  
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  searchText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  
  locationBtn: {
    padding: 8,
  },
  
  flipBtn: {
    position: "absolute",
    top: 70,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  
  compassContainer: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  compassDial: {
    opacity: 0.95,
  },
  compassNeedle: {
    position: "absolute",
  },
  
  bottomLeftInfo: {
    position: "absolute",
    bottom: 120,
    left: 20,
    backgroundColor: "transparent",
    padding: 10,
    borderRadius: 8,
  },
  bottomRightInfo: {
    position: "absolute",
    bottom: 120,
    right: 20,
    backgroundColor: "transparent",
    padding: 10,
    borderRadius: 8,
  },
  infoTitle: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  infoText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "600",
  },
  
  controls: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  navBtn: {
    alignItems: "center",
    gap: 4,
  },
  navBtnText: {
    color: "#BD202E",
    fontSize: 12,
    fontWeight: "600",
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  previewShot: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  previewShotInner: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  previewControls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  previewBtn: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
  },
  previewBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
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
    color: "#BD202E",
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
    color: "#BD202E",
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
    color: "#ffffff",    fontFamily: "Poppins",  },
  menuArrow: {
    fontSize: 24,
    color: "#ffffff",
  },
  
  cameraDialWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraDial: {
    opacity: 0.95,
  },
  cameraNeedle: {
    position: "absolute",
  },
  cameraOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cameraOverlayRow: {
    flexDirection: "row",
    gap: 6,
  },
  cameraOverlayLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  cameraOverlayValue: {
    color: "#fff",
    fontSize: 12,
  },
  
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 20, 
    backgroundColor: "#000" 
  },
  text: { 
    color: "#fff", 
    marginBottom: 12, 
    textAlign: "center" 
  },
  btn: { 
    backgroundColor: "#BD202E", 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 10 
  },
  btnText: { 
    color: "#fff", 
    fontWeight: "800" 
  },
});
