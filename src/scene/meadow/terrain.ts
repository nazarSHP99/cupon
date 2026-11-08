import { Color, MathUtils } from 'three'

export const TERRAIN_EXTENT = 96
export const MEADOW_FOG_NEAR = 44
export const MEADOW_FOG_FAR = 174
const TURF_GREEN = new Color('#476b24')
const TURF_OLIVE = new Color('#a2b936')
const TURF_SAGE = new Color('#bdc783')
const TURF_SHADE = new Color('#345729')

export function hillTurf(y: number, normalY: number) {
  const elevation = MathUtils.smoothstep(y, -6.8, 4)
  const slope = MathUtils.smoothstep(1 - normalY, .04, .30)
  return 1 - (1 - elevation) * (1 - slope)
}

const HILLS = [
  { x: -22, z: -8, width: 20, depth: 29, rise: 11.5 },
  { x: 20, z: -14, width: 20, depth: 28, rise: 14.2 },
  { x: -25, z: -39, width: 29, depth: 31, rise: 20.2 },
  { x: -37, z: -33, width: 17, depth: 22, rise: 14.4 },
  { x: 7, z: -36, width: 24, depth: 28, rise: 15.5 },
  { x: -4, z: -66, width: 34, depth: 37, rise: 25 },
  { x: 12, z: -69, width: 24, depth: 26, rise: 17 },
  { x: 37, z: -53, width: 34, depth: 33, rise: 24 },
  { x: -53, z: -57, width: 31, depth: 32, rise: 25 },
  { x: -41, z: 17, width: 23, depth: 27, rise: 12.3 },
  { x: 42, z: 14, width: 25, depth: 33, rise: 15.1 },
  { x: -16, z: 18, width: 12, depth: 13, rise: 3.5 },
  { x: 23, z: 25, width: 14, depth: 16, rise: 4.1 },
]

export function terrainHeight(x: number, z: number) {
  let hills = 0
  for (const hill of HILLS) {
    const dx = (x - hill.x) / hill.width
    const dz = (z - hill.z) / hill.depth
    const falloff = 1 - dx * dx - dz * dz
    if (falloff > 0) {
      const rise = hill.rise * falloff * falloff * falloff
      hills += rise * rise
    }
  }
  const rolling = Math.sin(x * .21 + z * .12) * Math.cos(z * .19) * .65
    + Math.cos(x * .09 - z * .13) * .43
    + Math.sin(x * .49 - z * .34) * .13
  const valley = -8.65 + Math.sqrt(hills) + rolling
  // Keep the crest level under all four table legs, with a rounded drop into the valley.
  const knoll = 1 - MathUtils.smoothstep(Math.hypot(x / 9.3, z / 7.4), .7, 1.7)
  return MathUtils.lerp(valley, -5.04, knoll)
}

export const FLOWER_DRIFTS = [
  { x: -7.5, z: 5, width: 4.2, depth: 1.8, angle: -.55, species: 0 },
  { x: 8.1, z: 5.2, width: 3.8, depth: 1.9, angle: .57, species: 1 },
  { x: -11.2, z: -2, width: 5.3, depth: 2.4, angle: .75, species: 1 },
  { x: 10.5, z: -4.1, width: 5.5, depth: 2.1, angle: -.72, species: 0 },
  { x: -3.1, z: -9, width: 4.6, depth: 1.5, angle: .12, species: 2 },
  { x: -14, z: 14, width: 6.2, depth: 2.8, angle: .35, species: 2 },
  { x: 16.5, z: 15.8, width: 5.7, depth: 2.5, angle: -.8, species: 0 },
  { x: -1.4, z: 20, width: 5.2, depth: 2.3, angle: -.52, species: 1 },
  { x: -19, z: -14, width: 8, depth: 3.3, angle: -.57, species: 0 },
  { x: 17, z: -19, width: 8.2, depth: 3.5, angle: .51, species: 1 },
  { x: -9, z: -24, width: 7.6, depth: 3.1, angle: -.53, species: 2 },
  { x: 4, z: -30, width: 6.9, depth: 2.3, angle: .44, species: 0 },
  { x: -20, z: -32, width: 9.6, depth: 3.3, angle: .49, species: 1 },
  { x: 29, z: -35, width: 11.3, depth: 4.2, angle: -.63, species: 2 },
  { x: -12, z: -49, width: 11, depth: 4.1, angle: -.39, species: 0 },
  { x: 21, z: -56, width: 14, depth: 4.2, angle: .33, species: 0 },
  { x: -37, z: -51, width: 14, depth: 4.8, angle: .57, species: 2 },
].map(drift => ({ ...drift, cos: Math.cos(drift.angle), sin: Math.sin(drift.angle) }))

const FLOWER_TINTS = [
  new Color('#8064a0'),
  new Color('#a97e9d'),
  new Color('#a796b5'),
]

export function flowerDrift(drift: typeof FLOWER_DRIFTS[number], x: number, z: number) {
  const dx = x - drift.x, dz = z - drift.z
  const u = (dx * drift.cos + dz * drift.sin) / drift.width
  const v = (-dx * drift.sin + dz * drift.cos) / drift.depth
  const edge = Math.hypot(u, v + Math.sin(u * 5 + drift.x) * .21)
  const openings = Math.sin(x * 1.83 + z * .61) * Math.cos(z * 1.46 - x * .55)
  return (1 - MathUtils.smoothstep(edge, .28, 1.04)) * (.75 + openings * .25)
}

export function meadowTurfColor(color: Color, x: number, z: number) {
  const tone = .53 + Math.sin(x * .25 + z * .17) * .12 + Math.sin(x * .105 - z * .14) * .14
  const patches = Math.sin(x * .46 + z * .29 + Math.sin(z * .57)) * Math.cos(z * .63 - x * .35)
    + .24 * Math.sin(x * 1.09 + z * .91)
  color.copy(TURF_GREEN).lerp(TURF_OLIVE, tone)
    .lerp(TURF_SAGE, MathUtils.smoothstep(patches, .08, .84) * .52)
    .lerp(TURF_SHADE, MathUtils.smoothstep(-patches, .21, .91) * .36)
  for (const drift of FLOWER_DRIFTS) {
    const bloom = flowerDrift(drift, x, z)
    if (bloom > 0) color.lerp(FLOWER_TINTS[drift.species], bloom * .49)
  }
  return color
}

export function meadowRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
