import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { DEMO_COUPONS, type Coupon } from '../coupons/coupon'
import { PRINT_DURATION, type Receipt } from '../coupons/receipt'
import { DEMO_LAYOUT, DEMO_WIDTH, getSceneLayout, sceneCamera } from './sceneLayout'
import { ReceiptPrinter } from './terminal/ReceiptPrinter'
import { LedDisplay } from './terminal/LedDisplay'
import { woodenTable } from './terminal/woodenTable'
import { Keycaps, KEY_TOP } from './terminal/Keycaps'
import { Meadow } from './meadow/Meadow'

export type Phase = 'empty' | 'ready' | 'inserting' | 'printing' | 'success'
export type DragHint = 'idle' | 'dragging' | 'over'
interface SceneProps {
  coupon: Coupon | null
  receipt: Receipt | null
  phase: Phase
  reducedMotion: boolean
  dragHint: DragHint
  onInsert: () => void
  onDragHint: (hint: DragHint) => void
  onChooseDemo: (index: number) => void
  onHoverCoupon: () => void
  scrollRoot: RefObject<HTMLDivElement | null>
  keypad: RefObject<HTMLDivElement | null>
  onReady: (fallback?: boolean) => void
  onApproach: (near: boolean) => void
  disabled: boolean
}

const rest = new THREE.Vector3(-0.22, -1.1, 2.05)
const insertion = new THREE.Vector3(0, 0.105, 1.72)
const ease = (t: number) => t * t * (3 - 2 * t)
const KEYPAD_WIDTH = 360
const KEYPAD_HEIGHT = 226
const keypadPlane = new THREE.Matrix4().set(
  2.7 / KEYPAD_WIDTH, 0, 0, -1.35,
  0, -1.59 / KEYPAD_HEIGHT, 0, .795,
  0, 0, 1, KEY_TOP,
  0, 0, 0, 1,
)

function texture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!)
  const result = new THREE.CanvasTexture(canvas)
  result.colorSpace = THREE.SRGBColorSpace
  result.anisotropy = 4
  return result
}

function box(group: THREE.Group, size: [number, number, number], position: [number, number, number], color: string, radius = 0.08, metalness = 0) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 4, radius), new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness }))
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

function plane(group: THREE.Group, size: [number, number], position: [number, number, number], map: THREE.Texture, transparent = false) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ map, transparent, depthWrite: !transparent, toneMapped: false }))
  mesh.position.set(...position)
  group.add(mesh)
  return mesh
}

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    if (object instanceof THREE.InstancedMesh) object.dispose()
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
  })
  for (const material of materials) {
    if ('map' in material && material.map instanceof THREE.Texture) textures.add(material.map)
    if ('envMap' in material && material.envMap instanceof THREE.Texture) textures.add(material.envMap)
    if ('bumpMap' in material && material.bumpMap instanceof THREE.Texture) textures.add(material.bumpMap)
    material.dispose()
  }
  for (const geometry of geometries) geometry.dispose()
  for (const map of textures) map.dispose()
}

