import { ZONE_PALETTE } from './entities';
import type { BiomeKey, RuntimeLandingZone, StageDef } from './types';

interface BiomeTheme {
  oceanInner: string;
  oceanMid: string;
  oceanOuter: string;
  reef: string;
  sand: string;
  grass1: string;
  grass2: string;
  treeDark: string;
  treeLight: string;
}

const BIOMES: Record<BiomeKey, BiomeTheme> = {
  coastal: {
    oceanInner: '#2bb8cc',
    oceanMid: '#178bb8',
    oceanOuter: '#0b5c8a',
    reef: 'rgba(103, 232, 249, 0.25)',
    sand: '#ebd5a3',
    grass1: '#6bb85c',
    grass2: '#448f3d',
    treeDark: '#2d6a32',
    treeLight: '#4ea147',
  },
  lagoon: {
    oceanInner: '#2dd4bf',
    oceanMid: '#0ea5e9',
    oceanOuter: '#0369a1',
    reef: 'rgba(153, 246, 228, 0.3)',
    sand: '#f3dfb0',
    grass1: '#65c466',
    grass2: '#3f9948',
    treeDark: '#236b3b',
    treeLight: '#4ade80',
  },
  pines: {
    oceanInner: '#38bdf8',
    oceanMid: '#1d7aa8',
    oceanOuter: '#0f4c75',
    reef: 'rgba(125, 211, 252, 0.22)',
    sand: '#dfd1aa',
    grass1: '#59a653',
    grass2: '#377337',
    treeDark: '#1b4d2b',
    treeLight: '#2f7a44',
  },
  harbor: {
    oceanInner: '#22b8cf',
    oceanMid: '#1580ab',
    oceanOuter: '#0c4a6e',
    reef: 'rgba(103, 232, 249, 0.22)',
    sand: '#e7d2a2',
    grass1: '#68b35a',
    grass2: '#42873b',
    treeDark: '#2b6330',
    treeLight: '#4e9c46',
  },
  mesa: {
    oceanInner: '#26a9bd',
    oceanMid: '#157c9e',
    oceanOuter: '#0b4b6e',
    reef: 'rgba(103, 232, 249, 0.2)',
    sand: '#e6c28b',
    grass1: '#95b259',
    grass2: '#6b873d',
    treeDark: '#4d6629',
    treeLight: '#779440',
  },
  tradewind: {
    oceanInner: '#29b6c7',
    oceanMid: '#1484ad',
    oceanOuter: '#0a527c',
    reef: 'rgba(125, 211, 252, 0.25)',
    sand: '#ecd8a5',
    grass1: '#64b558',
    grass2: '#3e8537',
    treeDark: '#245e2b',
    treeLight: '#479444',
  },
  monsoon: {
    oceanInner: '#1e7f99',
    oceanMid: '#125c78',
    oceanOuter: '#0a3952',
    reef: 'rgba(94, 234, 212, 0.16)',
    sand: '#cbb88d',
    grass1: '#4d8a52',
    grass2: '#326339',
    treeDark: '#1f4526',
    treeLight: '#366b3c',
  },
  sunset: {
    oceanInner: '#f59e0b',
    oceanMid: '#c26d53',
    oceanOuter: '#334e73',
    reef: 'rgba(253, 224, 71, 0.22)',
    sand: '#f0c68c',
    grass1: '#74a14c',
    grass2: '#4d7335',
    treeDark: '#2f4f24',
    treeLight: '#58823c',
  },
  carrier: {
    oceanInner: '#16658c',
    oceanMid: '#0e496e',
    oceanOuter: '#082d4a',
    reef: 'rgba(56, 189, 248, 0.12)',
    sand: '#94a3b8',
    grass1: '#475569',
    grass2: '#334155',
    treeDark: '#334155',
    treeLight: '#475569',
  },
  canyon_night: {
    oceanInner: '#2a6f8f',
    oceanMid: '#174969',
    oceanOuter: '#0b2942',
    reef: 'rgba(96, 165, 250, 0.16)',
    sand: '#c9a679',
    grass1: '#5d824d',
    grass2: '#3d5a34',
    treeDark: '#243b20',
    treeLight: '#3d5e35',
  },
  megahub: {
    oceanInner: '#24b0c7',
    oceanMid: '#147aa3',
    oceanOuter: '#0a4870',
    reef: 'rgba(103, 232, 249, 0.24)',
    sand: '#e6d3a5',
    grass1: '#5ea856',
    grass2: '#3d7d3a',
    treeDark: '#265c2c',
    treeLight: '#448f42',
  },
  sector51: {
    oceanInner: '#1d6f80',
    oceanMid: '#12465c',
    oceanOuter: '#071f33',
    reef: 'rgba(45, 212, 191, 0.18)',
    sand: '#d4b483',
    grass1: '#6e8c58',
    grass2: '#445c37',
    treeDark: '#293d22',
    treeLight: '#4b6b3e',
  },
};

