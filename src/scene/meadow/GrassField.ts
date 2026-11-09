import * as THREE from 'three'
import { MEADOW_FOG_FAR } from './terrain'
import { GRASS_PRESET } from './grassSettings'

import {
  GRASS_TILE as TILE, DISTANT_GRASS_TILE as DISTANT_TILE, GRASS_EXTENT_X as FIELD_X,
  GRASS_BACK as FIELD_BACK, GRASS_FRONT as FIELD_FRONT, ROOT_HEIGHT_RANGE, type GrassTileData,
} from './meadowData'
const FIELD_EDGE = 7
const LOD_FEATHER = .11
const LOD_WEIGHT = 1 + LOD_FEATHER * 2

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
  private detailLods = new Map<THREE.Mesh<THREE.InstancedBufferGeometry>, THREE.InstancedBufferGeometry[]>()
  private lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity)
  private tileCenter = new THREE.Vector3()
  private range: number
  private detailMaterial: THREE.MeshLambertMaterial
  private distantMaterial: THREE.MeshLambertMaterial

  constructor(private compact: boolean, private transmissionFrustum: THREE.Frustum) {
    super()
    this.name = 'meadow-grass-blades'
    this.range = compact ? 36 : 46
    this.detailMaterial = bladeMaterial(this.wind, this.range, true)
    this.distantMaterial = bladeMaterial(this.wind, this.range, false)
  }

  prepare(tiles: GrassTileData[]) {
    for (const { detailed, centerX, centerZ, minY, maxY, roots, appearance } of tiles) {
      const count = roots.length / 4
      const tileSize = detailed ? TILE : DISTANT_TILE
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

      const mesh = new THREE.Mesh(geometry, detailed ? this.detailMaterial : this.distantMaterial)
      let transmissionCount: number | null = null
      mesh.onBeforeRender = renderer => {
        // The auxiliary transmission pass only needs grass behind the glass key's screen region.
        if (renderer.toneMapping === THREE.NoToneMapping && !this.transmissionFrustum.intersectsObject(mesh)) {
          transmissionCount = mesh.geometry.instanceCount
          mesh.geometry.instanceCount = 0
        }
      }
      mesh.onAfterRender = () => {
        if (transmissionCount === null) return
        mesh.geometry.instanceCount = transmissionCount
        transmissionCount = null
      }
      mesh.position.set(centerX, 0, centerZ)
      mesh.receiveShadow = detailed && Math.abs(centerX) < 20 && Math.abs(centerZ) < 20
      if (detailed) {
        const variants = [geometry]
        for (const [position, indices] of [[middleRibbon, middleIndices], [distantBlade, distantIndices]]) {
          const lod = new THREE.InstancedBufferGeometry()
          for (const [name, attribute] of Object.entries(geometry.attributes)) lod.setAttribute(name, attribute)
          lod.setAttribute('position', position)
          lod.setIndex(indices)
          lod.boundingSphere = geometry.boundingSphere
          lod.instanceCount = count
          variants.push(lod)
        }
        this.detailLods.set(mesh, variants)
        this.detailTiles.push(mesh)
      } else this.distantTiles.push(mesh)
      this.add(mesh)
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
      const geometry = this.detailLods.get(tile)![coarse ? 2 : simple ? 1 : 0]
      geometry.instanceCount = tile.geometry.instanceCount
      tile.geometry = geometry
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

  prepareRenderLods(render: () => void) {
    const originals = this.detailTiles.map(tile => tile.geometry)
    try {
      for (let level = 0; level < 3; level++) {
        for (const [tile, variants] of this.detailLods) {
          variants[level].instanceCount = tile.geometry.instanceCount
          tile.geometry = variants[level]
        }
        render()
      }
    } finally {
      this.detailTiles.forEach((tile, index) => { tile.geometry = originals[index] })
    }
  }

  disposeLods() {
    for (const variants of this.detailLods.values()) for (const geometry of variants) geometry.dispose()
    this.detailLods.clear()
  }

  private limitBlades(tile: THREE.Mesh<THREE.InstancedBufferGeometry>, coverage: number) {
    // Instances are stored in rank order, so the shader's fully hidden suffix never needs drawing.
    const limit = Math.min(1, coverage * LOD_WEIGHT + 1 / 255)
    const capacity = tile.geometry.getAttribute('bladeRoot').count
    tile.geometry.instanceCount = Math.ceil(capacity * limit)
    tile.visible = coverage > 0
  }
}
