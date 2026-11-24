import * as THREE from 'three'

export const REST_TILT = -.04
export const SLOT_EDGE = new THREE.Vector3(0, .105, 1.05)
export const READY_EDGE = new THREE.Vector3(.3, -.42, SLOT_EDGE.z)

export function couponDimensions(aspect: number) {
  const width = Math.min(2.28, 1.6 * aspect)
  return { width, height: width / aspect }
}

export function couponLeadingEdge(height: number, position: THREE.Vector3, rotation: THREE.Euler, result: THREE.Vector3) {
  return result.set(0, height / 2, 0).applyEuler(rotation).add(position)
}

export function couponPositionFromEdge(height: number, edge: THREE.Vector3, rotation: THREE.Euler, result: THREE.Vector3) {
  return result.set(0, height / 2, 0).applyEuler(rotation).negate().add(edge)
}
