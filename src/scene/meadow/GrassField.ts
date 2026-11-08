import * as THREE from 'three'
import { MEADOW_FOG_FAR, TERRAIN_EXTENT, meadowRandom } from './terrain'
import { GRASS_PRESET } from './grassSettings'

const TILE = 8
const DISTANT_TILE = 16
const FIELD_X = 40
const FIELD_BACK = -32
const FIELD_FRONT = 88
const FIELD_EDGE = 7
const ROOT_HEIGHT_RANGE = 32
const LOD_FEATHER = .11
const LOD_WEIGHT = 1 + LOD_FEATHER * 2
const timeSlice = () => new Promise<void>(resolve => window.setTimeout(resolve, 0))

export async function meadowGroundTexture() {
  const map = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}grass-ground.jpg`)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(45, 45)
  return map
}

export function grassGroundMaterial(map: THREE.Texture) {
  const material = new THREE.MeshLambertMaterial({ map, vertexColors: true })
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 grainA = texture2D(map, vMapUv).rgb;
      vec3 grainB = texture2D(map, vec2(vMapUv.y, -vMapUv.x) * .83 + vec2(.37, .61)).rgb;
      vec3 coarse = texture2D(map, vMapUv * .31 + vec2(.24, .43)).rgb;
      vec3 luminance = vec3(.2126, .7152, .0722);
      float fine = smoothstep(.025, .27, dot(mix(grainA, grainB, .37), luminance)) - .5;
      float broad = smoothstep(.025, .27, dot(coarse, luminance)) - .5;
      float detail = 1. - smoothstep(20., 52., length(vViewPosition));
      diffuseColor.rgb *= .84 + fine * mix(.07, .34, detail) + broad * mix(.31, .17, detail);
    `)
  }
  return material
}

const ribbon = new THREE.Float32BufferAttribute([
  -.48, 0, 0, .48, 0, 0,
  -.49, .39, .15, .43, .39, .2,
  -.29, .74, .56, .25, .74, .63,
  .07, 1, 1.34,
], 3)
const ribbonIndices = new THREE.Uint16BufferAttribute([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6], 1)
const middleRibbon = new THREE.Float32BufferAttribute([
  -.48, 0, 0, .48, 0, 0,
  -.43, .52, .28, .36, .52, .35,
  .07, 1, 1.34,
], 3)
const middleIndices = new THREE.Uint16BufferAttribute([0, 1, 2, 1, 3, 2, 2, 3, 4], 1)
const distantBlade = new THREE.Float32BufferAttribute([-.48, 0, 0, .48, 0, 0, .07, 1, 1.34], 3)
const distantIndices = new THREE.Uint16BufferAttribute([0, 1, 2], 1)
const bladeNormals = new THREE.Float32BufferAttribute(Array.from({ length: ribbon.count }, () => [0, 1, 0]).flat(), 3)

