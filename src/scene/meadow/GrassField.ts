import * as THREE from 'three'
import { TERRAIN_EXTENT, TURF_GREEN, TURF_OLIVE, meadowRandom, turfTone } from './terrain'

const TILE = 8
const DISTANT_TILE = 16
const FIELD_X = 40
const FIELD_BACK = -32
const FIELD_FRONT = 88
const timeSlice = () => new Promise<void>(resolve => requestAnimationFrame(() => window.setTimeout(resolve, 0)))

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
      diffuseColor.rgb *= .89 + fine * mix(.07, .34, detail) + broad * mix(.31, .17, detail);
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
const distantBlade = new THREE.Float32BufferAttribute([-.48, 0, 0, .48, 0, 0, .11, 1, 1.1], 3)
const bladeNormals = new THREE.Float32BufferAttribute(Array.from({ length: ribbon.count }, () => [0, 1, 0]).flat(), 3)

function bladeMaterial(wind: { value: number }, distance: number, detailed: boolean) {
  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
  material.onBeforeCompile = shader => {
    shader.uniforms.grassWind = wind
    shader.uniforms.grassRange = { value: distance }
    shader.uniforms.grassGreen = { value: TURF_GREEN }
    shader.uniforms.grassOlive = { value: TURF_OLIVE }
    shader.vertexShader = `
      attribute vec4 bladeRoot;
      attribute vec4 bladeStyle;
      attribute vec2 bladeSlope;
      uniform float grassWind;
      uniform float grassRange;
      varying float bladeTone;
      varying float bladeShade;
    ` + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      #include <beginnormal_vertex>
      objectNormal = normalize(vec3(bladeSlope.x, .92, bladeSlope.y));
    `)
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 root = bladeRoot.xyz;
      float distance = length(cameraPosition - (modelMatrix * vec4(root, 1.)).xyz);
      float detail = 1. - smoothstep(grassRange * .57, grassRange, distance);
      detail *= smoothstep(0., 7., ${FIELD_X}. - abs(root.x))
        * smoothstep(${FIELD_BACK}., ${FIELD_BACK + 7}., root.z)
        * (1. - smoothstep(${FIELD_FRONT - 7}., ${FIELD_FRONT}., root.z));
      float growth = ${detailed ? 'detail' : 'smoothstep(.02, .66, 1. - detail)'};
      float y = position.y;
      vec2 span = vec2(position.x * bladeStyle.x - position.z * bladeStyle.y,
                       position.x * bladeStyle.y + position.z * bladeStyle.x);
      ${detailed ? 'span += vec2(.47, .25) * sin(grassWind * 1.7 + root.x * .32 + root.z * .44) * y * y;' : ''}
      transformed = root + vec3(span.x * bladeStyle.z, y * bladeRoot.w, span.y * bladeStyle.z) * growth;
      bladeTone = bladeStyle.w;
      bladeShade = ${detailed ? 'mix(.89, mix(.59, 1.13, sqrt(y)), detail)' : 'mix(.73, 1.04, sqrt(y))'};
    `)
    shader.fragmentShader = `
      uniform vec3 grassGreen;
      uniform vec3 grassOlive;
      varying float bladeTone;
      varying float bladeShade;
    ` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      diffuseColor.rgb *= mix(grassGreen, grassOlive, bladeTone) * bladeShade;
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
  private lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity)
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
    const { width, height, widthSegments, heightSegments } = ground.parameters
    const stride = widthSegments + 1
    const cellWidth = width / widthSegments, cellDepth = height / heightSegments
    const tileSize = detailed ? TILE : DISTANT_TILE
    const extentX = detailed ? FIELD_X : TERRAIN_EXTENT
    const back = detailed ? FIELD_BACK : -TERRAIN_EXTENT
    const front = detailed ? FIELD_FRONT : TERRAIN_EXTENT
    let deadline = performance.now() + 7

    // Curved blades follow the camera route. The simpler layer reaches every ridge.
    for (let z = back; z < front; z += tileSize) for (let x = -extentX; x < extentX; x += tileSize) {
      if (cancelled()) return
      const centerX = x + tileSize / 2, centerZ = z + tileSize / 2
      const foreground = Math.abs(centerX) <= 20 && centerZ >= -12
      const density = detailed
        ? foreground ? (this.compact ? 88 : 150) : (this.compact ? 32 : 52)
        : this.compact ? 9 : 13
      const cells = Math.floor(tileSize * Math.sqrt(density))
      const count = cells * cells
      const roots = new Float32Array(count * 4)
      const styles = new Float32Array(count * 4)
      const slopes = new Int8Array(count * 2)
      let minY = Infinity, maxY = -Infinity

      for (let index = 0; index < count; index++) {
        const px = x + (index % cells + random()) * tileSize / cells
        const pz = z + (Math.floor(index / cells) + random()) * tileSize / cells
        const gx = (px + width / 2) / cellWidth, gz = (pz + height / 2) / cellDepth
        const ix = Math.floor(gx), iz = Math.floor(gz)
        const u = gx - ix, v = gz - iz
        const corner = iz * stride + ix
        const a = positions.getY(corner), b = positions.getY(corner + stride)
        const d = positions.getY(corner + 1), c = positions.getY(corner + stride + 1)
        // Match the two triangles of the rendered surface so roots never float.
        const y = u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)

        const tone = turfTone(px, y, pz)
        const yaw = random() * Math.PI * 2
        const offset = index * 4
        roots[offset] = px
        roots[offset + 1] = y - .013
        roots[offset + 2] = pz
        const lengthVariation = random() ** 1.65
        roots[offset + 3] = detailed ? .12 + .095 * tone + .24 * lengthVariation : .21 + .1 * tone + .28 * lengthVariation
        styles[offset] = Math.cos(yaw)
        styles[offset + 1] = Math.sin(yaw)
        const widthVariation = random()
        styles[offset + 2] = (detailed ? .036 + .034 * widthVariation : .08 + .062 * widthVariation) * (this.compact ? 1.1 : 1)
        styles[offset + 3] = THREE.MathUtils.clamp(tone + (random() - .5) * (detailed ? .57 : .39), 0, 1)
        const normal = Math.round(gz) * stride + Math.round(gx)
        slopes[index * 2] = Math.round(normals.getX(normal) * 127)
        slopes[index * 2 + 1] = Math.round(normals.getZ(normal) * 127)
      }

      const geometry = new THREE.InstancedBufferGeometry()
      geometry.setAttribute('position', detailed ? ribbon : distantBlade)
      geometry.setAttribute('normal', bladeNormals)
      if (detailed) geometry.setIndex(ribbonIndices)
      geometry.setAttribute('bladeRoot', new THREE.InstancedBufferAttribute(roots, 4))
      geometry.setAttribute('bladeStyle', new THREE.InstancedBufferAttribute(styles, 4))
      geometry.setAttribute('bladeSlope', new THREE.InstancedBufferAttribute(slopes, 2, true))
      geometry.instanceCount = count
      geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(centerX, (minY + maxY) / 2, centerZ),
        Math.hypot(tileSize / 2 + .25, tileSize / 2 + .25, (maxY - minY) / 2 + .65),
      )

      const mesh = new THREE.Mesh(geometry, material)
      mesh.receiveShadow = detailed && Math.abs(centerX) < 20 && Math.abs(centerZ) < 20
      if (detailed) this.detailTiles.push(mesh)
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
      tile.visible = center.distanceToSquared(camera.position) < (this.range + radius + .35) ** 2
    }
  }
}
