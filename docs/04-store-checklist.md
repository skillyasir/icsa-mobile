# App Store and Google Play checklist

Written 3 Nov 2026. Re-check every rule at release time — both stores change them yearly.

## Accounts — start now (Yasir)

- [ ] **D-U-N-S number** for the legal entity that owns ICSA (free; Apple has a D-U-N-S lookup in its enrolment flow).
- [ ] **Apple Developer Program — Organization** enrolment (yearly fee). Needs the D-U-N-S, the legal entity name, a website, and the authority to sign for the company.
- [ ] **Google Play Console — Organization** account (one-time fee), verified with the same D-U-N-S. *A personal account created after 13 Nov 2023 must run a closed test with **12 testers for 14 days** before production.*
- [ ] **Expo account** (free) — the organization "icsa".
- [ ] **GitHub repo** `skillyasir/icsa-mobile` (private).

## Identity — decide once (hard to change later)

- [ ] App name: **ICSA** (check it is free in both stores; fallback "ICSA Academy").
- [ ] Bundle id / package name: suggestion **`us.icsa.app`** (reverse of `icsa.us`).
- [ ] Icon: ICSA mark on brand blue, no text; 1024×1024 master.
- [ ] Support URL, marketing URL `https://icsa.us`, privacy policy `https://icsa.us/privacy`.

## Build requirements (2026)

- [ ] **iOS:** built with **Xcode 26 or later** and an iOS 26 SDK (required since **28 Apr 2026**). EAS Build uses current Xcode images; local builds need Xcode 26+ on the Mac.
- [ ] **Android:** **target API level 36** (Android 16), required for new apps and updates since **31 Aug 2026**.
- [ ] **Age rating:** answer Apple's updated age-rating questions (new system since 31 Jan 2026).
- [ ] **Privacy manifest** (`PrivacyInfo.xcprivacy`) with the required-reason APIs — Expo generates most of it; check third-party SDKs.
- [ ] **Encryption:** HTTPS only → `ITSAppUsesNonExemptEncryption = false`.

## Permissions — the words the user sees

- [ ] **Location (when in use):** "ICSA uses your location only when you check in, to confirm you are at an ICSA branch."
- [ ] **Camera:** "To scan a Civil ID, photograph a payment proof, or submit an assignment."
- [ ] **Photos:** "To attach a payment proof or assignment from your photos."
- [ ] **Notifications:** asked in context ("Get a reminder 30 minutes before class?"), never on first launch.
- [ ] **Face ID:** "To unlock ICSA quickly and keep your account safe."
- [ ] No background location in v1 → no Play background-location declaration needed.

## Privacy forms

- [ ] **Apple App Privacy** label: contact info, user content (photos/files), identifiers (user id), location (precise, linked to the user, for app functionality only), diagnostics (Sentry). No tracking, no ads.
- [ ] **Google Play Data safety**: the same, plus "data encrypted in transit" and "users can request deletion" (link the request route).
- [ ] **Account deletion:** accounts are created by ICSA staff, not in the app — confirm against Apple guideline 5.1.1(v) at submission; offer a "Request account deletion" link either way.

## Review

- [ ] **Demo accounts on production** (there is no staging): a **Demo** branch with made-up students; logins for a student, a teacher and a reception/supervisor. Never real people's data.
- [ ] Reviewer notes: what each login shows, and that check-in only works inside an ICSA branch. Give the **Demo branch a very wide fence** so a reviewer anywhere can try check-in — safe, because only demo students belong to it.
- [ ] No in-app sales in v1 (in-person tuition is paid outside the app; online/recorded courses sold in-app would need in-app purchase).
- [ ] Sign-in: AMS username/student code + password only in v1 (Google sign-in would bring guideline 4.8 / Sign in with Apple into play).

## Testing before release

- [ ] **TestFlight** (iOS) and **Play internal testing** (Android) with real staff: one teacher, one reception, one marketer, two students — at least a week of daily use.
- [ ] Test on **mobile data**, not only Wi-Fi (Cloudflare challenges, weak-signal retries).
- [ ] Test **old app → new server** (keep the previous build installed on one phone).
- [ ] Phased release (Apple 7-day phased release; Play staged rollout 10% → 50% → 100%).

## Store listing

- [ ] Screenshots: iPhone 6.9", iPad 13", Android phone; English first (Arabic later).
- [ ] Short description, full description, keywords, category **Education**.