function bladeMaterial(wind: { value: number }, distance: number, detailed: boolean) {
  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
  const tileHalf = (detailed ? TILE : DISTANT_TILE) / 2
  material.onBeforeCompile = shader => {
    shader.uniforms.grassWind = wind
    shader.uniforms.grassRange = { value: distance }
    shader.vertexShader = `
      attribute vec4 bladeRoot;
      attribute vec4 bladeStyle;
      attribute vec2 bladeSlope;
      attribute vec3 bladeColor;
      uniform float grassWind;
      uniform float grassRange;
      varying vec3 grassColor;
    ` + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      #include <beginnormal_vertex>
      vec2 slope = bladeSlope * 2. - 1.;
      objectNormal = normalize(vec3(slope.x, .92, slope.y));
    `)
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 root = bladeRoot.xyz * vec3(${tileHalf}., ${ROOT_HEIGHT_RANGE}., ${tileHalf}.);
      vec3 worldRoot = (modelMatrix * vec4(root, 1.)).xyz;
      float distance = length(cameraPosition - worldRoot);
      float detail = 1. - smoothstep(grassRange * .57, grassRange, distance);
      detail *= smoothstep(0., ${FIELD_EDGE}., ${FIELD_X}. - abs(worldRoot.x))
        * smoothstep(${FIELD_BACK}., ${FIELD_BACK + FIELD_EDGE}., worldRoot.z)
        * (1. - smoothstep(${FIELD_FRONT - FIELD_EDGE}., ${FIELD_FRONT}., worldRoot.z));
      // Trade blades between LODs without shrinking the whole field through the transition.
      float fill = ${detailed ? 'detail' : '1. - detail'};
      float rank = bladeStyle.w;
      float growth = smoothstep(rank - ${LOD_FEATHER}, rank + ${LOD_FEATHER}, fill * ${LOD_WEIGHT} - ${LOD_FEATHER});
      float y = position.y;
      vec2 yaw = bladeStyle.xy * 2. - 1.;
      vec2 span = vec2(position.x * yaw.x - position.z * yaw.y,
                       position.x * yaw.y + position.z * yaw.x);
      ${detailed ? 'span += vec2(.47, .25) * sin(grassWind * 1.7 + worldRoot.x * .32 + worldRoot.z * .44) * y * y;' : ''}
      float width = bladeStyle.z * .2 * ${GRASS_PRESET.width / 100};
      float height = bladeRoot.w * ${GRASS_PRESET.height / 100};
      vec2 lean = vec2(-yaw.y, yaw.x) * (y * y * height * .26);
      vec2 offset = span * width + lean + slope * (.26 * y * height);
      transformed = root + vec3(offset.x, y * height, offset.y) * growth;
      grassColor = bladeColor * mix(.64, 1.10, sqrt(y));
    `)
    shader.fragmentShader = `
      varying vec3 grassColor;
    ` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      diffuseColor.rgb *= grassColor;
    `)
    // A blade's two faces share canopy lighting. Turning the back normal down
    // would make thin blades flash as they sway past the camera.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
      #include <normal_fragment_begin>
      normal *= faceDirection;
    `)
  }
  material.customProgramCacheKey = () => detailed ? 'meadow-blade-detailed' : 'meadow-blade-distant'
  return material
}

