interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  spin: number;
  rotation: number;
  shape: 'dot' | 'ribbon';
}

/**
 * One pooled particle system for catch bursts, dust and confetti.
 * Capped and recycled so a kiosk running for hours never grows its heap.
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  private readonly max = 400;

  burst(x: number, y: number, count: number, palette: string[], power = 340) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = power * (0.35 + Math.random() * 0.85);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - power * 0.25,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.5,
        size: 3 + Math.random() * 5,
        color: palette[Math.floor(Math.random() * palette.length)],
        gravity: 900,
        spin: (Math.random() - 0.5) * 12,
        rotation: Math.random() * Math.PI,
        shape: 'dot',
      });
    }
  }

  confetti(width: number, count: number, palette: string[]) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      this.particles.push({
        x: Math.random() * width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 120,
        vy: 120 + Math.random() * 180,
        life: 0,
        maxLife: 3 + Math.random() * 2,
        size: 6 + Math.random() * 8,
        color: palette[Math.floor(Math.random() * palette.length)],
        gravity: 60,
        spin: (Math.random() - 0.5) * 10,
        rotation: Math.random() * Math.PI,
        shape: 'ribbon',
      });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= 1 - dt * 0.9;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.shape === 'ribbon') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  get count() {
    return this.particles.length;
  }

  clear() {
    this.particles.length = 0;
  }
}
