import type { HandMode, Landmark } from '../types';

/**
 * Geometry helpers for a MediaPipe hand.
 *
 * Landmark indices:
 *   0 wrist · 1-4 thumb (CMC, MCP, IP, TIP) · 5-8 index · 9-12 middle
 *   13-16 ring · 17-20 pinky (MCP, PIP, DIP, TIP)
 */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

const FINGERS = [
  { mcp: LM.INDEX_MCP, pip: LM.INDEX_PIP, tip: LM.INDEX_TIP },
  { mcp: LM.MIDDLE_MCP, pip: LM.MIDDLE_PIP, tip: LM.MIDDLE_TIP },
  { mcp: LM.RING_MCP, pip: LM.RING_PIP, tip: LM.RING_TIP },
  { mcp: LM.PINKY_MCP, pip: LM.PINKY_PIP, tip: LM.PINKY_TIP },
];

export interface PalmReading {
  /** Stable palm centre in normalised camera space. */
  center: { x: number; y: number };
  /** Palm width (index MCP → pinky MCP) in normalised units. */
  width: number;
  /** Rotation of the palm in radians, 0 = fingers pointing up. */
  orientation: number;
  /** 0..1 how open the hand is. */
  openness: number;
  isOpen: boolean;
  /** Number of extended fingers, thumb counts as 0.5. */
  extendedFingers: number;
}

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Palm centre from the stable part of the hand (wrist + the four MCP knuckles).
 * Deliberately not a fingertip: fingertips wobble by several centimetres while
 * the knuckle plate barely moves, and the catch target must feel anchored.
 */
export function palmCenter(landmarks: Landmark[]): { x: number; y: number } {
  if (!landmarks || landmarks.length < 21) return { x: 0.5, y: 0.5 };
  const ids = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];
  let x = 0;
  let y = 0;
  for (const i of ids) {
    x += landmarks[i].x;
    y += landmarks[i].y;
  }
  // Bias slightly towards the knuckles — that is where a ball meets the glove.
  const cx = x / ids.length;
  const cy = y / ids.length;
  const knuckleY = (landmarks[LM.INDEX_MCP].y + landmarks[LM.PINKY_MCP].y) / 2;
  return { x: cx, y: cy * 0.75 + knuckleY * 0.25 };
}

export function palmWidth(landmarks: Landmark[]): number {
  if (!landmarks || landmarks.length < 21) return 0.1;
  return dist(landmarks[LM.INDEX_MCP], landmarks[LM.PINKY_MCP]);
}

export function palmOrientation(landmarks: Landmark[]): number {
  if (!landmarks || landmarks.length < 21) return 0;
  const wrist = landmarks[LM.WRIST];
  const mid = landmarks[LM.MIDDLE_MCP];
  return Math.atan2(mid.x - wrist.x, wrist.y - mid.y);
}

/**
 * Open-palm classifier.
 *
 * Uses *relative* measurements only (everything divided by the hand's own scale),
 * so it works the same at 1 m and at 3 m from the camera:
 *  - fingertip distance from the wrist vs. the knuckle distance (extension), and
 *  - the MCP→PIP→TIP angle (a curled finger bends well past 40°).
 */
export function classifyPalm(landmarks: Landmark[]): PalmReading {
  if (!landmarks || landmarks.length < 21) {
    return {
      center: { x: 0.5, y: 0.5 },
      width: 0.1,
      orientation: 0,
      openness: 0,
      isOpen: false,
      extendedFingers: 0,
    };
  }

  const wrist = landmarks[LM.WRIST];
  const scale = Math.max(1e-4, palmWidth(landmarks));

  let extended = 0;
  let openness = 0;

  for (const f of FINGERS) {
    const tipReach = dist(landmarks[f.tip], wrist) / scale;
    const mcpReach = dist(landmarks[f.mcp], wrist) / scale;
    const extensionRatio = tipReach / Math.max(1e-4, mcpReach);

    const angle = jointAngle(landmarks[f.mcp], landmarks[f.pip], landmarks[f.tip]);

    // Straight finger: tip clearly beyond the knuckle AND joint close to 180°.
    const straightness = clamp01((angle - 110) / 60);
    const reach = clamp01((extensionRatio - 1.05) / 0.5);
    const score = Math.min(1, straightness * 0.5 + reach * 0.5);

    openness += score;
    if (score > 0.5) extended += 1;
  }

  // Thumb is measured sideways from the palm axis rather than by reach.
  const thumbSpread = dist(landmarks[LM.THUMB_TIP], landmarks[LM.INDEX_MCP]) / scale;
  if (thumbSpread > 0.9) extended += 0.5;

  const normalisedOpenness = clamp01(openness / 4);
  return {
    center: palmCenter(landmarks),
    width: scale,
    orientation: palmOrientation(landmarks),
    openness: normalisedOpenness,
    // Forgiving on purpose: three straight fingers is an open hand at a trade show.
    isOpen: extended >= 3,
    extendedFingers: extended,
  };
}

function jointAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (mag < 1e-6) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * MediaPipe reports handedness *assuming the input image is mirrored* (the
 * selfie convention). getUserMedia hands us raw, un-mirrored frames, so the
 * label has to be flipped to recover the anatomical hand. Getting this wrong is
 * the classic bug where "raise your left hand" only works for right-handers.
 *
 * @param label          categoryName from MediaPipe ('Left' | 'Right')
 * @param inputMirrored  true when the frames fed to MediaPipe were already flipped
 */
export function anatomicalHand(label: string, inputMirrored: boolean): HandMode {
  const raw = label.toLowerCase() === 'left' ? 'left' : 'right';
  if (inputMirrored) return raw;
  return raw === 'left' ? 'right' : 'left';
}
