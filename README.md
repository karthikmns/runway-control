# Runway Control — Super ATC (Android & Web)

A fast, tactile **12-stage Air Traffic Control game** built for **Android (Capacitor)** and **Desktop/Mobile Web** with HTML5 Canvas, TypeScript, Web Audio procedural sound effects, and native haptic feedback.

## What's New in v2.0 (Super ATC Edition)

- **12 Handcrafted Stages + Boss Sectors** — All 11 original airfields upgraded plus **Stage 12: Sector 51 Apex** (night ops, UFO incursions, storms, wind shifts, and all 6 aircraft classes).
- **Holding Pattern Orbits** — Double-tap any aircraft (or right-click / tap **ORBIT**) to lock it into a smooth circular holding pattern at reduced speed until a runway opens.
- **Chrono Radar Slow-Mo** — Rechargeable tactical `0.35x` slow-motion radar sweep to untangle congested skies and tight intersections.
- **Emergency Mayday Landings & ARFF Fire Trucks** — Smoking engine-fire aircraft can divert onto any runway; Airport Fire Trucks race from the ARFF station with flashing strobes to foam-extinguish the blaze for massive **+500+ HERO SAVE** bonuses.
- **Rogue Drones, UFOs & Tower EMP Jammer** — Tap hostile drones or tractor-beam UFOs on radar to fire a Control Tower EMP beam for bonus points and credits.
- **6 Aircraft Classes** — Airliner, Turboprop, Rescue Chopper, Amphibious Seaplane, Express / Gold VIP Jet, and **Heavy Cargo** 4-engine freighters.
- **Tower Upgrades Hangar & Mid-Shift Perk Drafts** — Earn 🪙 ATC Credits every run to permanently upgrade Chrono Battery, Auto-TCAS Collision Shields, ILS Wide-Beam Locks, EMP Overclock, Rapid Fire Crew, and Fuel Tankers — plus pick 1 of 3 tactical boosts mid-stage.
- **Daily Ops & Endless Overdrive** — Deterministic daily seeded challenge missions with rotating 3-mutator combinations and 2x Credits, plus Endless Overdrive on every cleared stage.

## Install on Android

Download **`RunwayControl-v2.0.0.apk`** directly from this repository on your Android device and install it (replaces/upgrades `com.runwaycontrol.app` v1.0.0 seamlessly, migrating your saved progress).

## Development & Building Locally

```bash
npm install
npm run dev           # Run locally in browser (Desktop & Mobile)
npm run build         # Type-check & build production web bundle to dist/
npm run android:debug # Sync Capacitor & compile Android debug APK
```
