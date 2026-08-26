export class CursorSmoother {
  private smoothedX: number = 0.5;
  private smoothedY: number = 0.5;
  private smoothedScreenX: number = 0;
  private smoothedScreenY: number = 0;
  private lastTimestamp: number = 0;
  private currentVelocity: number = 0; // Pixels per second
  private alpha: number = 0.75; // Smoothing factor (0 = infinite lag, 1 = raw instant)
  private deadzone: number = 0.003; // In normalized space

  constructor(alpha: number = 0.75) {
    this.alpha = alpha;
  }

  public setAlpha(alpha: number) {
    this.alpha = Math.max(0.1, Math.min(1.0, alpha));
  }

  public update(
    rawNormX: number,
    rawNormY: number,
    screenX: number,
    screenY: number,
    timestamp: number = performance.now()
  ): {
    norm: { x: number; y: number };
    screen: { x: number; y: number };
    velocity: number;
  } {
    if (this.lastTimestamp === 0) {
      this.smoothedX = rawNormX;
      this.smoothedY = rawNormY;
      this.smoothedScreenX = screenX;
      this.smoothedScreenY = screenY;
      this.lastTimestamp = timestamp;
      return {
        norm: { x: this.smoothedX, y: this.smoothedY },
        screen: { x: this.smoothedScreenX, y: this.smoothedScreenY },
        velocity: 0
      };
    }

    const dt = Math.max(1, timestamp - this.lastTimestamp) / 1000; // in seconds

    // Deadzone check on normalized space
    const dNormX = rawNormX - this.smoothedX;
    const dNormY = rawNormY - this.smoothedY;
    const normDist = Math.hypot(dNormX, dNormY);

    if (normDist > this.deadzone) {
      this.smoothedX += dNormX * this.alpha;
      this.smoothedY += dNormY * this.alpha;
    }

    // Screen space smoothing
    const dScreenX = screenX - this.smoothedScreenX;
    const dScreenY = screenY - this.smoothedScreenY;
    const prevScreenX = this.smoothedScreenX;
    const prevScreenY = this.smoothedScreenY;

    this.smoothedScreenX += dScreenX * this.alpha;
    this.smoothedScreenY += dScreenY * this.alpha;

    // Calculate instantaneous velocity in pixels / sec
    const actualScreenDist = Math.hypot(
      this.smoothedScreenX - prevScreenX,
      this.smoothedScreenY - prevScreenY
    );
    this.currentVelocity = actualScreenDist / dt;

    this.lastTimestamp = timestamp;

    return {
      norm: { x: this.smoothedX, y: this.smoothedY },
      screen: { x: this.smoothedScreenX, y: this.smoothedScreenY },
      velocity: this.currentVelocity
    };
  }

  public reset(normX: number = 0.5, normY: number = 0.5, screenX: number = 0, screenY: number = 0) {
    this.smoothedX = normX;
    this.smoothedY = normY;
    this.smoothedScreenX = screenX;
    this.smoothedScreenY = screenY;
    this.lastTimestamp = 0;
    this.currentVelocity = 0;
  }
}
