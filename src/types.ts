export type AircraftType =
  | 'airliner'
  | 'turboprop'
  | 'helicopter'
  | 'seaplane'
  | 'fastjet'
  | 'heavycargo';

export type ZoneKind = 'runway' | 'helipad' | 'waterlane';
export type ZoneColor = 'blue' | 'green' | 'yellow' | 'orange' | 'red';

export type DifficultyTier =
  | 'TRAINING'
  | 'NORMAL'
  | 'CHALLENGING'
  | 'HARD'
  | 'SUPER COMPLEX'
  | 'BOSS'
  | 'DAILY OPS';

export type BiomeKey =
  | 'coastal'
  | 'lagoon'
  | 'pines'
  | 'harbor'
  | 'mesa'
  | 'tradewind'
  | 'monsoon'
  | 'sunset'
  | 'carrier'
  | 'canyon_night'
  | 'megahub'
  | 'sector51';

export interface Point {
  x: number;
  y: number;
}

export interface LandingZoneDef {
  id: string;
  name: string;
  revName?: string;
  kind: ZoneKind;
  color: ZoneColor;
  offsetX: number;
  offsetY: number;
  angle: number;
  length: number;
  width: number;
  accepts: AircraftType[];
  reversible?: boolean;
  allowTakeoffs?: boolean;
  intersectionGroup?: string;
}

export interface RuntimeLandingZone {
  def: LandingZoneDef;
  name: string;
  kind: ZoneKind;
  color: ZoneColor;
  cx: number;
  cy: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  angle: number;
  fx: number;
  fy: number;
  rx: number;
  ry: number;
  length: number;
  width: number;
  gateLen: number;
  gateHalfW: number;
  reversed: boolean;
  emergencyLockedUntil: number;
  worldToLocal(x: number, y: number): { along: number; across: number };
  localToWorld(along: number, across: number): Point;
}

export interface StageFeatures {
  colorMatching?: boolean;
  windShifts?: boolean;
  lowFuel?: boolean;
  storms?: number;
  outboundTakeoffs?: boolean;
  vipJets?: boolean;
  bonusLifeStreak?: boolean;
  movingCarrier?: boolean;
  dayToNight?: boolean;
  maydayEmergencies?: boolean;
  rogueDrones?: boolean;
  ufoEvents?: boolean;
  heavyCargo?: boolean;
}

export interface StageDef {
  id: number;
  name: string;
  subtitle: string;
  difficulty: DifficultyTier;
  biome: BiomeKey;
  targetLandings: number;
  targetLaunches?: number;
  maxAirborne: number;
  spawnIntervalMin: number;
  spawnIntervalMax: number;
  aircraftPool: AircraftType[];
  islandRx: number;
  islandRy: number;
  landingZones: LandingZoneDef[];
  features: StageFeatures;
  tip: string;
  isDaily?: boolean;
  dailyDateKey?: string;
  dailyMutators?: string[];
}

export type UpgradeId =
  | 'chrono_battery'
  | 'tcas_shield'
  | 'wide_approach'
  | 'emp_overclock'
  | 'rapid_fire_crew'
  | 'fuel_tankers';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  maxLevel: number;
  costs: number[];
  summary: (level: number) => string;
  nextBenefit: (nextLevel: number) => string;
}

export type TacticalPerkId =
  | 'perk_chrono_refill'
  | 'perk_tcas_charge'
  | 'perk_score_surge'
  | 'perk_calm_skies'
  | 'perk_fuel_drop'
  | 'perk_repair_life';

export interface TacticalPerkDef {
  id: TacticalPerkId;
  name: string;
  icon: string;
  tag: string;
  description: string;
}

export interface StageRecord {
  cleared: boolean;
  stars: number;
  bestScore: number;
}

export interface CareerStats {
  totalLandings: number;
  totalLaunches: number;
  maydaysSaved: number;
  hazardsJammed: number;
  bestStreak: number;
  dailyCompletedDates: string[];
  dailyStreak: number;
}

export interface SaveData {
  highestUnlocked: number;
  unlockAllDev: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  credits: number;
  upgrades: Record<UpgradeId, number>;
  records: Record<number, StageRecord>;
  dailyBestScores: Record<string, number>;
  stats: CareerStats;
}

export interface FlightStripItem {
  id: string;
  name: string;
  padColor: ZoneColor;
  state: string;
  isVip: boolean;
  isMayday: boolean;
  lowFuel: boolean;
  fuelSec: number;
  fuelRatio: number;
  danger: boolean;
  lockedZoneName: string | null;
  selected: boolean;
}

export interface OutboundStripItem {
  id: string;
  zoneName: string;
  patienceSec: number;
  patienceRatio: number;
}

export interface HazardStripItem {
  index: number;
  kind: 'drone' | 'ufo';
  lifeSec: number;
}

export interface HudSnapshot {
  stage: StageDef;
  landings: number;
  launches: number;
  score: number;
  bestScore: number;
  credits: number;
  runCredits: number;
  lives: number;
  maxLives: number;
  streak: number;
  multiplier: number;
  activeFlights: number;
  orbitingCount: number;
  windReversed: boolean;
  endlessMode: boolean;
  atcMessage: string;
  eventBanner: string | null;
  eventBannerTone: 'info' | 'warn' | 'danger' | 'success';
  slowMoCharge: number; // 0..1
  slowMoActive: boolean;
  empCooldownRatio: number; // 0 = ready, 1 = cooling
  tcasShields: number;
  selectedPlaneId: string | null;
  selectedPlaneOrbiting: boolean;
  activeHazards: number;
  activeMaydays: number;
  flightStrips: FlightStripItem[];
  outboundStrips: OutboundStripItem[];
  hazardStrips: HazardStripItem[];
}

export interface RunSummary {
  stage: StageDef;
  score: number;
  landings: number;
  launches: number;
  maydaysSaved: number;
  hazardsJammed: number;
  maxStreak: number;
  creditsEarned: number;
  stars: number;
  reason?: string;
}
