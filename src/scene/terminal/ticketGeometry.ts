import * as THREE from 'three'
import { TICKET_DESIGN } from '../../coupons/catalog'

export function ticketGeometry(width: number, thickness: number) {
  const design = TICKET_DESIGN
  const scale = width / design.width
  const height = design.height * scale
  const right = width / 2
  const top = height / 2
  const corner = design.corner * scale
  const notch = design.notchRadius * scale
  const notchX = design.notchX * scale - right
  const shape = new THREE.Shape()
  const halfTurn = Math.PI
  const quarterTurn = halfTurn / 2

  shape.moveTo(-right + corner, top)
  shape.absarc(notchX, top, notch, halfTurn, 2 * halfTurn, false)
  shape.absarc(right - corner, top - corner, corner, quarterTurn, 0, true)
  shape.absarc(right - corner, -top + corner, corner, 0, -quarterTurn, true)
  shape.absarc(notchX, -top, notch, 0, halfTurn, false)
  shape.absarc(-right + corner, -top + corner, corner, -quarterTurn, -halfTurn, true)
  shape.absarc(-right + corner, top - corner, corner, halfTurn, quarterTurn, true)
  shape.closePath()

  const face = new THREE.ShapeGeometry(shape, 12)
  const positions = face.getAttribute('position')
  const uv = face.getAttribute('uv')
  for (let index = 0; index < uv.count; index++) {
    uv.setXY(index, positions.getX(index) / width + .5, positions.getY(index) / height + .5)
  }
  const paper = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 })
  paper.translate(0, 0, -thickness / 2)
  return { paper, face, faceZ: thickness / 2 + .001 }
}
