import { Color, PlaneGeometry } from 'three'
import { GRASS_PRESET } from './grassSettings'
import { meadowRandom, meadowTurfColor, terrainHeight, TERRAIN_EXTENT } from './terrain'

export const GRASS_TILE = 8
export const DISTANT_GRASS_TILE = 16
export const GRASS_EXTENT_X = 40
export const GRASS_BACK = -32
export const GRASS_FRONT = 88
export const ROOT_HEIGHT_RANGE = 32

export interface GrassTileData {
  detailed: boolean
  centerX: number
  centerZ: number
  minY: number
  maxY: number
  roots: Int16Array
  appearance: Uint8Array
}

export interface GroundData {
  position: Float32Array
  normal: Float32Array
  uv: Float32Array
  color: Float32Array
  index: Uint32Array
}

export interface MeadowData {
  ground: GroundData
  tiles: GrassTileData[]
}

export function* generateMeadowData(compact: boolean): Generator<GrassTileData, GroundData> {
  const ground = new PlaneGeometry(TERRAIN_EXTENT * 2, TERRAIN_EXTENT * 2, 256, 256).rotateX(-Math.PI / 2)
  const vertices = ground.getAttribute('position')
  const colors = new Float32Array(vertices.count * 3)
  const color = new Color()
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i)
    vertices.setY(i, terrainHeight(x, z))
    meadowTurfColor(color, x, z).toArray(colors, i * 3)
  }
  ground.computeVertexNormals()
  const data: GroundData = {
    position: vertices.array as Float32Array,
    normal: ground.getAttribute('normal').array as Float32Array,
    uv: ground.getAttribute('uv').array as Float32Array,
    color: colors,
    index: ground.index!.array as Uint32Array,
  }
  yield* plantGrass(ground, colors, compact, true)
  yield* plantGrass(ground, colors, compact, false)
  ground.dispose()
  return data
}

function* plantGrass(ground: PlaneGeometry, colors: Float32Array, compact: boolean, detailed: boolean): Generator<GrassTileData> {
  const random = meadowRandom(detailed ? 951847 : 715419)
  const positions = ground.getAttribute('position')
  const normals = ground.getAttribute('normal')
  const { width, height, widthSegments, heightSegments } = ground.parameters
  const stride = widthSegments + 1
  const cellWidth = width / widthSegments, cellDepth = height / heightSegments
  const tileSize = detailed ? GRASS_TILE : DISTANT_GRASS_TILE
  const extentX = detailed ? GRASS_EXTENT_X : TERRAIN_EXTENT
  const back = detailed ? GRASS_BACK : -TERRAIN_EXTENT
  const front = detailed ? GRASS_FRONT : TERRAIN_EXTENT
  const density = (detailed ? (compact ? 80 : 125) : (compact ? 9 : 13))
    * (detailed ? GRASS_PRESET.nearDensity : GRASS_PRESET.farDensity) / 100
  const placementOrders = new Map<number, Uint16Array>()

  // Curved blades follow the camera route. The simpler layer reaches every ridge.
  for (let z = back; z < front; z += tileSize) for (let x = -extentX; x < extentX; x += tileSize) {
    const centerX = x + tileSize / 2, centerZ = z + tileSize / 2
    const cells = Math.floor(tileSize * Math.sqrt(density))
    const count = cells * cells
    let order = placementOrders.get(cells)
    if (!order) {
      const shuffle = meadowRandom(cells)
      order = Uint16Array.from({ length: count }, (_, index) => index)
      for (let index = count - 1; index > 0; index--) {
        const other = Math.floor(shuffle() * (index + 1))
        const cell = order[index]
        order[index] = order[other]
        order[other] = cell
      }
      placementOrders.set(cells, order)
    }
    const roots = new Int16Array(count * 4)
    const appearance = new Uint8Array(count * 9)
    let minY = Infinity, maxY = -Infinity

    for (let index = 0; index < count; index++) {
      const cell = order[index]
      const px = x + (cell % cells + random()) * tileSize / cells
      const pz = z + (Math.floor(cell / cells) + random()) * tileSize / cells
      const gx = (px + width / 2) / cellWidth, gz = (pz + height / 2) / cellDepth
      const ix = Math.floor(gx), iz = Math.floor(gz)
      const u = gx - ix, v = gz - iz
      const corner = iz * stride + ix
      // Match the two triangles of the rendered surface so roots never float.
      const firstTriangle = u + v <= 1
      const a = firstTriangle ? corner : corner + stride + 1
      const b = firstTriangle ? corner + 1 : corner + stride
      const c = firstTriangle ? corner + stride : corner + 1
      const bWeight = firstTriangle ? u : 1 - u
      const cWeight = firstTriangle ? v : 1 - v
      const aWeight = 1 - bWeight - cWeight
      const y = positions.getY(a) * aWeight + positions.getY(b) * bWeight + positions.getY(c) * cWeight
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      const normal = Math.round(gz) * stride + Math.round(gx)
      const yaw = random() * Math.PI * 2
      const offset = index * 4
      // Normalized local coordinates keep both dense layers small enough to instance.
      roots[offset] = Math.round((px - centerX) * 65534 / tileSize)
      roots[offset + 1] = Math.round((y - .013) * 32767 / ROOT_HEIGHT_RANGE)
      roots[offset + 2] = Math.round((pz - centerZ) * 65534 / tileSize)
      roots[offset + 3] = Math.round((.15 + .34 * random() ** 1.65) * 32767)
      const style = index * 9
      appearance[style] = Math.round((Math.cos(yaw) * .5 + .5) * 255)
      appearance[style + 1] = Math.round((Math.sin(yaw) * .5 + .5) * 255)
      const bladeWidth = .048 + .046 * random()
      appearance[style + 2] = Math.round(bladeWidth / .2 * 255)
      appearance[style + 3] = Math.round((index + .5) / count * 255)
      appearance[style + 4] = Math.round((normals.getX(normal) * .5 + .5) * 255)
      appearance[style + 5] = Math.round((normals.getZ(normal) * .5 + .5) * 255)
      const shade = (.82 + .34 * random()) * 255
      for (let channel = 0; channel < 3; channel++) {
        const color = colors[a * 3 + channel] * aWeight + colors[b * 3 + channel] * bWeight + colors[c * 3 + channel] * cWeight
        appearance[style + 6 + channel] = Math.min(255, Math.round(color * shade))
      }
    }

    yield { detailed, centerX, centerZ, minY, maxY, roots, appearance }
  }
}

export function meadowTransfers(data: MeadowData): ArrayBuffer[] {
  return [
    ...Object.values(data.ground).map(attribute => attribute.buffer as ArrayBuffer),
    ...data.tiles.flatMap(tile => [tile.roots.buffer as ArrayBuffer, tile.appearance.buffer as ArrayBuffer]),
  ]
}
