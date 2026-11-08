import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { DEMO_COUPONS } from '../../coupons/coupon'
import { ticketGeometry } from './ticketGeometry'

export const COUPON_BOX_WIDTH = 2.64
export const COUPON_BOX_DEPTH = 2.94
export const COUPON_PREVIEW_X = -2.85

const CARD_WIDTH = 2.32
const CARD_HEIGHT = CARD_WIDTH / DEMO_COUPONS[0].aspect
const CARD_LEAN = -.19
const CARD_BASE_Y = .12
const SLOT_SPACING = .11
const CARD_CENTER_Y = CARD_BASE_Y + Math.cos(CARD_LEAN) * CARD_HEIGHT / 2

export class CouponBox extends THREE.Group {
  private cards: THREE.Group[] = []
  private faces: THREE.MeshStandardMaterial[] = []
  private slots: THREE.Mesh
  private frontSlot: THREE.Mesh
  private rack = new THREE.Group()
  private preview = new THREE.Group()
  private previewFace: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>
  private rim = new THREE.MeshStandardMaterial({ color: '#b8bfa0', roughness: .57, emissive: '#d0e2a8', emissiveIntensity: .06 })

  constructor(manager: THREE.LoadingManager) {
    super()
    this.name = 'coupon-library'
    this.add(this.rack)
    const wood = new THREE.MeshStandardMaterial({ color: '#526758', roughness: .78 })
    const box = (size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, .055), material)
      mesh.position.set(...position)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.rack.add(mesh)
    }
    const rimZ = COUPON_BOX_DEPTH / 2 - .06
    box([COUPON_BOX_WIDTH, CARD_BASE_Y, COUPON_BOX_DEPTH], [0, CARD_BASE_Y / 2, 0], wood)
    box([COUPON_BOX_WIDTH, .82, .12], [0, .47, -rimZ], wood)
    box([COUPON_BOX_WIDTH, .29, .12], [0, .2, rimZ], this.rim)
    for (const x of [-1.26, 1.26]) box([.12, .46, COUPON_BOX_DEPTH - .16], [x, .27, 0], wood)

    // Pick the resting slots so lifting a card never changes the hover targets.
    this.slots = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_WIDTH, DEMO_COUPONS.length * SLOT_SPACING),
      new THREE.MeshBasicMaterial(),
    )
    this.slots.position.set(0, CARD_CENTER_Y + Math.cos(CARD_LEAN) * CARD_HEIGHT / 2,
      Math.sin(CARD_LEAN) * CARD_HEIGHT / 2)
    this.slots.rotation.x = -Math.PI / 2
    this.slots.visible = false
    this.add(this.slots)

    const geometry = ticketGeometry(CARD_WIDTH, .02)
    const paperMaterial = new THREE.MeshStandardMaterial({ color: '#f6efdf', roughness: .9 })
    const addCard = (card: THREE.Group, material: THREE.MeshStandardMaterial) => {
      const paper = new THREE.Mesh(geometry.paper, paperMaterial)
      const art = new THREE.Mesh(geometry.face, material)
      paper.castShadow = true
      art.position.z = geometry.faceZ
      card.add(paper, art)
      return art
    }
    const loader = new THREE.TextureLoader(manager)
    DEMO_COUPONS.forEach((coupon, index) => {
      const card = new THREE.Group()
      const map = loader.load(coupon.src)
      map.colorSpace = THREE.SRGBColorSpace
      map.anisotropy = 8
      const face = new THREE.MeshStandardMaterial({ map, alphaTest: .3, roughness: .85 })
      addCard(card, face)
      card.rotation.x = CARD_LEAN
      card.position.set(0, CARD_CENTER_Y, this.slotZ(index))
      this.rack.add(card)
      this.faces.push(face)
      this.cards.push(card)
    })

    this.frontSlot = new THREE.Mesh(geometry.face, this.slots.material)
    this.frontSlot.position.copy(this.cards[this.cards.length - 1].position)
    this.frontSlot.rotation.x = CARD_LEAN
    this.frontSlot.visible = false
    this.add(this.frontSlot)

    this.previewFace = addCard(this.preview, this.faces[0])
    this.preview.position.set(COUPON_PREVIEW_X, CARD_CENTER_Y + .53, .04)
    this.preview.rotation.x = -.76
    this.preview.visible = false
    this.add(this.preview)
  }

  private slotZ(index: number) {
    return (index - (DEMO_COUPONS.length - 1) / 2) * SLOT_SPACING
  }

  update(open: boolean, focus: number, activeIndex: number, hovered: boolean, delta: number, reduced: boolean) {
    let changed = this.preview.visible !== open
    this.preview.visible = open
    this.previewFace.material = this.faces[activeIndex]
    const blend = reduced ? 1 : 1 - Math.exp(-12 * delta)
    const glow = hovered || focus > .1 ? .48 : .06
    this.rim.emissiveIntensity = THREE.MathUtils.lerp(this.rim.emissiveIntensity, glow, blend)
    this.cards.forEach((card, index) => {
      const lift = open && index === activeIndex ? .09 * focus : 0
      const targetY = CARD_CENTER_Y + lift
      if (Math.abs(card.position.y - targetY) > .001) changed = true
      card.position.y = THREE.MathUtils.lerp(card.position.y, targetY, blend)
    })
    return changed
  }

  couponIndexAtPointer(raycaster: THREE.Raycaster): number | undefined {
    const slot = raycaster.intersectObject(this.slots, false)[0]?.uv
    if (slot) return Math.min(this.cards.length - 1, Math.floor((1 - slot.y) * this.cards.length))
    if (raycaster.intersectObject(this.frontSlot, false).length) return this.cards.length - 1
  }

  isPreviewAtPointer(raycaster: THREE.Raycaster) {
    return this.preview.visible && raycaster.intersectObject(this.previewFace, false).length > 0
  }

  previewHintPosition(point: THREE.Vector3) {
    return this.preview.localToWorld(point.set(0, CARD_HEIGHT / 2, .025))
  }

  rackHit(raycaster: THREE.Raycaster) {
    return raycaster.intersectObject(this.rack, true)[0]
  }
}
