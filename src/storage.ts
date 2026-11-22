import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { DEFAULT_UPGRADES, UPGRADES } from './perks';
import type { SaveData, StageRecord, UpgradeId } from './types';

const STORAGE_KEY = 'runway_control_save_v2';
const LEGACY_KEY = 'runway_control_save_v1';

function createDefaultSave(): SaveData {
  return {
    highestUnlocked: 1,
    unlockAllDev: false,
    soundEnabled: true,
    hapticsEnabled: true,
    credits: 120,
    upgrades: { ...DEFAULT_UPGRADES },
    records: {},
    dailyBestScores: {},
    stats: {
      totalLandings: 0,
      totalLaunches: 0,
      maydaysSaved: 0,
      hazardsJammed: 0,
      bestStreak: 0,
      dailyCompletedDates: [],
      dailyStreak: 0,
    },
  };
}

export class SaveStore {
  data: SaveData = createDefaultSave();

  private async readRaw(key: string): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      const res = await Preferences.get({ key });
      return res.value;
    }
    return localStorage.getItem(key);
  }

  private async writeRaw(key: string, value: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  }

  async load(): Promise<SaveData> {
    try {
      let raw = await this.readRaw(STORAGE_KEY);
      if (!raw) {
        // Migrate v1 save progress seamlessly if present
        raw = await this.readRaw(LEGACY_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        const defaults = createDefaultSave();
        this.data = {
          highestUnlocked: Math.max(1, parsed.highestUnlocked ?? 1),
          unlockAllDev: Boolean(parsed.unlockAllDev),
          soundEnabled: parsed.soundEnabled ?? true,
          hapticsEnabled: parsed.hapticsEnabled ?? true,
          credits: Math.max(0, parsed.credits ?? defaults.credits),
          upgrades: { ...DEFAULT_UPGRADES, ...(parsed.upgrades ?? {}) },
          records: parsed.records ?? {},
          dailyBestScores: parsed.dailyBestScores ?? {},
          stats: {
            ...defaults.stats,
            ...(parsed.stats ?? {}),
            dailyCompletedDates: parsed.stats?.dailyCompletedDates ?? [],
          },
        };
      }
    } catch {
      this.data = createDefaultSave();
    }
    return this.data;
  }

  async save(): Promise<void> {
    try {
      await this.writeRaw(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota issues
    }
  }

  isStageUnlocked(stageId: number): boolean {
    return this.data.unlockAllDev || stageId <= this.data.highestUnlocked;
  }

  getRecord(stageId: number): StageRecord {
    return this.data.records[stageId] ?? { cleared: false, stars: 0, bestScore: 0 };
  }

  getUpgradeLevel(id: UpgradeId): number {
    return this.data.upgrades[id] ?? 0;
  }

  canAffordUpgrade(id: UpgradeId): boolean {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const lvl = this.getUpgradeLevel(id);
    if (lvl >= def.maxLevel) return false;
    return this.data.credits >= def.costs[lvl];
  }

  buyUpgrade(id: UpgradeId): boolean {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const lvl = this.getUpgradeLevel(id);
    if (lvl >= def.maxLevel) return false;
    const cost = def.costs[lvl];
    if (this.data.credits < cost) return false;
    this.data.credits -= cost;
    this.data.upgrades[id] = lvl + 1;
    void this.save();
    return true;
  }

  addCredits(amount: number): void {
    if (amount <= 0) return;
    this.data.credits += Math.round(amount);
    void this.save();
  }

  recordStageClear(
    stageId: number,
    score: number,
    lives: number,
    totalStages: number
  ): number {
    const stars = lives >= 3 ? 3 : lives === 2 ? 2 : 1;
    const prev = this.getRecord(stageId);
    this.data.records[stageId] = {
      cleared: true,
      stars: Math.max(prev.stars, stars),
      bestScore: Math.max(prev.bestScore, score),
    };
    if (stageId < totalStages && this.data.highestUnlocked < stageId + 1) {
      this.data.highestUnlocked = stageId + 1;
    }
    void this.save();
    return stars;
  }

  recordDailyClear(dateKey: string, score: number): void {
    const prevBest = this.data.dailyBestScores[dateKey] ?? 0;
    if (score > prevBest) {
      this.data.dailyBestScores[dateKey] = score;
    }
    if (!this.data.stats.dailyCompletedDates.includes(dateKey)) {
      this.data.stats.dailyCompletedDates.push(dateKey);
      this.data.stats.dailyStreak += 1;
    }
    void this.save();
  }

  recordBestScore(stageId: number, score: number, dailyDateKey?: string): void {
    if (dailyDateKey) {
      const prev = this.data.dailyBestScores[dailyDateKey] ?? 0;
      if (score > prev) {
        this.data.dailyBestScores[dailyDateKey] = score;
        void this.save();
      }
      return;
    }
    const prev = this.getRecord(stageId);
    if (score > prev.bestScore) {
      this.data.records[stageId] = { ...prev, bestScore: score };
      void this.save();
    }
  }

  getDailyBest(dateKey: string): number {
    return this.data.dailyBestScores[dateKey] ?? 0;
  }

  isDailyCleared(dateKey: string): boolean {
    return this.data.stats.dailyCompletedDates.includes(dateKey);
  }

  recordRunStats(
    landings: number,
    launches: number,
    maydaysSaved: number,
    hazardsJammed: number,
    maxStreak: number
  ): void {
    this.data.stats.totalLandings += landings;
    this.data.stats.totalLaunches += launches;
    this.data.stats.maydaysSaved += maydaysSaved;
    this.data.stats.hazardsJammed += hazardsJammed;
    if (maxStreak > this.data.stats.bestStreak) {
      this.data.stats.bestStreak = maxStreak;
    }
    void this.save();
  }

  toggleUnlockAll(): boolean {
    this.data.unlockAllDev = !this.data.unlockAllDev;
    void this.save();
    return this.data.unlockAllDev;
  }

  setSoundEnabled(enabled: boolean): void {
    this.data.soundEnabled = enabled;
    void this.save();
  }

  setHapticsEnabled(enabled: boolean): void {
    this.data.hapticsEnabled = enabled;
    void this.save();
  }

  totalStars(): number {
    return Object.values(this.data.records).reduce((acc, r) => acc + (r.stars || 0), 0);
  }
}