class TerminalScene {
  private props: SceneProps
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = sceneCamera()
  private meadow: Meadow
  private machine = new THREE.Group()
  private stack = new THREE.Group()
  private keypad = new THREE.Group()
  private keycaps = new Keycaps()
  private printer = new ReceiptPrinter()
  private cable = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#4c594a', roughness: 0.7 }))
  private hoveredDemo: THREE.Object3D | null = null
  private printStarted = 0
  private contact: THREE.Mesh
  private card: THREE.Group | null = null
  private display: LedDisplay
  private assets: Promise<void>
  private compiling: Promise<THREE.Object3D> | null = null
  private reportedReady = false
  private shadowDirty = true
  private near = false
  private progress = 0
  private scrollTarget = 0
  private layout: ReturnType<typeof getSceneLayout> | null = null
  private targetView = new THREE.Vector3()
  private projection = new THREE.Matrix4()
  private viewport = new THREE.Matrix4()
  private touch: { id: number; start: number; last: number; moved: boolean; demo: THREE.Object3D | null } | null = null
  private light: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  private observer: ResizeObserver
  private animation = 0
  private previous = 0
  private clock = 0
  private insertStarted = 0
  private startPosition = rest.clone()
  private startRotation = new THREE.Euler()
  private dragging = false
  private over = false
  private pointer = new THREE.Vector2()
  private raycaster = new THREE.Raycaster()
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.05)
  private hit = new THREE.Vector3()
  private grabOffset = new THREE.Vector3()
  private dragPosition = rest.clone()
  private target = rest.clone()
  private destroyed = false

  constructor(private host: HTMLDivElement, props: SceneProps) {
    this.props = props
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = .96
    this.renderer.domElement.setAttribute('aria-label', 'Купоноприймач, принтер чеків і демокупони на столі. Натисни на купон, щоб обрати. Перетягни його до приймача або скористайся кнопкою. Після активації принтер надрукує чек.')
    this.renderer.domElement.setAttribute('role', 'img')
    this.host.appendChild(this.renderer.domElement)
    this.meadow = new Meadow(host.clientWidth < 760)
    this.scene.fog = new THREE.Fog('#acc3c8', 38, 153)
    this.scene.add(this.meadow)
    this.scene.add(new THREE.HemisphereLight('#e5f1ff', '#b6b4a1', 1.75))
    const key = new THREE.DirectionalLight('#fff7e8', 2.15)
    key.position.set(-12, 16, 8)
    key.target.position.set(0, -3.5, 0)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    Object.assign(key.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, far: 42 })
    key.shadow.bias = -0.0005
    key.shadow.normalBias = 0.025
    key.shadow.radius = 3.5
    this.scene.add(key, key.target)
    const rim = new THREE.DirectionalLight('#eaf5ff', .35)
    rim.position.set(7, 5, -6)
    this.scene.add(rim)
    this.scene.add(this.machine)
    this.scene.add(this.printer)
    this.cable.castShadow = true
    this.cable.receiveShadow = true
    this.scene.add(this.cable)
    box(this.machine, [0.12, 0.16, 0.2], [-1.655, -1.94, -0.28], '#344638', 0.04)

    box(this.machine, [3.28, 4.25, 1.22], [0, 0.15, -0.035], '#dedfc9', 0.22)
    box(this.machine, [3.12, 4.09, 0.18], [0, 0.16, 0.55], '#f3eedb', 0.16)
    box(this.machine, [2.83, 1.56, 0.17], [0, 1.18, 0.642], '#292923', 0.12, 0.24)
    box(this.machine, [2.66, 1.39, 0.08], [0, 1.18, 0.724], '#dd9e62', 0.078, 0.15)
    box(this.machine, [2.54, 1.29, 0.06], [0, 1.18, 0.765], '#141219', 0.045)
    this.display = new LedDisplay(props.phase)
    plane(this.machine, [2.47, 1.235], [0, 1.18, 0.798], this.display.texture)

    box(this.machine, [2.86, 0.63, 0.28], [0, 0.08, 0.72], '#d84f2e', 0.12)
    box(this.machine, [2.62, 0.22, 0.045], [0, 0.095, 0.874], '#a83b24', 0.022)
    box(this.machine, [2.45, 0.09, 0.025], [0, 0.105, 0.905], '#20312a', 0.01)
    box(this.machine, [2.73, 0.15, 0.13], [0, -0.17, 0.82], '#ef724b', 0.04)
    this.light = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.027, 0.015), new THREE.MeshStandardMaterial({ color: '#f6ba81', emissive: '#e69159', emissiveIntensity: 0.25 }))
    this.light.position.set(0, 0.335, 0.872)
    this.machine.add(this.light)
    for (const x of [-0.22, 0, 0.22]) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.085, 3), new THREE.MeshStandardMaterial({ color: '#e16440' }))
      arrow.position.set(x, -0.51, 0.656)
      this.machine.add(arrow)
    }
    const label = texture(1024, 380, (context) => {
      context.fillStyle = '#536258'
      context.textAlign = 'center'
      context.font = 'bold 108px Arial, sans-serif'
      context.fillText('cupon.', 512, 133)
      context.fillStyle = '#8a8e7d'
      context.font = '22px monospace'
      context.fillText('GOOD THINGS GO IN. GOOD THINGS HAPPEN.', 512, 207)
      context.fillText('DESIGNED FOR A LITTLE JOY', 512, 325)
      context.fillRect(400, 258, 224, 2)
    })
    plane(this.machine, [2.6, 0.965], [0, -1.22, 0.649], label, true)
    for (const x of [-1.38, 1.38]) for (const y of [-1.69, 1.99]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.018, 20), new THREE.MeshStandardMaterial({ color: '#adae99', metalness: 0.6, roughness: 0.3 }))
      screw.position.set(x, y, 0.654)
      screw.rotation.x = Math.PI / 2
      this.machine.add(screw)
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.007, 0.009), new THREE.MeshStandardMaterial({ color: '#818775' }))
      groove.position.set(x, y, 0.669)
      groove.rotation.z = -0.4
      this.machine.add(groove)
    }
    box(this.machine, [3.05, 0.22, 1.15], [0, -1.99, -0.035], '#a8af98', 0.08)
    for (const x of [-1.08, 1.08]) box(this.machine, [0.47, 0.18, 0.7], [x, -2.14, -0.03], '#334439', 0.065)
    for (let i = 0; i < 6; i++) box(this.machine, [0.02, 0.045, 0.54], [1.645, -0.86 + i * 0.13, -0.07], '#9da78f', 0.009)

    this.scene.add(woodenTable(), this.stack, this.keypad)
    this.keypad.rotation.x = -1.08
    box(this.keypad, [2.83, 1.72, .235], [0, 0, -.102], '#b9bdba', .11)
    box(this.keypad, [2.74, 1.63, .08], [0, 0, -.018], '#d5d7d3', .073)
    this.keypad.add(this.keycaps)
    const manager = new THREE.LoadingManager()
    this.assets = new Promise<void>(resolve => { manager.onLoad = resolve })
    const demoTextures = new THREE.TextureLoader(manager)
    DEMO_LAYOUT.forEach(({ index, x, z, angle }) => {
      const coupon = DEMO_COUPONS[index]
      const card = new THREE.Group()
      card.userData.couponIndex = index
      const width = DEMO_WIDTH
      const height = width / coupon.aspect
      box(card, [width + 0.025, height + 0.025, 0.025], [0, 0, 0], '#fff9e8', 0.012)
      const map = demoTextures.load(coupon.src)
      map.colorSpace = THREE.SRGBColorSpace
      map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
      const art = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map, roughness: 0.68 }))
      art.position.z = 0.014
      card.add(art)
      card.position.set(x, 0, z)
      card.rotation.set(-Math.PI / 2, 0, angle)
      card.userData.baseAngle = angle
      this.stack.add(card)
    })
    const shadow = texture(256, 256, (context) => {
      const gradient = context.createRadialGradient(128, 128, 15, 128, 128, 128)
      gradient.addColorStop(0, 'rgba(49,55,34,0.3)')
      gradient.addColorStop(0.45, 'rgba(49,55,34,0.16)')
      gradient.addColorStop(1, 'rgba(49,55,34,0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, 256, 256)
    })
    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.9), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }))
    this.contact.rotation.x = -Math.PI / 2
    this.contact.position.y = -2.235
    this.scene.add(this.contact)
    this.setCoupon(props.coupon)
    this.printer.setReceipt(props.receipt)
    if (props.phase === 'success') this.printer.feed(1)
    if (props.phase === 'printing') this.printStarted = performance.now()
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', this.down)
    canvas.addEventListener('pointermove', this.move)
    canvas.addEventListener('pointerup', this.up)
    canvas.addEventListener('pointercancel', this.cancel)
    canvas.addEventListener('lostpointercapture', this.cancel)
    canvas.addEventListener('pointerleave', this.leave)
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(host)
    this.props.scrollRoot.current?.addEventListener('scroll', this.scroll, { passive: true })
    this.resize()
  }

  async start() {
    await Promise.all([this.assets, this.meadow.prepare(() => this.destroyed)])
    if (this.destroyed) return
    this.meadow.update(this.camera, 0)
    this.compiling = this.renderer.compileAsync(this.scene, this.camera)
    try { await this.compiling }
    finally { this.compiling = null }
    if (this.destroyed) return
    this.animation = requestAnimationFrame(this.frame)
  }

  private scroll = () => {
    const root = this.props.scrollRoot.current
    if (!root) return
    this.scrollTarget = THREE.MathUtils.clamp(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight), 0, 1)
  }

  private positionCamera() {
    const layout = this.layout
    if (!layout) return
    const travel = ease(this.progress)
    this.camera.position.lerpVectors(layout.farPosition, layout.nearPosition, travel)
    this.targetView.lerpVectors(layout.farTarget, layout.nearTarget, travel)
    this.camera.lookAt(this.targetView)
    this.camera.updateMatrixWorld()
    this.keypad.updateMatrixWorld()
    this.projection.copy(this.viewport).multiply(this.camera.projectionMatrix)
      .multiply(this.camera.matrixWorldInverse).multiply(this.keypad.matrixWorld).multiply(keypadPlane)
    const elements = this.projection.elements
    if (this.props.keypad.current) {
      this.props.keypad.current.style.transform = `matrix3d(${elements.map(value => value / elements[15]).join(',')})`
    }
    const near = this.progress > .87 && this.scrollTarget > .86
    if (near !== this.near) {
      this.near = near
      if (!near) this.hoveredDemo = null
      this.props.onApproach(near)
    }
  }

  private resize = () => {
    const { width, height } = this.host.getBoundingClientRect()
    if (!width || !height) return
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4, Math.sqrt(2_250_000 / (width * height))))
    this.renderer.setSize(width, height)
    this.shadowDirty = true
    const layout = this.layout = getSceneLayout(width, height)
    this.machine.position.x = layout.machineX
    this.stack.position.copy(layout.stackPosition)
    this.stack.scale.setScalar(layout.stackScale)
    this.keypad.position.copy(layout.keypadPosition)
    this.keypad.scale.setScalar(layout.keypadScale)
    this.printer.position.copy(layout.printerPosition)
    this.printer.scale.setScalar(layout.printerScale)
    const [px, py, pz] = layout.printerPosition
    const scale = layout.printerScale
    const cablePoints = [
      new THREE.Vector3(px + 1.17 * scale, py + 0.28 * scale, pz - 0.3 * scale),
      new THREE.Vector3(px + 1.45 * scale, -2.2, pz - 0.7 * scale),
      new THREE.Vector3((px + layout.machineX) / 2, -2.2, pz - 0.9 * scale),
      new THREE.Vector3(layout.machineX - 1.95, -2.2, -0.85),
      new THREE.Vector3(layout.machineX - 1.69, -1.94, -0.28),
    ]
    this.cable.geometry.dispose()
    this.cable.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints), 72, layout.portrait ? 0.018 : 0.028, 8, false)
    this.contact.position.x = layout.machineX
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.viewport.set(
      width / 2, 0, 0, width / 2,
      0, -height / 2, 0, height / 2,
      0, 0, 1, 0,
      0, 0, 0, 1,
    )
    this.scroll()
    this.positionCamera()
  }

  private setCoupon(coupon: Coupon | null) {
    if (this.card) {
      this.machine.remove(this.card)
      disposeObject(this.card)
      this.card = null
    }
    if (!coupon) return
    const card = new THREE.Group()
    const width = Math.min(2.28, 1.6 * coupon.aspect)
    const height = width / coupon.aspect
    box(card, [width + 0.025, height + 0.025, 0.026], [0, 0, 0], '#fffae9', 0.013)
    const map = new THREE.TextureLoader().load(coupon.src)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    const art = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.62 }))
    art.position.z = 0.014
    card.add(art)
    card.position.copy(rest)
    card.rotation.set(-0.07, 0, -0.1)
    this.card = card
    this.machine.add(card)
  }

  update(props: SceneProps) {
    if (props.receipt?.id !== this.props.receipt?.id) this.printer.setReceipt(props.receipt)
    if (props.coupon?.src !== this.props.coupon?.src) this.setCoupon(props.coupon)
    if (props.phase !== this.props.phase) {
      this.shadowDirty = true
      this.display.setPhase(props.phase, this.clock)
      if (props.phase === 'inserting' && this.card) {
        this.insertStarted = performance.now()
        this.startPosition.copy(this.card.position)
        this.startRotation.copy(this.card.rotation)
        this.dragging = false
      }
      if (props.phase === 'printing') this.printStarted = performance.now()
      if (props.phase === 'success') this.printer.feed(1)
    }
    const active = props.dragHint === 'over' || props.phase === 'inserting'
    this.light.material.color.set(active ? '#d7ffb3' : '#f6ba81')
    this.light.material.emissive.set(active ? '#93e769' : '#e69159')
    this.light.material.emissiveIntensity = active ? 1.7 : 0.25
    if (props.disabled) this.hoveredDemo = null
    this.renderer.domElement.style.cursor = props.disabled ? 'progress' : 'default'
    this.props = props
  }

  private aim(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
  }

  private down = (event: PointerEvent) => {
    if (event.button !== 0 || this.touch || this.dragging) return
    this.aim(event)
    const enabled = this.near && !this.props.disabled
    const cardHit = enabled && this.props.phase === 'ready' && this.card
      && this.raycaster.intersectObject(this.card, true).length
    if (!cardHit || !this.card) {
      const object = enabled ? this.demoAtPointer() : null
      if (event.pointerType === 'touch') {
        this.touch = { id: event.pointerId, start: event.clientY, last: event.clientY, moved: false, demo: object }
        this.renderer.domElement.setPointerCapture(event.pointerId)
      } else if (object) this.props.onChooseDemo(object.userData.couponIndex as number)
      return
    }
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.hit)) return
    this.machine.worldToLocal(this.hit)
    event.preventDefault()
    this.dragging = true
    this.over = false
    this.dragPosition.copy(this.card.position)
    this.grabOffset.copy(this.hit).sub(this.card.position)
    this.renderer.domElement.setPointerCapture(event.pointerId)
    this.props.onDragHint('dragging')
  }

  private move = (event: PointerEvent) => {
    if (this.touch?.id === event.pointerId) {
      const touch = this.touch
      const root = this.props.scrollRoot.current
      if (root && (touch.moved || Math.abs(touch.start - event.clientY) > 7)) {
        touch.moved = true
        root.scrollTop += (touch.last - event.clientY) * 1.85
        touch.last = event.clientY
      }
      return
    }
    this.aim(event)
    if (!this.dragging) {
      const hovered = this.near && !this.props.disabled && event.pointerType !== 'touch' ? this.demoAtPointer() : null
      if (hovered && hovered !== this.hoveredDemo) this.props.onHoverCoupon()
      this.hoveredDemo = hovered
      const draggable = this.near && this.props.phase === 'ready' && this.card && this.raycaster.intersectObject(this.card, true).length
      this.renderer.domElement.style.cursor = this.props.disabled ? 'progress' : this.hoveredDemo ? 'pointer' : draggable ? 'grab' : 'default'
      return
    }
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.hit)) return
    this.machine.worldToLocal(this.hit)
    this.dragPosition.copy(this.hit).sub(this.grabOffset)
    this.dragPosition.x = THREE.MathUtils.clamp(this.dragPosition.x, -2.8, 2.8)
    this.dragPosition.y = THREE.MathUtils.clamp(this.dragPosition.y, -2, 2.6)
    this.over = Math.abs(this.dragPosition.x) < 0.75 && Math.abs(this.dragPosition.y - 0.105) < 0.48
    this.props.onDragHint(this.over ? 'over' : 'dragging')
  }

  private demoAtPointer() {
    const hit = this.raycaster.intersectObject(this.stack, true)[0]
    if (!hit) return null
    const obstruction = this.raycaster.intersectObject(this.printer, true)[0]
    if (obstruction && obstruction.distance < hit.distance) return null
    let object: THREE.Object3D | null = hit.object
    while (object && object.userData.couponIndex === undefined) object = object.parent
    return object
  }

  private leave = () => {
    this.hoveredDemo = null
    if (!this.dragging) this.renderer.domElement.style.cursor = 'default'
  }

  private up = (event: PointerEvent) => { this.release(event, false) }
  private cancel = (event: PointerEvent) => { this.release(event, true) }
  private release(event: PointerEvent, cancelled: boolean) {
    if (this.touch?.id === event.pointerId) {
      const { moved, demo } = this.touch
      this.touch = null
      if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId)
      if (demo && !cancelled && !moved && this.near && !this.props.disabled) this.props.onChooseDemo(demo.userData.couponIndex as number)
      return
    }
    if (!this.dragging) return
    this.dragging = false
    const accept = this.over && !cancelled
    this.over = false
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId)
    this.props.onDragHint('idle')
    if (accept) this.props.onInsert()
  }

  private frame = (timestamp: number) => {
    if (this.destroyed) return
    const delta = this.previous ? Math.min((timestamp - this.previous) / 1000, 0.08) : 0
    this.previous = timestamp
    this.clock += delta
    if (this.progress !== this.scrollTarget && !this.dragging) {
      this.progress = this.props.reducedMotion || Math.abs(this.progress - this.scrollTarget) < .0008
        ? this.scrollTarget : THREE.MathUtils.damp(this.progress, this.scrollTarget, 11, delta)
      this.positionCamera()
    }
    this.meadow.update(this.camera, this.props.reducedMotion ? 0 : this.clock)
    this.display.update(this.clock, this.props.reducedMotion)
    if (this.keycaps.update(this.props.keypad.current?.children, this.near, delta, this.props.reducedMotion)) this.shadowDirty = true
    for (const demo of this.stack.children) {
      const lifted = this.hoveredDemo === demo && !this.props.disabled
      const targetY = lifted ? .115 : 0
      const targetX = -Math.PI / 2 + (lifted ? .046 : 0)
      const targetZ = demo.userData.baseAngle
      if (Math.abs(demo.position.y - targetY) > .001) this.shadowDirty = true
      demo.position.y = this.props.reducedMotion ? targetY : THREE.MathUtils.damp(demo.position.y, targetY, 12, delta)
      demo.rotation.x = this.props.reducedMotion ? targetX : THREE.MathUtils.damp(demo.rotation.x, targetX, 12, delta)
      demo.rotation.z = this.props.reducedMotion ? targetZ : THREE.MathUtils.damp(demo.rotation.z, targetZ, 12, delta)
    }
    if (this.props.phase === 'printing') {
      this.shadowDirty = true
      const progress = Math.min(1, (timestamp - this.printStarted) / (this.props.reducedMotion ? 450 : PRINT_DURATION))
      this.printer.feed(progress)
    }
    this.printer.setStatus(this.props.phase === 'printing', this.clock)
    const card = this.card
    if (card) {
      card.visible = this.props.phase === 'ready' || this.props.phase === 'inserting'
      if (card.visible && (this.near || this.props.phase === 'inserting')) this.shadowDirty = true
      if (this.props.phase === 'inserting') {
        const progress = Math.min(1, Math.max(0, timestamp - this.insertStarted) / (this.props.reducedMotion ? 350 : 1950))
        if (progress < 0.43) {
          const t = ease(progress / 0.43)
          card.position.lerpVectors(this.startPosition, insertion, t)
          card.rotation.set(THREE.MathUtils.lerp(this.startRotation.x, -Math.PI / 2, t), THREE.MathUtils.lerp(this.startRotation.y, 0, t), THREE.MathUtils.lerp(this.startRotation.z, 0, t))
        } else {
          card.position.set(0, 0.105, THREE.MathUtils.lerp(1.72, -0.8, ease((progress - 0.43) / 0.57)))
          card.rotation.set(-Math.PI / 2, 0, 0)
        }
        card.visible = progress < 0.98
      } else if (this.dragging) {
        card.position.copy(this.dragPosition)
        card.rotation.x = THREE.MathUtils.damp(card.rotation.x, this.over ? -0.75 : -0.09, 10, delta)
        card.rotation.z = THREE.MathUtils.damp(card.rotation.z, this.over ? 0 : -0.055, 10, delta)
      } else {
        this.target.copy(rest)
        if (!this.props.reducedMotion) this.target.y += Math.sin(this.clock * 1.6) * 0.045
        card.position.lerp(this.target, 1 - Math.exp(-9 * delta))
        card.rotation.x = THREE.MathUtils.damp(card.rotation.x, -0.07, 8, delta)
        card.rotation.z = THREE.MathUtils.damp(card.rotation.z, -0.1, 8, delta)
      }
    }
    if (this.shadowDirty) {
      this.renderer.shadowMap.needsUpdate = true
      this.shadowDirty = false
    }
    this.renderer.render(this.scene, this.camera)
    if (!this.reportedReady) {
      this.reportedReady = true
      this.props.onReady()
    }
    this.animation = requestAnimationFrame(this.frame)
  }

  dispose() {
    this.destroyed = true
    cancelAnimationFrame(this.animation)
    this.observer.disconnect()
    this.props.scrollRoot.current?.removeEventListener('scroll', this.scroll)
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.down)
    canvas.removeEventListener('pointermove', this.move)
    canvas.removeEventListener('pointerup', this.up)
    canvas.removeEventListener('pointercancel', this.cancel)
    canvas.removeEventListener('lostpointercapture', this.cancel)
    canvas.removeEventListener('pointerleave', this.leave)
    canvas.remove()
    const release = () => {
      this.meadow.dispose()
      disposeObject(this.scene)
      this.scene.traverse((object) => { if (object instanceof THREE.DirectionalLight) object.shadow.dispose() })
      this.renderer.dispose()
    }
    if (this.compiling) void this.compiling.then(release, release)
    else release()
  }
}

