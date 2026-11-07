import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export const KEY_TOP = .35

const labels = ['File', 'Demo', 'Insert', 'Sound', 'Save', 'Again']
const keyColors = ['#f4f6fa', '#7800e8', '#5072ff', '#292e39', '#96f000', '#ff591f']
const inkColors = ['#18202c', '#ffffff', '#ffffff', '#f8faff', '#172207', '#24160f']
const symbols = [
  'M12 16V4m-4 4 4-4 4 4M5 15v5h14v-5',
  'M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5ZM15 5v3m0 3v3m0 3v2',
  'M12 3v11m-4-4 4 4 4-4M4 17h16v4H4z',
  'm11 5-5 4H3v6h3l5 4V5ZM16 9l5 6m0-6-5 6',
  'M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4',
  'M3 10a9 9 0 1 1 1.8 8.4M3 4v6h6',
]

function keyGeometry() {
  // The top rings form a shallow finger dish, continuous with the sloping sides.
  const rings = [
    [.77, .637, .09, .025],
    [.794, .658, .105, .047],
    [.768, .63, .108, .112],
    [.682, .55, .106, .312],
    [.654, .526, .109, KEY_TOP],
    [.59, .469, .105, .335],
    [.43, .336, .088, .311],
    [.23, .178, .055, .302],
  ]
  const points: number[] = [], uvs: number[] = [], indices: number[] = [], topIndices: number[] = []
  const steps = 10
  const length = (steps + 1) * 4
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]]
  for (const [ring, [width, height, radius, z]] of rings.entries()) {
    for (const [corner, [x, y]] of corners.entries()) for (let step = 0; step <= steps; step++) {
      const angle = (corner + step / steps) * Math.PI / 2
      const px = x * (width / 2 - radius) + radius * Math.cos(angle)
      const py = y * (height / 2 - radius) + radius * Math.sin(angle)
      points.push(px, py, z)
      uvs.push(px / .654 + .5, py / .526 + .5)
    }
    if (ring === 0) continue
    for (let i = 0; i < length; i++) {
      const a = (ring - 1) * length + i, b = (ring - 1) * length + (i + 1) % length
      const faces = [a, b, a + length, b, b + length, a + length]
      indices.push(...faces)
      if (ring > 4) topIndices.push(...faces)
    }
  }
  const center = points.length / 3
  points.push(0, 0, .299)
  uvs.push(.5, .5)
  const top = (rings.length - 1) * length
  for (let i = 0; i < length; i++) {
    const faces = [top + i, top + (i + 1) % length, center]
    indices.push(...faces)
    topIndices.push(...faces)
  }
  const body = new THREE.BufferGeometry()
  body.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  body.setIndex(indices)
  body.computeVertexNormals()
  const printing = body.clone()
  printing.setIndex(topIndices)
  printing.translate(0, 0, .0012)
  return { body, printing }
}

function reflection() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const sky = ctx.createLinearGradient(0, 0, 0, 128)
  sky.addColorStop(0, '#e9f3ff')
  sky.addColorStop(.51, '#a0bad1')
  sky.addColorStop(1, '#2b3934')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 256, 128)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(34, 20, 67, 12)
  ctx.fillRect(158, 29, 43, 21)
  const map = new THREE.CanvasTexture(canvas)
  map.mapping = THREE.EquirectangularReflectionMapping
  map.colorSpace = THREE.SRGBColorSpace
  return map
}

function surfaceGrain() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')!
  const image = context.createImageData(128, 128)
  let seed = 3417
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const tone = 114 + (seed >>> 27)
    image.data[i] = image.data[i + 1] = image.data[i + 2] = tone
    image.data[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
  const map = new THREE.CanvasTexture(canvas)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(3, 3)
  return map
}

interface KeyLabel {
  context: CanvasRenderingContext2D
  texture: THREE.CanvasTexture
  signature: string
}

export class Keycaps extends THREE.Group {
  private caps: THREE.Group[] = []
  private legends: KeyLabel[] = []
  private surfaces: THREE.MeshStandardMaterial[] = []
  private glass: THREE.MeshPhysicalMaterial

