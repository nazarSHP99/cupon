import * as THREE from 'three'

// Each marching-squares case lists directed pairs of crossed edges (top, right, bottom, left).
// Diagonally touching pixels stay separate, so every crossing belongs to exactly one contour.
const EDGE_PAIRS = [
  [], [0, 3], [1, 0], [1, 3], [2, 1], [0, 3, 2, 1], [2, 0], [2, 3],
  [3, 2], [0, 2], [1, 0, 3, 2], [1, 2], [3, 1], [0, 1], [3, 0], [],
]

function contains(point: THREE.Vector2, polygon: THREE.Vector2[]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < a.x + (b.x - a.x) * (point.y - a.y) / (b.y - a.y)) inside = !inside
  }
  return inside
}

export function imageTicketShapes(image: HTMLImageElement, width: number, height: number) {
  const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  const columns = canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  const rows = canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  ctx.drawImage(image, 0, 0, columns, rows)
  const { data } = ctx.getImageData(0, 0, columns, rows)
  let minAlpha = 255, maxAlpha = 0
  for (let i = 3; i < data.length; i += 4) {
    minAlpha = Math.min(minAlpha, data[i])
    maxAlpha = Math.max(maxAlpha, data[i])
  }
  if (!maxAlpha) return []
  const cutoff = Math.min(128, Math.ceil(maxAlpha / 2))
  if (minAlpha >= cutoff) {
    return [new THREE.Shape([
      new THREE.Vector2(-width / 2, height / 2), new THREE.Vector2(width / 2, height / 2),
      new THREE.Vector2(width / 2, -height / 2), new THREE.Vector2(-width / 2, -height / 2),
    ])]
  }

  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < columns && y < rows && data[(y * columns + x) * 4 + 3] >= cutoff
  const stride = 2 * columns + 1
  const next = new Map<number, number>()
  for (let y = -1; y < rows; y++) for (let x = -1; x < columns; x++) {
    const mask = Number(inside(x, y)) | Number(inside(x + 1, y)) << 1
      | Number(inside(x + 1, y + 1)) << 2 | Number(inside(x, y + 1)) << 3
    const pairs = EDGE_PAIRS[mask]
    if (!pairs.length) continue
    const top = (2 * y + 1) * stride + 2 * x + 2
    const edges = [top, top + stride + 1, top + 2 * stride, top + stride - 1]
    for (let i = 0; i < pairs.length; i += 2) next.set(edges[pairs[i]], edges[pairs[i + 1]])
  }

  const outlines: { points: THREE.Vector2[]; shape: THREE.Shape; area: number; bounds: THREE.Box2 }[] = []
  const holes: THREE.Vector2[][] = []
  for (const start of next.keys()) {
    const loop: THREE.Vector2[] = []
    let point = start
    while (next.has(point)) {
      loop.push(new THREE.Vector2(point % stride, Math.floor(point / stride)))
      const end = next.get(point)!
      next.delete(point)
      point = end
    }
    if (point !== start || loop.length < 3) continue
    const points = loop.filter((b, i) => {
      const a = loop[(i + loop.length - 1) % loop.length], c = loop[(i + 1) % loop.length]
      return (b.x - a.x) * (c.y - b.y) !== (b.y - a.y) * (c.x - b.x)
    }).map(p => new THREE.Vector2((p.x / (2 * columns) - .5) * width, (.5 - p.y / (2 * rows)) * height))
    const area = THREE.ShapeUtils.area(points)
    if (area < 0) outlines.push({ points, shape: new THREE.Shape(points), area: -area, bounds: new THREE.Box2().setFromPoints(points) })
    else if (area > 0) holes.push(points)
  }

  // An island inside a hole remains a separate piece. A hole belongs to the smallest outline that contains it.
  outlines.sort((a, b) => a.area - b.area)
  for (const hole of holes) {
    const bounds = new THREE.Box2().setFromPoints(hole)
    const owner = outlines.find(outline => outline.bounds.containsBox(bounds) && contains(hole[0], outline.points))
    owner?.shape.holes.push(new THREE.Path(hole))
  }
  return outlines.map(({ shape }) => shape)
}
