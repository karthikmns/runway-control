import { audio } from './audio';
import { haptics } from './haptics';
import type { ParticleSystem } from './particles';
import type {
  AircraftType,
  Point,
  RuntimeLandingZone,
  ZoneColor,
} from './types';

export const ZONE_PALETTE: Record<
  ZoneColor,
  { primary: string; soft: string; glow: string; label: string }
> = {
  blue: {
    primary: '#0284c7',
    soft: 'rgba(14, 165, 233, 0.28)',
    glow: '#38bdf8',
    label: 'BLUE',
  },
  green: {
    primary: '#059669',
    soft: 'rgba(16, 185, 129, 0.28)',
    glow: '#34d399',
    label: 'GREEN',
  },
  yellow: {
    primary: '#eab308',
    soft: 'rgba(234, 179, 8, 0.3)',
    glow: '#fde047',
    label: 'HELIPAD',
  },
  orange: {
    primary: '#ea580c',
    soft: 'rgba(249, 115, 22, 0.28)',
    glow: '#fb923c',
    label: 'WATER',
  },
  red: {
    primary: '#e11d48',
    soft: 'rgba(225, 29, 72, 0.28)',
    glow: '#fb7185',
    label: 'EXPRESS',
  },
};

export interface AircraftSpec {
  type: AircraftType;
  name: string;
  speed: number;
  wingspan: number;
  length: number;
  points: number;
  bodyColor: string;
  wingColor: string;
  accentColor: string;
  tailColor: string;
  badgeColor: string;
  padColor: ZoneColor;
}

export const AIRCRAFT_SPECS: Record<AircraftType, AircraftSpec> = {
  airliner: {
    type: 'airliner',
    name: 'Airliner',
    speed: 55,
    wingspan: 32,
    length: 34,
    points: 100,
    bodyColor: '#ffffff',
    wingColor: '#f1f5f9',
    accentColor: '#0284c7',
    tailColor: '#0369a1',
    badgeColor: '#0284c7',
    padColor: 'blue',
  },
  turboprop: {
    type: 'turboprop',
    name: 'Turboprop',
    speed: 44,
    wingspan: 28,
    length: 24,
    points: 150,
    bodyColor: '#f0fdf4',
    wingColor: '#dcfce7',
    accentColor: '#059669',
    tailColor: '#047857',
    badgeColor: '#059669',
    padColor: 'green',
  },
  helicopter: {
    type: 'helicopter',
    name: 'Chopper',
    speed: 35,
    wingspan: 26,
    length: 25,
    points: 125,
    bodyColor: '#fef9c3',
    wingColor: '#fde047',
    accentColor: '#ca8a04',
    tailColor: '#a16207',
    badgeColor: '#ca8a04',
    padColor: 'yellow',
  },
  seaplane: {
    type: 'seaplane',
    name: 'Seaplane',
    speed: 48,
    wingspan: 30,
    length: 26,
    points: 175,
    bodyColor: '#fff7ed',
    wingColor: '#ffedd5',
    accentColor: '#ea580c',
    tailColor: '#c2410c',
    badgeColor: '#ea580c',
    padColor: 'orange',
  },
  fastjet: {
    type: 'fastjet',
    name: 'Express Jet',
    speed: 73,
    wingspan: 24,
    length: 30,
    points: 250,
    bodyColor: '#fff1f2',
    wingColor: '#ffe4e6',
    accentColor: '#e11d48',
    tailColor: '#be123c',
    badgeColor: '#e11d48',
    padColor: 'red',
  },
  heavycargo: {
    type: 'heavycargo',
    name: 'Heavy Cargo',
    speed: 46,
    wingspan: 40,
    length: 39,
    points: 350,
    bodyColor: '#e0f2fe',
    wingColor: '#bae6fd',
    accentColor: '#0369a1',
    tailColor: '#0c4a6e',
    badgeColor: '#0369a1',
    padColor: 'blue',
  },
};

const CALLSIGNS = ['SKY', 'BAY', 'ISL', 'SUN', 'PAC', 'COR', 'JET', 'AIR', 'WAV', 'FLT', 'HVY'];

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export interface AircraftCallbacks {
  particles: ParticleSystem;
  onSafeLanding: (plane: Aircraft) => void;
  onMaydayTouchdown: (plane: Aircraft, zone: RuntimeLandingZone) => void;
  onFuelEmpty: (plane: Aircraft) => void;
  onATC: (msg: string) => void;
  isZoneBlocked: (zone: RuntimeLandingZone, ignorePlane?: Aircraft) => boolean;
}

export type AircraftState =
  | 'cruising'
  | 'following_path'
  | 'orbiting'
  | 'approaching'
  | 'landing'
  | 'foam_hold'
  | 'landed'
  | 'crashed';

export class Aircraft {
  id: string;
  typeKey: AircraftType;
  spec: AircraftSpec;
  isVip: boolean;
  isMayday: boolean;
  x: number;
  y: number;
  heading: number;
  bank = 0;
  speed: number;
  altitude = 1;
  state: AircraftState = 'cruising';
  path: Point[] = [];
  lockedZoneId: string | null = null;
  collisionRadius: number;
  warningRadius: number;
  selectRadius = 36;
  propAngle = 0;
  contrailTimer = 0;
  fireSmokeTimer = 0;
  contrails: { x1: number; y1: number; x2: number; y2: number; life: number }[] = [];
  dangerWarning = false;
  lastWarnTime = 0;
  stormCooldown = 0;
  evasionTimer = 0;

  // Holding orbit fields
  orbitCenterX = 0;
  orbitCenterY = 0;
  orbitRadius = 34;
  orbitAngle = 0;
  orbitDir = 1;

  // Fuel / Mayday timer
  lowFuel: boolean;
  fuel = 999;
  maxFuel = 999;

  // Foam hold timer (when fire trucks extinguish a Mayday aircraft on the runway)
  foamHoldTimer = 0;
  foamHoldMax = 3.2;

