import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { UsedCoupon } from '../../hooks/useCouponHistory'

export const DRAWER_WIDTH = 4.72
export const DRAWER_X = -2.41
const DRAWER_TRAVEL = 2.95

interface StoredCard {
  group: THREE.Group
  src: string
  target: THREE.Vector3
  angle: number
  pending: boolean
  droppedAt: number | null
}

function part(parent: THREE.Group, size: [number, number, number], position: [number, number, number], color: string) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: .74 })
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, .035), material)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function releaseCard(card: THREE.Group) {
  card.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose()
      material.dispose()
    }
  })
}

export class UsedCouponDrawer extends THREE.Group {
  private sliding = new THREE.Group()
  private cards = new Map<string, StoredCard>()
  private initialized = false
  private openness = 0

  constructor() {
    super()
    this.name = 'used-coupon-drawer'
    this.position.x = DRAWER_X
    this.sliding.name = 'sliding-drawer'
    this.add(this.sliding)

    // The runners stay under the tabletop while the tray moves toward the viewer.
    for (const x of [-2.27, 2.27]) {
      part(this, [.16, .16, 3.1], [x, -3.41, 1.69], '#655c42')
      part(this.sliding, [.12, .11, 2.94], [x, -3.34, 1.76], '#b8ad8b')
    }
    part(this, [DRAWER_WIDTH, .14, 3.16], [0, -3.73, 1.72], '#7f6849')
    part(this, [DRAWER_WIDTH, .65, .14], [0, -3.32, .17], '#8a704e')
    part(this, [DRAWER_WIDTH, .41, .2], [0, -2.7, 3.33], '#b99670')
    part(this, [.16, 1.14, 3.19], [DRAWER_WIDTH / 2 + .08, -3.2, 1.74], '#b99670')
    part(this.sliding, [4.5, .13, 3.11], [0, -3.595, 1.73], '#b6966b')
    part(this.sliding, [4.19, .03, 2.9], [0, -3.515, 1.75], '#8c987e')
    for (const x of [-2.17, 2.17]) {
      part(this.sliding, [.15, .5, 3.02], [x, -3.315, 1.76], '#b8976a')
    }
    part(this.sliding, [4.24, .5, .15], [0, -3.315, .29], '#af8c61')
    part(this.sliding, [DRAWER_WIDTH, .68, .2], [0, -3.25, 3.36], '#c5a078')

    const handle = part(this.sliding, [1.16, .095, .12], [0, -3.24, 3.65], '#c7a86b')
    handle.material.metalness = .62
    handle.material.roughness = .35
    for (const x of [-.49, .49]) {
      const mount = part(this.sliding, [.11, .135, .23], [x, -3.24, 3.55], '#b59865')
      mount.material.metalness = .55
    }
  }

  setEntries(entries: UsedCoupon[]) {
    const latest = [...entries]
      .sort((a, b) => Date.parse(b.usedAt) - Date.parse(a.usedAt) || a.id.localeCompare(b.id))
      .slice(0, 12)
      .reverse()
    const ids = new Set(latest.map(entry => entry.id))
    for (const [id, card] of this.cards) {
      if (ids.has(id)) continue
      this.sliding.remove(card.group)
      releaseCard(card.group)
      this.cards.delete(id)
    }
    latest.forEach((entry, index) => {
      let card = this.cards.get(entry.id)
      if (card && card.src !== entry.src) {
        this.sliding.remove(card.group)
        releaseCard(card.group)
        this.cards.delete(entry.id)
        card = undefined
      }
      if (!card) {
        const group = new THREE.Group()
        group.name = 'used-coupon-' + entry.id
        const width = Math.min(1.78, 1.06 * entry.aspect)
        const height = width / entry.aspect
        part(group, [width + .04, height + .04, .024], [0, 0, 0], '#f7eedc')
        const map = new THREE.TextureLoader().load(entry.src)
        map.colorSpace = THREE.SRGBColorSpace
        map.anisotropy = 4
        const image = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          new THREE.MeshStandardMaterial({ map, roughness: .82, color: '#f5efdf' }),
        )
        image.position.z = .014
        group.add(image)
        card = { group, src: entry.src, target: new THREE.Vector3(), angle: 0, pending: this.initialized, droppedAt: null }
        this.cards.set(entry.id, card)
        this.sliding.add(group)
      }
      let hash = 0
      for (const char of entry.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
      const row = Math.floor(index / 2)
      card.target.set((index % 2 - .5) * 1.98 + ((hash % 31) - 15) * .006,
        -3.465 + index * .008, 1.05 + row * .28)
      card.angle = ((hash % 101) / 100 - .5) * .24
      card.group.position.copy(card.target)
      card.group.rotation.set(-Math.PI / 2, 0, card.angle)
      card.group.visible = !card.pending
    })
    this.initialized = true
  }

  update(open: number, time: number, reducedMotion: boolean) {
    const amount = THREE.MathUtils.clamp(open, 0, 1)
    let changed = Math.abs(amount - this.openness) > .0001
    this.openness = amount
    this.sliding.position.z = amount * DRAWER_TRAVEL
    for (const card of this.cards.values()) {
      if (!card.pending) continue
      if (amount < .45) continue
      card.droppedAt ??= time
      const progress = reducedMotion ? 1 : THREE.MathUtils.clamp((time - card.droppedAt) / .9, 0, 1)
      const remaining = 1 - progress
      card.group.visible = true
      card.group.position.copy(card.target)
      card.group.position.y += 1.15 * remaining * remaining
      card.group.rotation.set(-Math.PI / 2 + remaining * .28, 0, card.angle + remaining * .18)
      changed = true
      if (progress === 1) card.pending = false
    }
    return changed
  }
}
