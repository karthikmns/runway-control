# Google Play Store Publishing Guide — Runway Control

Everything you need to publish **Runway Control (`com.karthikmns.runwaycontrol`)** on Google Play Console.

---

## 1. Build Your Signed `.aab` Bundle (Never Commit Your Keystore!)

Google Play requires a signed **Android App Bundle (`.aab`)** signed with your private Upload Keystore (`.jks`).

### Option A — Build locally on your desktop (easiest)
```bash
git pull origin main
npm install

# 1. Generate your private upload keystore ONCE (keep a safe backup!)
chmod +x scripts/generate-keystore.sh
./scripts/generate-keystore.sh

# 2. Build the signed Play Store .aab
npm run android:bundle
```
Your Play-ready signed bundle will be created at:
`android/app/build/outputs/bundle/release/app-release.aab`

### Option B — Build automatically in GitHub Actions
1. Base64-encode your `.jks` keystore:
   `base64 -w 0 android/runway-control-upload.jks`
2. In GitHub → **Settings → Secrets and variables → Actions**, add:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS` (`runway-upload`)
   - `ANDROID_KEY_PASSWORD`
3. Go to **Actions → Build Signed Google Play AAB → Run workflow** (or push a tag like `v2.0.0`), then download the `RunwayControl-play-release-aab` artifact!

> **Important:** For every future Play Store update, increment `versionCode` (e.g. `3`, `4`...) and `versionName` in `android/app/build.gradle`.

---

## 2. Store Listing Copy (Ready to Paste)

- **App Name (max 30 chars):** `Runway Control — Super ATC`
- **Category:** `Games` → `Arcade` (or `Simulation`)
- **Tags:** `Air traffic control`, `Aviation`, `Arcade`, `Strategy`, `Offline`, `Single player`
- **Contact Email:** `karthikmns@gmail.com`
- **Website:** `https://karthikmns.github.io/runway-control/`
- **Privacy Policy URL:** `https://karthikmns.github.io/runway-control/privacy.html`

### Short Description (max 80 chars — 78 chars used)
```
Draw flight paths, orbit jets, zap drones & save Maydays across 12 ATC stages!
```

### Full Description
```
Take command of the control tower in Runway Control — Super ATC, a fast, tactile 12-stage Air Traffic Control game built for mobile!

Drag smooth flight paths from incoming aircraft into glowing runway approach cones, sequence intersecting runways, and keep the skies safe as weather, emergencies, and unexpected intruders ramp up.

KEY FEATURES
• 12 Handcrafted Airfields + Boss Sectors — Master Coral Bay, Palm Lagoon, Twin Pines, Harbor Point, Crosswind Mesa, Tradewind Isle, Monsoon Watch, Sunset Hub, the moving USS Horizon aircraft carrier, Canyon Blackout nightfall, Grand Megahub, and the classified Sector 51 Apex!
• Holding Pattern Orbits — Double-tap any aircraft (or tap ORBIT) to lock it into a neat circular holding pattern at reduced speed until a runway clears.
• Chrono Radar Slow-Mo — Trigger rechargeable 0.35x tactical slow-motion to untangle crowded airspace and tight intersections.
• Emergency Mayday Landings & ARFF Fire Trucks — Divert smoking engine-fire aircraft onto any runway and watch Airport Fire Trucks race out with flashing strobes to foam-extinguish the fire for huge Hero Save bonuses!
• Rogue Drones, UFOs & Tower EMP Jammer — Tap hostile drones and tractor-beam UFOs on radar to fire a Control Tower EMP beam for bonus credits.
• 6 Aircraft Classes — Guide Airliners, Turboprops, Rescue Choppers, Amphibious Seaplanes, Express & VIP Jets, and massive 4-engine Heavy Cargo freighters.
• Tower Upgrades & Mid-Shift Perk Drafts — Spend ATC Credits earned every shift on 6 permanent 3-tier tower upgrades (Chrono Radar Cell, Auto-TCAS Collision Shield, ILS Wide-Beam Lock, Tower EMP Overclock, ARFF Rapid Fire Crew, and Fuel Tankers), plus draft tactical boosts mid-stage.
• Daily Ops & Endless Overdrive — Play a fresh seeded Daily Challenge every day with rotating 3-mutator modifiers and 2x Credits, or push your high score in Endless Overdrive on any cleared stage.
• 100% Offline & Zero Ads — Play anywhere with zero tracking, zero ads, and crisp haptic feedback.
```

---

## 3. Ready-to-Upload Store Graphic Assets (`store-assets/`)

| Asset | File | Exact Dimensions |
|---|---|---|
| High-Res App Icon | `store-assets/play-icon-512.png` | `512 × 512` PNG |
| Feature Graphic | `store-assets/feature-graphic-1024x500.png` | `1024 × 500` PNG |
| Phone Screenshot 1 | `store-assets/screenshots/01-stage1-gameplay.png` | `1080 × 1920` PNG |
| Phone Screenshot 2 | `store-assets/screenshots/02-stage12-boss-slowmo.png` | `1080 × 1920` PNG |
| Phone Screenshot 3 | `store-assets/screenshots/03-carrier-stage9.png` | `1080 × 1920` PNG |
| Phone Screenshot 4 | `store-assets/screenshots/04-missions-daily-ops.png` | `1080 × 1920` PNG |
| Phone Screenshot 5 | `store-assets/screenshots/05-tower-upgrades.png` | `1080 × 1920` PNG |

---

## 4. Google Play Console Declarations Checklist

1. **App Content → Privacy Policy:** `https://karthikmns.github.io/runway-control/privacy.html`
2. **App Content → Ads:** **No, my app does not contain ads.**
3. **App Content → App Access:** **All functionality is available without special access.**
4. **App Content → Content Ratings (IARC):**
   - Category: **Game**
   - Violence: None / Mild cartoon explosions only (no blood/gore/realistic violence) → typically rates **Everyone / PEGI 3**
   - User interaction / Data sharing / Purchases: **No**
5. **App Content → Target Audience:** `13+` (or `All ages` — note selecting under-13 triggers Google's Families Policy review; selecting `13+` or `16+` is fastest for indie releases unless specifically targeting kids).
6. **App Content → Data Safety:**
   - Does your app collect or share any of the required user data types? → **No**
7. **Release Track:**
   - Personal Google Play developer accounts created after Nov 2023 require **Closed Testing** (12 opted-in testers for 14 days) before Production release. Upload your signed `app-release.aab` to **Testing → Closed testing** first!