  constructor(
    type: AircraftType,
    x: number,
    y: number,
    heading: number,
    opts?: {
      lowFuel?: boolean;
      isVip?: boolean;
      isMayday?: boolean;
      extraFuelSec?: number;
    }
  ) {
    this.typeKey = type;
    this.spec = AIRCRAFT_SPECS[type];
    this.isVip = Boolean(opts?.isVip && type === 'fastjet');
    this.isMayday = Boolean(opts?.isMayday);
    const prefix = this.isMayday
      ? 'MAY-'
      : this.isVip
        ? 'VIP-'
        : type === 'heavycargo'
          ? 'HVY-'
          : `${CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)]}-`;
    this.id = `${prefix}${Math.floor(Math.random() * 89 + 10)}`;
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.speed = this.spec.speed * (this.isVip ? 1.06 : 1);
    this.collisionRadius = type === 'heavycargo' ? 21 : 17;
    this.warningRadius = type === 'heavycargo' ? 62 : 54;
    this.lowFuel = Boolean(opts?.lowFuel || this.isMayday);
    if (this.lowFuel) {
      const base = this.isMayday
        ? 30
        : type === 'helicopter'
          ? 34
          : 28;
      this.maxFuel = base + (opts?.extraFuelSec ?? 0);
      this.fuel = this.maxFuel;
    }
  }

  canLandOn(zone: RuntimeLandingZone): boolean {
    if (this.isMayday) {
      // Mayday emergency aircraft can divert onto ANY runway of matching medium!
      if (this.typeKey === 'helicopter') return zone.kind === 'helipad' || zone.kind === 'runway';
      if (this.typeKey === 'seaplane') return zone.kind === 'waterlane' || zone.kind === 'runway';
      return zone.kind === 'runway';
    }
    return zone.def.accepts.includes(this.typeKey);
  }

  enterOrbit(worldW: number, worldH: number) {
    this.path = [];
    this.lockedZoneId = null;
    this.state = 'orbiting';
    this.orbitRadius = this.typeKey === 'heavycargo' ? 40 : 32;
    this.orbitDir = 1;
    // Place center perpendicular to current heading so entry is smooth & natural
    const perp = this.heading + Math.PI / 2;
    let cx = this.x + Math.cos(perp) * this.orbitRadius;
    let cy = this.y + Math.sin(perp) * this.orbitRadius;
    const pad = this.orbitRadius + 24;
    cx = Math.max(pad, Math.min(worldW - pad, cx));
    cy = Math.max(pad, Math.min(worldH - pad, cy));
    this.orbitCenterX = cx;
    this.orbitCenterY = cy;
    this.orbitAngle = Math.atan2(this.y - cy, this.x - cx);
  }

  update(
    dt: number,
    zones: RuntimeLandingZone[],
    worldW: number,
    worldH: number,
    isBeingDragged: boolean,
    cb: AircraftCallbacks
  ) {
    if (this.state === 'crashed' || this.state === 'landed') return;

    this.propAngle += dt * (this.typeKey === 'helicopter' ? 22 : 34);
    if (this.stormCooldown > 0) this.stormCooldown -= dt;
    if (this.evasionTimer > 0) this.evasionTimer -= dt;

    if (this.state === 'foam_hold') {
      this.foamHoldTimer -= dt;
      this.bank *= 0.8;
      if (this.foamHoldTimer > 0.7) {
        this.fireSmokeTimer += dt;
        if (this.fireSmokeTimer > 0.14) {
          this.fireSmokeTimer = 0;
          cb.particles.spawnEngineFire(this.x, this.y, this.heading);
        }
      }
      if (this.foamHoldTimer <= 0) {
        this.state = 'landed';
        audio.playFoamExtinguish();
        cb.particles.spawnConfetti(this.x, this.y);
        cb.onSafeLanding(this);
      }
      return;
    }

    if (this.isMayday && this.state !== 'landing') {
      this.fireSmokeTimer += dt;
      if (this.fireSmokeTimer > 0.08) {
        this.fireSmokeTimer = 0;
        cb.particles.spawnEngineFire(this.x, this.y, this.heading);
      }
    }

    if (this.lowFuel && this.state !== 'landing') {
      this.fuel -= dt;
      if (this.fuel <= 0) {
        this.state = 'crashed';
        cb.onFuelEmpty(this);
        return;
      }
    }

    if (this.typeKey !== 'helicopter') {
      this.contrailTimer += dt;
      if (this.altitude > 0.72 && this.contrailTimer > 0.085) {
        this.contrailTimer = 0;
        const perp = this.heading + Math.PI / 2;
        const span = this.spec.wingspan * 0.42;
        this.contrails.push({
          x1: this.x + Math.cos(perp) * span,
          y1: this.y + Math.sin(perp) * span,
          x2: this.x - Math.cos(perp) * span,
          y2: this.y - Math.sin(perp) * span,
          life: 0.52,
        });
      }
      for (let i = this.contrails.length - 1; i >= 0; i--) {
        this.contrails[i].life -= dt;
        if (this.contrails[i].life <= 0) this.contrails.splice(i, 1);
      }
    }

    const prevHeading = this.heading;
    const lockedZone = this.lockedZoneId
      ? zones.find((z) => z.def.id === this.lockedZoneId) ?? null
      : null;

    if (lockedZone && this.path.length > 0 && !isBeingDragged) {
      if (lockedZone.kind === 'helipad') {
        this.path[this.path.length - 1] = { x: lockedZone.cx, y: lockedZone.cy };
      } else {
        const lastIdx = this.path.length - 1;
        this.path[lastIdx] = lockedZone.localToWorld(8, 0);
        if (lastIdx >= 1) {
          this.path[lastIdx - 1] = lockedZone.localToWorld(-22, 0);
        }
      }
    }

    if (this.state === 'approaching') {
      if (!lockedZone) {
        this.state = 'cruising';
        return;
      }
      if (lockedZone.kind === 'helipad') {
        const dx = lockedZone.cx - this.x;
        const dy = lockedZone.cy - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const step = Math.min(dist, this.speed * 0.9 * dt);
          this.x += (dx / dist) * step;
          this.y += (dy / dist) * step;
          const targetH = Math.atan2(dy, dx);
          this.heading = wrapAngle(
            this.heading + wrapAngle(targetH - this.heading) * Math.min(1, 8 * dt)
          );
        }
        this.altitude = Math.max(0, this.altitude - dt * 0.65);
        if (dist < 6 && this.altitude <= 0.08) {
          this.state = 'landed';
          audio.playTouchdown(false);
          haptics.touchdown();
          cb.onSafeLanding(this);
        }
        this.bank *= 0.85;
        return;
      }

      const local = lockedZone.worldToLocal(this.x, this.y);
      const nextAlong = local.along + this.speed * 0.94 * dt;
      const nextAcross = local.across * Math.max(0, 1 - 8 * dt);
      const pos = lockedZone.localToWorld(nextAlong, nextAcross);
      this.x = pos.x;
      this.y = pos.y;
      this.heading = wrapAngle(
        this.heading + wrapAngle(lockedZone.angle - this.heading) * Math.min(1, 10 * dt)
      );
      this.altitude = Math.max(0.06, this.altitude - dt * 0.55);
      if (nextAlong >= 4) {
        this.state = 'landing';
        this.heading = lockedZone.angle;
        this.altitude = 0;
        const isWater = lockedZone.kind === 'waterlane';
        audio.playTouchdown(isWater);
        haptics.touchdown();
        cb.particles.spawnTouchdownSmoke(this.x, this.y, lockedZone.angle, isWater);
        if (this.isMayday && lockedZone.kind === 'runway') {
          cb.onMaydayTouchdown(this, lockedZone);
        } else {
          cb.onATC(`${this.id} touchdown ${lockedZone.name}.`);
        }
      }
      this.updateBank(prevHeading, dt);
      return;
    }

