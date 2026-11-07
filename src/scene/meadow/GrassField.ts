import * as THREE from 'three'
import { FLOWER_DRIFTS, FLOWER_TINTS, flowerDrift, meadowRandom, terrainHeight, TERRAIN_EXTENT } from './terrain'

const TILE = 8
const up = new THREE.Vector3(0, 1, 0)
const timeSlice = () => new Promise<void>(resolve => requestAnimationFrame(() => window.setTimeout(resolve, 0)))
const softenGrassColor = `
  float luminance = dot(texel.rgb, vec3(.2126, .7152, .0722));
  texel.rgb = mix(texel.rgb, luminance * vec3(.92, 1.01, .76), .84);
  diffuseColor *= texel;
`

export async function meadowTextures() {
  const loader = new THREE.TextureLoader()
  const results = await Promise.allSettled([
    loader.loadAsync(`${import.meta.env.BASE_URL}grass-ground.jpg`),
    loader.loadAsync(`${import.meta.env.BASE_URL}grass-atlas.png`),
  ])
  if (results.some(result => result.status === 'rejected')) {
    for (const result of results) if (result.status === 'fulfilled') result.value.dispose()
    throw new Error('Meadow textures could not be loaded')
  }
  const [ground, atlas] = results.map(result => (result as PromiseFulfilledResult<THREE.Texture>).value)
  for (const map of [ground, atlas]) {
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    map.minFilter = THREE.LinearMipmapLinearFilter
    map.magFilter = THREE.LinearFilter
  }
  ground.wrapS = ground.wrapT = THREE.RepeatWrapping
  ground.repeat.set(38.4, 38.4)
  return { ground, atlas }
}

