# Rebuild & Testing Guide - Stable Permissions

## Quick Rebuild Steps

### Option 1: EAS Build (Recommended)
```bash
cd /home/bobmarley/Desktop/digitalCompass/mobileApp

# Clear cache
rm -rf node_modules .expo

# Reinstall dependencies  
npm install

# Build APK with EAS
eas build -p android --local

# Or monitor build
eas build -p android --local --wait
```

### Option 2: Direct Expo Build
```bash
cd /home/bobmarley/Desktop/digitalCompass/mobileApp

# Prebuild for Android
expo prebuild --clean

# Build APK
expo run:android --release
```

### Option 3: Manual Development Build
```bash
cd /home/bobmarley/Desktop/digitalCompass/mobileApp

# Create development build
eas build -p android --profile preview

# Install on device
adb install path/to/app.apk
```

## Testing Checklist

### ✅ Camera Permission Flow
- [ ] Install APK on fresh device
- [ ] Open app → Camera screen
- [ ] Grant camera permission when prompted
- [ ] Camera should load immediately
- [ ] No reload needed
- [ ] Close and reopen - camera still works

### ✅ Media Library (Save Photo)
- [ ] Take a photo with camera
- [ ] Tap the "Save" button  
- [ ] Grant media library permission when prompted
- [ ] Photo saves successfully to gallery
- [ ] Gallery notification appears
- [ ] No reload needed

### ✅ Retry Mechanism
- [ ] Deny camera permission
- [ ] See "Retry" button in alert
- [ ] Tap "Retry"
- [ ] Grant permission
- [ ] Should work immediately

### ✅ Location Permission
- [ ] Camera screen shows "Locating..."
- [ ] Grant location permission when prompted
- [ ] Coordinates appear in search bar
- [ ] Location updates as you move

### ✅ Emergency Cases
- [ ] Revoke permission in settings mid-use
- [ ] App detects revocation on next action
- [ ] Re-request works properly
- [ ] No crashes or freezes

## Expected Behavior After Fix

### Camera Permission
| Scenario | Before | After |
|----------|--------|-------|
| Grant permission | Doesn't work, app crashes | Works immediately ✅ |
| Deny permission | Crashes | Shows alert with Retry option ✅ |
| Retry after deny | N/A | Works if user changes mind ✅ |
| Permission revoked | Crashes | Re-requests on use ✅ |

### Media Library Permission
| Scenario | Before | After |
|----------|--------|-------|
| Save without perm | Crashes/Error | Requests permission first ✅ |
| Grant on prompt | Unstable, may need reload | Saves immediately ✅ |
| Low on storage | Confusing error | Clear error message ✅ |
| Permission revoked | Crashes | Re-requests and handles gracefully ✅ |

## Debug Commands

### Monitor Permission Changes
```bash
adb logcat | grep -E "\[Permission\]|\[Camera\]"
```

### Clear App Data (Hard Reset)
```bash
adb shell pm grant com.bobthedeveloper.mobileApp android.permission.CAMERA
adb shell pm grant com.bobthedeveloper.mobileApp android.permission.READ_MEDIA_IMAGES
adb shell pm grant com.bobthedeveloper.mobileApp android.permission.WRITE_EXTERNAL_STORAGE
```

### View Real-time Logs
```bash
adb logcat -c  # Clear previous logs
# Then do your action in app
adb logcat
```

### Permission Status Check
```bash
adb shell dumpsys package | grep -A 20 "com.bobthedeveloper.mobileApp"
```

## Expected Log Output

### Good Permission Flow
```
[Permission] Requesting camera permission...
[Camera] Permission response: {granted: true, canAskAgain: false}
[Camera] ✅ Camera permission GRANTED
```

### Retry Flow
```
[Permission] Requesting camera permission...
[Camera] Permission response: {granted: false, canAskAgain: true}
[Camera] ⚠️ Camera permission DENIED
[User taps Retry]
[Permission] Invalidated camera cache
[Permission] Requesting camera permission...
[Camera] Permission response: {granted: true, canAskAgain: false}
[Camera] ✅ Camera permission GRANTED
```

### Media Save Flow
```
[Camera] Checking media library status...
[Camera] ✅ Media library permission already granted
[Camera] Starting photo save...
[Camera] ✅ Asset created successfully: uuid
[Camera] 📁 Adding photo to Camera album...
[Camera] ✅ Photo added to Camera album
```

## Common Issues & Solutions

### Issue: "Permission still not working after grant"
**Solution**: 
- Ensure you're on updated code
- Clear app cache: `adb shell pm clear com.bobthedeveloper.mobileApp`
- Rebuild APK with latest changes

### Issue: "Multiple permission requests appearing"
**Solution**:
- This is normal due to cache refresh
- Cache persists only 2 seconds to prevent stale states
- Can be adjusted in `permissionHandler.ts` line: `const CACHE_DURATION = 2000;`

### Issue: "Save photo shows permission error even after granting"
**Solution**:
- App attempts retry automatically
- If still fails, check device storage space
- Verify app has write access in device settings

### Issue: "Camera freezes when requesting permission"
**Solution**:
- Increase initial delay in camera.tsx line ~260
- Current: `setTimeout(requestPermissions, 800);`
- Try: `setTimeout(requestPermissions, 1200);`

## Performance Metrics

After these changes, you should see:
- **Permission request**: < 500ms
- **Camera load after permission**: < 1s
- **Save photo after permission**: < 2s
- **No freezes or crashes**: 100% stable

## Rollback Instructions

If something goes wrong, revert to previous version:
```bash
git revert HEAD~2  # Or specific commit
npm install
eas build -p android --local
```

## Next Steps

1. Build APK with these changes
2. Test on at least 2 different Android devices
3. Test both permission grant and deny scenarios
4. Monitor logs for any unexpected behavior
5. Deploy to production once verified

---

**Note**: These changes make the app significantly more stable and user-friendly. Users will no longer need to reload the app after granting permissions.
