export class ProductHeroRenderer {
  private sweepProgress: number = 0; // 0..1 triggered on catch
  private sweepActive: boolean = false;

  public triggerCatchSweep() {
    this.sweepActive = true;
    this.sweepProgress = 0;
  }

  public update(dt: number) {
    if (this.sweepActive) {
      this.sweepProgress += dt * 1.5;
      if (this.sweepProgress > 1.0) {
        this.sweepActive = false;
        this.sweepProgress = 0;
      }
    }
  }

  /**
   * Renders the cold Japanese green tea bottle hero & pedestal
   */
  public render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    time: number,
    isHeroLarge: boolean = false
  ) {
    ctx.save();
    ctx.translate(x, y);
    const effectiveScale = isHeroLarge ? scale * 1.4 : scale;
    ctx.scale(effectiveScale, effectiveScale);

    // Floating idle animation
    const floatY = Math.sin(time * 0.003) * 6;
    ctx.translate(0, floatY);

    // 1. Rotating Golden/Green Pedestal Base
    ctx.save();
    ctx.translate(0, 95);
    ctx.scale(1, 0.35); // 3D ellipse perspective
    const pedestalGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 65);
    pedestalGrad.addColorStop(0, '#fef08a');
    pedestalGrad.addColorStop(0.5, '#eab308');
    pedestalGrad.addColorStop(1, 'rgba(22, 101, 52, 0.8)');
    ctx.fillStyle = pedestalGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fde047';
    ctx.stroke();

    // Pedestal rotating light beam
    ctx.rotate(time * 0.001);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(-60, 0);
    ctx.lineTo(60, 0);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 2. Green Aura Glow
    const aura = ctx.createRadialGradient(0, 0, 20, 0, 0, 90);
    aura.addColorStop(0, 'rgba(74, 222, 128, 0.4)');
    aura.addColorStop(0.6, 'rgba(34, 197, 94, 0.15)');
    aura.addColorStop(1, 'rgba(34, 197, 94, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();

    // 3. Bottle Body (Faceted Japanese green tea bottle shape)
    ctx.save();
    // Glass/PET Bottle Gradient
    const bottleGrad = ctx.createLinearGradient(-26, 0, 26, 0);
    bottleGrad.addColorStop(0, '#15803d');
    bottleGrad.addColorStop(0.25, '#4ade80');
    bottleGrad.addColorStop(0.6, '#16a34a');
    bottleGrad.addColorStop(0.85, '#86efac');
    bottleGrad.addColorStop(1, '#14532d');

    // Bottle outline
    ctx.beginPath();
    ctx.moveTo(-22, 85); // Base
    ctx.lineTo(22, 85);
    ctx.lineTo(24, -20); // Shoulder
    ctx.lineTo(12, -45); // Neck
    ctx.lineTo(10, -65);
    ctx.lineTo(-10, -65);
    ctx.lineTo(-12, -45);
    ctx.lineTo(-24, -20);
    ctx.closePath();
    ctx.fillStyle = bottleGrad;
    ctx.fill();

    // Cap (Gold / Green)
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-10, -74, 20, 10);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-9, -73, 18, 2);

    // Label Band (Traditional Japanese Green Tea Style)
    ctx.fillStyle = '#fcfbf7'; // Washi Paper background
    ctx.fillRect(-22, -8, 44, 52);
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-22, -8, 44, 52);

    // Label Logo & Typography
    ctx.fillStyle = '#166534';
    ctx.font = 'bold 12px Zen Kaku Gothic New, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('お〜い', 0, 10);
    ctx.fillText('お茶', 0, 24);

    ctx.fillStyle = '#dc2626';
    ctx.font = '9px Outfit, sans-serif';
    ctx.fillText('ITO EN', 0, 36);

    // 4. Condensation Water Droplets (Cold Tea Realism)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const drops = [
      { x: -16, y: -12, r: 1.8 },
      { x: 18, y: 5, r: 2.2 },
      { x: -14, y: 55, r: 2.5 },
      { x: 15, y: 68, r: 2.0 },
      { x: 5, y: 72, r: 1.5 }
    ];
    drops.forEach((d) => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. Catch Sweep / Shimmer Effect (Light ray crossing bottle)
    if (this.sweepActive) {
      const sweepX = -60 + this.sweepProgress * 120;
      const sweepGrad = ctx.createLinearGradient(sweepX - 20, 0, sweepX + 20, 0);
      sweepGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sweepGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
      sweepGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(-30, -75, 60, 165);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore(); // end bottle
    ctx.restore(); // end all
  }
}
