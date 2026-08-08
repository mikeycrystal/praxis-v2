# Mobile Preview Runbook

Use this file to pick the fastest preview path instead of debugging Expo from scratch every time.

## Recommended Workflow

1. Use web preview for most UI and state work:

   ```sh
   npm run dev:web
   ```

   This opens the Expo web build on port `8083`. It is the fastest loop for Graph search, saved articles, profile UI, feed state, and layout checks that do not depend on native gestures.

2. Use LAN phone preview when the iPhone and Mac are on the same Wi-Fi:

   ```sh
   npm run dev:phone
   ```

   Expo Go should scan the LAN QR. If it does not load, check that:
   - iPhone and Mac are on the same Wi-Fi network.
   - Expo Go has iOS Local Network permission enabled.
   - VPN, guest Wi-Fi isolation, or firewall rules are not blocking the Mac.

3. Use tunnel phone preview only when LAN fails and the security tradeoff is acceptable:

   ```sh
   npm run dev:tunnel
   ```

   Tunnel mode is usually easier for phone testing because it avoids local network issues, but it exposes the development bundle through Expo's public relay.

## Current Machine Note

The iOS Simulator command-line tool `xcrun simctl` was not available on this Mac during the August 7 session. Installing or selecting Xcode command line tools would make simulator testing a stronger default, because it removes QR codes and phone networking from the daily loop.
