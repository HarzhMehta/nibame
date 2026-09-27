# nibame Android

The Android app is a Capacitor shell around the production Nibame web application. It uses the
same login session, MongoDB-backed profile, categories, rules, links, and responsive interface.

## Requirements

- Node.js 22 or newer
- Java 21
- Android Studio Otter 2025.2.1 or newer
- Android SDK configured through `ANDROID_HOME`

## Setup

```bash
npm install
npm run android:sync
npm run android:open
```

For an Android emulator connected to a local Next.js server, sync with:

```bash
NIBAME_WEB_URL=http://10.0.2.2:3002 npm run android:sync
```

The default production URL is `https://nibamedeploy.vercel.app`.

## Sharing links

Nibame registers as a `text/plain` Android share target. Sharing a URL from a browser, Instagram,
X, YouTube, or another app opens `/mobile-share` in the WebView. Signed-in users save immediately;
signed-out users are taken through login and the link is saved after authentication.

## Release note

The remote URL keeps Android and web behavior synchronized, but publishing a remote-only WebView
to an app store may require additional native value and store-policy review. The share target is the
first native capability; notifications and offline capture can be added without duplicating the UI.
