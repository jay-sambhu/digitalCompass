# Google Maps API Setup Guide for Sanskar Compass

## Overview

This guide will help you set up Google Maps API keys to enable the Satellite Map View feature in your Sanskar Compass app. This feature provides Google Earth-like functionality with satellite imagery, 3D buildings, and GPS coordinates display.

## What You Get

- 🛰️ Satellite and aerial imagery view
- 🏢 3D building visualization
- 🧭 Real-time compass integration on map
- 📍 Precise GPS coordinates display
- 🗺️ Hybrid map mode (satellite + roads)

---

## Step 1: Create a Google Cloud Project

1. Go to **[Google Cloud Console](https://console.cloud.google.com/)**
2. Sign in with your Google account
3. Click **"Select a project"** → **"New Project"**
4. Enter project name: `Sanskar Compass Maps`
5. Click **"Create"**

---

## Step 2: Enable Required APIs

1. In your Google Cloud Console, go to **"APIs & Services"** → **"Library"**
2. Search for and enable the following APIs:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Places API** (optional, for future features)

---

## Step 3: Create API Keys

### For Android:

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"API Key"**
3. A new API key will be created (e.g., `AIzaSyXXXXXXXXXXXXXXXXXX`)
4. Click **"Restrict Key"** (recommended for security)
5. Under **"Application restrictions"**:
   - Select **"Android apps"**
6. Click **"Add an item"**
   - Package name: `com.bobthedeveloper.mobileApp`
   - SHA-1 fingerprint: (see instructions below)
7. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Choose **"Maps SDK for Android"**
8. Click **"Save"**
9. Copy your Android API key

### For iOS:

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"API Key"**
3. Click **"Restrict Key"**
4. Under **"Application restrictions"**:
   - Select **"iOS apps"**
5. Click **"Add an item"**
   - Bundle ID: `com.bobthedeveloper.mobileApp`
6. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Choose **"Maps SDK for iOS"**
7. Click **"Save"**
8. Copy your iOS API key

---

## Step 4: Get SHA-1 Certificate Fingerprint (Android)

### For Development Build:

Run this command in your project directory:

```bash
cd android
./gradlew signingReport
```

Look for the **"SHA1"** fingerprint under the **"Task :app:signingReport"** section for the **debug** variant.

### Alternative method (Linux/Mac):

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### For Production Build:

If you're using EAS Build:

```bash
eas credentials
```

Select your project, then get the SHA-1 from your keystore.

---

## Step 5: Add API Keys to Your App

1. Open `app.json` in your project
2. Replace the placeholder API keys:

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_IOS_GOOGLE_MAPS_API_KEY_HERE" // Replace with your iOS key
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_ANDROID_GOOGLE_MAPS_API_KEY_HERE" // Replace with your Android key
        }
      }
    }
  }
}
```

**Example:**

```json
"googleMapsApiKey": "AIzaSyB1234567890abcdefghijklmnopqrstu"
```

---

## Step 6: Rebuild Your App

After adding the API keys, you need to rebuild your app:

### For Development:

```bash
# For Android
npx expo run:android

# For iOS
npx expo run:ios
```

### For Production (EAS Build):

```bash
# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

---

## Step 7: Test the Map Feature

1. Launch your app
2. On the home screen, you'll see a new **"Satellite Map View"** button (blue color with satellite icon)
3. Tap on it to open the map
4. You should see:
   - Satellite imagery
   - Your current location with a compass indicator
   - GPS coordinates at the bottom
   - Compass heading (degrees and direction) at the top right

---

## Troubleshooting

### Map shows "Loading Map..." forever

- Check that your API keys are correctly added to `app.json`
- Ensure you've enabled the Maps SDK for Android/iOS in Google Cloud Console
- Verify your app's bundle ID/package name matches the one in API restrictions

### "Authorization failure" error

- Verify SHA-1 fingerprint is correctly added (Android)
- Verify bundle ID is correctly added (iOS)
- Make sure API restrictions match the enabled APIs

### Black screen or tiles not loading

- Check your internet connection
- Verify the API keys are not restricted to wrong bundle IDs
- Make sure location permissions are granted

### Map works but no satellite view

- The map component is set to "hybrid" mode by default
- Check that Maps SDK is enabled (not just Places API)

---

## Cost & Billing

Google Maps Platform has a **free tier**:

- **$200 free credit** per month
- After that, pricing applies based on usage
- For typical mobile app usage, you'll likely stay within the free tier

**To avoid unexpected charges:**

1. Set up billing alerts in Google Cloud Console
2. Set quotas on your API keys
3. Monitor usage in Google Cloud Console

---

## Security Best Practices

1. ✅ **Always restrict your API keys** (by app bundle ID/package name)
2. ✅ **Never commit API keys to public repositories**
3. ✅ Use separate keys for development and production
4. ✅ Set up quotas to prevent abuse
5. ✅ Regularly rotate your API keys

---

## Next Steps

Once your map is working, you can enhance it further:

- Add markers for Vastu directions
- Show multiple locations
- Add drawing/measurement tools
- Integrate with your Vastu compass readings
- Save favorite locations

---

## Support

If you encounter issues:

1. Check the [Google Maps Platform documentation](https://developers.google.com/maps/documentation)
2. Review the [React Native Maps documentation](https://github.com/react-native-maps/react-native-maps)
3. Check Expo's [Maps documentation](https://docs.expo.dev/versions/latest/sdk/map-view/)

---

**Congratulations!** You now have Google Earth-like functionality integrated into your Sanskar Compass app! 🎉
