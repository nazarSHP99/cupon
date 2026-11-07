import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Receipt } from '../../coupons/receipt'

function bodyPart(parent: THREE.Group, size: [number, number, number], position: [number, number, number], color: string, radius = 0.06) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 4, radius), new THREE.MeshStandardMaterial({ color, roughness: 0.48 }))
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export class ReceiptPrinter extends THREE.Group {
  private paper: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null = null
  private indicator: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  private progress = -1
  private readonly columns = 10
  private readonly rows = 48

  constructor() {
    super()
    bodyPart(this, [2.15, 0.86, 1.6], [0, 0.47, 0], '#465448', 0.14)
    bodyPart(this, [2.09, 0.2, 1.56], [0, 0.9, -0.02], '#edead9', 0.075)
    bodyPart(this, [1.98, 0.04, 0.25], [0, 1.005, 0.19], '#8b9580', 0.018)
    bodyPart(this, [1.86, 0.025, 0.12], [0, 1.028, 0.2], '#27392e', 0.01)
    bodyPart(this, [2.0, 0.055, 0.11], [0, 1.03, 0.31], '#e4dfcc', 0.02)
    bodyPart(this, [0.36, 0.055, 0.025], [-0.65, 0.39, 0.812], '#e66b43', 0.013)
    bodyPart(this, [1.3, 0.022, 0.02], [0.04, 0.64, 0.811], '#7b8a70', 0.009)
    bodyPart(this, [0.7, 0.022, 0.02], [-0.26, 0.57, 0.811], '#7b8a70', 0.009)
    this.indicator = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.025), new THREE.MeshStandardMaterial({ color: '#bed6a1', emissive: '#8cae67', emissiveIntensity: 0.5 }))
    this.indicator.position.set(0.72, 0.37, 0.813)
    this.add(this.indicator)
    for (const x of [-0.78, 0.78]) for (const z of [-0.5, 0.5]) {
      bodyPart(this, [0.3, 0.09, 0.3], [x, 0.055, z], '#293b2f', 0.035)
    }
    bodyPart(this, [0.18, 0.16, 0.22], [1.08, 0.28, -0.3], '#2f4034', 0.04)
  }

  setReceipt(receipt: Receipt | null) {
    if (this.paper) {
      this.remove(this.paper)
      this.paper.geometry.dispose()
      this.paper.material.map?.dispose()
      this.paper.material.dispose()
      this.paper = null
    }
    this.progress = -1
    if (!receipt) return
    const geometry = new THREE.BufferGeometry()
    const count = (this.columns + 1) * (this.rows + 1)
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage))
    const indices: number[] = []
    for (let row = 0; row < this.rows; row++) for (let column = 0; column < this.columns; column++) {
      const a = row * (this.columns + 1) + column
      const b = a + 1
      const c = a + this.columns + 1
      indices.push(a, b, c, b, c + 1, c)
    }
    geometry.setIndex(indices)
    const map = new THREE.CanvasTexture(receipt.canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 4
    this.paper = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, transparent: true, roughness: 0.86 }))
    this.paper.castShadow = true
    this.paper.receiveShadow = true
    this.paper.frustumCulled = false
    this.add(this.paper)
    this.feed(0)
  }

  feed(progress: number) {
    if (!this.paper || this.progress === progress) return
    this.progress = progress
    this.paper.visible = progress > 0.005
    const positions = this.paper.geometry.getAttribute('position') as THREE.BufferAttribute
    const uvs = this.paper.geometry.getAttribute('uv') as THREE.BufferAttribute
    const length = 2.75 * progress
    for (let row = 0; row <= this.rows; row++) for (let column = 0; column <= this.columns; column++) {
      const index = row * (this.columns + 1) + column
      const u = column / this.columns
      const t = row / this.rows
      const distance = t * length
      const curl = 0.09 * Math.sin(distance * 1.5) + 0.1 * t ** 4 + 0.025 * (u * 2 - 1) ** 2 * t
      positions.setXYZ(index, (u - 0.5) * 1.85, 1.045 + distance, 0.2 + curl)
      uvs.setXY(index, u, 1 - progress + t * progress)
    }
    positions.needsUpdate = true
    uvs.needsUpdate = true
    this.paper.geometry.computeVertexNormals()
  }

  setStatus(printing: boolean, clock: number) {
    this.indicator.material.color.set(printing ? '#f3b778' : '#bed6a1')
    this.indicator.material.emissive.set(printing ? '#e4934b' : '#8cae67')
    this.indicator.material.emissiveIntensity = printing ? 0.6 + Math.sin(clock * 12) * 0.4 : 0.5
  }
}
