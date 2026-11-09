import * as THREE from 'three'
import { GrassField, grassGroundMaterial, meadowGroundTexture } from './GrassField'
import { generateMeadowData, type MeadowData } from './meadowData'
import { wildflowers } from './Wildflowers'

const sun = new THREE.Vector3(-15, 12, 8).normalize()

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
        float blue = pow(smoothstep(0., .62, elev), .66);
        float lightSide = smoothstep(-.12, .78, -ray.x);
        float warmth = pow(max(dot(ray, sun), 0.), 6.);
        vec3 horizon = mix(vec3(.84,.62,.74), vec3(.97,.77,.66), lightSide);
        vec3 color = mix(horizon, vec3(.28,.43,.67), blue);
        color += warmth * vec3(.1,.072,.035);
        vec2 p = ray.xz / (.34 + elev) * vec2(1.8,4.2) + vec2(5.21 + drift, 1.14);
        p += vec2(noise(p*1.4), noise(p*1.4+7.)) * .19;
        float density = clouds(p);
        float cover = smoothstep(.60,.82,density) * smoothstep(.003,.055,elev);
        float shade = smoothstep(-.105,.075,density - clouds(p + vec2(-.21,.19)) + .024);
        vec3 cloud = mix(vec3(.55,.48,.66), vec3(1.,.89,.78), shade);
        cloud = mix(cloud, horizon, (1.-smoothstep(0.,.24,elev))*.21);
        float rim = max(0., smoothstep(.55,.67,density) - cover) * smoothstep(.01,.045,elev);
        color = mix(color, cloud, cover*.68);
        color += rim * warmth * vec3(.048,.039,.02);
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

export class Meadow extends THREE.Group {
  private dome = sky()
  private grass: GrassField | null = null
  private cancelBuild: (() => void) | null = null

  constructor(private compact: boolean, private transmissionFrustum: THREE.Frustum) {
    super()
    this.add(this.dome)
  }

  async prepare(cancelled: () => boolean) {
    const [map, data] = await Promise.all([meadowGroundTexture(), this.buildData(cancelled)])
    if (cancelled() || !data) { map.dispose(); return }
    const ground = new THREE.BufferGeometry()
    ground.setAttribute('position', new THREE.BufferAttribute(data.ground.position, 3))
    ground.setAttribute('normal', new THREE.BufferAttribute(data.ground.normal, 3))
    ground.setAttribute('uv', new THREE.BufferAttribute(data.ground.uv, 2))
    ground.setAttribute('color', new THREE.BufferAttribute(data.ground.color, 3))
    ground.setIndex(new THREE.BufferAttribute(data.ground.index, 1))
    const field = new THREE.Mesh(ground, grassGroundMaterial(map))
    field.receiveShadow = true
    field.name = 'textured-meadow-ground'
    this.add(field)
    this.grass = new GrassField(this.compact, this.transmissionFrustum)
    this.add(this.grass)
    this.grass.prepare(data.tiles)
    if (!cancelled()) this.add(wildflowers(this.compact))
  }

  private async buildData(cancelled: () => boolean): Promise<MeadowData | null> {
    try {
      return await new Promise<MeadowData | null>((resolve, reject) => {
        const worker = new Worker(new URL('./meadow.worker.ts', import.meta.url), { type: 'module' })
        this.cancelBuild = () => { worker.terminate(); resolve(null) }
        worker.onmessage = (event: MessageEvent<MeadowData>) => {
          worker.terminate()
          this.cancelBuild = null
          resolve(event.data)
        }
        worker.onerror = event => {
          event.preventDefault()
          worker.terminate()
          this.cancelBuild = null
          reject(new Error('Meadow worker unavailable'))
        }
        worker.postMessage(this.compact)
      })
    } catch {
      // Keep the scene usable in browsers that prevent workers from starting.
      if (cancelled()) return null
      const generation = generateMeadowData(this.compact)
      const tiles: MeadowData['tiles'] = []
      let deadline = performance.now() + 7
      let result = generation.next()
      while (!result.done) {
        if (cancelled()) return null
        tiles.push(result.value)
        if (performance.now() > deadline) {
          await timeSlice()
          deadline = performance.now() + 7
        }
        result = generation.next()
      }
      return { ground: result.value, tiles }
    }
  }

  cancelPreparation() {
    this.cancelBuild?.()
    this.cancelBuild = null
    this.grass?.disposeLods()
  }

  prepareRenderLods(render: () => void) {
    this.grass?.prepareRenderLods(render)
  }

  update(camera: THREE.Camera, time: number) {
    this.dome.position.copy(camera.position)
    this.dome.material.uniforms.drift.value = time * .013
    this.grass?.update(camera, time)
  }
}
