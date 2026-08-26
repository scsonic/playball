export class CoordinateMapper {
  private screenWidth: number = window.innerWidth;
  private screenHeight: number = window.innerHeight;
  private mirrored: boolean = true;
  private margin: number = 0.05; // 5% edge margin clamping

  constructor(mirrored: boolean = true) {
    this.mirrored = mirrored;
    this.updateScreenDimensions();
  }

  public updateScreenDimensions(width?: number, height?: number) {
    this.screenWidth = width || window.innerWidth || 1920;
    this.screenHeight = height || window.innerHeight || 1080;
  }

  public setMirrored(mirrored: boolean) {
    this.mirrored = mirrored;
  }

  /**
   * Maps normalized camera coordinates (0..1) to screen pixel coordinates
   */
  public mapToScreen(normX: number, normY: number): { x: number; y: number } {
    // 1. Mirror horizontally if camera preview is mirrored
    let activeX = this.mirrored ? 1.0 - normX : normX;
    let activeY = normY;

    // 2. Expand coordinate range slightly so reaching screen edges is comfortable
    const range = 1.0 - 2 * this.margin;
    activeX = (activeX - this.margin) / range;
    activeY = (activeY - this.margin) / range;

    // 3. Clamp within 0..1
    activeX = Math.max(0, Math.min(1, activeX));
    activeY = Math.max(0, Math.min(1, activeY));

    return {
      x: activeX * this.screenWidth,
      y: activeY * this.screenHeight
    };
  }
}