    if (this.state === 'landing') {
      if (!lockedZone) {
        this.state = 'landed';
        cb.onSafeLanding(this);
        return;
      }
      const local = lockedZone.worldToLocal(this.x, this.y);
      const nextAlong = local.along + this.speed * dt;
      const nextAcross = local.across * Math.max(0, 1 - 10 * dt);
      const pos = lockedZone.localToWorld(nextAlong, nextAcross);
      this.x = pos.x;
      this.y = pos.y;
      this.heading = lockedZone.angle;
      this.speed = Math.max(15, this.speed - dt * (this.isMayday ? 52 : 42));
      if (lockedZone.kind === 'waterlane' && Math.random() < 0.35) {
        cb.particles.spawnTouchdownSmoke(this.x, this.y, lockedZone.angle, true);
      }
      if (this.isMayday && lockedZone.kind === 'runway' && nextAlong >= lockedZone.length * 0.52) {
        // Stop on runway for ARFF fire crew foam suppression!
        this.state = 'foam_hold';
        this.speed = 0;
        return;
      }
      if (nextAlong >= lockedZone.length * 0.72) {
        this.state = 'landed';
        cb.onSafeLanding(this);
      }
      this.bank *= 0.85;
      return;
    }

    if (this.state === 'orbiting') {
      const orbitSpeed = this.speed * 0.74;
      const angularVel = (orbitSpeed / this.orbitRadius) * this.orbitDir;
      this.orbitAngle = wrapAngle(this.orbitAngle + angularVel * dt);
      const tx = this.orbitCenterX + Math.cos(this.orbitAngle) * this.orbitRadius;
      const ty = this.orbitCenterY + Math.sin(this.orbitAngle) * this.orbitRadius;
      this.x += (tx - this.x) * Math.min(1, 10 * dt);
      this.y += (ty - this.y) * Math.min(1, 10 * dt);
      const tangent = wrapAngle(this.orbitAngle + (this.orbitDir > 0 ? Math.PI / 2 : -Math.PI / 2));
      this.heading = wrapAngle(
        this.heading + wrapAngle(tangent - this.heading) * Math.min(1, 12 * dt)
      );
      this.updateBank(prevHeading, dt);
      return;
    }

    if (this.path.length > 0) {
      let remaining = this.speed * dt;
      let segHeading: number | null = null;
      while (remaining > 0 && this.path.length > 0) {
        const pt = this.path[0];
        const dx = pt.x - this.x;
        const dy = pt.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.001) {
          this.path.shift();
          continue;
        }
        segHeading = Math.atan2(dy, dx);
        if (dist <= remaining) {
          this.x = pt.x;
          this.y = pt.y;
          remaining -= dist;
          this.path.shift();
        } else {
          this.x += (dx / dist) * remaining;
          this.y += (dy / dist) * remaining;
          remaining = 0;
        }
      }
      const look = this.getLookaheadPoint(20);
      const desired = look
        ? Math.atan2(look.y - this.y, look.x - this.x)
        : segHeading !== null
          ? segHeading
          : this.heading;
      const diff = wrapAngle(desired - this.heading);
      this.heading = wrapAngle(this.heading + diff * Math.min(1, 13 * dt));

