import * as THREE from 'three'

const FOV = 39
const up = new THREE.Vector3(0, 1, 0)

export const TABLE_WIDTH = 11.6
export const TABLE_DEPTH = 7
export const DEMO_WIDTH = 1.74
export const DEMO_LAYOUT = [
  { index: 1, x: -.68, z: -1.14, angle: .09 },
  { index: 2, x: .58, z: .14, angle: -.12 },
  { index: 0, x: -.54, z: 1.42, angle: .08 },
]

export function getSceneLayout(width: number, height: number) {
  const portrait = width < 760 && height > width * 0.8
  const aspect = width / height
  const machineX = portrait ? 0.81 : 2.18
  const stackPosition = new THREE.Vector3(portrait ? -1.66 : -3.40, -2.225, 1.32)
  const stackScale = portrait ? 0.69 : 1
  const printerPosition = new THREE.Vector3(portrait ? -2.06 : -3.65, -2.24, -1.49)
  const printerScale = portrait ? 0.66 : 1
  const keypadScale = portrait ? 1 : 0.83
  const keypadPosition = new THREE.Vector3(portrait ? 0.84 : -0.29, -2.24 + 0.47 * keypadScale, 2.43)
  const direction = new THREE.Vector3(portrait ? 0.13 : 0.27, portrait ? 0.31 : 0.28, 1).normalize()
  const right = new THREE.Vector3().crossVectors(up, direction).normalize()
  const cameraUp = new THREE.Vector3().crossVectors(direction, right)
  const nearTarget = new THREE.Vector3(portrait ? -0.25 : -0.62, portrait ? -0.15 : -0.27, 0.67)
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  let distance = 7.6
  const fit = (min: number[], max: number[]) => {
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      const p = new THREE.Vector3(x, y, z).sub(nearTarget)
      const fitX = Math.abs(p.dot(right)) / (halfHeight * aspect * 0.89)
      const fitY = Math.abs(p.dot(cameraUp)) / (halfHeight * 0.88)
      distance = Math.max(distance, p.dot(direction) + Math.max(fitX, fitY))
    }
  }
  fit([machineX - 1.67, -2.24, -0.66], [machineX + 1.67, 2.28, 2.09])
  for (const { x, z } of DEMO_LAYOUT) {
    const px = stackPosition.x + x * stackScale
    const pz = stackPosition.z + z * stackScale
    fit([px - .96 * stackScale, -2.25, pz - .63 * stackScale], [px + .96 * stackScale, -2.05, pz + .63 * stackScale])
  }
  fit(
    [printerPosition.x - 1.16 * printerScale, -2.24, printerPosition.z - .83 * printerScale],
    [printerPosition.x + 1.16 * printerScale, -2.24 + 3.8 * printerScale, printerPosition.z + .83 * printerScale],
  )
  fit([keypadPosition.x - 1.45 * keypadScale, -2.24, 1.61], [keypadPosition.x + 1.45 * keypadScale, -1.33, 3.4])
  const farDistance = Math.max(34, Math.min(70, 30 / aspect))
  return {
    portrait, machineX, stackPosition, stackScale, printerPosition, printerScale, keypadPosition, keypadScale,
    nearPosition: nearTarget.clone().addScaledVector(direction, distance), nearTarget,
    farPosition: new THREE.Vector3(farDistance * 0.19, -3.8, farDistance),
    farTarget: new THREE.Vector3(-0.2, -0.65, 0),
  }
}

export function sceneCamera() {
  return new THREE.PerspectiveCamera(FOV, 1, 0.12, 210)
}