export class GrassField extends THREE.Group {
  private wind = { value: 0 }
  private detailTiles: THREE.Mesh<THREE.InstancedBufferGeometry>[] = []
  private distantTiles: THREE.Mesh<THREE.InstancedBufferGeometry>[] = []
  private lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity)
  private tileCenter = new THREE.Vector3()
  private range: number

  constructor(private compact: boolean) {
    super()
    this.name = 'meadow-grass-blades'
    this.range = compact ? 36 : 46
  }

  async prepare(ground: THREE.PlaneGeometry, cancelled: () => boolean) {
    await this.plant(ground, true, cancelled)
    if (!cancelled()) await this.plant(ground, false, cancelled)
  }

  private async plant(ground: THREE.PlaneGeometry, detailed: boolean, cancelled: () => boolean) {
    const random = meadowRandom(detailed ? 951847 : 715419)
    const material = bladeMaterial(this.wind, this.range, detailed)
    const positions = ground.getAttribute('position')
    const normals = ground.getAttribute('normal')
    const colors = ground.getAttribute('color').array
    const { width, height, widthSegments, heightSegments } = ground.parameters
    const stride = widthSegments + 1
    const cellWidth = width / widthSegments, cellDepth = height / heightSegments
    const tileSize = detailed ? TILE : DISTANT_TILE
    const extentX = detailed ? FIELD_X : TERRAIN_EXTENT
    const back = detailed ? FIELD_BACK : -TERRAIN_EXTENT
    const front = detailed ? FIELD_FRONT : TERRAIN_EXTENT
    const density = (detailed ? (this.compact ? 80 : 125) : (this.compact ? 9 : 13))
      * (detailed ? GRASS_PRESET.nearDensity : GRASS_PRESET.farDensity) / 100
    const placementOrders = new Map<number, Uint16Array>()
    let deadline = performance.now() + 7

    // Curved blades follow the camera route. The simpler layer reaches every ridge.
    for (let z = back; z < front; z += tileSize) for (let x = -extentX; x < extentX; x += tileSize) {
      if (cancelled()) return
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

      const geometry = new THREE.InstancedBufferGeometry()
      geometry.setAttribute('position', detailed ? ribbon : distantBlade)
      geometry.setAttribute('normal', bladeNormals)
      if (detailed) geometry.setIndex(ribbonIndices)
      geometry.setAttribute('bladeRoot', new THREE.InstancedBufferAttribute(roots, 4, true))
      const bladeAppearance = new THREE.InstancedInterleavedBuffer(appearance, 9)
      geometry.setAttribute('bladeStyle', new THREE.InterleavedBufferAttribute(bladeAppearance, 4, 0, true))
      geometry.setAttribute('bladeSlope', new THREE.InterleavedBufferAttribute(bladeAppearance, 2, 4, true))
      geometry.setAttribute('bladeColor', new THREE.InterleavedBufferAttribute(bladeAppearance, 3, 6, true))
      geometry.instanceCount = count
      geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(0, (minY + maxY) / 2, 0),
        Math.hypot(tileSize / 2 + .55, tileSize / 2 + .55, (maxY - minY) / 2 + 1.1),
      )

      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(centerX, 0, centerZ)
      mesh.receiveShadow = detailed && Math.abs(centerX) < 20 && Math.abs(centerZ) < 20
      if (detailed) this.detailTiles.push(mesh)
      else this.distantTiles.push(mesh)
      this.add(mesh)
      if (performance.now() > deadline) {
        await timeSlice()
        deadline = performance.now() + 7
      }
    }
  }

  update(camera: THREE.Camera, time: number) {
    this.wind.value = time
    if (camera.position.distanceToSquared(this.lastPosition) < .09) return
    this.lastPosition.copy(camera.position)
    for (const tile of this.detailTiles) {
      const { center, radius } = tile.geometry.boundingSphere!
      const nearest = Math.max(0, this.tileCenter.copy(center).add(tile.position).distanceTo(camera.position) - radius - .35)
      const coverage = 1 - THREE.MathUtils.smoothstep(nearest, this.range * .57, this.range)
      this.limitBlades(tile, coverage)
      const coarse = nearest > (this.compact ? 17 : 21)
      const simple = nearest > (this.compact ? 7 : 9)
      const indices = coarse ? distantIndices : simple ? middleIndices : ribbonIndices
      if (tile.geometry.index !== indices) {
        tile.geometry.setIndex(indices)
        tile.geometry.setAttribute('position', coarse ? distantBlade : simple ? middleRibbon : ribbon)
      }
    }
    for (const tile of this.distantTiles) {
      const { center, radius } = tile.geometry.boundingSphere!
      const distance = this.tileCenter.copy(center).add(tile.position).distanceTo(camera.position)
      const farthest = distance + radius + .35
      const half = DISTANT_TILE / 2
      const edge = THREE.MathUtils.smoothstep(FIELD_X - Math.abs(tile.position.x) - half, 0, FIELD_EDGE)
        * THREE.MathUtils.smoothstep(tile.position.z - half, FIELD_BACK, FIELD_BACK + FIELD_EDGE)
        * (1 - THREE.MathUtils.smoothstep(tile.position.z + half, FIELD_FRONT - FIELD_EDGE, FIELD_FRONT))
      const detail = (1 - THREE.MathUtils.smoothstep(farthest, this.range * .57, this.range)) * edge
      this.limitBlades(tile, distance - radius < MEADOW_FOG_FAR ? 1 - detail : 0)
    }
  }

  private limitBlades(tile: THREE.Mesh<THREE.InstancedBufferGeometry>, coverage: number) {
    // Instances are stored in rank order, so the shader's fully hidden suffix never needs drawing.
    const limit = Math.min(1, coverage * LOD_WEIGHT + 1 / 255)
    const capacity = tile.geometry.getAttribute('bladeRoot').count
    tile.geometry.instanceCount = Math.ceil(capacity * limit)
    tile.visible = coverage > 0
  }
}
