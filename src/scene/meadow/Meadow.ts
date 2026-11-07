import * as THREE from 'three'
import { GrassField, grassGroundMaterial, meadowTextures } from './GrassField'
import { FLOWER_DRIFTS, FLOWER_TINTS, flowerDrift, terrainHeight, TERRAIN_EXTENT } from './terrain'
import { wildflowers } from './Wildflowers'

const sun = new THREE.Vector3(-12, 19.5, 8).normalize()

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
        vec3 color = mix(vec3(.56,.72,.80), vec3(.16,.35,.51), blue);
        color += warmth * vec3(.08,.065,.03);
        vec2 p = ray.xz / (.34 + elev) * vec2(1.8,4.2) + vec2(5.21 + drift, 1.14);
        p += vec2(noise(p*1.4), noise(p*1.4+7.)) * .19;
        float density = clouds(p);
        float cover = smoothstep(.66,.83,density) * smoothstep(.003,.055,elev);
        float shade = smoothstep(-.105,.075,density - clouds(p + vec2(-.21,.19)) + .024);
        vec3 cloud = mix(vec3(.52,.67,.80), vec3(1.,.99,.96), shade);
        cloud = mix(cloud, vec3(.85,.92,.98), (1.-smoothstep(0.,.22,elev))*.16);
        float rim = max(0., smoothstep(.55,.67,density) - cover) * smoothstep(.01,.045,elev);
        color = mix(color, cloud, cover*.49);
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
    const maps = await meadowTextures()
    if (cancelled()) { maps.ground.dispose(); maps.atlas.dispose(); return }
    const ground = new THREE.PlaneGeometry(TERRAIN_EXTENT * 2, TERRAIN_EXTENT * 2, 256, 256).rotateX(-Math.PI / 2)
    const vertices = ground.getAttribute('position')
    const colors = new Float32Array(vertices.count * 3)
    const deep = new THREE.Color('#9cab81')
    const light = new THREE.Color('#f4f4d9')
    const color = new THREE.Color()
    let deadline = performance.now() + 7
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), z = vertices.getZ(i)
      const y = terrainHeight(x, z)
      vertices.setY(i, y)
      const variation = THREE.MathUtils.clamp(.41 + (y + 7) * .045
        + Math.sin(x * .24 + z * .17) * .15 + Math.sin(x * .1 - z * .12) * .14, .06, .94)
      color.copy(deep).lerp(light, variation)
      for (const drift of FLOWER_DRIFTS) {
        const bloom = flowerDrift(drift, x, z)
        if (bloom > 0) color.lerp(FLOWER_TINTS[drift.species], bloom * .66)
      }
      color.toArray(colors, i * 3)
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
    await this.grass.prepare(cancelled)
    if (!cancelled()) this.add(wildflowers(this.compact))
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
