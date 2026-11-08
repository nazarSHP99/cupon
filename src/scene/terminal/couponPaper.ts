import * as THREE from 'three'
import { imageTicketShapes } from './imageTicketShapes'
import { extrudedTicketGeometry, ticketGeometry } from './ticketGeometry'

interface Artwork {
  src: string
  aspect: number
  demo: boolean
}

export function couponPaper(artwork: Artwork, maxWidth: number, maxHeight: number, onReady: () => void) {
  const width = Math.min(maxWidth, maxHeight * artwork.aspect)
  const height = width / artwork.aspect
  const thickness = .024
  const known = artwork.demo ? ticketGeometry(width, thickness) : null
  const group = new THREE.Group()
  const empty = () => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3))
  const paper = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(
    known?.paper ?? empty(), new THREE.MeshStandardMaterial({ color: '#f3e7d3', roughness: .84 }),
  )
  const face = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(
    known?.face ?? empty(), new THREE.MeshStandardMaterial({ alphaTest: .02, roughness: .72 }),
  )
  let disposed = false
  const map = new THREE.TextureLoader().load(artwork.src, texture => {
    if (disposed) return
    if (!known) {
      const shapes = imageTicketShapes(texture.image, width, height)
      if (shapes.length) {
        const geometry = extrudedTicketGeometry(shapes, width, height, thickness)
        paper.geometry.dispose()
        face.geometry.dispose()
        paper.geometry = geometry.paper
        face.geometry = geometry.face
      }
    }
    onReady()
  })
  map.addEventListener('dispose', () => { disposed = true })
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  face.material.map = map
  face.position.z = thickness / 2 + .001
  paper.castShadow = true
  group.add(paper, face)
  return group
}
