import { TrajectoryType, PitchTrajectoryPoint } from '../types/game';

export class TrajectoryGenerator {
  // Mound release point in normalized coords
  private static readonly MOUND_RELEASE = { x: 0.50, y: 0.42 };

  public static getTargetForType(type: TrajectoryType): { x: number; y: number } {
    switch (type) {
      case 'fastball_center':
        return { x: 0.50, y: 0.55 };
      case 'high_left':
        return { x: 0.32, y: 0.34 };
      case 'high_right':
        return { x: 0.68, y: 0.34 };
      case 'low_left':
        return { x: 0.30, y: 0.72 };
      case 'low_right':
        return { x: 0.70, y: 0.72 };
      case 'curve_left':
        return { x: 0.35, y: 0.58 };
      case 'curve_right':
        return { x: 0.65, y: 0.58 };
      default:
        return { x: 0.50, y: 0.55 };
    }
  }

  /**
   * Computes baseball 2.5D position and shadow at normalized progress t in [0..1]
   */
  public static calculatePoint(
    type: TrajectoryType,
    t: number // 0 (release) -> 1 (arrival at camera plane)
  ): PitchTrajectoryPoint {
    const clampedT = Math.max(0, Math.min(1, t));
    const target = this.getTargetForType(type);
    const start = this.MOUND_RELEASE;

    // Depth Z travels from 1.0 (mound) to 0.0 (home plate)
    // Non-linear depth acceleration makes incoming pitch feel realistic and dramatic
    const z = 1.0 - Math.pow(clampedT, 1.3);

    // Ball visual scale (from small dot at mound to huge catching mitt size)
    const scale = 0.12 + 0.88 * Math.pow(clampedT, 1.8);

    let x = start.x + (target.x - start.x) * clampedT;
    let y = start.y + (target.y - start.y) * clampedT;

    // Add arc and curve mechanics based on pitch type
    if (type === 'curve_left') {
      // Swerves right first, then breaks hard left
      const curve = Math.sin(clampedT * Math.PI) * 0.14;
      x = x - curve;
      // Arc rise then drop
      y += Math.sin(clampedT * Math.PI) * -0.06 + Math.pow(clampedT, 2) * 0.08;
    } else if (type === 'curve_right') {
      const curve = Math.sin(clampedT * Math.PI) * 0.14;
      x = x + curve;
      y += Math.sin(clampedT * Math.PI) * -0.06 + Math.pow(clampedT, 2) * 0.08;
    } else if (type === 'low_left' || type === 'low_right') {
      // Sinker / Splitter sharp late drop
      y += Math.pow(clampedT, 2.5) * 0.12;
    } else if (type === 'high_left' || type === 'high_right') {
      // High rising fastball
      y -= Math.sin(clampedT * Math.PI * 0.5) * 0.05;
    } else {
      // Fastball subtle gravity dip
      y += Math.pow(clampedT, 2) * 0.04;
    }

    // Shadow on field: projects onto ground plane
    const shadowX = x;
    const shadowY = 0.65 + clampedT * 0.32; // ground perspective
    const shadowAlpha = Math.max(0.1, Math.min(0.6, (1.0 - z) * 0.7));

    return {
      x,
      y,
      z,
      scale,
      shadowX,
      shadowY,
      shadowAlpha
    };
  }
}
