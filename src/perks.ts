import type { TacticalPerkDef, UpgradeDef, UpgradeId } from './types';

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'chrono_battery',
    name: 'Chrono Radar Cell',
    icon: '⏱️',
    maxLevel: 3,
    costs: [180, 420, 820],
    summary: (lvl) =>
      lvl === 0
        ? '4.5s tactical slow-mo (0.35x speed)'
        : `${(4.5 + lvl * 1.4).toFixed(1)}s slow-mo & +${lvl * 22}% faster recharge`,
    nextBenefit: (next) =>
      `Boost slow-mo to ${(4.5 + next * 1.4).toFixed(1)}s & faster recharge`,
  },
  {
    id: 'tcas_shield',
    name: 'Auto-TCAS Override',
    icon: '🛡️',
    maxLevel: 3,
    costs: [250, 550, 980],
    summary: (lvl) =>
      lvl === 0
        ? 'No auto-evasion charges'
        : `${lvl} automatic mid-air collision save${lvl > 1 ? 's' : ''} per run`,
    nextBenefit: (next) =>
      `Start every stage with ${next} auto-TCAS collision save${next > 1 ? 's' : ''}`,
  },
  {
    id: 'wide_approach',
    name: 'ILS Wide-Beam Lock',
    icon: '📡',
    maxLevel: 3,
    costs: [160, 380, 740],
    summary: (lvl) =>
      lvl === 0
        ? 'Standard runway capture cone'
        : `+${lvl * 14}% wider capture cones & smoother magnetic snap`,
    nextBenefit: (next) =>
      `Widen runway & helipad ILS lock zones by +${next * 14}%`,
  },
  {
    id: 'emp_overclock',
    name: 'Tower EMP Jammer',
    icon: '⚡',
    maxLevel: 3,
    costs: [200, 460, 860],
    summary: (lvl) =>
      lvl === 0
        ? '6.5s EMP recharge; +200 per drone/UFO'
        : `${(6.5 - lvl * 1.3).toFixed(1)}s recharge & +${200 + lvl * 80} bounty`,
    nextBenefit: (next) =>
      `Cut EMP cooldown to ${(6.5 - next * 1.3).toFixed(1)}s & boost bounty`,
  },
  {
    id: 'rapid_fire_crew',
    name: 'ARFF Rapid Fire Crew',
    icon: '🚒',
    maxLevel: 3,
    costs: [210, 480, 880],
    summary: (lvl) =>
      lvl === 0
        ? 'Standard 3.4s emergency foam clear'
        : `${(3.4 - lvl * 0.65).toFixed(1)}s foam clear & +${lvl * 120} Mayday bonus`,
    nextBenefit: (next) =>
      `Extinguish Mayday fires in ${(3.4 - next * 0.65).toFixed(1)}s + bonus score`,
  },
  {
    id: 'fuel_tankers',
    name: 'Reserve Fuel Tankers',
    icon: '⛽',
    maxLevel: 3,
    costs: [170, 390, 760],
    summary: (lvl) =>
      lvl === 0
        ? 'Standard low-fuel & Mayday timers'
        : `+${lvl * 6}s extra reserve fuel on every emergency flight`,
    nextBenefit: (next) =>
      `Add +${next * 6}s emergency fuel endurance across all stages`,
  },
];

export const DEFAULT_UPGRADES: Record<UpgradeId, number> = {
  chrono_battery: 0,
  tcas_shield: 0,
  wide_approach: 0,
  emp_overclock: 0,
  rapid_fire_crew: 0,
  fuel_tankers: 0,
};

export const TACTICAL_PERKS: TacticalPerkDef[] = [
  {
    id: 'perk_chrono_refill',
    name: 'Overcharge Chrono',
    icon: '⏱️',
    tag: 'TACTICAL',
    description: 'Instantly refill Slow-Mo to 100% and double recharge speed this run.',
  },
  {
    id: 'perk_tcas_charge',
    name: 'Emergency TCAS Shield',
    icon: '🛡️',
    tag: 'DEFENSE',
    description: 'Gain +1 Auto-TCAS mid-air collision save for this stage.',
  },
  {
    id: 'perk_score_surge',
    name: 'Radar Telemetry Boost',
    icon: '📈',
    tag: 'SCORE',
    description: '+35% score & ATC Credits on all remaining landings this run.',
  },
  {
    id: 'perk_calm_skies',
    name: 'Weather Dispersal',
    icon: '🌤️',
    tag: 'CONTROL',
    description: 'Shrink storm cells by 35% and clear active rogue drones immediately.',
  },
  {
    id: 'perk_fuel_drop',
    name: 'Aerial Refuel Drop',
    icon: '⛽',
    tag: 'SUPPORT',
    description: 'Refill +15s fuel on all airborne low-fuel & Mayday aircraft.',
  },
  {
    id: 'perk_repair_life',
    name: 'Tower Reinforcement',
    icon: '❤️',
    tag: 'RECOVERY',
    description: 'Restore +1 Life (or +500 bonus points if already at full lives).',
  },
];

export function pickTacticalPerks(
  lives: number,
  maxLives: number,
  hasHazards: boolean
): TacticalPerkDef[] {
  const pool = [...TACTICAL_PERKS];
  // Prioritize repair if injured
  const weighted = pool.filter((p) => {
    if (p.id === 'perk_repair_life' && lives >= maxLives) return Math.random() < 0.35;
    if (p.id === 'perk_calm_skies' && !hasHazards) return Math.random() < 0.4;
    return true;
  });
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }
  const chosen = weighted.slice(0, 3);
  while (chosen.length < 3) {
    const fallback = pool.find((p) => !chosen.some((c) => c.id === p.id));
    if (!fallback) break;
    chosen.push(fallback);
  }
  return chosen;
}
