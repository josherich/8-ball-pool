export type CueSpinState = {
  offset: { x: number; y: number };
  expanded: boolean;
  dragging: boolean;
};

export function getCueSpinLayout(canvasWidth: number, canvasHeight: number, expanded: boolean) {
  if (expanded) {
    return { centerX: canvasWidth - 80, centerY: 88, radius: 50 };
  }
  return { centerX: canvasWidth - 20, centerY: canvasHeight / 2 - 20, radius: 14 };
}

export function isWithinCueSpinControl(
  x: number, y: number,
  canvasWidth: number, canvasHeight: number,
  expanded: boolean
): boolean {
  const { centerX, centerY, radius } = getCueSpinLayout(canvasWidth, canvasHeight, expanded);
  return Math.hypot(x - centerX, y - centerY) <= radius;
}

export function computeCueSpinOffset(
  x: number, y: number,
  canvasWidth: number, canvasHeight: number,
  expanded: boolean
): { x: number; y: number } {
  const { centerX, centerY, radius } = getCueSpinLayout(canvasWidth, canvasHeight, expanded);
  const relX = x - centerX;
  const relY = y - centerY;
  const dist = Math.hypot(relX, relY);

  if (dist <= radius) {
    return { x: relX / radius, y: relY / radius };
  }
  return { x: relX / dist, y: relY / dist };
}