export function grassGroundMaterial(map: THREE.Texture) {
  const material = new THREE.MeshStandardMaterial({
    map, vertexColors: true, roughness: 1, metalness: 0,
    bumpMap: map, bumpScale: .038,
  })
  // Two differently oriented samples hide repetition; mipmaps filter the fine blades.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec4 groundA = texture2D(map, vMapUv);
      vec4 groundB = texture2D(map, vec2(vMapUv.y, -vMapUv.x)*.83 + vec2(.37,.61));
      vec4 texel = mix(groundA, groundB, .38);
      ${softenGrassColor}
    `)
  }
  material.customProgramCacheKey = () => 'meadow-textured-ground-v3'
  return material
}

function atlasBounds(texture: THREE.Texture) {
  const image = texture.image as HTMLImageElement
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const { data } = context.getImageData(0, 0, image.width, image.height)
  const bounds: THREE.Vector4[] = []
  for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
    const x0 = Math.floor(column * image.width / 2), x1 = Math.floor((column + 1) * image.width / 2)
    const y0 = Math.floor(row * image.height / 2), y1 = Math.floor((row + 1) * image.height / 2)
    let left = x1, right = x0, top = y1, bottom = y0
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (data[(y * image.width + x) * 4 + 3] < 190) continue
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
    }
    if (left > right) { left = x0; right = x1 - 1; top = y0; bottom = y1 - 1 }
    left = Math.max(x0, left - 3); right = Math.min(x1 - 1, right + 3)
    top = Math.max(y0, top - 3); bottom = Math.min(y1 - 1, bottom + 3)
    bounds.push(new THREE.Vector4(left / image.width, 1 - bottom / image.height,
      (right - left) / image.width, (bottom - top) / image.height))
  }
  return bounds
}

function patchGeometry(cards: number) {
  const positions: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = []
  for (let i = 0; i < cards; i++) {
    const angle = i * Math.PI / cards
    const c = Math.cos(angle), s = Math.sin(angle), start = positions.length / 3
    for (const [x, y] of [[-.5, 0], [.5, 0], [-.5, 1], [.5, 1]]) {
      positions.push(c*x + s*y*.13, y, s*x - c*y*.13)
      // Canopy lighting, shared by both faces, avoids alternating dark crossed cards.
      normals.push(0, 1, 0)
      uv.push(x + .5, y)
    }
    indices.push(start, start+1, start+2, start+1, start+3, start+2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  return geometry
}

export class GrassField extends THREE.Group {
  private wind = { value: 0 }
  private tiles: THREE.InstancedMesh[] = []
  private nearGeometry = patchGeometry(3)
  private farGeometry = patchGeometry(2)
  private lastPosition = new THREE.Vector2(Infinity, Infinity)
  private material: THREE.MeshLambertMaterial

  constructor(atlas: THREE.Texture, private compact: boolean) {
    super()
    this.name = 'dense-meadow-grass'
    this.material = new THREE.MeshLambertMaterial({
      map: atlas, side: THREE.DoubleSide, alphaTest: .58, alphaToCoverage: true,
      color: '#ccd7c2',
    })
    const bounds = { value: atlasBounds(atlas) }
    this.material.onBeforeCompile = shader => {
      shader.uniforms.grassWind = this.wind
      shader.uniforms.grassBounds = bounds
      shader.vertexShader = 'uniform float grassWind;\nuniform vec4 grassBounds[4];\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
        #include <uv_vertex>
        vec4 patchBounds = grassBounds[int(mod(float(gl_InstanceID), 4.))];
        vMapUv = patchBounds.xy + uv * patchBounds.zw;
      `)
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 root = instanceMatrix[3].xyz;
        float breeze = sin(grassWind*.85 + root.x*.18 + root.z*.21);
        transformed.x += breeze * position.y * position.y * .055;
        transformed.z += cos(grassWind*.63 + root.z*.27) * position.y * position.y * .035;
      `)
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        #ifdef DOUBLE_SIDED
          normal *= faceDirection;
        #endif
      `)
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        vec4 texel = texture2D(map, vMapUv);
        ${softenGrassColor}
      `)
    }
    this.material.customProgramCacheKey = () => 'dense-grass-atlas-v3'
  }

  async prepare(cancelled: () => boolean) {
    const random = meadowRandom(951847)
    const pose = new THREE.Object3D(), normal = new THREE.Vector3()
    const yaw = new THREE.Quaternion(), color = new THREE.Color()
    let deadline = performance.now() + 7
    for (let z = -TERRAIN_EXTENT; z < TERRAIN_EXTENT; z += TILE) for (let x = -TERRAIN_EXTENT; x < TERRAIN_EXTENT; x += TILE) {
      if (cancelled()) return
      const centerX = x+TILE/2, centerZ = z+TILE/2
      const approach = Math.abs(centerX) < 30 && centerZ > -30 && centerZ < 70
      const capacity = approach ? (this.compact ? 820 : 1230) : (this.compact ? 540 : 820)
      const mesh = new THREE.InstancedMesh(this.farGeometry, this.material, capacity)
      const drifts = FLOWER_DRIFTS.filter(drift =>
        Math.hypot(drift.x - centerX, drift.z - centerZ) < drift.width * 1.3 + TILE,
      )
      let minY = Infinity, maxY = -Infinity
      for (let i = 0; i < capacity; i++) {
        const px = x + random()*TILE, pz = z + random()*TILE
        const y = terrainHeight(px, pz)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
        const slopeStep = .12
        normal.set(y - terrainHeight(px+slopeStep, pz), slopeStep, y - terrainHeight(px, pz+slopeStep)).normalize()
        yaw.setFromAxisAngle(up, random()*Math.PI*2)
        pose.quaternion.setFromUnitVectors(up, normal).multiply(yaw)
        const patch = .5 + Math.sin(px*.53 + pz*.21) * Math.cos(pz*.42 - px*.16) * .5
        const width = (.54 + random()*.35) * (approach ? 1 : 1.21) * (this.compact ? 1.14 : 1)
        const length = .15 + random()*.22 + patch*.11
        pose.scale.set(width, length, width)
        pose.position.set(px, y-.045, pz)
        pose.updateMatrix()
        mesh.setMatrixAt(i, pose.matrix)
        const tone = .62 + patch*.25 + random()*.13
        color.setRGB(tone * (1.03 - patch*.08), tone, tone * (.89 + patch*.13))
        for (const drift of drifts) {
          const bloom = flowerDrift(drift, px, pz)
          if (bloom > 0) color.lerp(FLOWER_TINTS[drift.species], bloom * .85)
        }
        mesh.setColorAt(i, color)
      }
      mesh.receiveShadow = Math.abs(centerX) < 20 && Math.abs(centerZ) < 20
      mesh.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(centerX, (minY + maxY) / 2, centerZ),
        Math.hypot(TILE / 2 + 1, TILE / 2 + 1, (maxY - minY) / 2 + 1),
      )
      this.tiles.push(mesh)
      this.add(mesh)
      if (performance.now() > deadline) {
        await timeSlice()
        deadline = performance.now() + 7
      }
    }
  }

  update(camera: THREE.Camera, time: number) {
    this.wind.value = time
    const { x, z } = camera.position
    if (Math.hypot(x-this.lastPosition.x, z-this.lastPosition.y) < .35) return
    this.lastPosition.set(x, z)
    for (const tile of this.tiles) {
      const center = tile.boundingSphere!.center
      tile.geometry = Math.hypot(center.x-x, center.z-z) < 30 ? this.nearGeometry : this.farGeometry
    }
  }

  disposeUnusedGeometries() {
    // One LOD geometry can be unreferenced when a scene is disposed during loading.
    this.nearGeometry.dispose()
    this.farGeometry.dispose()
    this.material.map?.dispose()
    this.material.dispose()
  }
}