      if (this.path.length === 0) {
        if (lockedZone && !cb.isZoneBlocked(lockedZone, this)) {
          this.state = 'approaching';
        } else {
          this.lockedZoneId = null;
          this.state = 'cruising';
        }
      }
    } else {
      this.x += Math.cos(this.heading) * this.speed * dt;
      this.y += Math.sin(this.heading) * this.speed * dt;
      const margin = 24;
      if (
        this.x < margin ||
        this.x > worldW - margin ||
        this.y < margin ||
        this.y > worldH - margin
      ) {
        const toCenter = Math.atan2(worldH / 2 - this.y, worldW / 2 - this.x);
        const diff = wrapAngle(toCenter - this.heading);
        const maxTurn = 2.7 * dt;
        this.heading = wrapAngle(
          this.heading + Math.max(-maxTurn, Math.min(maxTurn, diff))
        );
      }
    }

    this.updateBank(prevHeading, dt);
    if (!isBeingDragged) {
      this.checkLandingCapture(zones, cb);
    }
  }

  private getLookaheadPoint(distNeeded: number): Point | null {
    let acc = 0;
    let px = this.x;
    let py = this.y;
    for (let i = 0; i < this.path.length; i++) {
      const pt = this.path[i];
      const d = Math.hypot(pt.x - px, pt.y - py);
      if (acc + d >= distNeeded && d > 0.01) {
        const t = (distNeeded - acc) / d;
        return { x: px + (pt.x - px) * t, y: py + (pt.y - py) * t };
      }
      acc += d;
      px = pt.x;
      py = pt.y;
    }
    return this.path.length > 0 ? this.path[this.path.length - 1] : null;
  }

  private updateBank(prevHeading: number, dt: number) {
    const rate = wrapAngle(this.heading - prevHeading) / Math.max(dt, 0.001);
    const target = Math.max(-1, Math.min(1, rate * 0.25));
    this.bank += (target - this.bank) * Math.min(1, 9 * dt);
  }

  private checkLandingCapture(zones: RuntimeLandingZone[], cb: AircraftCallbacks) {
    for (const z of zones) {
      if (!this.canLandOn(z)) continue;
      if (z.kind === 'helipad') {
        if (
          Math.hypot(this.x - z.cx, this.y - z.cy) <= z.gateHalfW &&
          (this.lockedZoneId === z.def.id || this.path.length <= 1)
        ) {
          if (cb.isZoneBlocked(z, this)) {
            this.notifyBlocked(z, cb);
          } else {
            this.lockedZoneId = z.def.id;
            this.state = 'approaching';
            this.path = [];
            audio.playLockRunway();
            cb.particles.spawnFloatingText(this.x, this.y - 20, 'LANDING', '#fde047');
            return;
          }
        }
        continue;
      }

      const local = z.worldToLocal(this.x, this.y);
      const inCone =
        local.along >= -z.gateLen - 8 &&
        local.along <= 20 &&
        Math.abs(local.across) <= z.gateHalfW;
      const aligned = Math.abs(wrapAngle(this.heading - z.angle)) < 0.82;
      if (inCone && aligned) {
        if (cb.isZoneBlocked(z, this)) {
          this.notifyBlocked(z, cb);
        } else if (this.lockedZoneId === z.def.id || this.path.length <= 2) {
          this.lockedZoneId = z.def.id;
          this.state = 'approaching';
          this.path = [];
          audio.playLockRunway();
          cb.onATC(`${this.id} final approach ${z.name}.`);
          cb.particles.spawnFloatingText(
            this.x,
            this.y - 20,
            this.isMayday ? 'EMERGENCY FINAL' : 'FINAL',
            this.isMayday ? '#fb7185' : ZONE_PALETTE[z.color].glow
          );
          return;
        }
      }
    }
  }

  private notifyBlocked(z: RuntimeLandingZone, cb: AircraftCallbacks) {
    if (Date.now() - this.lastWarnTime > 2000) {
      this.lastWarnTime = Date.now();
      cb.onATC(`${this.id}: ${z.name} busy — double-tap to Orbit or Go-Around!`);
    }
  }

  drawPath(ctx: CanvasRenderingContext2D) {
    if (this.state === 'orbiting') {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -(Date.now() * 0.025) % 12;
      ctx.beginPath();
      ctx.arc(this.orbitCenterX, this.orbitCenterY, this.orbitRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
      ctx.beginPath();
      ctx.arc(this.orbitCenterX, this.orbitCenterY, this.orbitRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (!this.path || this.path.length === 0) return;
    ctx.save();
    const isLocked = this.lockedZoneId !== null;
    const strokeMain = isLocked ? (this.isMayday ? '#fb7185' : '#34d399') : '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    for (let i = 0; i < this.path.length; i++) {
      ctx.lineTo(this.path[i].x, this.path[i].y);
    }
    ctx.strokeStyle = isLocked ? 'rgba(6, 78, 59, 0.48)' : 'rgba(15, 23, 42, 0.38)';
    ctx.lineWidth = isLocked ? 5.8 : 4.8;
    ctx.stroke();

    ctx.strokeStyle = strokeMain;
    ctx.lineWidth = isLocked ? 3.1 : 2.6;
    ctx.setLineDash(isLocked ? [] : [8, 7]);
    ctx.lineDashOffset = -(Date.now() * 0.03) % 15;
    ctx.stroke();
    ctx.setLineDash([]);

    const end = this.path[this.path.length - 1];
    ctx.fillStyle = isLocked ? (this.isMayday ? '#f43f5e' : '#10b981') : this.spec.badgeColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(end.x, end.y, isLocked ? 5.2 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D, isSelected: boolean, nightLevel: number) {
    if (this.state === 'landed') return;

    if (this.contrails.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = this.typeKey === 'heavycargo' ? 1.9 : 1.3;
      for (let i = 1; i < this.contrails.length; i++) {
        const a = this.contrails[i - 1];
        const b = this.contrails[i];
        ctx.globalAlpha = Math.max(0, b.life * 0.65);
        ctx.beginPath();
        ctx.moveTo(a.x1, a.y1);
        ctx.lineTo(b.x1, b.y1);
        ctx.moveTo(a.x2, a.y2);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    if (this.altitude > 0.03 && nightLevel < 0.85) {
      const shadowOff = 17 * this.altitude;
      ctx.save();
      ctx.translate(this.x + shadowOff * 0.75, this.y + shadowOff);
      ctx.rotate(this.heading);
      const sc = 0.8 + this.altitude * 0.12;
      ctx.scale(sc, sc * (1 - Math.abs(this.bank) * 0.16));
      ctx.fillStyle = `rgba(7, 24, 42, ${0.25 * (1 - nightLevel * 0.7)})`;
      this.drawSilhouette(ctx);
      ctx.restore();
    }

    ctx.translate(this.x, this.y);

    if (this.evasionTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (this.state === 'foam_hold') {
      const progress = 1 - Math.max(0, this.foamHoldTimer / this.foamHoldMax);
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
    } else if (this.lowFuel && this.state !== 'landing') {
      const ratio = Math.max(0, this.fuel / this.maxFuel);
      const pulse = (Math.sin(Date.now() * 0.016) + 1) * 0.5;
      ctx.save();
      ctx.strokeStyle = this.isMayday || ratio < 0.3 ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = this.isMayday ? 3.2 : 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
      if (this.isMayday || ratio < 0.4) {
        ctx.fillStyle = this.isMayday
          ? `rgba(239, 68, 68, ${0.14 + pulse * 0.2})`
          : `rgba(245, 158, 11, ${0.12 + pulse * 0.18})`;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.dangerWarning) {
      ctx.save();
      const pulse = (Math.sin(Date.now() * 0.018) + 1) * 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + pulse * 0.14})`;
      ctx.beginPath();
      ctx.arc(0, 0, this.warningRadius * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, this.warningRadius * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = this.lockedZoneId ? '#34d399' : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.selectRadius * 0.78, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(this.heading);
    const altScale = 0.76 + this.altitude * 0.24;
    const bankScale = this.typeKey === 'helicopter' ? 1 : 1 - Math.abs(this.bank) * 0.18;
    ctx.scale(altScale, altScale * bankScale);
    this.drawModel(ctx, nightLevel);
    ctx.restore();

    if (
      isSelected ||
      this.dangerWarning ||
      this.lowFuel ||
      this.isMayday ||
      this.isVip ||
      this.state === 'orbiting' ||
      this.state === 'approaching' ||
      this.state === 'foam_hold'
    ) {
      this.drawMiniBadge(ctx);
    }
  }

  private drawModel(ctx: CanvasRenderingContext2D, nightLevel: number) {
    const s = this.spec;
    const hw = s.wingspan / 2;
    const hl = s.length / 2;
    ctx.lineWidth = 1.15;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.52)';

    if (this.typeKey === 'helicopter') {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-6, -7);
      ctx.lineTo(8, -7);
      ctx.moveTo(-6, 7);
      ctx.lineTo(8, 7);
      ctx.stroke();

      ctx.fillStyle = s.accentColor;
      ctx.fillRect(-hl, -1.8, hl * 0.9, 3.6);
      ctx.fillStyle = s.tailColor;
      ctx.fillRect(-hl - 1, -4.5, 3, 9);

      ctx.fillStyle = s.bodyColor;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(2, 0, 9.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(6.5, 0, 3.8, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(1.5, 0);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, hw, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(this.propAngle);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-hw, 0);
      ctx.lineTo(hw, 0);
      ctx.moveTo(0, -hw);
      ctx.lineTo(0, hw);
      ctx.stroke();
      ctx.fillStyle = s.accentColor;
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (this.typeKey === 'seaplane') {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.roundRect(-hl * 0.45, -hw * 0.45, hl * 1.1, 3.4, 1.5);
      ctx.roundRect(-hl * 0.45, hw * 0.45 - 3.4, hl * 1.1, 3.4, 1.5);
      ctx.fill();
    }

    ctx.fillStyle = s.wingColor;
    ctx.beginPath();
    if (this.typeKey === 'turboprop' || this.typeKey === 'seaplane') {
      ctx.roundRect(-hl * 0.15, -hw, hl * 0.42, hw * 2, 3);
    } else if (this.typeKey === 'fastjet') {
      ctx.moveTo(hl * 0.18, 0);
      ctx.lineTo(-hl * 0.28, -hw);
      ctx.lineTo(-hl * 0.48, -hw * 0.9);
      ctx.lineTo(-hl * 0.22, 0);
      ctx.lineTo(-hl * 0.48, hw * 0.9);
      ctx.lineTo(-hl * 0.28, hw);
      ctx.closePath();
    } else {
      ctx.moveTo(hl * 0.26, 0);
      ctx.lineTo(-hl * 0.12, -hw);
      ctx.lineTo(-hl * 0.32, -hw * 0.92);
      ctx.lineTo(-hl * 0.14, 0);
      ctx.lineTo(-hl * 0.32, hw * 0.92);
      ctx.lineTo(-hl * 0.12, hw);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    const tipColor = this.isVip ? '#eab308' : s.accentColor;
    ctx.fillStyle = tipColor;
    ctx.fillRect(-hl * 0.22, -hw, 4.5, 4.2);
    ctx.fillRect(-hl * 0.22, hw - 4.2, 4.5, 4.2);

    if (this.typeKey === 'heavycargo') {
      ctx.fillStyle = '#334155';
      // 4 engines on jumbo wing!
      ctx.beginPath();
      ctx.roundRect(hl * 0.02, -hw * 0.42, 7, 3.4, 1.5);
      ctx.roundRect(hl * 0.02, hw * 0.42 - 3.4, 7, 3.4, 1.5);
      ctx.roundRect(-hl * 0.1, -hw * 0.72, 6.5, 3, 1.5);
      ctx.roundRect(-hl * 0.1, hw * 0.72 - 3, 6.5, 3, 1.5);
      ctx.fill();
    } else if (this.typeKey === 'airliner') {
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(-hl * 0.02, -hw * 0.52, 7, 3.4, 1.5);
      ctx.roundRect(-hl * 0.02, hw * 0.52 - 3.4, 7, 3.4, 1.5);
      ctx.fill();
    } else if (this.typeKey === 'turboprop' || this.typeKey === 'seaplane') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(hl * 0.06, -hw * 0.46, 5.5, 3);
      ctx.fillRect(hl * 0.06, hw * 0.46 - 3, 5.5, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      const r = 4.6 + Math.sin(this.propAngle) * 1.2;
      ctx.beginPath();
      ctx.ellipse(hl * 0.28, -hw * 0.46 + 1.5, 1.4, r, 0, 0, Math.PI * 2);
      ctx.ellipse(hl * 0.28, hw * 0.46 - 1.5, 1.4, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Horizontal stabilizer
    ctx.fillStyle = s.wingColor;
    ctx.beginPath();
    ctx.moveTo(-hl * 0.65, 0);
    ctx.lineTo(-hl * 0.92, -hw * 0.42);
    ctx.lineTo(-hl * 1.02, -hw * 0.34);
    ctx.lineTo(-hl * 0.88, 0);
    ctx.lineTo(-hl * 1.02, hw * 0.34);
    ctx.lineTo(-hl * 0.92, hw * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fuselage
    ctx.fillStyle = this.isVip ? '#fef3c7' : s.bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, hl, hw * (this.typeKey === 'heavycargo' ? 0.28 : 0.24), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Vertical tail fin
    ctx.fillStyle = this.isVip ? '#d97706' : s.tailColor;
    ctx.beginPath();
    ctx.roundRect(-hl * 0.96, -1.6, hl * 0.38, 3.2, 1.5);
    ctx.fill();

    // Cockpit glass
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(hl * 0.58, 0, 3.4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (nightLevel > 0.2) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, nightLevel * 1.15);
      const beam = ctx.createLinearGradient(hl * 0.8, 0, hl + 30, 0);
      beam.addColorStop(0, 'rgba(254, 249, 195, 0.58)');
      beam.addColorStop(1, 'rgba(254, 249, 195, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(hl * 0.8, -2);
      ctx.lineTo(hl + 30, -11);
      ctx.lineTo(hl + 30, 11);
      ctx.lineTo(hl * 0.8, 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-hl * 0.16, -hw, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(-hl * 0.16, hw, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawSilhouette(ctx: CanvasRenderingContext2D) {
    const hw = this.spec.wingspan / 2;
    const hl = this.spec.length / 2;
    if (this.typeKey === 'helicopter') {
      ctx.beginPath();
      ctx.arc(1, 0, hw * 0.72, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, hl, hw * 0.25, 0, 0, Math.PI * 2);
    ctx.moveTo(hl * 0.2, 0);
    ctx.lineTo(-hl * 0.15, -hw);
    ctx.lineTo(-hl * 0.3, -hw * 0.9);
    ctx.lineTo(-hl * 0.15, 0);
    ctx.lineTo(-hl * 0.3, hw * 0.9);
    ctx.lineTo(-hl * 0.15, hw);
    ctx.closePath();
    ctx.fill();
  }

  private drawMiniBadge(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = 'bold 9.5px ui-monospace, monospace';
    const bx = this.x;
    const by = this.y - 26;
    let label = this.id;
    let bg = 'rgba(15, 23, 42, 0.86)';

    if (this.dangerWarning) {
      label = 'TCAS!';
      bg = '#dc2626';
    } else if (this.state === 'foam_hold') {
      label = 'FOAMING...';
      bg = '#0284c7';
    } else if (this.isMayday) {
      label = `🔥 MAYDAY ${Math.ceil(this.fuel)}s`;
      bg = '#dc2626';
    } else if (this.lowFuel) {
      label = `FUEL ${Math.ceil(this.fuel)}s`;
      bg = this.fuel < 9 ? '#dc2626' : '#d97706';
    } else if (this.state === 'orbiting') {
      label = '⟳ ORBIT';
      bg = '#0284c7';
    } else if (this.isVip) {
      label = '★ VIP';
      bg = '#b45309';
    } else if (this.state === 'approaching') {
      label = 'FINAL';
      bg = '#059669';
    }

    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(bx - w / 2, by - 8, w, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(label, bx, by + 2.2);
    ctx.restore();
  }
}

export class FireTruck {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  heading = 0;
  state: 'stationed' | 'responding' | 'spraying' | 'returning' = 'stationed';
  targetPlane: Aircraft | null = null;
  sideOffset: number;
  sprayTimer = 0;

  constructor(homeX: number, homeY: number, sideOffset: number) {
    this.homeX = homeX;
    this.homeY = homeY;
    this.x = homeX;
    this.y = homeY;
    this.sideOffset = sideOffset;
  }

  setHome(x: number, y: number) {
    this.homeX = x;
    this.homeY = y;
    if (this.state === 'stationed') {
      this.x = x;
      this.y = y;
    }
  }

  dispatch(plane: Aircraft) {
    this.targetPlane = plane;
    this.state = 'responding';
  }

  update(dt: number, particles: ParticleSystem) {
    if (this.state === 'stationed') return;

    if (this.state === 'responding' || this.state === 'spraying') {
      const p = this.targetPlane;
      if (!p || p.state === 'landed' || p.state === 'crashed') {
        this.targetPlane = null;
        this.state = 'returning';
        return;
      }
      const perp = p.heading + Math.PI / 2;
      const tx = p.x + Math.cos(perp) * this.sideOffset;
      const ty = p.y + Math.sin(perp) * this.sideOffset;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        const spd = 115;
        this.x += (dx / dist) * Math.min(dist, spd * dt);
        this.y += (dy / dist) * Math.min(dist, spd * dt);
        this.heading = Math.atan2(dy, dx);
      } else {
        this.state = 'spraying';
        this.heading = Math.atan2(p.y - this.y, p.x - this.x);
      }
      if (p.state === 'foam_hold' && dist < 34) {
        this.sprayTimer += dt;
        if (this.sprayTimer > 0.055) {
          this.sprayTimer = 0;
          particles.spawnFoamSpray(this.x, this.y, p.x, p.y);
        }
      }
      return;
    }

    if (this.state === 'returning') {
      const dx = this.homeX - this.x;
      const dy = this.homeY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        this.x = this.homeX;
        this.y = this.homeY;
        this.state = 'stationed';
      } else {
        const spd = 76;
        this.x += (dx / dist) * Math.min(dist, spd * dt);
        this.y += (dy / dist) * Math.min(dist, spd * dt);
        this.heading = Math.atan2(dy, dx);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.state === 'stationed') return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fillRect(-7, -3.5, 16, 9);

    // ARFF Crash Tender body
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-8, -4.5, 16, 9, 2);
    ctx.fill();
    ctx.stroke();

    // Neon lime safety stripe
    ctx.fillStyle = '#bef264';
    ctx.fillRect(-6, -1.2, 12, 2.4);

    // Cab glass
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(3.5, -3.2, 3, 6.4);

    // Flashing red/blue strobe bar
    const blink = Math.floor(Date.now() / 110) % 2 === 0;
    ctx.fillStyle = blink ? '#ef4444' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(1.5, -2.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#38bdf8' : '#ef4444';
    ctx.beginPath();
    ctx.arc(1.5, 2.5, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export class RogueHazard {
  kind: 'drone' | 'ufo';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  tapRadius: number;
  life: number;
  spin = 0;
  wobble = Math.random() * Math.PI * 2;
  alive = true;

  constructor(kind: 'drone' | 'ufo', worldW: number, worldH: number) {
    this.kind = kind;
    this.radius = kind === 'ufo' ? 38 : 26;
    this.tapRadius = kind === 'ufo' ? 44 : 36;
    this.life = kind === 'ufo' ? 20 : 24;

    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) {
      this.x = Math.random() * (worldW - 120) + 60;
      this.y = 22;
    } else if (edge === 1) {
      this.x = worldW - 22;
      this.y = Math.random() * (worldH - 120) + 60;
    } else if (edge === 2) {
      this.x = Math.random() * (worldW - 120) + 60;
      this.y = worldH - 22;
    } else {
      this.x = 22;
      this.y = Math.random() * (worldH - 120) + 60;
    }

    const angle =
      Math.atan2(worldH / 2 - this.y, worldW / 2 - this.x) + (Math.random() - 0.5) * 0.55;
    const spd = kind === 'ufo' ? 38 : 26;
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;
  }

  update(dt: number, worldW: number, worldH: number) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    this.spin += dt * (this.kind === 'ufo' ? 4.5 : 18);
    this.wobble += dt * 2.1;

    if (this.kind === 'ufo') {
      // Sinuous smooth gliding across airspace
      const perpX = -this.vy * 0.35 * Math.sin(this.wobble);
      const perpY = this.vx * 0.35 * Math.sin(this.wobble);
      this.x += (this.vx + perpX) * dt;
      this.y += (this.vy + perpY) * dt;
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    const pad = 28;
    if (this.x < pad) {
      this.x = pad;
      this.vx = Math.abs(this.vx);
    }
    if (this.x > worldW - pad) {
      this.x = worldW - pad;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y < pad) {
      this.y = pad;
      this.vy = Math.abs(this.vy);
    }
    if (this.y > worldH - pad) {
      this.y = worldH - pad;
      this.vy = -Math.abs(this.vy);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    const pulse = (Math.sin(Date.now() * 0.014) + 1) * 0.5;

    if (this.kind === 'ufo') {
      // Tractor beam shimmer aura
      const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, this.radius + 14);
      grad.addColorStop(0, `rgba(45, 212, 191, ${0.28 + pulse * 0.14})`);
      grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 14, 0, Math.PI * 2);
      ctx.fill();

      // Outer dashed interference ring
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Saucer hull
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotating rim lights
      for (let i = 0; i < 6; i++) {
        const a = this.spin + (i * Math.PI * 2) / 6;
        ctx.fillStyle = i % 2 === 0 ? '#2dd4bf' : '#fde047';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 11, Math.sin(a) * 11, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cockpit dome
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
      ctx.fill();

      // Tap to EMP tag
      ctx.font = '800 8.5px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-24, -29, 48, 13, 4);
      ctx.fill();
      ctx.fillStyle = '#2dd4bf';
      ctx.fillText('⚡ UFO', 0, -19.5);
    } else {
      // Rogue Drone exclusion ring
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.55 + pulse * 0.35})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Quadcopter arms
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-9, -9);
      ctx.lineTo(9, 9);
      ctx.moveTo(9, -9);
      ctx.lineTo(-9, 9);
      ctx.stroke();

      // 4 spinning rotors
      const arms = [
        [-9, -9],
        [9, -9],
        [9, 9],
        [-9, 9],
      ];
      for (const [ax, ay] of arms) {
        ctx.fillStyle = 'rgba(248, 113, 113, 0.35)';
        ctx.beginPath();
        ctx.arc(ax, ay, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ax + Math.cos(this.spin) * 4.5, ay + Math.sin(this.spin) * 4.5);
        ctx.lineTo(ax - Math.cos(this.spin) * 4.5, ay - Math.sin(this.spin) * 4.5);
        ctx.stroke();
      }

      // Drone core + blinking LED
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pulse > 0.5 ? '#ef4444' : '#fca5a5';
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Tap tag
      ctx.font = '800 8.5px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(-24, -27, 48, 13, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('⚡ DRONE', 0, -17.5);
    }

    ctx.restore();
  }
}

export class StormCell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  flashTimer = 0;
  flashAlpha = 0;

  constructor(worldW: number, worldH: number, index: number) {
    this.radius = 48 + (index % 2) * 8;
    const angle = index * 2.5 + 0.7;
    this.x = worldW / 2 + Math.cos(angle) * (worldW * 0.34);
    this.y = worldH / 2 + Math.sin(angle) * (worldH * 0.32);
    const spd = 15 + (index % 2) * 5;
    const dir = angle + Math.PI * 0.65;
    this.vx = Math.cos(dir) * spd;
    this.vy = Math.sin(dir) * spd;
    this.flashTimer = 1.5 + Math.random() * 2.5;
  }

  update(dt: number, worldW: number, worldH: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const pad = this.radius + 16;
    if (this.x < pad) {
      this.x = pad;
      this.vx = Math.abs(this.vx);
    }
    if (this.x > worldW - pad) {
      this.x = worldW - pad;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y < pad) {
      this.y = pad;
      this.vy = Math.abs(this.vy);
    }
    if (this.y > worldH - pad) {
      this.y = worldH - pad;
      this.vy = -Math.abs(this.vy);
    }
    this.flashTimer -= dt;
    if (this.flashTimer <= 0) {
      this.flashAlpha = 1;
      this.flashTimer = 2.4 + Math.random() * 3;
    }
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 4.5);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const grad = ctx.createRadialGradient(-8, -8, 6, 0, 0, this.radius);
    grad.addColorStop(
      0,
      this.flashAlpha > 0.2 ? 'rgba(226, 232, 240, 0.85)' : 'rgba(51, 65, 85, 0.84)'
    );
    grad.addColorStop(0.65, 'rgba(30, 41, 59, 0.78)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.08)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(30, 41, 59, 0.72)';
    const r = this.radius * 0.45;
    ctx.beginPath();
    ctx.arc(-r * 0.65, -r * 0.2, r * 0.85, 0, Math.PI * 2);
    ctx.arc(r * 0.6, -r * 0.15, r * 0.8, 0, Math.PI * 2);
    ctx.arc(0, r * 0.38, r * 0.78, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.flashAlpha > 0.15 ? '#fef08a' : 'rgba(250, 204, 21, 0.78)';
    ctx.beginPath();
    ctx.moveTo(2, -13);
    ctx.lineTo(-7, 1);
    ctx.lineTo(0, 1);
    ctx.lineTo(-3, 14);
    ctx.lineTo(8, -2);
    ctx.lineTo(1, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export class OutboundFlight {
  id: string;
  zoneId: string;
  state: 'waiting' | 'rolling' | 'airborne' | 'done' = 'waiting';
  patience: number;
  maxPatience = 19;
  x = 0;
  y = 0;
  heading = 0;
  speed = 0;
  altitude = 0;
  along = 0;
  expired = false;

  constructor(zone: RuntimeLandingZone) {
    this.id = `DEP-${Math.floor(Math.random() * 89 + 10)}`;
    this.zoneId = zone.def.id;
    this.patience = this.maxPatience;
    this.syncWaitingPos(zone);
  }

  syncWaitingPos(zone: RuntimeLandingZone) {
    const pos = zone.localToWorld(10, zone.width * 0.9);
    this.x = pos.x;
    this.y = pos.y;
    this.heading = zone.angle;
  }

  launch(zone: RuntimeLandingZone) {
    if (this.state !== 'waiting') return;
    this.state = 'rolling';
    this.along = 8;
    this.speed = 24;
    this.heading = zone.angle;
    const pos = zone.localToWorld(this.along, 0);
    this.x = pos.x;
    this.y = pos.y;
  }

  update(dt: number, zone: RuntimeLandingZone, worldW: number, worldH: number) {
    if (this.state === 'waiting') {
      this.syncWaitingPos(zone);
      this.patience -= dt;
      if (this.patience <= 0) {
        this.expired = true;
        this.state = 'done';
      }
      return;
    }
    if (this.state === 'rolling') {
      this.speed = Math.min(118, this.speed + 54 * dt);
      this.along += this.speed * dt;
      const pos = zone.localToWorld(this.along, 0);
      this.x = pos.x;
      this.y = pos.y;
      this.heading = zone.angle;
      if (this.along >= zone.length * 0.78) {
        this.state = 'airborne';
      }
      return;
    }
    if (this.state === 'airborne') {
      this.speed = Math.min(132, this.speed + 32 * dt);
      this.altitude = Math.min(1, this.altitude + dt * 0.9);
      this.x += Math.cos(this.heading) * this.speed * dt;
      this.y += Math.sin(this.heading) * this.speed * dt;
      if (this.x < -50 || this.x > worldW + 50 || this.y < -50 || this.y > worldH + 50) {
        this.state = 'done';
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.state === 'done') return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.state === 'waiting') {
      const ratio = Math.max(0, this.patience / this.maxPatience);
      const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
      ctx.fillStyle =
        ratio < 0.3
          ? `rgba(239, 68, 68, ${0.22 + pulse * 0.18})`
          : `rgba(14, 165, 233, ${0.2 + pulse * 0.14})`;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = ratio < 0.3 ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();

      ctx.font = '800 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ratio < 0.3 ? '#dc2626' : '#0284c7';
      ctx.beginPath();
      ctx.roundRect(-22, -33, 44, 13, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('LAUNCH', 0, -23.5);
    }

    ctx.rotate(this.heading);
    const sc = 0.78 + this.altitude * 0.25;
    ctx.scale(sc, sc);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, -14);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 12);
    ctx.lineTo(-4, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 3.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(-13, -1.5, 6, 3);
    ctx.restore();
  }
}

export class CarrierController {
  time = 0;
  offsetX = 0;
  offsetY = 0;
  angleOffset = 0;

  reset() {
    this.time = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.angleOffset = 0;
  }

  update(dt: number, worldW: number, worldH: number) {
    this.time += dt;
    const rx = Math.min(95, worldW * 0.14);
    const ry = Math.min(68, worldH * 0.13);
    const prevX = this.offsetX;
    const prevY = this.offsetY;
    this.offsetX = Math.sin(this.time * 0.22) * rx;
    this.offsetY = Math.sin(this.time * 0.44) * ry * 0.55;
    const dx = this.offsetX - prevX;
    const dy = this.offsetY - prevY;
    if (Math.hypot(dx, dy) > 0.001) {
      const targetAngle = Math.max(-0.24, Math.min(0.24, Math.atan2(dy, Math.abs(dx) + 18) * 0.45));
      this.angleOffset += (targetAngle - this.angleOffset) * Math.min(1, 2.5 * dt);
    }
  }
}
