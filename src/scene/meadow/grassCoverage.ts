// A cone enclosing all camera directions, with a sphere enclosing all camera eyes.
// Both bounds also contain every interpolated camera between their endpoints.
export interface GrassCoverage {
  eye: [number, number, number]
  eyeRadius: number
  axis: [number, number, number]
  halfAngle: number
}

export function tileInCameraCoverage(coverage: GrassCoverage[], x: number, y: number, z: number, radius: number, reach = Infinity) {
  if (!coverage.length) return true
  return coverage.some(cone => {
    const dx = x - cone.eye[0], dy = y - cone.eye[1], dz = z - cone.eye[2]
    const distance = Math.hypot(dx, dy, dz)
    const margin = cone.eyeRadius + radius
    if (distance - margin > reach) return false
    if (distance <= margin) return true
    const cosine = (dx * cone.axis[0] + dy * cone.axis[1] + dz * cone.axis[2]) / distance
    const angle = Math.acos(Math.max(-1, Math.min(1, cosine)))
    return angle <= cone.halfAngle + Math.asin(Math.min(1, margin / distance))
  })
}
