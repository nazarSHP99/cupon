import * as THREE from 'three'
import { GrassField, grassGroundMaterial, meadowGroundTexture } from './GrassField'
import { meadowTurfColor, terrainHeight, TERRAIN_EXTENT } from './terrain'
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

  constructor(private compact: boolean) {
    super()
    this.add(this.dome)
  }

  async prepare(cancelled: () => boolean) {
    await timeSlice()
    if (cancelled()) return
    const map = await meadowGroundTexture()
    if (cancelled()) { map.dispose(); return }
    const ground = new THREE.PlaneGeometry(TERRAIN_EXTENT * 2, TERRAIN_EXTENT * 2, 256, 256).rotateX(-Math.PI / 2)
    const vertices = ground.getAttribute('position')
    const colors = new Float32Array(vertices.count * 3)
    const color = new THREE.Color()
    let deadline = performance.now() + 7
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), z = vertices.getZ(i)
      const y = terrainHeight(x, z)
      vertices.setY(i, y)
      meadowTurfColor(color, x, z).toArray(colors, i * 3)
      if (i % 1024 === 0 && performance.now() > deadline) {
        await timeSlice()
        if (cancelled()) { ground.dispose(); map.dispose(); return }
        deadline = performance.now() + 7
      }
    }
    ground.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    ground.computeVertexNormals()
    const field = new THREE.Mesh(ground, grassGroundMaterial(map))
    field.receiveShadow = true
    field.name = 'textured-meadow-ground'
    this.add(field)
    this.grass = new GrassField(this.compact)
    this.add(this.grass)
    await this.grass.prepare(ground, cancelled)
    if (!cancelled()) this.add(wildflowers(this.compact))
  }

  update(camera: THREE.Camera, time: number) {
    this.dome.position.copy(camera.position)
    this.dome.material.uniforms.drift.value = time * .013
    this.grass?.update(camera, time)
  }
}
