import { audio } from './audio';
import {
  AIRCRAFT_SPECS,
  Aircraft,
  CarrierController,
  FireTruck,
  OutboundFlight,
  RogueHazard,
  StormCell,
  ZONE_PALETTE,
  wrapAngle,
} from './entities';
import { haptics } from './haptics';
import { ParticleSystem } from './particles';
import { pickTacticalPerks } from './perks';
import {
  drawAircraftCarrier,
  drawControlTowerBeacon,
  drawLandingZones,
  renderStaticBackdrop,
} from './renderer';
import { STAGES } from './stages';
import type { SaveStore } from './storage';
import type {
  AircraftType,
  HudSnapshot,
  Point,
  RunSummary,
  RuntimeLandingZone,
  StageDef,
  TacticalPerkDef,
  TacticalPerkId,
} from './types';

export interface GameUiCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onStageClear: (summary: RunSummary) => void;
  onGameOver: (summary: RunSummary) => void;
  onPerkDraft: (perks: TacticalPerkDef[]) => void;
}

interface IncomingAlert {
  type: AircraftType;
  x: number;
  y: number;
  heading: number;
  lowFuel: boolean;
  isVip: boolean;
  isMayday: boolean;
  timer: number;
}

interface EmpBeamFx {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  life: number;
  maxLife: number;
}

export class RunwayGameEngine {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bgCanvas: HTMLCanvasElement;
  bgCtx: CanvasRenderingContext2D;
  store: SaveStore;
  ui: GameUiCallbacks;

  stage: StageDef = STAGES[0];
  worldW = 860;
  worldH = 540;
  scale = 1;
  dpr = 1;
  airfieldAngle = 0;

  zones: RuntimeLandingZone[] = [];
  aircraft: Aircraft[] = [];
  incomingAlerts: IncomingAlert[] = [];
  storms: StormCell[] = [];
  hazards: RogueHazard[] = [];
  outbounds: OutboundFlight[] = [];
  fireTrucks: FireTruck[] = [];
  empBeams: EmpBeamFx[] = [];
  particles = new ParticleSystem();
  carrier = new CarrierController();
  clouds: { x: number; y: number; r: number; speed: number }[] = [];

  lives = 3;
  maxLives = 3;
  score = 0;
  runCredits = 0;
  landings = 0;
  launches = 0;
  streak = 0;
  maxStreak = 0;
  maydaysSaved = 0;
  hazardsJammed = 0;

  endlessMode = false;
  isPaused = false;
  isPerkDraftOpen = false;
  gameSpeed = 1;
  isGameOver = false;
  isStageCleared = false;
  hasStarted = false;

  // Tactical Chrono Slow-Mo
  slowMoCharge = 1; // 0..1
  slowMoActive = false;
  runChronoBoost = false;
  runScoreMult = 1;
  tcasShields = 0;

  // Mid-run perk milestone tracking
  nextPerkLandingMilestone = 0;

  // EMP Jammer
  empCooldown = 0;
  empCooldownMax = 6.5;

  // Environmental timers
  windReversed = false;
  windTimer = 26;
  nightLevel = 0;
  outboundTimer = 9;
  hazardTimer = 11;
  maydayCooldown = 14;

  // Tower & Fire Station world coordinates
  towerPos: Point = { x: 430, y: 270 };
  fireStationPos: Point = { x: 380, y: 270 };

  // Banners & ATC radio
  eventBanner: string | null = null;
  eventBannerTone: 'info' | 'warn' | 'danger' | 'success' = 'info';
  eventBannerTimer = 0;
  atcMessage = 'Tower online.';

  // Input / interaction state
  selectedPlane: Aircraft | null = null;
  isDragging = false;
  highlightedZoneId: string | null = null;
  lastTapPlaneId: string | null = null;
  lastTapTime = 0;
  dragMovedDist = 0;

