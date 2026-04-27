export const RAW_CENTER = 2048;
export const RAW_RANGE = 4095;

export function degToRaw(deg: number): number {
  return Math.round((deg / 360) * RAW_RANGE + RAW_CENTER);
}

export function rawToDeg(raw: number): number {
  return ((raw - RAW_CENTER) / RAW_RANGE) * 360;
}

export function formatDeg(deg: number): number {
  return Math.round(deg * 10) / 10;
}
