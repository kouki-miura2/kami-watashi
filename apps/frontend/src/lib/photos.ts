/**
 * The size a photo is stored at: unchanged when its long edge fits in `maxLongEdge`, otherwise
 * scaled down (aspect ratio kept) so the long edge is exactly `maxLongEdge`. Never scaled up.
 */
export const fitLongEdge = (
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } => {
  const longEdge = Math.max(width, height)
  if (longEdge <= maxLongEdge) return { width, height }
  const scale = maxLongEdge / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
