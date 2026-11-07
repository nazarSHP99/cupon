import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { TABLE_DEPTH, TABLE_WIDTH } from './sceneLayout'
import { GrassField, grassGroundMaterial, meadowTextures } from './GrassField'

const GROUND = -5.04
const sun = new THREE.Vector3(-12, 19.5, 8).normalize()

function randomSource() {
  let seed = 381413
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function height(x: number, z: number) {
  const radius = Math.hypot(x / 12.5, z / 11.3)
  const slope = THREE.MathUtils.smoothstep(radius, .5, 1.55)
  const swells = Math.sin(x * .139 + z * .059) * Math.cos(z * .143 - .7) * 1.55
    + Math.cos(x * .064 - z * .081) * 1.01
  const mounds = 2.05 * Math.exp(-(((x + 13) / 7.5) ** 2 + ((z - 17) / 9) ** 2))
    + 2.15 * Math.exp(-(((x - 16) / 10) ** 2 + ((z - 8) / 14) ** 2))
    + 2.35 * Math.exp(-(((x - 12) / 11) ** 2 + ((z - 33) / 7) ** 2))
    + 4.7 * Math.exp(-(((x + 24) / 16) ** 2 + ((z + 31) / 15) ** 2))
    + 5.8 * Math.exp(-(((x - 22) / 19) ** 2 + ((z + 46) / 18) ** 2))
    + 3.8 * Math.exp(-(((x + 49) / 21) ** 2 + ((z + 61) / 17) ** 2))
  return THREE.MathUtils.lerp(GROUND, -8.5 + swells + mounds, slope)
}

function sky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sun: { value: sun }, drift: { value: 0 } },
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      uniform vec3 sun;
      uniform float drift;
      varying vec3 direction;
      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                   mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
      }
      float detail(vec2 p) {
        return noise(p)*.56 + noise(p*2.07+11.)*.25
             + noise(p*4.19-7.)*.125 + noise(p*8.71)*.065;
      }
      float clouds(vec2 p) {
        return detail(p) + .21 * noise(p*.47+vec2(9.,4.));
      }
      void main() {
        vec3 ray = normalize(direction);
        float elev = max(ray.y + .075, 0.);
        float blue = pow(clamp(elev * 1.9, 0., 1.), .48);
        float warmth = pow(max(dot(ray, sun), 0.), 25.);
        vec3 color = mix(vec3(.35,.73,.92), vec3(.012,.16,.38), blue);
        color += warmth * vec3(.17,.12,.046);
        vec2 p = ray.xz / (.34 + elev) * 3.1 + vec2(5.21 + drift, 1.14);
        p += vec2(noise(p*1.4), noise(p*1.4+7.)) * .19;
        float density = clouds(p);
        float cover = smoothstep(.59,.735,density) * smoothstep(.003,.035,elev);
        float shade = smoothstep(-.105,.075,density - clouds(p + vec2(-.21,.19)) + .024);
        vec3 cloud = mix(vec3(.52,.67,.80), vec3(1.,.99,.96), shade);
        cloud = mix(cloud, vec3(.85,.92,.98), (1.-smoothstep(0.,.22,elev))*.16);
        float rim = max(0., smoothstep(.55,.67,density) - cover) * smoothstep(.01,.045,elev);
        color = mix(color, cloud, cover*.995);
        color += rim * warmth * vec3(.18,.136,.058);
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }`,
  })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(146, 32, 16), material)
  dome.renderOrder = -10
  dome.frustumCulled = false
  return dome
}

const timeSlice = () => new Promise<void>(resolve => {
  requestAnimationFrame(() => window.setTimeout(resolve, 0))
})

function woodTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 192
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(canvas.width, canvas.height)
  const random = randomSource()
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const knotX = (x - 489) * .29
    const knotY = (y - 103) * 1.17
    const knot = Math.exp(-(knotX * knotX + knotY * knotY) / 610)
    const flow = y + 4 * Math.sin(x * .012 + y * .028) + 8 * Math.sin(x * .004 + y * .051)
      + 17 * knot * Math.tanh(knotY * .1)
    const grain = Math.sin(flow * 1.59) * 3 + Math.sin(flow * .34) * 7 + Math.sin(flow * .088 + x * .003) * 9
    const tone = grain * .58 - knot * 13 + (random() - .5) * 4
    const i = (y * canvas.width + x) * 4
    pixels.data[i] = 168 + tone
    pixels.data[i + 1] = 132 + tone * .84
    pixels.data[i + 2] = 90 + tone * .63
    pixels.data[i + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  return map
}

export function woodenTable() {
  const table = new THREE.Group()
  const map = woodTexture()
  const wood = (size: [number, number, number], position: [number, number, number], color: string, radius: number) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, radius), new THREE.MeshStandardMaterial({ color, map, roughness: .71 }))
    mesh.position.set(...position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    table.add(mesh)
    return mesh
  }
  for (let i = 0; i < 5; i++) {
    const plankDepth = TABLE_DEPTH / 5
    wood([TABLE_WIDTH, .27, plankDepth - .012], [0, -2.375, (i - 2) * plankDepth], ['#e4c5a4', '#fff2d8', '#f1d6b5', '#edc8a0', '#f7dfc3'][i], .043)
  }
  const legX = TABLE_WIDTH / 2 - .7
  const legZ = TABLE_DEPTH / 2 - .75
  for (const z of [-legZ, legZ]) wood([TABLE_WIDTH - .62, .4, .2], [0, -2.67, z], '#b99371', .028)
  for (const x of [-legX, legX]) {
    wood([.22, .4, legZ * 2 + .2], [x, -2.67, 0], '#c49d79', .028)
    for (const z of [-legZ, legZ]) {
      const leg = wood([2.57, .47, .44], [x, -3.78, z], '#d9b695', .035)
      leg.rotation.z = Math.PI / 2 + Math.sign(x) * .055
    }
  }
  return table
}

export class Meadow extends THREE.Group {
  private dome = sky()
  private grass: GrassField | null = null

  constructor(private compact: boolean) {
    super()
    this.add(this.dome)
  }

  async prepare(cancelled: () => boolean) {
    await timeSlice()
    if (cancelled()) return
    const maps = await meadowTextures()
    if (cancelled()) { maps.ground.dispose(); maps.atlas.dispose(); return }
    const ground = new THREE.PlaneGeometry(192, 192, 208, 208).rotateX(-Math.PI / 2)
    const vertices = ground.getAttribute('position')
    const colors = new Float32Array(vertices.count * 3)
    const deep = new THREE.Color('#c7d4bb')
    const light = new THREE.Color('#ffffff')
    const color = new THREE.Color()
    let deadline = performance.now() + 7
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), z = vertices.getZ(i)
      const y = height(x, z)
      vertices.setY(i, y)
      const variation = THREE.MathUtils.clamp(.46 + (y + 7) * .099
        + Math.sin(x * .18 + z * .13) * .06 + Math.sin(x * .09 - z * .11) * .09, .06, .94)
      color.copy(deep).lerp(light, variation).toArray(colors, i * 3)
      if (i % 1024 === 0 && performance.now() > deadline) {
        await timeSlice()
        if (cancelled()) { ground.dispose(); maps.ground.dispose(); maps.atlas.dispose(); return }
        deadline = performance.now() + 7
      }
    }
    ground.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    ground.computeVertexNormals()
    const field = new THREE.Mesh(ground, grassGroundMaterial(maps.ground))
    field.receiveShadow = true
    field.name = 'textured-meadow-ground'
    this.add(field)
    try { this.grass = new GrassField(maps.atlas, this.compact) }
    catch (error) { maps.atlas.dispose(); throw error }
    this.add(this.grass)
    await this.grass.prepare(height, cancelled)
  }

  update(camera: THREE.Camera, time: number) {
    this.dome.position.copy(camera.position)
    this.dome.material.uniforms.drift.value = time * .013
    this.grass?.update(camera, time)
  }

  dispose() {
    this.grass?.disposeUnusedGeometries()
  }
}
