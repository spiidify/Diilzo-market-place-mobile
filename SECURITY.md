# Diilzo Mobile — Security Implementation

## Overview

This document describes the security features and best practices implemented in the Diilzo mobile app.

## 1. Authentication & Session Security

### JWT Token Storage
- **Access and refresh tokens** are stored in `expo-secure-store` (iOS Keychain / Android Keystore).
- Tokens are stored with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — not synced to iCloud, not accessible when device is locked.
- Tokens are never logged, never exposed in error messages, and never sent to non-HTTPS endpoints.

### Session Timeout
- **30-minute inactivity timeout**: If the app is backgrounded for more than 30 minutes, the session is automatically cleared and the user is logged out.
- Implemented via `useSessionManager` hook in `src/hooks/useSessionManager.ts`.
- Monitors `AppState` changes (foreground/background transitions).

### Token Rotation
- On 401 responses, the API client automatically attempts a token refresh.
- Failed refreshes clear all tokens and reject the request.
- Concurrent 401s are queued and processed after a single refresh attempt.

### Biometric Authentication
- **Face ID / Touch ID / Fingerprint** support via `expo-local-authentication`.
- Available in `src/services/biometric.ts`.
- Can be used to gate sensitive actions (payments, wallet access, settings changes).
- User opt-in — stored as a preference in SecureStore.

## 2. Input Validation & Sanitization

### Validation Utilities (`src/utils/validation.ts`)
- **Email validation**: RFC-compliant regex, max 254 chars.
- **Phone validation**: Uganda-focused, accepts international formats.
- **URL validation**: HTTPS-only, max 2048 chars.
- **Password strength checker**: 0-4 score with suggestions (length, mixed case, numbers, special chars).
- **Amount/quantity validation**: Prevents negative values, enforces reasonable maximums.
- **Suspicious input detection**: Blocks `<script>`, `javascript:`, SQL injection patterns.

### Sanitization
- All text inputs are trimmed, control characters removed, whitespace collapsed.
- Max length enforced on all inputs to prevent buffer-style attacks.
- Email is lowercased before sending to the API.

### Applied to:
- Login screen: email + password validation before submission.
- Register screen: email, password strength, phone validation, all inputs sanitized.
- Search queries: sanitized and length-limited.

## 3. API Security

### HTTPS-Only (Production)
- The API client blocks non-HTTPS requests in production builds.
- The `EXPO_PUBLIC_API_URL` env var is validated — non-HTTPS URLs are rejected in production.

### Request Hardening
- **Timeout**: 15 seconds default.
- **Max response size**: 10MB (prevents memory exhaustion from large responses).
- **Max request body**: 2MB (prevents oversized payloads).
- **Custom headers**: `X-Client` and `X-Client-Version` for tracking and API compatibility.

### Error Sanitization (`src/utils/errors.ts`)
- **Never exposes**: stack traces, internal paths, SQL errors, server internals.
- Maps HTTP status codes to user-friendly messages.
- Only returns known-safe DRF field error messages.
- In production, logs only safe metadata (status, URL, method, timestamp) — no sensitive data.
- In development, logs full errors for debugging.

## 4. App-Level Security

### Screenshot Prevention
- `useScreenshotPrevention` hook blocks screenshots on sensitive screens.
- Applied to: Seller Earnings (financial data).
- Can be extended to: checkout, KYC, payment methods.

### Deep Link Security
- App scheme: `diilzomobile://` — only the app can handle these links.
- No sensitive data is passed via deep links.

### App Configuration (`app.json`)
- **iOS**: `ITSAppUsesNonExemptEncryption: false` (standard HTTPS only).
- **iOS**: Privacy usage descriptions for camera, photos, Face ID.
- **Android**: Only biometric permissions requested (no unnecessary permissions).
- **Plugins**: `expo-secure-store` and `expo-local-authentication` registered.

### Build Security (`eas.json`)
- **Production builds**: App Bundle (AAB) for Android — smaller, more secure than APK.
- **Auto-increment**: Version codes auto-increment to prevent replay attacks.
- **Submit config**: Service account key path for Play Store submission.

### Git Hygiene (`.gitignore`)
- Secrets and credentials are gitignored:
  - `.env`, `.env.production`
  - `google-service-account.json`
  - `*.keystore`, `*.jks`, `*.p8`, `*.p12`, `*.key`
  - `*.mobileprovision`
  - `credentials.json`, `eas-credentials.json`

## 5. Recommendations for Further Hardening

### High Priority
1. **SSL Pinning**: Pin the Railway backend's TLS certificate to prevent MITM attacks. Requires a custom native module or `react-native-ssl-pinning`.
2. **Code Obfuscation**: Enable ProGuard/R8 on Android and strip symbols on iOS in production builds.
3. **Rate Limiting (Client-side)**: Add debounce/throttle on auth attempts and search to prevent brute-force.
4. **Sentry / Crash Reporting**: Integrate Sentry for production error monitoring with PII scrubbing.

### Medium Priority
5. **App Integrity Check**: Use Play Integrity API (Android) and DeviceCheck (iOS) to detect rooted/jailbroken devices.
6. **Root/Jailbreak Detection**: Block app functionality on compromised devices.
7. **Certificate Transparency**: Monitor backend TLS certificates for unauthorized issuance.
8. **API Request Signing**: Sign requests with HMAC to prevent tampering.

### Low Priority
9. **Offline Token Validation**: Validate JWT expiry locally before making requests.
10. **Push Notification Security**: Use token-based authentication for APNs.
11. **Content Security Policy**: Add CSP headers on the backend for web views.

## 6. File Locations

| Feature | File |
|---------|------|
| Input validation | `src/utils/validation.ts` |
| Error sanitization | `src/utils/errors.ts` |
| API client (hardened) | `src/services/api.ts` |
| Biometric auth | `src/services/biometric.ts` |
| Session manager | `src/hooks/useSessionManager.ts` |
| Screenshot prevention | `src/hooks/useScreenshotPrevention.ts` |
| App config | `app.json` |
| Build config | `eas.json` |
| Git ignore | `.gitignore` |