  // Spawn & loop bookkeeping
  spawnTimer = 1.6;
  shakeTimer = 0;
  lastTcasSound = 0;
  lastTime = 0;
  hudDirty = true;
  hudTickTimer = 0;
  rafId = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    wrap: HTMLElement,
    canvas: HTMLCanvasElement,
    store: SaveStore,
    ui: GameUiCallbacks
  ) {
    this.wrap = wrap;
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D Canvas context unavailable');
    this.ctx = ctx;

    this.bgCanvas = document.createElement('canvas');
    const bgCtx = this.bgCanvas.getContext('2d');
    if (!bgCtx) throw new Error('Offscreen 2D Canvas context unavailable');
    this.bgCtx = bgCtx;

    this.store = store;
    this.ui = ui;

    this.clouds = [
      { x: 110, y: 80, r: 40, speed: 6 },
      { x: 520, y: 450, r: 48, speed: 4.5 },
      { x: 740, y: 120, r: 34, speed: 7 },
    ];

    this.fireTrucks = [
      new FireTruck(380, 270, -20),
      new FireTruck(380, 270, 20),
    ];

    this.setupInputHandlers();
    this.resize();
    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.wrap);
    }

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private handleResize = () => this.resize();

  loadStage(stageOrId: StageDef | number, autoStart = false) {
    if (typeof stageOrId === 'number') {
      this.stage = STAGES.find((s) => s.id === stageOrId) ?? STAGES[0];
    } else {
      this.stage = stageOrId;
    }
    this.resetRunState(autoStart);
  }

  resetRunState(startNow = true) {
    this.lives = 3;
    this.maxLives = 3;
    this.score = 0;
    this.runCredits = 0;
    this.landings = 0;
    this.launches = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.maydaysSaved = 0;
    this.hazardsJammed = 0;

    this.endlessMode = false;
    this.isPaused = false;
    this.isPerkDraftOpen = false;
    this.isGameOver = false;
    this.isStageCleared = false;
    this.hasStarted = startNow;

    this.slowMoCharge = 1;
    this.slowMoActive = false;
    this.runChronoBoost = false;
    this.runScoreMult = 1;
    this.tcasShields = this.store.getUpgradeLevel('tcas_shield');
    this.empCooldown = 0;
    this.empCooldownMax = Math.max(2.2, 6.5 - this.store.getUpgradeLevel('emp_overclock') * 1.3);

    this.nextPerkLandingMilestone = Math.max(5, Math.floor(this.stage.targetLandings * 0.5));

    this.aircraft = [];
    this.incomingAlerts = [];
    this.outbounds = [];
    this.hazards = [];
    this.empBeams = [];
    this.particles.clear();
    this.carrier.reset();

    this.windReversed = false;
    this.windTimer = 24;
    this.nightLevel = this.stage.features.dayToNight ? 0.18 : 0;
    this.outboundTimer = 7.5;
    this.hazardTimer = 10;
    this.maydayCooldown = 11;

    this.eventBanner = null;
    this.eventBannerTone = 'info';
    this.eventBannerTimer = 0;
    this.selectedPlane = null;
    this.isDragging = false;
    this.highlightedZoneId = null;
    this.spawnTimer = 2.4;

    this.storms = [];
    const stormCount = this.stage.features.storms ?? 0;
    for (let i = 0; i < stormCount; i++) {
      this.storms.push(new StormCell(this.worldW, this.worldH, i));
    }

    this.rebuildZones();
    for (const ft of this.fireTrucks) {
      ft.state = 'stationed';
      ft.targetPlane = null;
      ft.setHome(this.fireStationPos.x, this.fireStationPos.y);
    }

    renderStaticBackdrop(
      this.bgCtx,
      this.stage,
      this.worldW,
      this.worldH,
      this.airfieldAngle,
      this.scale,
      this.dpr
    );

    const tag = this.stage.isDaily ? 'DAILY OPS' : `Stage ${this.stage.id}`;
    this.atcMessage = `${tag}: ${this.stage.name} — ${this.stage.tip}`;
    if (startNow) {
      this.spawnPlaneImmediate();
    }
    this.pushHud();
  }

  startCurrentStage() {
    audio.init();
    haptics.light();
    this.hasStarted = true;
    if (this.aircraft.length === 0) {
      this.spawnPlaneImmediate();
    }
    this.pushHud();
  }

  continueEndless() {
    this.endlessMode = true;
    this.isStageCleared = false;
    this.nextPerkLandingMilestone = this.landings + 14;
    this.showBanner('ENDLESS OVERDRIVE — MAX TRAFFIC!', 'warn');
    this.pushHud();
  }

  toggleSlowMo(): boolean {
    if (!this.hasStarted || this.isPaused || this.isGameOver || this.isStageCleared) {
      return this.slowMoActive;
    }
    audio.init();
    if (this.slowMoActive) {
      this.slowMoActive = false;
      audio.playSlowMoOff();
      haptics.light();
    } else if (this.slowMoCharge >= 0.2) {
      this.slowMoActive = true;
      audio.playSlowMoOn();
      haptics.lock();
      this.showBanner('⏱️ CHRONO RADAR ACTIVE (0.35x)', 'info');
    } else {
      audio.playMismatch();
    }
    this.hudDirty = true;
    return this.slowMoActive;
  }

  orbitSelectedOrNearest(): boolean {
    if (!this.hasStarted || this.isPaused || this.isGameOver || this.isStageCleared) return false;
    audio.init();
    const target =
      this.selectedPlane &&
      this.selectedPlane.state !== 'landing' &&
      this.selectedPlane.state !== 'foam_hold'
        ? this.selectedPlane
        : this.aircraft.find(
            (p) => p.state === 'cruising' || p.state === 'following_path' || p.state === 'approaching'
          ) ?? null;
    if (!target) return false;

    if (target.state === 'orbiting') {
      target.state = 'cruising';
      this.setATC(`${target.id} exiting holding orbit.`);
    } else {
      target.enterOrbit(this.worldW, this.worldH);
      audio.playOrbitLock();
      haptics.orbit();
      this.particles.spawnFloatingText(target.x, target.y - 22, '⟳ ORBIT', '#38bdf8');
      this.setATC(`${target.id} holding in circular orbit.`);
    }
    this.hudDirty = true;
    return true;
  }

  selectPlaneById(id: string) {
    const target = this.aircraft.find((p) => p.id === id) ?? null;
    if (!target) return;
    audio.init();
    this.selectedPlane = target;
    audio.playSelect();
    this.hudDirty = true;
  }

  toggleOrbitById(id: string) {
    if (!this.hasStarted || this.isPaused || this.isGameOver || this.isStageCleared) return;
    const target = this.aircraft.find((p) => p.id === id);
    if (!target || target.state === 'landing' || target.state === 'foam_hold') return;
    audio.init();
    this.selectedPlane = target;
    if (target.state === 'orbiting') {
      target.state = 'cruising';
      this.setATC(`${target.id} exiting holding orbit.`);
    } else {
      target.enterOrbit(this.worldW, this.worldH);
      audio.playOrbitLock();
      haptics.orbit();
      this.particles.spawnFloatingText(target.x, target.y - 22, '⟳ ORBIT', '#38bdf8');
      this.setATC(`${target.id} holding in circular orbit.`);
    }
    this.hudDirty = true;
  }

  launchOutboundById(id: string) {
    if (!this.hasStarted || this.isPaused || this.isGameOver || this.isStageCleared) return;
    const dep = this.outbounds.find((o) => o.id === id && o.state === 'waiting');
    if (!dep) return;
    audio.init();
    const z = this.zones.find((zn) => zn.def.id === dep.zoneId);
    if (!z) return;
    if (this.isZoneBlocked(z)) {
      audio.playMismatch();
      this.setATC(`${dep.id} hold short — RWY ${z.name} busy!`);
      this.particles.spawnFloatingText(dep.x, dep.y - 24, 'RWY BUSY!', '#f59e0b');
    } else {
      dep.launch(z);
      this.launches += 1;
      const pts = Math.round(140 * this.runScoreMult);
      this.score += pts;
      this.runCredits += this.stage.isDaily ? 16 : 8;
      audio.playLaunch();
      haptics.lock();
      this.particles.spawnFloatingText(dep.x, dep.y - 24, `LAUNCH +${pts}`, '#38bdf8');
      this.setATC(`${dep.id} cleared for takeoff RWY ${z.name}!`);
      this.hudDirty = true;
    }
  }

  zapHazardByIndex(index: number) {
    if (!this.hasStarted || this.isPaused || this.isGameOver || this.isStageCleared) return;
    const h = this.hazards[index];
    if (!h || !h.alive) return;
    audio.init();
    this.tryZapHazard({ x: h.x, y: h.y }, 10);
  }

  applyTacticalPerk(perkId: TacticalPerkId) {
    this.isPerkDraftOpen = false;
    audio.playUpgradeBuy();
    haptics.lock();

    switch (perkId) {
      case 'perk_chrono_refill':
        this.slowMoCharge = 1;
        this.runChronoBoost = true;
        this.showBanner('⏱️ CHRONO OVERCHARGED — 2x RECHARGE!', 'info');
        break;
      case 'perk_tcas_charge':
        this.tcasShields += 1;
        this.showBanner(`🛡️ +1 AUTO-TCAS SHIELD (${this.tcasShields} READY)`, 'success');
        break;
      case 'perk_score_surge':
        this.runScoreMult += 0.35;
        this.showBanner('📈 TELEMETRY BOOST: +35% SCORE & CREDITS!', 'success');
        break;
      case 'perk_calm_skies':
        for (const s of this.storms) s.radius = Math.max(24, s.radius * 0.65);
        for (const h of this.hazards) {
          this.particles.spawnEmpBurst(h.x, h.y);
          h.alive = false;
        }
        this.hazards = [];
        this.showBanner('🌤️ SKIES CLEARED — STORMS SHRUNK & DRONES SWEPT!', 'info');
        break;
      case 'perk_fuel_drop':
        for (const p of this.aircraft) {
          if (p.lowFuel) {
            p.fuel = Math.min(p.maxFuel + 15, p.fuel + 15);
            this.particles.spawnFloatingText(p.x, p.y - 24, '+15s FUEL', '#34d399');
          }
        }
        this.showBanner('⛽ AERIAL REFUEL COMPLETE!', 'success');
        break;
      case 'perk_repair_life':
        if (this.lives < this.maxLives) {
          this.lives += 1;
          this.showBanner('❤️ +1 TOWER LIFE RESTORED!', 'success');
        } else {
          this.score += 500;
          this.runCredits += 40;
          this.showBanner('★ FULL LIVES BONUS: +500 PTS & +40 🪙!', 'success');
        }
        break;
    }
    this.pushHud();
  }

  toggleSpeed(): number {
    this.gameSpeed = this.gameSpeed === 1 ? 1.5 : this.gameSpeed === 1.5 ? 2 : 1;
    return this.gameSpeed;
  }

  togglePause(): boolean {
    if (!this.hasStarted || this.isGameOver || this.isStageCleared || this.isPerkDraftOpen) {
      return this.isPaused;
    }
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  resize() {
    const rect = this.wrap.getBoundingClientRect();
    const cssW = Math.max(260, rect.width || 360);
    const cssH = Math.max(260, rect.height || 360);
    const prevW = this.worldW;
    const prevH = this.worldH;

    // Keep consistent logical gameplay scale across portrait phones & wide desktops
    const isPortrait = cssH > cssW * 1.05;
    if (isPortrait) {
      this.worldW = 480;
      this.worldH = Math.max(540, Math.round((480 * cssH) / cssW));
      this.scale = cssW / this.worldW;
    } else {
      this.worldH = 540;
      this.worldW = Math.max(520, Math.round((540 * cssW) / cssH));
      this.scale = cssH / this.worldH;
    }

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
    this.bgCanvas.width = this.canvas.width;
    this.bgCanvas.height = this.canvas.height;

    this.airfieldAngle = isPortrait ? -0.96 : 0;

    this.rebuildZones();
    for (const ft of this.fireTrucks) {
      ft.setHome(this.fireStationPos.x, this.fireStationPos.y);
    }

    renderStaticBackdrop(
      this.bgCtx,
      this.stage,
      this.worldW,
      this.worldH,
      this.airfieldAngle,
      this.scale,
      this.dpr
    );

    if (prevW && prevH && (prevW !== this.worldW || prevH !== this.worldH)) {
      const sx = this.worldW / prevW;
      const sy = this.worldH / prevH;
      for (const p of this.aircraft) {
        p.x *= sx;
        p.y *= sy;
        p.orbitCenterX *= sx;
        p.orbitCenterY *= sy;
        for (const pt of p.path) {
          pt.x *= sx;
          pt.y *= sy;
        }
      }
      for (const h of this.hazards) {
        h.x *= sx;
        h.y *= sy;
      }
    }
  }

  rebuildZones() {
    const cx = this.worldW / 2 + (this.stage.features.movingCarrier ? this.carrier.offsetX : 0);
    const cy = this.worldH / 2 + (this.stage.features.movingCarrier ? this.carrier.offsetY : 0);
    const rot = this.airfieldAngle + (this.stage.features.movingCarrier ? this.carrier.angleOffset : 0);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // Sync Control Tower & ARFF Fire Station world positions
    const termY = this.stage.features.movingCarrier
      ? 24
      : Math.min(this.stage.islandRy - 26, 84);
    const towerLocalX = this.stage.features.movingCarrier ? 36 : 54;
    const towerLocalY = this.stage.features.movingCarrier ? 24 : termY + 8;
    this.towerPos = {
      x: cx + towerLocalX * cos - towerLocalY * sin,
      y: cy + towerLocalX * sin + towerLocalY * cos,
    };

    const fireLocalX = this.stage.features.movingCarrier ? 20 : -58;
    const fireLocalY = this.stage.features.movingCarrier ? 20 : termY + 9;
    this.fireStationPos = {
      x: cx + fireLocalX * cos - fireLocalY * sin,
      y: cy + fireLocalX * sin + fireLocalY * cos,
    };

    const wideBonus = 1 + this.store.getUpgradeLevel('wide_approach') * 0.14;
    const prevLocks = new Map<string, number>();
    for (const z of this.zones) prevLocks.set(z.def.id, z.emergencyLockedUntil);

    this.zones = this.stage.landingZones.map((def) => {
      const zx = cx + def.offsetX * cos - def.offsetY * sin;
      const zy = cy + def.offsetX * sin + def.offsetY * cos;
      const reversed = Boolean(def.reversible && this.windReversed);
      const angle = wrapAngle(rot + def.angle + (reversed ? Math.PI : 0));
      const fx = Math.cos(angle);
      const fy = Math.sin(angle);
      const rx = -fy;
      const ry = fx;
      const startX = zx - fx * (def.length / 2);
      const startY = zy - fy * (def.length / 2);

      return {
        def,
        name: reversed && def.revName ? def.revName : def.name,
        kind: def.kind,
        color: def.color,
        cx: zx,
        cy: zy,
        startX,
        startY,
        endX: startX + fx * def.length,
        endY: startY + fy * def.length,
        angle,
        fx,
        fy,
        rx,
        ry,
        length: def.length,
        width: def.width,
        gateLen: (def.kind === 'helipad' ? 28 : 90) * wideBonus,
        gateHalfW: (def.kind === 'helipad' ? 30 : 39) * wideBonus,
        reversed,
        emergencyLockedUntil: prevLocks.get(def.id) ?? 0,
        worldToLocal(wx: number, wy: number) {
          const dx = wx - startX;
          const dy = wy - startY;
          return { along: dx * fx + dy * fy, across: dx * rx + dy * ry };
        },
        localToWorld(along: number, across: number) {
          return {
            x: startX + fx * along + rx * across,
            y: startY + fy * along + ry * across,
          };
        },
      };
    });
  }

  private toWorldCoords(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.worldW,
      y: ((clientY - rect.top) / rect.height) * this.worldH,
    };
  }

  isZoneBlocked(zone: RuntimeLandingZone, ignorePlane?: Aircraft): boolean {
    if (zone.emergencyLockedUntil > Date.now()) {
      return true;
    }
    const group = zone.def.intersectionGroup;
    for (const p of this.aircraft) {
      if (p === ignorePlane) continue;
      if (
        p.state !== 'landing' &&
        p.state !== 'approaching' &&
        p.state !== 'foam_hold'
      ) {
        continue;
      }
      if (!p.lockedZoneId) continue;
      const pz = this.zones.find((z) => z.def.id === p.lockedZoneId);
      if (!pz) continue;
      const sameOrIntersect =
        pz.def.id === zone.def.id ||
        Boolean(group && pz.def.intersectionGroup === group);
      if (!sameOrIntersect) continue;
      if (
        p.state === 'landing' ||
        p.state === 'foam_hold' ||
        pz.kind === 'helipad' ||
        pz.worldToLocal(p.x, p.y).along > -34
      ) {
        return true;
      }
    }
    for (const dep of this.outbounds) {
      if (dep.state !== 'rolling') continue;
      const dz = this.zones.find((z) => z.def.id === dep.zoneId);
      if (
        dz &&
        (dz.def.id === zone.def.id ||
          Boolean(group && dz.def.intersectionGroup === group))
      ) {
        return true;
      }
    }
    return false;
  }

  private findSnapZone(
    plane: Aircraft,
    wx: number,
    wy: number,
    prevX: number,
    prevY: number
  ): RuntimeLandingZone | null {
    const segLen = Math.hypot(wx - prevX, wy - prevY) || 1;
    const dx = (wx - prevX) / segLen;
    const dy = (wy - prevY) / segLen;

    for (const z of this.zones) {
      if (!plane.canLandOn(z)) continue;
      if (z.kind === 'helipad') {
        if (Math.hypot(wx - z.cx, wy - z.cy) <= z.gateHalfW + 4) return z;
        continue;
      }
      const local = z.worldToLocal(wx, wy);
      const inside =
        local.along >= -z.gateLen - 10 &&
        local.along <= z.length * 0.48 &&
        Math.abs(local.across) <= z.gateHalfW + 6;
      const dot = dx * z.fx + dy * z.fy;
      if (inside && dot >= -0.25) return z;
    }
    return null;
  }

  private tryZapHazard(pt: Point, extraPad: number): boolean {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (!h.alive) continue;
      if (Math.hypot(h.x - pt.x, h.y - pt.y) <= h.tapRadius + extraPad) {
        if (this.empCooldown > 0) {
          audio.playMismatch();
          this.particles.spawnFloatingText(
            h.x,
            h.y - 24,
            `EMP ${Math.ceil(this.empCooldown)}s`,
            '#f59e0b'
          );
          return true;
        }
        // Fire Tower EMP Jammer!
        h.alive = false;
        this.hazards.splice(i, 1);
        this.empCooldown = this.empCooldownMax;
        this.hazardsJammed += 1;

        const empLvl = this.store.getUpgradeLevel('emp_overclock');
        const baseBounty = h.kind === 'ufo' ? 350 : 200;
        const pts = Math.round((baseBounty + empLvl * 80) * this.runScoreMult);
        const creds = Math.round((h.kind === 'ufo' ? 35 : 20) * (this.stage.isDaily ? 2 : 1));
        this.score += pts;
        this.runCredits += creds;

        this.empBeams.push({
          fromX: this.towerPos.x,
          fromY: this.towerPos.y,
          toX: h.x,
          toY: h.y,
          life: 0.36,
          maxLife: 0.36,
        });
        audio.playEmpPulse();
        haptics.emp();
        this.particles.spawnEmpBurst(h.x, h.y);
        this.particles.spawnFloatingText(
          h.x,
          h.y - 24,
          `${h.kind === 'ufo' ? 'UFO REPELLED' : 'DRONE JAMMED'} +${pts}`,
          '#38bdf8'
        );
        this.setATC(
          `EMP hit! ${h.kind === 'ufo' ? 'UFO banished' : 'Rogue drone neutralized'} (+${pts}).`
        );
        this.hudDirty = true;
        return true;
      }
    }
    return false;
  }

  private setupInputHandlers() {
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.hasStarted || this.isPaused || this.isGameOver || this.isStageCleared) return;
      const pt = this.toWorldCoords(e.clientX, e.clientY);
      const plane = this.findPlaneAt(pt, 18);
      if (plane) {
        audio.init();
        if (plane.state === 'orbiting') {
          plane.state = 'cruising';
        } else {
          plane.enterOrbit(this.worldW, this.worldH);
          audio.playOrbitLock();
          haptics.orbit();
          this.particles.spawnFloatingText(plane.x, plane.y - 22, '⟳ ORBIT', '#38bdf8');
          this.setATC(`${plane.id} locked into holding orbit.`);
        }
        this.hudDirty = true;
      }
    });

    const onDown = (e: PointerEvent) => {
      if (e.button === 2) return;
      if (!this.hasStarted || this.isPaused || this.isGameOver || this.isStageCleared || this.isPerkDraftOpen) {
        return;
      }
      e.preventDefault();
      audio.init();

      const pt = this.toWorldCoords(e.clientX, e.clientY);
      const touchPad = e.pointerType === 'touch' ? 28 : 14;

      // 1. Check Rogue Drone / UFO EMP tap first
      if (this.tryZapHazard(pt, touchPad * 0.5)) return;

      // 2. Check Outbound LAUNCH jet tap
      for (const dep of this.outbounds) {
        if (dep.state === 'waiting' && Math.hypot(dep.x - pt.x, dep.y - pt.y) <= 28 + touchPad * 0.5) {
          const z = this.zones.find((zn) => zn.def.id === dep.zoneId);
          if (z) {
            if (this.isZoneBlocked(z)) {
              audio.playMismatch();
              this.setATC(`${dep.id} hold short — RWY ${z.name} busy!`);
              this.particles.spawnFloatingText(dep.x, dep.y - 24, 'RWY BUSY!', '#f59e0b');
            } else {
              dep.launch(z);
              this.launches += 1;
              const pts = Math.round(140 * this.runScoreMult);
              this.score += pts;
              this.runCredits += this.stage.isDaily ? 16 : 8;
              audio.playLaunch();
              haptics.lock();
              this.particles.spawnFloatingText(dep.x, dep.y - 24, `LAUNCH +${pts}`, '#38bdf8');
              this.setATC(`${dep.id} cleared for takeoff RWY ${z.name}!`);
              this.hudDirty = true;
            }
          }
          return;
        }
      }

      // 3. Check Aircraft pick (for drag routing or double-tap Holding Orbit!)
      const plane = this.findPlaneAt(pt, touchPad);
      if (plane) {
        const now = Date.now();
        const isDoubleTap =
          this.lastTapPlaneId === plane.id && now - this.lastTapTime < 340;
        this.lastTapPlaneId = plane.id;
        this.lastTapTime = now;

        if (isDoubleTap && plane.state !== 'foam_hold' && plane.state !== 'landing') {
          this.selectedPlane = plane;
          this.isDragging = false;
          if (plane.state === 'orbiting') {
            plane.state = 'cruising';
            this.setATC(`${plane.id} resumed heading.`);
          } else {
            plane.enterOrbit(this.worldW, this.worldH);
            audio.playOrbitLock();
            haptics.orbit();
            this.particles.spawnFloatingText(plane.x, plane.y - 22, '⟳ ORBIT', '#38bdf8');
            this.setATC(`${plane.id} entered holding orbit.`);
          }
          this.hudDirty = true;
          return;
        }

        if (this.canvas.setPointerCapture) {
          try {
            this.canvas.setPointerCapture(e.pointerId);
          } catch {
            // Ignore capture errors
          }
        }
        this.selectedPlane = plane;
        this.isDragging = true;
        this.dragMovedDist = 0;
        this.highlightedZoneId = null;

        const wasApproaching = plane.state === 'approaching';
        plane.path = [];
        plane.lockedZoneId = null;
        if (plane.state === 'orbiting') plane.state = 'cruising';
        haptics.light();

        if (wasApproaching) {
          plane.state = 'cruising';
          plane.altitude = Math.max(plane.altitude, 0.72);
          this.score += 50;
          audio.playGoAround();
          this.particles.spawnFloatingText(plane.x, plane.y - 22, 'GO AROUND +50', '#fbbf24');
          this.setATC(`${plane.id} safe Go-Around (+50).`);
        } else {
          audio.playSelect();
          const padLabel = plane.isMayday ? 'ANY RUNWAY (MAYDAY!)' : ZONE_PALETTE[plane.spec.padColor].label;
          this.setATC(`Routing ${plane.id} (${plane.spec.name} → ${padLabel}).`);
        }
        this.hudDirty = true;
      } else {
        this.selectedPlane = null;
        this.hudDirty = true;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!this.isDragging || !this.selectedPlane) return;
      const plane = this.selectedPlane;
      if (
        plane.state === 'landed' ||
        plane.state === 'landing' ||
        plane.state === 'foam_hold' ||
        plane.state === 'crashed'
      ) {
        this.isDragging = false;
        this.selectedPlane = null;
        return;
      }
      e.preventDefault();
      const raw = this.toWorldCoords(e.clientX, e.clientY);
      const pt = {
        x: Math.max(12, Math.min(this.worldW - 12, raw.x)),
        y: Math.max(12, Math.min(this.worldH - 12, raw.y)),
      };
      const prev =
        plane.path.length > 0 ? plane.path[plane.path.length - 1] : { x: plane.x, y: plane.y };
      const step = Math.hypot(pt.x - prev.x, pt.y - prev.y);
      if (step < 11) return;
      this.dragMovedDist += step;

      if (plane.lockedZoneId) {
        const lz = this.zones.find((z) => z.def.id === plane.lockedZoneId);
        if (lz) {
          const stillNear =
            lz.kind === 'helipad'
              ? Math.hypot(pt.x - lz.cx, pt.y - lz.cy) <= lz.gateHalfW + 10
              : (() => {
                  const loc = lz.worldToLocal(pt.x, pt.y);
                  return (
                    loc.along >= -lz.gateLen - 14 &&
                    loc.along <= lz.length * 0.55 &&
                    Math.abs(loc.across) <= lz.gateHalfW + 10
                  );
                })();
          if (stillNear) return;
          plane.lockedZoneId = null;
          this.highlightedZoneId = null;
        }
      }

      const snap = this.findSnapZone(plane, pt.x, pt.y, prev.x, prev.y);
      if (snap) {
        if (snap.kind === 'helipad') {
          plane.path.push({ x: snap.cx, y: snap.cy });
        } else {
          const loc = snap.worldToLocal(pt.x, pt.y);
          if (loc.along < -26) {
            plane.path.push(snap.localToWorld(Math.max(-snap.gateLen + 14, loc.along), 0));
          }
          plane.path.push(snap.localToWorld(-14, 0));
          plane.path.push(snap.localToWorld(10, 0));
        }
        plane.lockedZoneId = snap.def.id;
        plane.state = 'following_path';
        this.highlightedZoneId = snap.def.id;
        audio.playLockRunway();
        haptics.lock();
        this.setATC(`${plane.id} locked onto ${snap.name}!`);
        return;
      }

      plane.path.push(pt);
      if (plane.path.length >= 3) {
        const len = plane.path.length;
        const a = plane.path[len - 3];
        const b = plane.path[len - 2];
        const c = plane.path[len - 1];
        b.x = b.x * 0.65 + (a.x + c.x) * 0.175;
        b.y = b.y * 0.65 + (a.y + c.y) * 0.175;
      }
      plane.state = 'following_path';
      audio.playPathTick();
    };

    const onUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.highlightedZoneId = null;
        if (this.dragMovedDist > 12) {
          this.selectedPlane = null;
        }
        this.hudDirty = true;
      }
    };

    this.canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  private findPlaneAt(pt: Point, extraPad: number): Aircraft | null {
    let best: Aircraft | null = null;
    let bestDist = Infinity;
    for (const p of this.aircraft) {
      if (p.state === 'landed' || p.state === 'landing' || p.state === 'foam_hold' || p.state === 'crashed') {
        continue;
      }
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < p.selectRadius + extraPad && d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  private pickSpawnSpec(): Omit<IncomingAlert, 'timer'> {
    const pool = this.stage.aircraftPool;
    const type = pool[Math.floor(Math.random() * pool.length)];
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    let heading = 0;
    if (edge === 0) {
      x = Math.random() * (this.worldW - 140) + 70;
      y = 14;
      heading = Math.PI * 0.38 + Math.random() * 0.24;
    } else if (edge === 1) {
      x = this.worldW - 14;
      y = Math.random() * (this.worldH - 140) + 70;
      heading = Math.PI * 0.88 + Math.random() * 0.24;
    } else if (edge === 2) {
      x = Math.random() * (this.worldW - 140) + 70;
      y = this.worldH - 14;
      heading = -Math.PI * 0.38 - Math.random() * 0.24;
    } else {
      x = 14;
      y = Math.random() * (this.worldH - 160) + 80;
      heading = -0.18 + Math.random() * 0.36;
    }

    const canMayday =
      Boolean(this.stage.features.maydayEmergencies) &&
      this.landings >= 2 &&
      this.maydayCooldown <= 0 &&
      type !== 'helicopter' &&
      !this.aircraft.some((p) => p.isMayday) &&
      Math.random() < 0.26;

    const isMayday = canMayday;
    if (isMayday) this.maydayCooldown = 22;

    const lowFuel =
      isMayday ||
      Boolean(this.stage.features.lowFuel && this.landings >= 2 && Math.random() < 0.22);
    const isVip = Boolean(
      !isMayday && this.stage.features.vipJets && type === 'fastjet' && Math.random() < 0.38
    );

    return { type, x, y, heading, lowFuel, isVip, isMayday };
  }

  private spawnPlaneImmediate() {
    const spec = this.pickSpawnSpec();
    const extraFuel = this.store.getUpgradeLevel('fuel_tankers') * 6;
    const plane = new Aircraft(spec.type, spec.x, spec.y, spec.heading, {
      lowFuel: false,
      isVip: spec.isVip,
      isMayday: false,
      extraFuelSec: extraFuel,
    });
    this.aircraft.push(plane);
    this.setATC(`Inbound: ${plane.id} (${plane.spec.name}).`);
    this.hudDirty = true;
  }

  private queueIncomingPlane() {
    const spec = this.pickSpawnSpec();
    this.incomingAlerts.push({ ...spec, timer: 2.0 });
    if (spec.isMayday) {
      audio.playMaydayAlert();
      haptics.warn();
      this.showBanner('🔥 MAYDAY ENGINE FIRE! CLEAR ANY RUNWAY — ARFF READY!', 'danger');
    } else {
      audio.playIncoming();
      if (spec.lowFuel) {
        this.showBanner('⛽ EMERGENCY LOW-FUEL FLIGHT INBOUND!', 'warn');
      }
    }
  }

  private handleMaydayTouchdown(plane: Aircraft, zone: RuntimeLandingZone) {
    const fireLvl = this.store.getUpgradeLevel('rapid_fire_crew');
    const foamDur = Math.max(1.3, 3.4 - fireLvl * 0.65);
    plane.foamHoldMax = foamDur;
    plane.foamHoldTimer = foamDur;
    zone.emergencyLockedUntil = Date.now() + (foamDur + 1.1) * 1000;

    audio.playFireSiren();
    haptics.warn();
    for (const ft of this.fireTrucks) {
      ft.dispatch(plane);
    }
    this.showBanner(`🚒 ARFF FIRE CREW FOAMING RWY ${zone.name}!`, 'warn');
    this.setATC(`${plane.id} emergency stop on ${zone.name} — Fire Trucks dispatched!`);
  }

  showBanner(msg: string, tone: 'info' | 'warn' | 'danger' | 'success' = 'info') {
    this.eventBanner = msg;
    this.eventBannerTone = tone;
    this.eventBannerTimer = 3.4;
    this.hudDirty = true;
  }

  setATC(msg: string) {
    this.atcMessage = msg;
    this.hudDirty = true;
  }

  getMultiplier(): number {
    return Math.min(6, 1 + Math.floor(this.streak / 3));
  }

  private handleSafeLanding(plane: Aircraft) {
    this.landings += 1;
    this.streak += 1;
    if (this.streak > this.maxStreak) this.maxStreak = this.streak;

    // Recharge a bit of Chrono Slow-Mo on every clean landing!
    this.slowMoCharge = Math.min(1, this.slowMoCharge + (this.runChronoBoost ? 0.16 : 0.09));

    const mult = this.getMultiplier();
    const fireLvl = this.store.getUpgradeLevel('rapid_fire_crew');
    const fuelBonus = plane.lowFuel && !plane.isMayday ? 110 : 0;
    const vipBonus = plane.isVip ? 180 : 0;
    const maydayBonus = plane.isMayday ? 500 + fireLvl * 120 : 0;
    if (plane.isMayday) this.maydaysSaved += 1;

    const pts = Math.round(
      (plane.spec.points + fuelBonus + vipBonus + maydayBonus) * mult * this.runScoreMult
    );
    this.score += pts;

    const baseCreds =
      (plane.isMayday ? 45 : plane.isVip ? 26 : plane.typeKey === 'heavycargo' ? 24 : 10) *
      (this.stage.isDaily || this.stage.id === 12 ? 2 : 1);
    this.runCredits += Math.round(baseCreds * this.runScoreMult);

    audio.playLandSuccess(this.streak);
    const label = plane.isMayday
      ? `🚒 MAYDAY SAVED +${pts}`
      : mult > 1
        ? `+${pts} (${mult}x)`
        : `+${pts}`;
    this.particles.spawnFloatingText(
      plane.x,
      plane.y - 24,
      label,
      plane.isMayday ? '#38bdf8' : plane.isVip ? '#facc15' : '#34d399'
    );

    if (
      this.stage.features.bonusLifeStreak &&
      this.streak > 0 &&
      this.streak % 10 === 0 &&
      this.lives < this.maxLives
    ) {
      this.lives += 1;
      this.showBanner('★ 10-STREAK BONUS: +1 LIFE RESTORED!', 'success');
    }

    this.store.recordBestScore(this.stage.id, this.score, this.stage.dailyDateKey);
    this.setATC(`${plane.id} landed safely (+${pts}).`);
    this.hudDirty = true;

    const launchGoalMet =
      !this.stage.targetLaunches || this.launches >= this.stage.targetLaunches;
    if (
      !this.endlessMode &&
      this.landings >= this.stage.targetLandings &&
      launchGoalMet &&
      !this.isStageCleared
    ) {
      this.isStageCleared = true;
      this.slowMoActive = false;
      audio.playVictory();
      const stars = this.stage.isDaily
        ? this.lives >= 3
          ? 3
          : this.lives === 2
            ? 2
            : 1
        : this.store.recordStageClear(this.stage.id, this.score, this.lives, STAGES.length);

      if (this.stage.isDaily && this.stage.dailyDateKey) {
        this.store.recordDailyClear(this.stage.dailyDateKey, this.score);
      }

      const clearCreditBonus = (stars * 45 + 60) * (this.stage.isDaily ? 2 : 1);
      this.runCredits += clearCreditBonus;
      this.store.addCredits(this.runCredits);
      this.store.recordRunStats(
        this.landings,
        this.launches,
        this.maydaysSaved,
        this.hazardsJammed,
        this.maxStreak
      );

      this.pushHud();
      this.ui.onStageClear({
        stage: this.stage,
        score: this.score,
        landings: this.landings,
        launches: this.launches,
        maydaysSaved: this.maydaysSaved,
        hazardsJammed: this.hazardsJammed,
        maxStreak: this.maxStreak,
        creditsEarned: this.runCredits,
        stars,
      });
      return;
    }

    // Trigger Mid-Run Tactical Perk Draft!
    if (this.landings === this.nextPerkLandingMilestone && !this.isStageCleared) {
      this.nextPerkLandingMilestone = this.endlessMode ? this.landings + 15 : 99999;
      this.isPerkDraftOpen = true;
      this.slowMoActive = false;
      const perks = pickTacticalPerks(
        this.lives,
        this.maxLives,
        this.storms.length > 0 || this.hazards.length > 0
      );
      this.ui.onPerkDraft(perks);
    }
  }

  private triggerLifeLoss(x: number, y: number, reason: string) {
    audio.playExplosion();
    haptics.crash();
    this.particles.spawnExplosion(x, y);
    this.lives -= 1;
    this.streak = 0;
    this.shakeTimer = 0.45;
    this.setATC(reason);
    this.hudDirty = true;

    if (this.lives <= 0) {
      this.isGameOver = true;
      this.slowMoActive = false;
      this.store.recordBestScore(this.stage.id, this.score, this.stage.dailyDateKey);
      // Award partial credits earned during the run so every attempt progresses upgrades!
      this.store.addCredits(this.runCredits);
      this.store.recordRunStats(
        this.landings,
        this.launches,
        this.maydaysSaved,
        this.hazardsJammed,
        this.maxStreak
      );
      this.pushHud();
      this.ui.onGameOver({
        stage: this.stage,
        score: this.score,
        landings: this.landings,
        launches: this.launches,
        maydaysSaved: this.maydaysSaved,
        hazardsJammed: this.hazardsJammed,
        maxStreak: this.maxStreak,
        creditsEarned: this.runCredits,
        stars: 0,
        reason,
      });
    }
  }

  pushHud() {
    this.hudDirty = false;
    const bestScore = this.stage.dailyDateKey
      ? this.store.getDailyBest(this.stage.dailyDateKey)
      : this.store.getRecord(this.stage.id).bestScore;

    this.ui.onHudUpdate({
      stage: this.stage,
      landings: this.landings,
      launches: this.launches,
      score: this.score,
      bestScore,
      credits: this.store.data.credits,
      runCredits: this.runCredits,
      lives: this.lives,
      maxLives: this.maxLives,
      streak: this.streak,
      multiplier: this.getMultiplier(),
      activeFlights: this.aircraft.length,
      orbitingCount: this.aircraft.filter((p) => p.state === 'orbiting').length,
      windReversed: this.windReversed,
      endlessMode: this.endlessMode,
      atcMessage: this.atcMessage,
      eventBanner: this.eventBanner,
      eventBannerTone: this.eventBannerTone,
      slowMoCharge: this.slowMoCharge,
      slowMoActive: this.slowMoActive,
      empCooldownRatio: Math.max(0, Math.min(1, this.empCooldown / this.empCooldownMax)),
      tcasShields: this.tcasShields,
      selectedPlaneId: this.selectedPlane ? this.selectedPlane.id : null,
      selectedPlaneOrbiting: this.selectedPlane?.state === 'orbiting',
      activeHazards: this.hazards.length,
      activeMaydays: this.aircraft.filter((p) => p.isMayday).length,
      flightStrips: this.aircraft
        .map((p) => {
          const z = p.lockedZoneId ? this.zones.find((zn) => zn.def.id === p.lockedZoneId) : null;
          return {
            id: p.id,
            name: p.spec.name,
            padColor: p.spec.padColor,
            state: p.state,
            isVip: p.isVip,
            isMayday: p.isMayday,
            lowFuel: p.lowFuel,
            fuelSec: p.lowFuel ? Math.max(0, Math.ceil(p.fuel)) : 999,
            fuelRatio: p.lowFuel ? Math.max(0, Math.min(1, p.fuel / p.maxFuel)) : 1,
            danger: p.dangerWarning,
            lockedZoneName: z ? z.name : null,
            selected: this.selectedPlane === p,
          };
        })
        .sort((a, b) => {
          const prio = (x: typeof a) =>
            (x.danger ? 1000 : 0) + (x.isMayday ? 500 : 0) + (x.lowFuel ? 250 - x.fuelSec : 0) + (x.isVip ? 80 : 0);
          return prio(b) - prio(a);
        }),
      outboundStrips: this.outbounds
        .filter((o) => o.state === 'waiting')
        .map((o) => {
          const z = this.zones.find((zn) => zn.def.id === o.zoneId);
          return {
            id: o.id,
            zoneName: z ? z.name : 'RWY',
            patienceSec: Math.max(0, Math.ceil(o.patience)),
            patienceRatio: Math.max(0, Math.min(1, o.patience / o.maxPatience)),
          };
        }),
      hazardStrips: this.hazards
        .map((h, index) => ({
          index,
          kind: h.kind,
          lifeSec: Math.max(0, Math.ceil(h.life)),
        })),
    });
  }

  private loop = (now: number) => {
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.08);
    this.lastTime = now;

    if (
      this.hasStarted &&
      !this.isPaused &&
      !this.isPerkDraftOpen &&
      !this.isGameOver &&
      !this.isStageCleared
    ) {
      // Chrono Slow-Mo battery update in real time
      const chronoLvl = this.store.getUpgradeLevel('chrono_battery');
      const slowDuration = 4.5 + chronoLvl * 1.4;
      const rechargeRate = (0.045 + chronoLvl * 0.012) * (this.runChronoBoost ? 2 : 1);

      if (this.slowMoActive) {
        this.slowMoCharge -= rawDt / slowDuration;
        if (this.slowMoCharge <= 0) {
          this.slowMoCharge = 0;
          this.slowMoActive = false;
          audio.playSlowMoOff();
        }
      } else {
        this.slowMoCharge = Math.min(1, this.slowMoCharge + rawDt * rechargeRate);
      }

      const simScale = this.slowMoActive ? 0.35 : this.gameSpeed;
      this.update(rawDt * simScale, rawDt);
    }

    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number, realDt: number) {
    if (this.empCooldown > 0) {
      this.empCooldown = Math.max(0, this.empCooldown - realDt);
    }
    if (this.maydayCooldown > 0) {
      this.maydayCooldown -= dt;
    }

    if (this.stage.features.movingCarrier) {
      this.carrier.update(dt, this.worldW, this.worldH);
      this.rebuildZones();
      for (const ft of this.fireTrucks) {
        ft.setHome(this.fireStationPos.x, this.fireStationPos.y);
      }
    }

    if (this.stage.features.dayToNight) {
      const targetNight =
        0.18 + Math.min(1, this.landings / Math.max(1, this.stage.targetLandings * 0.72)) * 0.78;
      this.nightLevel += (targetNight - this.nightLevel) * Math.min(1, dt * 0.6);
    }

    if (this.stage.features.windShifts) {
      this.windTimer -= dt;
      if (this.windTimer <= 0) {
        this.windReversed = !this.windReversed;
        this.windTimer = 26 + Math.random() * 10;
        this.rebuildZones();
        audio.playWindShift();
        haptics.warn();
        this.showBanner(
          `💨 WIND SHIFT! RUNWAYS REVERSED (${this.windReversed ? '270°' : '090°'})`,
          'warn'
        );
        for (const p of this.aircraft) {
          if (p.lockedZoneId && p.state === 'following_path') {
            const z = this.zones.find((zn) => zn.def.id === p.lockedZoneId);
            if (z?.def.reversible) p.lockedZoneId = null;
          }
        }
      }
    }

    // Outbound takeoff queue
    if (this.stage.features.outboundTakeoffs) {
      this.outboundTimer -= dt;
      const waiting = this.outbounds.filter((o) => o.state === 'waiting').length;
      if (this.outboundTimer <= 0 && waiting < 2) {
        const available = this.zones
          .filter((z) => z.def.allowTakeoffs)
          .filter((z) => !this.outbounds.some((o) => o.zoneId === z.def.id && o.state === 'waiting'));
        if (available.length > 0) {
          const z = available[Math.floor(Math.random() * available.length)];
          this.outbounds.push(new OutboundFlight(z));
          this.showBanner(`🛫 OUTBOUND READY ON RWY ${z.name} — TAP TO LAUNCH!`, 'info');
          this.outboundTimer = 11 + Math.random() * 5;
        }
      }
      for (const dep of this.outbounds) {
        const z = this.zones.find((zn) => zn.def.id === dep.zoneId);
        if (z) dep.update(dt, z, this.worldW, this.worldH);
        if (dep.expired) {
          this.streak = 0;
          this.setATC(`${dep.id} departure slot missed — streak reset!`);
          this.hudDirty = true;
        }
      }
      this.outbounds = this.outbounds.filter((o) => o.state !== 'done');
    }

    // Rogue Drones & UFOs spawning and interference
    if (this.stage.features.rogueDrones || this.stage.features.ufoEvents) {
      this.hazardTimer -= dt;
      if (this.hazardTimer <= 0 && this.hazards.length < 2 && this.landings >= 1) {
        const allowUfo = Boolean(this.stage.features.ufoEvents);
        const allowDrone = Boolean(this.stage.features.rogueDrones);
        const kind: 'drone' | 'ufo' =
          allowUfo && (!allowDrone || Math.random() < 0.45) ? 'ufo' : 'drone';
        const hazard = new RogueHazard(kind, this.worldW, this.worldH);
        this.hazards.push(hazard);
        if (kind === 'ufo') {
          audio.playUfoWarble();
          this.showBanner('🛸 UNIDENTIFIED UFO ON RADAR — TAP TO EMP!', 'warn');
        } else {
          audio.playIncoming();
          this.showBanner('🤖 ROGUE DRONE INTRUSION — TAP TO EMP JAM!', 'warn');
        }
        this.hazardTimer = 15 + Math.random() * 8;
        this.hudDirty = true;
      }

      for (const h of this.hazards) {
        h.update(dt, this.worldW, this.worldH);
        for (const p of this.aircraft) {
          if (p.altitude < 0.25 || p.stormCooldown > 0) continue;
          const dist = Math.hypot(p.x - h.x, p.y - h.y);
          if (dist < h.radius) {
            p.path = [];
            p.lockedZoneId = null;
            if (p.state === 'orbiting') p.state = 'cruising';
            p.state = 'cruising';
            p.heading = wrapAngle(p.heading + (h.kind === 'ufo' ? 1.25 : 0.85) * (Math.random() > 0.5 ? 1 : -1));
            p.stormCooldown = 2.6;
            audio.playStormZap();
            haptics.warn();
            this.particles.spawnStormSparks(p.x, p.y);
            this.particles.spawnFloatingText(
              p.x,
              p.y - 20,
              h.kind === 'ufo' ? 'UFO BEAM!' : 'DRONE DODGE!',
              '#2dd4bf'
            );
            this.setATC(`${p.id} scrambled by ${h.kind.toUpperCase()} — tap hazard to EMP!`);
          }
        }
      }
      this.hazards = this.hazards.filter((h) => h.alive);
    }

    // Storm cells
    for (const s of this.storms) {
      s.update(dt, this.worldW, this.worldH);
      for (const p of this.aircraft) {
        if (p.altitude < 0.25 || p.stormCooldown > 0) continue;
        if (Math.hypot(p.x - s.x, p.y - s.y) < s.radius) {
          p.path = [];
          p.lockedZoneId = null;
          p.state = 'cruising';
          p.heading = wrapAngle(p.heading + (Math.random() > 0.5 ? 1 : -1) * 0.9);
          p.stormCooldown = 2.8;
          audio.playStormZap();
          haptics.warn();
          this.particles.spawnStormSparks(p.x, p.y);
          this.particles.spawnFloatingText(p.x, p.y - 20, 'TURBULENCE!', '#facc15');
          this.setATC(`${p.id} hit storm turbulence — reroute!`);
        }
      }
    }

    // Fire trucks update
    for (const ft of this.fireTrucks) {
      ft.update(dt, this.particles);
    }

    // EMP beam decay
    for (let i = this.empBeams.length - 1; i >= 0; i--) {
      this.empBeams[i].life -= realDt;
      if (this.empBeams[i].life <= 0) this.empBeams.splice(i, 1);
    }

    // Ambient clouds
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x - c.r * 2 > this.worldW) {
        c.x = -c.r * 2;
        c.y = Math.random() * this.worldH;
      }
    }

    if (this.eventBannerTimer > 0) {
      this.eventBannerTimer -= realDt;
      if (this.eventBannerTimer <= 0) {
        this.eventBanner = null;
        this.hudDirty = true;
      }
    }

    // Incoming aircraft queue
    const extraFuel = this.store.getUpgradeLevel('fuel_tankers') * 6;
    for (let i = this.incomingAlerts.length - 1; i >= 0; i--) {
      const inc = this.incomingAlerts[i];
      inc.timer -= dt;
      if (inc.timer <= 0) {
        this.incomingAlerts.splice(i, 1);
        const plane = new Aircraft(inc.type, inc.x, inc.y, inc.heading, {
          lowFuel: inc.lowFuel,
          isVip: inc.isVip,
          isMayday: inc.isMayday,
          extraFuelSec: extraFuel,
        });
        this.aircraft.push(plane);
        this.setATC(
          `Inbound: ${plane.id} (${plane.spec.name})${inc.isMayday ? ' [MAYDAY!]' : inc.lowFuel ? ' [LOW FUEL]' : ''}.`
        );
        this.hudDirty = true;
      }
    }

    this.spawnTimer -= dt;
    const totalPending = this.aircraft.length + this.incomingAlerts.length;
    const maxCap = this.endlessMode ? this.stage.maxAirborne + 2 : this.stage.maxAirborne;
    if (this.spawnTimer <= 0 && totalPending < maxCap) {
      this.queueIncomingPlane();
      const progress = Math.min(1, this.landings / Math.max(1, this.stage.targetLandings));
      const interval =
        this.stage.spawnIntervalMax -
        progress * (this.stage.spawnIntervalMax - this.stage.spawnIntervalMin);
      this.spawnTimer = Math.max(2.0, this.endlessMode ? interval * 0.85 : interval);
    }

    // Update Aircraft
    const cb = {
      particles: this.particles,
      onSafeLanding: (p: Aircraft) => this.handleSafeLanding(p),
      onMaydayTouchdown: (p: Aircraft, z: RuntimeLandingZone) => this.handleMaydayTouchdown(p, z),
      onFuelEmpty: (p: Aircraft) =>
        this.triggerLifeLoss(p.x, p.y, `MAYDAY: ${p.id} ran out of fuel!`),
      onATC: (msg: string) => this.setATC(msg),
      isZoneBlocked: (z: RuntimeLandingZone, ignore?: Aircraft) => this.isZoneBlocked(z, ignore),
    };

    for (const p of this.aircraft) {
      const dragged = this.isDragging && this.selectedPlane === p;
      p.update(dt, this.zones, this.worldW, this.worldH, dragged, cb);
    }
    this.aircraft = this.aircraft.filter((p) => p.state !== 'landed' && p.state !== 'crashed');

    // Mid-air TCAS & Collision checks (with Auto-TCAS Shield Override!)
    let anyDanger = false;
    for (const p of this.aircraft) p.dangerWarning = false;

    for (let i = 0; i < this.aircraft.length; i++) {
      const a = this.aircraft[i];
      if (a.state === 'foam_hold') continue;
      for (let j = i + 1; j < this.aircraft.length; j++) {
        const b = this.aircraft[j];
        if (b.state === 'foam_hold') continue;
        if (a.evasionTimer > 0 || b.evasionTimer > 0) continue;
        if (Math.abs(a.altitude - b.altitude) > 0.65) continue;

        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < a.collisionRadius + b.collisionRadius) {
          if (this.tcasShields > 0) {
            // Auto-TCAS Emergency Evasive Climb saves both aircraft!
            this.tcasShields -= 1;
            a.evasionTimer = 2.8;
            b.evasionTimer = 2.8;
            const sepAngle = Math.atan2(b.y - a.y, b.x - a.x);
            a.heading = wrapAngle(sepAngle + Math.PI);
            b.heading = wrapAngle(sepAngle);
            a.path = [];
            b.path = [];
            a.lockedZoneId = null;
            b.lockedZoneId = null;
            if (a.state === 'orbiting') a.state = 'cruising';
            if (b.state === 'orbiting') b.state = 'cruising';

            audio.playTcasSave();
            haptics.lock();
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            this.particles.spawnRing(mx, my, 76, '#38bdf8', 0.5);
            this.particles.spawnFloatingText(mx, my - 20, '🛡️ AUTO-TCAS SAVED!', '#38bdf8');
            this.showBanner(
              `🛡️ AUTO-TCAS COLLISION AVOIDED! (${this.tcasShields} LEFT)`,
              'success'
            );
            this.setATC(`Auto-TCAS separated ${a.id} & ${b.id}!`);
            this.hudDirty = true;
          } else {
            a.state = 'crashed';
            b.state = 'crashed';
            this.triggerLifeLoss(
              (a.x + b.x) / 2,
              (a.y + b.y) / 2,
              `Collision: ${a.id} & ${b.id}!`
            );
            break;
          }
        } else if (dist < a.warningRadius + b.warningRadius && a.altitude > 0.2 && b.altitude > 0.2) {
          a.dangerWarning = true;
          b.dangerWarning = true;
          anyDanger = true;
        }
      }
    }

    // Rolling outbound runway collision check
    for (const dep of this.outbounds) {
      if (dep.state !== 'rolling') continue;
      for (const p of this.aircraft) {
        if (p.altitude > 0.3 || p.evasionTimer > 0) continue;
        if (Math.hypot(dep.x - p.x, dep.y - p.y) < 26) {
          dep.state = 'done';
          p.state = 'crashed';
          this.triggerLifeLoss(
            (dep.x + p.x) / 2,
            (dep.y + p.y) / 2,
            `Runway collision: ${dep.id} & ${p.id}!`
          );
          break;
        }
      }
    }

    this.aircraft = this.aircraft.filter((p) => p.state !== 'crashed');

    if (anyDanger && Date.now() - this.lastTcasSound > 700) {
      audio.playTCAS();
      this.lastTcasSound = Date.now();
    }

    this.particles.update(dt);
    if (this.shakeTimer > 0) this.shakeTimer -= realDt;

    this.hudTickTimer += realDt;
    if (this.hudDirty || this.hudTickTimer >= 0.14) {
      this.hudTickTimer = 0;
      this.pushHud();
    }
  }

  private draw() {
    const ctx = this.ctx;
    const t = Date.now() * 0.001;
    const nowMs = Date.now();

    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.bgCanvas, 0, 0);
    ctx.scale(this.scale * this.dpr, this.scale * this.dpr);

    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 14;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    if (this.stage.features.movingCarrier) {
      drawAircraftCarrier(
        ctx,
        this.worldW / 2 + this.carrier.offsetX,
        this.worldH / 2 + this.carrier.offsetY,
        this.airfieldAngle + this.carrier.angleOffset,
        t
      );
    } else {
      // Animated coastal surf foam around island
      ctx.save();
      ctx.translate(this.worldW / 2, this.worldH / 2);
      ctx.rotate(this.airfieldAngle);
      const wave = Math.sin(t * 2.1) * 3.2;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + Math.sin(t * 2.1) * 0.1})`;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([16, 12]);
      ctx.beginPath();
      ctx.ellipse(
        0,
        6,
        this.stage.islandRx + 15 + wave,
        this.stage.islandRy + 14 + wave * 0.8,
        -0.03,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (this.nightLevel > 0.05) {
      ctx.fillStyle = `rgba(6, 14, 30, ${this.nightLevel * 0.68})`;
      ctx.fillRect(0, 0, this.worldW, this.worldH);
    }

    // Control tower rotating radar beacon & windsock
    const windHeading = this.airfieldAngle + (this.windReversed ? Math.PI : 0);
    drawControlTowerBeacon(
      ctx,
      this.towerPos.x,
      this.towerPos.y,
      t,
      windHeading,
      this.slowMoActive
    );

    drawLandingZones(ctx, this.zones, this.highlightedZoneId, this.nightLevel, t, nowMs);

    // Fire trucks on tarmac
    for (const ft of this.fireTrucks) ft.draw(ctx);

    // Outbound departing jets
    for (const dep of this.outbounds) dep.draw(ctx);

    // Flight paths & Holding orbits
    for (const p of this.aircraft) p.drawPath(ctx);

    // EMP Jammer lightning beams from Control Tower
    for (const beam of this.empBeams) {
      const a = Math.max(0, beam.life / beam.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5 * a;
      ctx.beginPath();
      ctx.moveTo(beam.fromX, beam.fromY);
      const midX = (beam.fromX + beam.toX) / 2 + (Math.random() - 0.5) * 18;
      const midY = (beam.fromY + beam.toY) / 2 + (Math.random() - 0.5) * 18;
      ctx.lineTo(midX, midY);
      ctx.lineTo(beam.toX, beam.toY);
      ctx.stroke();
      ctx.strokeStyle = '#f0f9ff';
      ctx.lineWidth = 2 * a;
      ctx.stroke();
      ctx.restore();
    }

    // Aircraft sprites
    for (const p of this.aircraft) {
      p.draw(ctx, p === this.selectedPlane, this.nightLevel);
    }

    // Rogue Drones & UFOs
    for (const h of this.hazards) h.draw(ctx);

    // Storm cells
    for (const s of this.storms) s.draw(ctx);

    // Particles & floating callouts
    this.particles.draw(ctx);

    // High-altitude soft clouds
    if (this.nightLevel < 0.6) {
      ctx.save();
      ctx.globalAlpha = 1 - this.nightLevel;
      for (const c of this.clouds) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.arc(c.x + c.r * 0.68, c.y - 4, c.r * 0.72, 0, Math.PI * 2);
        ctx.arc(c.x - c.r * 0.56, c.y + 6, c.r * 0.58, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Incoming radar edge alerts
    const pulse = (Math.sin(nowMs * 0.015) + 1) * 0.5;
    for (const inc of this.incomingAlerts) {
      const spec = AIRCRAFT_SPECS[inc.type];
      const ax = Math.max(24, Math.min(this.worldW - 24, inc.x));
      const ay = Math.max(24, Math.min(this.worldH - 24, inc.y));
      ctx.save();
      ctx.translate(ax, ay);
      ctx.globalAlpha = 0.68 + pulse * 0.32;
      ctx.fillStyle = inc.isMayday ? '#dc2626' : inc.lowFuel ? '#d97706' : spec.badgeColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.rotate(inc.heading);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(6.5, 0);
      ctx.lineTo(-4, -4.5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Tactical Chrono Slow-Mo crisp cyan vignette
    if (this.slowMoActive) {
      const vig = ctx.createRadialGradient(
        this.worldW / 2,
        this.worldH / 2,
        Math.min(this.worldW, this.worldH) * 0.32,
        this.worldW / 2,
        this.worldH / 2,
        Math.max(this.worldW, this.worldH) * 0.72
      );
      vig.addColorStop(0, 'rgba(14, 165, 233, 0)');
      vig.addColorStop(1, 'rgba(14, 165, 233, 0.24)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, this.worldW, this.worldH);
    }

    ctx.restore();
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
  }
}