export default function MachineScene(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const runtime = useRef<TerminalScene | null>(null)
  const initial = useRef(props)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const setup = requestAnimationFrame(() => {
      if (!host.current) return
      try {
        const scene = new TerminalScene(host.current, initial.current)
        runtime.current = scene
        void scene.start().catch(() => {
          if (runtime.current !== scene) return
          scene.dispose()
          runtime.current = null
          setFailed(true)
          initial.current.onReady(true)
        })
      } catch {
        setFailed(true)
        initial.current.onReady(true)
      }
    })
    return () => {
      cancelAnimationFrame(setup)
      runtime.current?.dispose()
      runtime.current = null
    }
  }, [])
  useEffect(() => {
    initial.current = props
    runtime.current?.update(props)
  }, [props])
  if (failed) return <div className="scene-fallback"><div className="fallback-machine"><span>cupon.</span><div>{props.phase === 'empty' ? 'ОБЕРИ КУПОН' : props.phase === 'ready' ? 'ВСТАВ КУПОН' : props.phase === 'inserting' ? 'ЗЧИТУЮ...' : props.phase === 'printing' ? 'ДРУКУЮ ЧЕК' : 'ГОТОВО :)'}</div><i /></div>{props.receipt && props.phase === 'success' && <img className="fallback-receipt" src={props.receipt.canvas.toDataURL()} alt="Надрукований чек" />}</div>
  return <div ref={host} className="canvas-host" />
}
