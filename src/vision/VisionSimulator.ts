import { TrackingFrame } from '../types/game';

export class VisionSimulator {
  private mouseX: number = window.innerWidth * 0.5;
  private mouseY: number = window.innerHeight * 0.5;
  private lastX: number = window.innerWidth * 0.5;
  private lastY: number = window.innerHeight * 0.5;
  private lastTime: number = performance.now();
  private velocity: number = 0;
  private isOpenPalm: boolean = true;
  private isEnabled: boolean = false;
  private activeListeners: boolean = false;

  constructor() {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  public enable() {
    this.isEnabled = true;
    if (!this.activeListeners && typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('pointermove', this.handleMouseMove);
      window.addEventListener('mousedown', this.handleMouseDown);
      window.addEventListener('mouseup', this.handleMouseUp);
      this.activeListeners = true;
    }
  }

  public disable() {
    this.isEnabled = false;
    if (this.activeListeners && typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('pointermove', this.handleMouseMove);
      window.removeEventListener('mousedown', this.handleMouseDown);
      window.removeEventListener('mouseup', this.handleMouseUp);
      this.activeListeners = false;
    }
  }

  private handleMouseMove(e: MouseEvent | PointerEvent) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  private handleMouseDown() {
    this.isOpenPalm = true;
  }

  private handleMouseUp() {
    this.isOpenPalm = true;
  }

  public setSimulatedPosition(screenX: number, screenY: number, isOpen: boolean = true) {
    this.mouseX = screenX;
    this.mouseY = screenY;
    this.isOpenPalm = isOpen;
  }

  public getFrame(timestamp: number = performance.now()): TrackingFrame {
    const dt = Math.max(1, timestamp - this.lastTime) / 1000;
    const dist = Math.hypot(this.mouseX - this.lastX, this.mouseY - this.lastY);
    this.velocity = dist / dt;

    this.lastX = this.mouseX;
    this.lastY = this.mouseY;
    this.lastTime = timestamp;

    const normX = this.mouseX / (window.innerWidth || 1920);
    const normY = this.mouseY / (window.innerHeight || 1080);

    return {
      timestamp,
      personDetected: true,
      handDetected: true,
      isLeftHand: true,
      palmOpen: this.isOpenPalm,
      confidence: 0.99,
      rawPalmCenter: { x: normX, y: normY },
      smoothedPalmCenter: { x: normX, y: normY },
      screenPos: { x: this.mouseX, y: this.mouseY },
      velocity: this.velocity,
      lightingQuality: 'good'
    };
  }

  public isActive(): boolean {
    return this.isEnabled;
  }
}

export const visionSimulator = new VisionSimulator();
