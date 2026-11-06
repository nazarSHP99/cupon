import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { DEMO_COUPONS, type Coupon } from './coupon'
import { getSceneLayout } from './sceneLayout'
import { ReceiptPrinter } from './ReceiptPrinter'
import { PRINT_DURATION, type Receipt } from './receipt'

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
  disabled: boolean
}

const rest = new THREE.Vector3(-0.22, -1.1, 2.05)
const insertion = new THREE.Vector3(0, 0.105, 1.72)
const ease = (t: number) => t * t * (3 - 2 * t)

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
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose()
      material.dispose()
    }
  })
}

class TerminalScene {
  private props: SceneProps
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  private machine = new THREE.Group()
  private stack = new THREE.Group()
  private printer = new ReceiptPrinter()
  private cable = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#4c594a', roughness: 0.7 }))
  private hoveredDemo: THREE.Object3D | null = null
  private printStarted = 0
  private contact: THREE.Mesh
  private card: THREE.Group | null = null
  private screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private light: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  private observer: ResizeObserver
  private animation = 0
  private previous = 0
  private clock = 0
  private insertTime = 0
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
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.domElement.setAttribute('aria-label', 'Купоноприймач, принтер чеків і демокупони на столі. Натисни на купон, щоб обрати. Перетягни його до приймача або скористайся кнопкою. Після активації принтер надрукує чек.')
    this.renderer.domElement.setAttribute('role', 'img')
    this.host.appendChild(this.renderer.domElement)
    this.camera.position.set(4.4, 2.6, 10)
    this.camera.lookAt(0, -0.04, 0.25)

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.7))
    const key = new THREE.DirectionalLight(0xffffff, 3.3)
    key.position.set(-3, 7, 6)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 })
    key.shadow.bias = -0.0005
    key.shadow.normalBias = 0.025
    key.shadow.radius = 5
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0xe6edd5, 1.2)
    rim.position.set(5, 2, -3)
    this.scene.add(rim)
    this.scene.add(this.machine)
    this.scene.add(this.printer)
    this.cable.castShadow = true
    this.cable.receiveShadow = true
    this.scene.add(this.cable)
    box(this.machine, [0.12, 0.16, 0.2], [-1.655, -1.94, -0.28], '#344638', 0.04)

    box(this.machine, [3.28, 4.25, 1.22], [0, 0.15, -0.035], '#dedfc9', 0.22)
    box(this.machine, [3.12, 4.09, 0.18], [0, 0.16, 0.55], '#f3eedb', 0.16)
    box(this.machine, [2.64, 1.43, 0.09], [0, 1.18, 0.615], '#c8c8b2', 0.045)
    box(this.machine, [2.52, 1.29, 0.05], [0, 1.18, 0.634], '#1b2d28', 0.025)
    this.screen = plane(this.machine, [2.47, 1.235], [0, 1.18, 0.667], this.screenTexture(props.phase))

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

    const table = new THREE.Group()
    box(table, [30, 0.32, 9.6], [0, -2.42, -0.5], '#cdbb9a', 0.08)
    box(table, [30, 0.035, 9.6], [0, -2.2575, -0.5], '#e5dbc4', 0.015)
    this.scene.add(table)
    this.scene.add(this.stack)
    const arrangement = [
      { index: 1, x: -0.34, z: -0.22, angle: 0.2 },
      { index: 2, x: 0.05, z: 0.04, angle: -0.18 },
      { index: 0, x: 0.22, z: 0.28, angle: 0.05 },
    ]
    arrangement.forEach(({ index, x, z, angle }, layer) => {
      const coupon = DEMO_COUPONS[index]
      const card = new THREE.Group()
      card.userData.couponIndex = index
      const width = 2.4
      const height = width / coupon.aspect
      box(card, [width + 0.025, height + 0.025, 0.025], [0, 0, 0], '#fff9e8', 0.012)
      const map = new THREE.TextureLoader().load(coupon.src)
      map.colorSpace = THREE.SRGBColorSpace
      map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
      const art = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map, roughness: 0.68 }))
      art.position.z = 0.014
      card.add(art)
      card.position.set(x, layer * 0.027, z)
      card.rotation.set(-Math.PI / 2, 0, angle)
      card.userData.baseY = layer * 0.027
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
    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(7, 5.5), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }))
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
    this.resize()
    this.animation = requestAnimationFrame(this.frame)
  }

  private screenTexture(phase: Phase) {
    return texture(1200, 600, (context) => {
      context.fillStyle = '#243a34'
      context.fillRect(0, 0, 1200, 600)
      context.fillStyle = '#93a59a'
      context.font = '24px monospace'
      context.fillText('CUPON TERMINAL / 001', 75, 80)
      context.beginPath()
      context.arc(1090, 71, 11, 0, Math.PI * 2)
      context.fillStyle = phase === 'inserting' ? '#f8b473' : '#bcde9e'
      context.fill()
      context.fillStyle = '#f3efd9'
      context.font = 'bold 87px Arial, sans-serif'
      const lines: Record<Phase, [string, string]> = {
        empty: ['ПРИВІТ,', 'КУПОНЕ.'], ready: ['О, ЦЕ ДЛЯ', 'МЕНЕ?'],
        inserting: ['ТРОХИ', 'МАГІЇ...'], success: ['ПРИЄМНОГО', 'МОМЕНТУ!'],
        printing: ['ДРУКУЮ', 'УСМІШКУ.'],
      }
      context.fillText(lines[phase][0], 70, 238)
      context.fillText(lines[phase][1], 70, 337)
      context.strokeStyle = '#4c6056'
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(75, 420)
      context.lineTo(1125, 420)
      context.stroke()
      context.fillStyle = '#aebca9'
      context.font = '25px monospace'
      context.fillText(phase === 'inserting' ? 'ЗЧИТУЮ КУПОН' : phase === 'printing' ? 'ТВІЙ ЧЕК УЖЕ В ДОРОЗІ' : phase === 'success' ? 'ГОТОВО. УСМІХНИСЬ :)' : 'МАЛЕНЬКИЙ КУПОН. ВЕЛИКЕ ПРИЄМНО.', 75, 491)
      context.fillStyle = '#bcde9e'
      for (let i = 0; i < 3; i++) context.fillRect(75 + i * 35, 535, phase === 'inserting' ? 22 : 8, 7)
    })
  }

  private resize = () => {
    const { width, height } = this.host.getBoundingClientRect()
    if (!width || !height) return
    this.renderer.setSize(width, height)
    const layout = getSceneLayout(width, height)
    this.machine.position.x = layout.machineX
    this.stack.position.set(...layout.stackPosition)
    this.printer.position.set(...layout.printerPosition)
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
    this.camera.position.set(...layout.cameraPosition)
    this.camera.lookAt(...layout.cameraTarget)
    this.camera.left = -width / 2
    this.camera.right = width / 2
    this.camera.top = height / 2
    this.camera.bottom = -height / 2
    this.camera.zoom = layout.zoom
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
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
      this.screen.material.map?.dispose()
      this.screen.material.map = this.screenTexture(props.phase)
      if (props.phase === 'inserting' && this.card) {
        this.insertTime = 0
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
    if (this.props.disabled || event.button !== 0) return
    this.aim(event)
    if (this.props.phase !== 'ready' || !this.card || !this.raycaster.intersectObject(this.card, true).length) {
      const object = this.demoAtPointer()
      if (object) this.props.onChooseDemo(object.userData.couponIndex as number)
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
    this.aim(event)
    if (!this.dragging) {
      this.hoveredDemo = !this.props.disabled && event.pointerType !== 'touch' ? this.demoAtPointer() : null
      const draggable = this.props.phase === 'ready' && this.card && this.raycaster.intersectObject(this.card, true).length
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
    for (const demo of this.stack.children) {
      const lifted = this.hoveredDemo === demo && !this.props.disabled
      const targetY = demo.userData.baseY + (lifted ? 0.16 : 0)
      const targetX = -Math.PI / 2 + (lifted ? 0.12 : 0)
      const targetZ = demo.userData.baseAngle + (lifted ? 0.025 : 0)
      demo.position.y = this.props.reducedMotion ? targetY : THREE.MathUtils.damp(demo.position.y, targetY, 12, delta)
      demo.rotation.x = this.props.reducedMotion ? targetX : THREE.MathUtils.damp(demo.rotation.x, targetX, 12, delta)
      demo.rotation.z = this.props.reducedMotion ? targetZ : THREE.MathUtils.damp(demo.rotation.z, targetZ, 12, delta)
    }
    if (this.props.phase === 'printing') {
      const progress = Math.min(1, (timestamp - this.printStarted) / (this.props.reducedMotion ? 450 : PRINT_DURATION))
      this.printer.feed(progress)
    }
    this.printer.setStatus(this.props.phase === 'printing', this.clock)
    const card = this.card
    if (card) {
      card.visible = this.props.phase === 'ready' || this.props.phase === 'inserting'
      if (this.props.phase === 'inserting') {
        this.insertTime += delta
        const progress = Math.min(1, this.insertTime / (this.props.reducedMotion ? 0.35 : 1.95))
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
    this.renderer.render(this.scene, this.camera)
    this.animation = requestAnimationFrame(this.frame)
  }

  dispose() {
    this.destroyed = true
    cancelAnimationFrame(this.animation)
    this.observer.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.down)
    canvas.removeEventListener('pointermove', this.move)
    canvas.removeEventListener('pointerup', this.up)
    canvas.removeEventListener('pointercancel', this.cancel)
    canvas.removeEventListener('lostpointercapture', this.cancel)
    canvas.removeEventListener('pointerleave', this.leave)
    disposeObject(this.scene)
    this.scene.traverse((object) => { if (object instanceof THREE.DirectionalLight) object.shadow.dispose() })
    this.renderer.dispose()
    canvas.remove()
  }
}

export default function MachineScene(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const runtime = useRef<TerminalScene | null>(null)
  const initial = useRef(props)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!host.current) return
    try {
      runtime.current = new TerminalScene(host.current, initial.current)
      return () => { runtime.current?.dispose(); runtime.current = null }
    } catch {
      setFailed(true)
    }
  }, [])
  useEffect(() => { runtime.current?.update(props) }, [props])
  if (failed) return <div className="scene-fallback"><div className="fallback-machine"><span>cupon.</span><div>ПРИВІТ,<br />КУПОНЕ.</div><i /></div><p>3D недоступне в цьому браузері.<br />Купон можна вставити кнопкою.</p></div>
  return <div ref={host} className="canvas-host" />
}
