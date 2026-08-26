import { HandLandmark } from '../types/game';

/**
 * Geometric open-palm classifier based on hand landmarks.
 * Landmarks (MediaPipe convention):
 * 0: WRIST
 * 1-4: THUMB (CMC, MCP, IP, TIP)
 * 5-8: INDEX (MCP, PIP, DIP, TIP)
 * 9-12: MIDDLE (MCP, PIP, DIP, TIP)
 * 13-16: RING (MCP, PIP, DIP, TIP)
 * 17-20: PINKY (MCP, PIP, DIP, TIP)
 */
export class PalmClassifier {
  /**
   * Computes stable palm center from wrist and MCP landmarks
   */
  public static computePalmCenter(landmarks: HandLandmark[]): { x: number; y: number } {
    if (!landmarks || landmarks.length < 21) {
      return { x: 0.5, y: 0.5 };
    }

    // Centroid of wrist (0), Index MCP (5), Middle MCP (9), Ring MCP (13), Pinky MCP (17)
    const indices = [0, 5, 9, 13, 17];
    let sumX = 0;
    let sumY = 0;

    indices.forEach((idx) => {
      sumX += landmarks[idx].x;
      sumY += landmarks[idx].y;
    });

    return {
      x: sumX / indices.length,
      y: sumY / indices.length
    };
  }

  /**
   * Computes approximate palm width based on distance from Index MCP (5) to Pinky MCP (17)
   */
  public static computePalmWidth(landmarks: HandLandmark[]): number {
    if (!landmarks || landmarks.length < 21) return 0.1;
    const dx = landmarks[5].x - landmarks[17].x;
    const dy = landmarks[5].y - landmarks[17].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Evaluates whether the hand is an open palm facing forward.
   * Checks if fingertips are extended away from wrist and MCPs.
   */
  public static isOpenPalm(landmarks: HandLandmark[]): { isOpen: boolean; confidence: number } {
    if (!landmarks || landmarks.length < 21) {
      return { isOpen: false, confidence: 0 };
    }

    const wrist = landmarks[0];
    const fingerPairs = [
      { mcp: 5, tip: 8 },   // Index
      { mcp: 9, tip: 12 },  // Middle
      { mcp: 13, tip: 16 }, // Ring
      { mcp: 17, tip: 20 }  // Pinky
    ];

    let extendedFingers = 0;

    fingerPairs.forEach(({ mcp, tip }) => {
      const tipDist = Math.hypot(landmarks[tip].x - wrist.x, landmarks[tip].y - wrist.y);
      const mcpDist = Math.hypot(landmarks[mcp].x - wrist.x, landmarks[mcp].y - wrist.y);

      // In an open palm, fingertip must be significantly further from wrist than MCP
      if (tipDist > mcpDist * 1.25) {
        extendedFingers++;
      }
    });

    // Check thumb extension relative to wrist
    const thumbTipDist = Math.hypot(landmarks[4].x - wrist.x, landmarks[4].y - wrist.y);
    const thumbMcpDist = Math.hypot(landmarks[2].x - wrist.x, landmarks[2].y - wrist.y);
    if (thumbTipDist > thumbMcpDist * 1.15) {
      extendedFingers += 0.5;
    }

    const confidence = Math.min(1.0, extendedFingers / 4.0);
    // At least 3 extended fingers qualifies as an open palm (forgiving catch window)
    const isOpen = extendedFingers >= 3.0;

    return { isOpen, confidence };
  }
}
