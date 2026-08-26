export class StadiumRenderer {
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ) {
    // 1. Sky & Stadium Floodlight Glow
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.45);
    skyGradient.addColorStop(0, '#0a1931');
    skyGradient.addColorStop(0.5, '#15325b');
    skyGradient.addColorStop(1, '#1e487a');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.45);

    // 2. Stadium Floodlight Stanchions & Beams
    this.renderFloodlights(ctx, width, height, time);

    // 3. Grandstand / Upper Deck Crowd Silhouettes
    this.renderCrowd(ctx, width, height, time);

    // 4. Outfield Wall & LED Sponsor Ribbons (ITO EN Green)
    this.renderOutfieldWall(ctx, width, height, time);

    // 5. Infield Turf & Cut Grass Stripes (Perspective 2.5D)
    this.renderField(ctx, width, height);

    // 6. Pitcher's Mound Dirt & Rubber
    this.renderMound(ctx, width, height);

    // 7. Home Plate & Catcher's View Chalk Lines (Foreground)
    this.renderHomePlateZone(ctx, width, height);
  }

  private renderFloodlights(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ) {
    const lightPoles = [
      { x: width * 0.12, y: height * 0.12 },
      { x: width * 0.28, y: height * 0.08 },
      { x: width * 0.72, y: height * 0.08 },
      { x: width * 0.88, y: height * 0.12 }
    ];

    lightPoles.forEach((pole, i) => {
      const shimmer = Math.sin(time * 0.002 + i) * 0.1 + 0.9;

      // Glow flare
      const flare = ctx.createRadialGradient(pole.x, pole.y, 5, pole.x, pole.y, 140);
      flare.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      flare.addColorStop(0.2, 'rgba(219, 234, 254, 0.6)');
      flare.addColorStop(0.6, 'rgba(147, 197, 253, 0.15)');
      flare.addColorStop(1, 'rgba(147, 197, 253, 0)');

      ctx.save();
      ctx.globalAlpha = shimmer;
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.arc(pole.x, pole.y, 140, 0, Math.PI * 2);
      ctx.fill();

      // Light beam angled towards home plate
      ctx.beginPath();
      ctx.moveTo(pole.x - 25, pole.y);
      ctx.lineTo(pole.x + 25, pole.y);
      ctx.lineTo(width * (0.3 + i * 0.15), height);
      ctx.lineTo(width * (0.2 + i * 0.15), height);
      ctx.closePath();
      const beamGrad = ctx.createLinearGradient(pole.x, pole.y, width * 0.5, height);
      beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
      beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = beamGrad;
      ctx.fill();
      ctx.restore();
    });
  }

  private renderCrowd(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ) {
    const crowdTop = height * 0.22;
    const crowdBottom = height * 0.38;

    ctx.fillStyle = '#0e1d38';
    ctx.fillRect(0, crowdTop, width, crowdBottom - crowdTop);

    // Dynamic crowd cheering dots
    ctx.save();
    const rows = 4;
    const cols = 40;
    const cellW = width / cols;
    const cellH = (crowdBottom - crowdTop) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cheerOffset = Math.sin(time * 0.005 + c * 0.4 + r) * 2;
        const cx = c * cellW + cellW * 0.5;
        const cy = crowdTop + r * cellH + cellH * 0.5 + cheerOffset;
        const colorSeed = (c * 7 + r * 13) % 4;

        // Flash of camera or colored jersey
        if ((c + r) % 9 === 0 && Math.sin(time * 0.008 + c) > 0.8) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        } else if (colorSeed === 0) {
          ctx.fillStyle = '#1e3a8a'; // Navy
        } else if (colorSeed === 1) {
          ctx.fillStyle = '#dc2626'; // Red
        } else if (colorSeed === 2) {
          ctx.fillStyle = '#f8fafc'; // White
        } else {
          ctx.fillStyle = '#15803d'; // Green
        }

        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderOutfieldWall(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ) {
    const wallY = height * 0.38;
    const wallH = height * 0.05;

    // Deep stadium blue wall
    ctx.fillStyle = '#09152b';
    ctx.fillRect(0, wallY, width, wallH);

    // Green Tea LED Ribbon Banner across outfield
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, wallY + wallH - 12, width, 12);

    // Glowing golden accents
    const bannerShimmer = (time * 0.1) % width;
    const ribbonGlow = ctx.createLinearGradient(bannerShimmer - 150, 0, bannerShimmer + 150, 0);
    ribbonGlow.addColorStop(0, 'rgba(234, 179, 8, 0)');
    ribbonGlow.addColorStop(0.5, 'rgba(253, 224, 71, 0.7)');
    ribbonGlow.addColorStop(1, 'rgba(234, 179, 8, 0)');

    ctx.fillStyle = ribbonGlow;
    ctx.fillRect(0, wallY + wallH - 12, width, 12);
  }

  private renderField(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const fieldTop = height * 0.43;

    // Grass Field (Linear gradient with rich stadium green)
    const fieldGrad = ctx.createLinearGradient(0, fieldTop, 0, height);
    fieldGrad.addColorStop(0, '#15803d');
    fieldGrad.addColorStop(0.5, '#166534');
    fieldGrad.addColorStop(1, '#0f4c24');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, fieldTop, width, height - fieldTop);

    // Mower lawn stripe patterns in perspective
    ctx.save();
    ctx.beginPath();
    const stripes = 12;
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 0) continue;
      const x0 = width * (0.5 + (i - stripes * 0.5) * 0.03);
      const x1 = width * (0.5 + (i - stripes * 0.5) * 0.18);
      const x2 = width * (0.5 + (i + 1 - stripes * 0.5) * 0.18);
      const x3 = width * (0.5 + (i + 1 - stripes * 0.5) * 0.03);

      ctx.moveTo(x0, fieldTop);
      ctx.lineTo(x1, height);
      ctx.lineTo(x2, height);
      ctx.lineTo(x3, fieldTop);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.restore();

    // Infield Clay Dirt Arc
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.49, width * 0.32, height * 0.16, 0, 0, Math.PI * 2);
    const dirtGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      10,
      width * 0.5,
      height * 0.49,
      width * 0.32
    );
    dirtGrad.addColorStop(0, '#a2593b');
    dirtGrad.addColorStop(0.7, '#8b4526');
    dirtGrad.addColorStop(1, 'rgba(139, 69, 38, 0)');
    ctx.fillStyle = dirtGrad;
    ctx.fill();
    ctx.restore();
  }

  private renderMound(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const moundX = width * 0.5;
    const moundY = height * 0.47;

    // Pitcher Mound Oval Dirt
    ctx.beginPath();
    ctx.ellipse(moundX, moundY, width * 0.11, height * 0.045, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#b45309';
    ctx.fill();

    // Mound Rubber Plate (White rectangular strip)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(moundX - 18, moundY - 4, 36, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(moundX - 18, moundY - 4, 36, 6);
  }

  private renderHomePlateZone(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const centerX = width * 0.5;
    const baseY = height * 0.94;

    // Catcher & Umpire Chalk Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 4;

    // Batter's Box Left
    ctx.strokeRect(centerX - width * 0.36, baseY - 120, width * 0.18, 160);
    // Batter's Box Right
    ctx.strokeRect(centerX + width * 0.18, baseY - 120, width * 0.18, 160);

    // Home Plate Polygon (Five-sided white rubber plate)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(centerX - 42, baseY);
    ctx.lineTo(centerX + 42, baseY);
    ctx.lineTo(centerX + 42, baseY + 28);
    ctx.lineTo(centerX, baseY + 55);
    ctx.lineTo(centerX - 42, baseY + 28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}
