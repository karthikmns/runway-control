interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  isSmoke?: boolean;
  isRing?: boolean;
  maxRadius?: number;
  isText?: boolean;
  text?: string;
}

export class ParticleSystem {
  particles: Particle[] = [];

  clear() {
    this.particles = [];
  }

  spawnExplosion(x: number, y: number) {
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 150 + 24;
      const life = Math.random() * 0.65 + 0.35;
      const isSmoke = Math.random() > 0.54;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life,
        maxLife: life,
        size: Math.random() * 8 + 3.5,
        color: isSmoke ? '#475569' : Math.random() > 0.4 ? '#f97316' : '#facc15',
        isSmoke,
      });
    }
    this.spawnRing(x, y, 66, '#fb923c', 0.45);
  }

  spawnRing(x: number, y: number, maxRadius: number, color: string, duration = 0.42) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: duration,
      maxLife: duration,
      size: 8,
      maxRadius,
      color,
      isRing: true,
    });
  }

  spawnEmpBurst(x: number, y: number) {
    this.spawnRing(x, y, 72, '#38bdf8', 0.44);
    this.spawnRing(x, y, 42, '#e0f2fe', 0.32);
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 110 + 30;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.36,
        maxLife: 0.36,
        size: 3.2,
        color: i % 2 === 0 ? '#38bdf8' : '#fef08a',
      });
    }
  }

  spawnTouchdownSmoke(x: number, y: number, angle: number, isWater = false) {
    const rev = angle + Math.PI;
    const count = isWater ? 18 : 12;
    for (let i = 0; i < count; i++) {
      const a = rev + (Math.random() - 0.5) * (isWater ? 1.55 : 0.9);
      const spd = Math.random() * (isWater ? 50 : 38) + 10;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.45 + Math.random() * 0.32,
        maxLife: 0.77,
        size: Math.random() * 5 + 3,
        color: isWater ? 'rgba(224, 242, 254, 0.88)' : 'rgba(255, 255, 255, 0.82)',
        isSmoke: true,
      });
    }
  }

  spawnEngineFire(x: number, y: number, heading: number) {
    const back = heading + Math.PI;
    const bx = x + Math.cos(back) * 11;
    const by = y + Math.sin(back) * 11;
    this.particles.push({
      x: bx + (Math.random() - 0.5) * 4,
      y: by + (Math.random() - 0.5) * 4,
      vx: Math.cos(back) * 20 + (Math.random() - 0.5) * 12,
      vy: Math.sin(back) * 20 + (Math.random() - 0.5) * 12,
      life: 0.42,
      maxLife: 0.42,
      size: Math.random() * 3.8 + 2.5,
      color: Math.random() > 0.45 ? '#f97316' : '#334155',
      isSmoke: true,
    });
  }

  spawnFoamSpray(fromX: number, fromY: number, toX: number, toY: number) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const vx = (dx / dist) * 115 + (Math.random() - 0.5) * 28;
    const vy = (dy / dist) * 115 + (Math.random() - 0.5) * 28;
    this.particles.push({
      x: fromX,
      y: fromY,
      vx,
      vy,
      life: 0.38,
      maxLife: 0.38,
      size: Math.random() * 4.5 + 3,
      color: 'rgba(241, 245, 249, 0.92)',
      isSmoke: true,
    });
  }

  spawnStormSparks(x: number, y: number) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 82 + 24;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.32,
        maxLife: 0.32,
        size: 3,
        color: '#fde047',
      });
    }
  }

  spawnConfetti(x: number, y: number) {
    const colors = ['#38bdf8', '#34d399', '#facc15', '#fb7185', '#f8fafc'];
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 95 + 30;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 20,
        life: 0.65 + Math.random() * 0.35,
        maxLife: 1.0,
        size: 3.4,
        color: colors[i % colors.length],
      });
    }
  }

  spawnFloatingText(x: number, y: number, text: string, color = '#34d399') {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -32,
      life: 1.45,
      maxLife: 1.45,
      size: 0,
      color,
      isText: true,
      text,
    });
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.isRing && p.maxRadius) {
        const progress = 1 - p.life / p.maxLife;
        p.size = 6 + progress * p.maxRadius;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.isSmoke) {
        p.size += dt * 7;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      if (p.isRing) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * alpha + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.isText && p.text) {
        ctx.font = '800 13px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3.8;
        ctx.strokeStyle = 'rgba(10, 20, 34, 0.92)';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
