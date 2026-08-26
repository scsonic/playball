import { TrackingFrame } from '../types/game';

export class VisionSimulator {
  private mouseX: number = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 960;
  private mouseY: number = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 540;
  private lastX: number = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 960;
  private lastY: number = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 540;
  private lastTime: number = performance.now();
  private velocity: number = 0;
  private isOpenPalm: boolean = true;
  private isEnabled: boolean = true;
  private activeListeners: boolean = false;
  private hasReceivedMouseInput: boolean = false;

  constructor() {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.enable();
  }

  public enable() {
    this.isEnabled = true;
    if (!this.activeListeners && typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
      window.addEventListener('pointermove', this.handleMouseMove, { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          this.mouseX = e.touches[0].clientX;
          this.mouseY = e.touches[0].clientY;
          this.hasReceivedMouseInput = true;
        }
      }, { passive: true });
      window.addEventListener('mousedown', this.handleMouseDown);
      window.addEventListener('mouseup', this.handleMouseUp);
      this.activeListeners = true;
    }
  }

  public disable() {
    this.isEnabled = false;
  }

  private handleMouseMove(e: MouseEvent | PointerEvent) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.hasReceivedMouseInput = true;
  }

  private handleMouseDown() {
    this.isOpenPalm = true;
    this.hasReceivedMouseInput = true;
  }

  private handleMouseUp() {
    this.isOpenPalm = true;
  }

  public setSimulatedPosition(screenX: number, screenY: number, isOpen: boolean = true) {
    this.mouseX = screenX;
    this.mouseY = screenY;
    this.isOpenPalm = isOpen;
    this.hasReceivedMouseInput = true;
  }

  public getFrame(timestamp: number = performance.now()): TrackingFrame {
    const dt = Math.max(1, timestamp - this.lastTime) / 1000;
    const dist = Math.hypot(this.mouseX - this.lastX, this.mouseY - this.lastY);
    this.velocity = dist / dt;

    this.lastX = this.mouseX;
    this.lastY = this.mouseY;
    this.lastTime = timestamp;

    const width = (typeof window !== 'undefined' ? window.innerWidth : 1920) || 1920;
    const height = (typeof window !== 'undefined' ? window.innerHeight : 1080) || 1080;

    const normX = this.mouseX / width;
    const normY = this.mouseY / height;

    return {
      timestamp,
      personDetected: true,
      handDetected: true,
      isLeftHand: true,
      palmOpen: this.isOpenPalm,
      confidence: 1.0,
      rawPalmCenter: { x: normX, y: normY },
      smoothedPalmCenter: { x: normX, y: normY },
      screenPos: { x: this.mouseX, y: this.mouseY },
      velocity: this.velocity,
      lightingQuality: 'good'
    };
  }

  public hasInput(): boolean {
    return this.hasReceivedMouseInput;
  }

  public isActive(): boolean {
    return this.isEnabled;
  }
}

export const visionSimulator = new VisionSimulator();
