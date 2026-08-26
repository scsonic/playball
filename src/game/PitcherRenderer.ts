export type PitcherPhase =
  | 'idle'
  | 'set'
  | 'windup'
  | 'release'
  | 'follow_through'
  | 'celebrate'
  | 'miss_reaction';

export class PitcherRenderer {
  private phase: PitcherPhase = 'idle';
  private phaseProgress: number = 0; // 0..1 within current phase
  private videoElement: HTMLVideoElement | null = null;
  private useLicensedVideo: boolean = false;

  public setPhase(phase: PitcherPhase, progress: number = 0) {
    this.phase = phase;
    this.phaseProgress = Math.max(0, Math.min(1, progress));
  }

  public setVideo(video: HTMLVideoElement | null, isLicensed: boolean = false) {
    this.videoElement = video;
    this.useLicensedVideo = isLicensed;
  }

  /**
   * Renders the pitcher on the mound in 2.5D perspective
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ) {
    // If licensed video is present, render video frame
    if (this.useLicensedVideo && this.videoElement && !this.videoElement.paused) {
      const vidW = width * 0.35;
      const vidH = height * 0.55;
      ctx.drawImage(
        this.videoElement,
        width * 0.5 - vidW * 0.5,
        height * 0.38 - vidH * 0.5,
        vidW,
        vidH
      );
      return;
    }

    // Stylized high-energy Japanese baseball superstar pitcher (vector silhouette & athletic shading)
    const moundCenterX = width * 0.5;
    const moundCenterY = height * 0.44;
    const scale = Math.min(width, height) * 0.0028;

    ctx.save();
    ctx.translate(moundCenterX, moundCenterY);
    ctx.scale(scale, scale);

    // Cast shadow on mound dirt
    ctx.beginPath();
    ctx.ellipse(0, 75, 45, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 15, 25, 0.45)';
    ctx.fill();

    // Breathing / idle motion
    const idleBob = Math.sin(time * 0.003) * 2.5;

    // Body parts kinematic angles based on phase
    let torsoAngle = 0;
    let throwingArmAngle = -0.6;
    let gloveArmAngle = 0.8;
    let leadLegLift = 0;
    let headTilt = 0;

    if (this.phase === 'set') {
      torsoAngle = 0.05;
      throwingArmAngle = -0.4;
      gloveArmAngle = 0.5;
    } else if (this.phase === 'windup') {
      // High leg kick & chest twist
      const p = this.phaseProgress;
      leadLegLift = Math.sin(p * Math.PI) * 45;
      torsoAngle = -0.25 * Math.sin(p * Math.PI);
      throwingArmAngle = -0.6 - p * 1.8; // Cock back
      gloveArmAngle = 0.5 + p * 0.8;
    } else if (this.phase === 'release') {
      // Powerful forward drive and overhand release
      const p = this.phaseProgress;
      torsoAngle = 0.35 * p;
      throwingArmAngle = 1.2 + p * 0.6; // High overhand forward whip
      gloveArmAngle = -0.4;
      leadLegLift = 15 * (1 - p);
    } else if (this.phase === 'follow_through') {
      torsoAngle = 0.4;
      throwingArmAngle = 1.8;
      gloveArmAngle = -0.5;
    } else if (this.phase === 'celebrate') {
      // Fist pump victory pose
      const jump = Math.sin(time * 0.008) * 8;
      ctx.translate(0, -jump);
      throwingArmAngle = -2.2 + Math.sin(time * 0.01) * 0.2; // Raised fist
      gloveArmAngle = -1.2;
    } else if (this.phase === 'miss_reaction') {
      // Encouraging stance
      torsoAngle = 0.08;
      throwingArmAngle = -0.2;
      gloveArmAngle = 0.3;
    }

    ctx.translate(0, idleBob);

    // 1. Legs and Cleats
    // Back leg (plant)
    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.lineTo(14, 75);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#f8fafc'; // White uniform pants
    ctx.lineCap = 'round';
    ctx.stroke();
    // Navy stripe
    ctx.beginPath();
    ctx.moveTo(11, 22);
    ctx.lineTo(17, 72);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e3a8a';
    ctx.stroke();

    // Front leg (lead leg)
    ctx.beginPath();
    ctx.moveTo(-8, 20);
    ctx.quadraticCurveTo(-20 - leadLegLift * 0.3, 40 - leadLegLift * 0.6, -12, 75 - leadLegLift);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineCap = 'round';
    ctx.stroke();
    // Cleats
    ctx.fillStyle = '#dc2626'; // Red highlight cleats
    ctx.fillRect(8, 70, 16, 8);
    ctx.fillRect(-18, 70 - leadLegLift, 16, 8);

    // 2. Torso (Jersey)
    ctx.save();
    ctx.rotate(torsoAngle);

    ctx.beginPath();
    ctx.moveTo(-22, -35);
    ctx.lineTo(22, -35);
    ctx.lineTo(16, 22);
    ctx.lineTo(-16, 22);
    ctx.closePath();
    ctx.fillStyle = '#f8fafc'; // White WBC home jersey
    ctx.fill();

    // Red & Navy Collar / Chest number accents
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-18, -35, 36, 6);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('17', 2, 2);

    // 3. Head & Cap
    ctx.save();
    ctx.translate(0, -48);
    ctx.rotate(headTilt);
    // Face
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#fcd34d'; // Stylized skin tone
    ctx.fill();
    // Baseball Cap (Navy + Red visor)
    ctx.beginPath();
    ctx.arc(0, -3, 13, Math.PI, 0, false);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    // Visor brim
    ctx.beginPath();
    ctx.ellipse(6, -3, 10, 3, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.restore();

    // 4. Glove Arm (Left arm)
    ctx.save();
    ctx.translate(-18, -28);
    ctx.rotate(gloveArmAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-14, 24);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineCap = 'round';
    ctx.stroke();
    // Brown Leather Catcher/Pitcher Glove
    ctx.beginPath();
    ctx.arc(-16, 28, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#854d0e'; // Brown leather
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 5. Throwing Arm (Right arm)
    ctx.save();
    ctx.translate(18, -28);
    ctx.rotate(throwingArmAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16, 26);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineCap = 'round';
    ctx.stroke();
    // Hand holding ball before release
    ctx.beginPath();
    ctx.arc(18, 30, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fcd34d';
    ctx.fill();
    if (this.phase === 'set' || this.phase === 'windup') {
      ctx.beginPath();
      ctx.arc(20, 32, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();

    ctx.restore(); // end torso
    ctx.restore(); // end pitcher
  }
}