  constructor() {
    super()
    const { body, printing } = keyGeometry()
    const grain = surfaceGrain()
    this.glass = new THREE.MeshPhysicalMaterial({
      color: '#5072ff', roughness: .13, metalness: 0, transmission: .82,
      thickness: .26, ior: 1.46, clearcoat: .6, clearcoatRoughness: .16,
      attenuationColor: new THREE.Color('#1844ef'), attenuationDistance: .68,
      envMap: reflection(), envMapIntensity: .65,
    })
    for (let i = 0; i < 6; i++) {
      const key = new THREE.Group()
      key.position.set((i % 3 - 1) * .855, i < 3 ? .375 : -.354, 0)
      if (i === 2) {
        const switchBase = new THREE.Mesh(new RoundedBoxGeometry(.47, .36, .06, 3, .05),
          new THREE.MeshStandardMaterial({ color: '#0926a1', roughness: .34 }))
        switchBase.position.z = .077
        const stem = new THREE.Mesh(new RoundedBoxGeometry(.15, .15, .14, 3, .028),
          new THREE.MeshStandardMaterial({ color: '#9bbdff', roughness: .27 }))
        stem.position.z = .13
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.125, .013, 5, 24),
          new THREE.MeshStandardMaterial({ color: '#4160c0', metalness: .4, roughness: .3 }))
        ring.position.z = .13
        key.add(switchBase, stem, ring)
      }
      const material = i === 2 ? this.glass : new THREE.MeshStandardMaterial({
        color: keyColors[i], roughness: .49, metalness: 0, bumpMap: grain, bumpScale: .0013,
      })
      const cap = new THREE.Mesh(body, material)
      material.emissive.copy(material.color).lerp(new THREE.Color('#ffffff'), .24)
      material.emissiveIntensity = 0
      this.surfaces.push(material)
      cap.castShadow = true
      cap.receiveShadow = true
      key.add(cap)
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 416
      const map = new THREE.CanvasTexture(canvas)
      map.colorSpace = THREE.SRGBColorSpace
      map.anisotropy = 4
      const ink = new THREE.Mesh(printing, new THREE.MeshBasicMaterial({
        map, transparent: true, depthWrite: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }))
      ink.renderOrder = 2
      ink.name = 'key-legend'
      key.add(ink)
      this.legends.push({ context: canvas.getContext('2d')!, texture: map, signature: '' })
      this.caps.push(key)
      this.add(key)
      this.print(i, labels[i], false, false)
    }
  }

  private print(index: number, text: string, sound: boolean, disabled: boolean) {
    const legend = this.legends[index]
    const signature = text + sound + disabled
    if (legend.signature === signature) return
    legend.signature = signature
    const context = legend.context
    context.clearRect(0, 0, 512, 416)
    context.globalAlpha = disabled ? .72 : 1
    context.fillStyle = context.strokeStyle = inkColors[index]
    context.font = '600 96px Arial, sans-serif'
    context.textAlign = 'center'
    context.fillText(text, 256, 328, 430)
    context.save()
    context.translate(184, 68)
    context.scale(6, 6)
    context.lineWidth = 1.55
    context.lineCap = context.lineJoin = 'round'
    const path = index === 3 && sound
      ? 'm11 5-5 4H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'
      : symbols[index]
    context.stroke(new Path2D(path))
    context.restore()
    legend.texture.needsUpdate = true
  }

  update(buttons: HTMLCollection | undefined, active: boolean, delta: number, reducedMotion: boolean) {
    let changed = false
    this.caps.forEach((key, i) => {
      const button = buttons?.[i] as HTMLButtonElement | undefined
      const pressed = active && button?.matches(':active:not(:disabled)')
      const hovered = active && !button?.disabled && button?.matches(':hover, :focus-visible')
      const surface = this.surfaces[i]
      const glow = hovered ? .16 : 0
      surface.emissiveIntensity = reducedMotion ? glow : THREE.MathUtils.damp(surface.emissiveIntensity, glow, 16, delta)
      const target = pressed ? -.065 : 0
      const next = reducedMotion ? target : THREE.MathUtils.damp(key.position.z, target, 28, delta)
      changed ||= Math.abs(key.position.z - next) > .0003
      key.position.z = next
      this.print(i, button?.textContent?.trim() || labels[i], button?.getAttribute('aria-pressed') === 'true', button?.disabled ?? false)
    })
    return changed
  }
}