export function renderStaticBackdrop(
  ctx: CanvasRenderingContext2D,
  stage: StageDef,
  worldW: number,
  worldH: number,
  airfieldAngle: number,
  scale: number,
  dpr: number
) {
  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(scale * dpr, scale * dpr);

  const theme = BIOMES[stage.biome];
  const cx = worldW / 2;
  const cy = worldH / 2;

  const ocean = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(worldW, worldH) * 0.78);
  ocean.addColorStop(0, theme.oceanInner);
  ocean.addColorStop(0.36, theme.oceanMid);
  ocean.addColorStop(1, theme.oceanOuter);
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, worldW, worldH);

  // Subtle oceanic wave ridges
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1.6;
  for (let y = 26; y < worldH; y += 50) {
    ctx.beginPath();
    for (let x = 0; x < worldW; x += 36) {
      const wy = y + Math.sin(x * 0.04 + y) * 4;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  if (stage.features.movingCarrier) {
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(airfieldAngle);

  const rx = stage.islandRx;
  const ry = stage.islandRy;

  // Coral reef glow
  ctx.fillStyle = theme.reef;
  ctx.beginPath();
  ctx.ellipse(0, 6, rx + 28, ry + 24, -0.03, 0, Math.PI * 2);
  ctx.fill();

  // Sand beach
  ctx.fillStyle = theme.sand;
  ctx.beginPath();
  ctx.ellipse(0, 6, rx + 11, ry + 10, -0.03, 0, Math.PI * 2);
  ctx.fill();

  // Grass turf
  const grass = ctx.createLinearGradient(-rx, -ry, rx, ry);
  grass.addColorStop(0, theme.grass1);
  grass.addColorStop(1, theme.grass2);
  ctx.fillStyle = grass;
  ctx.beginPath();
  ctx.ellipse(0, 6, rx - 2, ry - 3, -0.03, 0, Math.PI * 2);
  ctx.fill();

  // Mowed airfield grass stripes
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 6, rx - 8, ry - 9, -0.03, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  for (let x = -rx; x < rx; x += 26) {
    ctx.fillRect(x, -ry, 12, ry * 2);
  }
  ctx.restore();

  // Main Airport Terminal + ARFF Fire Station + Apron
  const termY = Math.min(ry - 26, 84);
  // Concrete apron
  ctx.fillStyle = 'rgba(148, 163, 184, 0.42)';
  ctx.beginPath();
  ctx.roundRect(-78, termY - 4, 150, 26, 6);
  ctx.fill();

  // Terminal shadow & roof
  ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
  ctx.beginPath();
  ctx.roundRect(-35, termY + 3, 76, 18, 4);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-38, termY, 76, 18, 4);
  ctx.fill();
  ctx.stroke();

  // Terminal skylight windows
  ctx.fillStyle = '#38bdf8';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(-30 + i * 16, termY + 4.5, 10, 8);
  }

  // Red ARFF Fire Station bay (where Fire Trucks dispatch from!)
  ctx.fillStyle = '#b91c1c';
  ctx.strokeStyle = '#fef2f2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-70, termY + 1, 24, 16, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 7.5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ARFF', -58, termY + 11.5);

  // Control Tower base
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(54, termY + 8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Foliage clusters
  const treeAngles = [-2.6, -2.1, -1.65, -1.2, -0.75, -0.35, 0.45, 2.55];
  for (const a of treeAngles) {
    const tx = Math.cos(a) * (rx * 0.8);
    const ty = Math.sin(a) * (ry * 0.8);
    const tr = 11 + Math.abs(Math.sin(a * 7)) * 5;
    ctx.fillStyle = 'rgba(15, 45, 20, 0.26)';
    ctx.beginPath();
    ctx.arc(tx + 3, ty + 4, tr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.treeDark;
    ctx.beginPath();
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.treeLight;
    ctx.beginPath();
    ctx.arc(tx - tr * 0.22, ty - tr * 0.24, tr * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

export function drawControlTowerBeacon(
  ctx: CanvasRenderingContext2D,
  towerX: number,
  towerY: number,
  time: number,
  windAngle: number,
  slowMoActive: boolean
) {
  ctx.save();
  ctx.translate(towerX, towerY);

  // Rotating airport beacon sweep
  ctx.save();
  ctx.rotate(time * (slowMoActive ? 1.5 : 2.8));
  const beam = ctx.createLinearGradient(0, 0, slowMoActive ? 220 : 62, 0);
  beam.addColorStop(0, slowMoActive ? 'rgba(56, 189, 248, 0.42)' : 'rgba(52, 211, 153, 0.34)');
  beam.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, slowMoActive ? 220 : 62, -0.18, 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Tower dome
  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
  ctx.fill();

  // Animated windsock next to tower
  ctx.save();
  ctx.translate(16, -2);
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(windAngle + Math.sin(time * 5.2) * 0.12);
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(0, -2.6);
  ctx.lineTo(13, -1.2);
  ctx.lineTo(13, 1.2);
  ctx.lineTo(0, 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4, -2, 3, 4);
  ctx.restore();

  ctx.restore();
}

export function drawAircraftCarrier(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  time: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Wake foam
  ctx.save();
  const wake = ctx.createLinearGradient(-135, 0, -250, 0);
  wake.addColorStop(0, 'rgba(224, 242, 254, 0.44)');
  wake.addColorStop(1, 'rgba(224, 242, 254, 0)');
  ctx.fillStyle = wake;
  ctx.beginPath();
  ctx.moveTo(-125, -24);
  ctx.lineTo(-250, -48 - Math.sin(time * 3) * 4);
  ctx.lineTo(-250, 48 + Math.sin(time * 3) * 4);
  ctx.lineTo(-125, 24);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Hull shadow
  ctx.fillStyle = 'rgba(4, 18, 32, 0.46)';
  ctx.beginPath();
  ctx.moveTo(138, 6);
  ctx.lineTo(100, -34);
  ctx.lineTo(-126, -34);
  ctx.lineTo(-136, -14);
  ctx.lineTo(-136, 34);
  ctx.lineTo(96, 38);
  ctx.closePath();
  ctx.fill();

  // Flight deck steel
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(134, 0);
  ctx.lineTo(98, -32);
  ctx.lineTo(-126, -30);
  ctx.lineTo(-132, -12);
  ctx.lineTo(-132, 30);
  ctx.lineTo(94, 32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Carrier island superstructure
  ctx.fillStyle = '#94a3b8';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(14, 18, 46, 13, 3);
  ctx.fill();
  ctx.stroke();

  // Spinning radar dish
  ctx.save();
  ctx.translate(36, 24.5);
  ctx.rotate(time * 2.8);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.stroke();
  ctx.restore();

  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.textAlign = 'center';
  ctx.fillText('79', 102, 5);
  ctx.restore();
}

export function drawLandingZones(
  ctx: CanvasRenderingContext2D,
  zones: RuntimeLandingZone[],
  highlightedZoneId: string | null,
  nightLevel: number,
  time: number,
  nowMs: number
) {
  for (const z of zones) {
    const pal = ZONE_PALETTE[z.color];
    const isHi = highlightedZoneId === z.def.id;
    const isEmergencyLocked = z.emergencyLockedUntil > nowMs;

    ctx.save();
    ctx.translate(z.cx, z.cy);
    ctx.rotate(z.angle);

    if (z.kind === 'helipad') {
      const r = z.width * 0.5;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.beginPath();
      ctx.arc(2, 3, r + 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.strokeStyle = isHi ? '#fef08a' : pal.primary;
      ctx.lineWidth = isHi ? 4 : 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isHi || nightLevel > 0.2) {
        ctx.strokeStyle = pal.glow;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillStyle = pal.glow;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', 0, 1);
      ctx.restore();
      continue;
    }

    const hl = z.length / 2;
    const hw = z.width / 2;

    if (z.kind === 'waterlane') {
      ctx.fillStyle = isHi ? 'rgba(249, 115, 22, 0.24)' : 'rgba(249, 115, 22, 0.12)';
      ctx.beginPath();
      ctx.roundRect(-hl, -hw, z.length, z.width, 8);
      ctx.fill();

      ctx.strokeStyle = pal.glow;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      const buoys = 6;
      for (let i = 0; i <= buoys; i++) {
        const bx = -hl + (z.length / buoys) * i;
        ctx.fillStyle = '#fb923c';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, -hw, 3.2, 0, Math.PI * 2);
        ctx.arc(bx, hw, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // Colored tarmac shoulder
      ctx.fillStyle = isEmergencyLocked ? '#f59e0b' : pal.primary;
      ctx.beginPath();
      ctx.roundRect(-hl - 4, -hw - 3.5, z.length + 8, z.width + 7, 4);
      ctx.fill();

      // Asphalt
      ctx.fillStyle = '#243042';
      ctx.fillRect(-hl, -hw, z.length, z.width);

      // Tire rubber touchdown marks
      ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
      ctx.fillRect(-hl + 38, -7, 34, 4);
      ctx.fillRect(-hl + 38, 3, 34, 4);

      // Side edge stripes
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-hl + 2, -hw + 2.2);
      ctx.lineTo(hl - 2, -hw + 2.2);
      ctx.moveTo(-hl + 2, hw - 2.2);
      ctx.lineTo(hl - 2, hw - 2.2);
      ctx.stroke();

      // Piano keys threshold
      ctx.fillStyle = '#ffffff';
      const keys = 5;
      const step = (z.width - 8) / keys;
      for (let i = 0; i < keys; i++) {
        ctx.fillRect(-hl + 5, -hw + 4 + i * step, 13, 2.2);
      }

      // Runway heading number
      ctx.save();
      ctx.translate(-hl + 30, 0);
      ctx.rotate(Math.PI / 2);
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(z.name, 0, 0);
      ctx.restore();

      // Centerline dashes
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(-hl + 42, 0);
      ctx.lineTo(hl - 10, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // PAPI precision approach indicator lights (4 dots left of threshold)
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i < 2 ? '#f8fafc' : '#ef4444';
        ctx.beginPath();
        ctx.arc(-hl + 20, -hw - 6.5 - i * 3.2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Night edge lights
      if (nightLevel > 0.15) {
        ctx.fillStyle = `rgba(254, 240, 138, ${Math.min(1, nightLevel * 1.25)})`;
        for (let lx = -hl + 8; lx <= hl - 8; lx += 24) {
          ctx.beginPath();
          ctx.arc(lx, -hw - 1, 2.3, 0, Math.PI * 2);
          ctx.arc(lx, hw + 1, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Emergency foam banner across runway if locked
      if (isEmergencyLocked) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
        ctx.fillRect(-hl, -hw, z.length, z.width);
      }
    }

    // Approach capture funnel cone
    const gl = z.gateLen;
    const ghw = z.gateHalfW;
    ctx.fillStyle = isEmergencyLocked
      ? 'rgba(239, 68, 68, 0.18)'
      : isHi
        ? pal.soft
        : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(-hl - gl, -ghw);
    ctx.lineTo(-hl, -hw);
    ctx.lineTo(-hl, hw);
    ctx.lineTo(-hl - gl, ghw);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = isEmergencyLocked ? '#ef4444' : isHi ? pal.glow : pal.primary;
    ctx.lineWidth = isHi ? 2.4 : 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Marching lead-in chevrons
    const shift = (time * 34) % 22;
    ctx.strokeStyle = isEmergencyLocked ? '#fca5a5' : isHi ? '#ffffff' : pal.glow;
    ctx.lineWidth = 2;
    for (let cx = -hl - gl + 10 + shift; cx < -hl - 6; cx += 22) {
      ctx.beginPath();
      ctx.moveTo(cx - 4.5, -6);
      ctx.lineTo(cx + 3, 0);
      ctx.lineTo(cx - 4.5, 6);
      ctx.stroke();
    }

    ctx.restore();
  }
}
