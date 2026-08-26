interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  vRot: number;
  shape: 'circle' | 'rect' | 'star';
}

export class ParticleSystem {
  private particles: Particle[] = [];

  public update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.rotation += p.vRot * dt * 60;
      p.alpha -= p.decay * dt * 60;

      // Gravity for confetti
      if (p.shape === 'rect') {
        p.vy += 0.15 * dt * 60;
      }

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  public emitCatchBurst(x: number, y: number) {
    const colors = ['#fde047', '#eab308', '#ffffff', '#4ade80', '#38bdf8'];
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: Math.random() * 0.03 + 0.02,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.2,
        shape: Math.random() > 0.3 ? 'circle' : 'star'
      });
    }
  }

  public emitWinConfetti(width: number, height: number) {
    const colors = ['#dc2626', '#eab308', '#16a34a', '#2563eb', '#f43f5e', '#ffffff', '#facc15'];
    for (let i = 0; i < 150; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 5 + 3,
        size: Math.random() * 10 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: Math.random() * 0.005 + 0.003,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.15,
        shape: 'rect'
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'rect') {
        ctx.fillRect(-p.size * 0.5, -p.size * 0.25, p.size, p.size * 0.5);
      } else if (p.shape === 'star') {
        // Diamond spark
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.4, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.4, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  public clear() {
    this.particles = [];
  }
}
