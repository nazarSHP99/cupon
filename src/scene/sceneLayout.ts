import * as THREE from 'three'
import { COUPON_BOX_DEPTH, COUPON_BOX_WIDTH, COUPON_PREVIEW_X } from './terminal/CouponBox'
import { DRAWER_WIDTH, DRAWER_X } from './terminal/UsedCouponDrawer'
import { INSTRUCTION_DEPTH, INSTRUCTION_WIDTH } from './terminal/InstructionCard'

const FOV = 39
const up = new THREE.Vector3(0, 1, 0)

export const TABLE_WIDTH = 11.6
export const TABLE_DEPTH = 7

export function getSceneLayout(width: number, height: number) {
  const portrait = width < 760 && height > width * 0.8
  const aspect = width / height
  const machineX = portrait ? 0.81 : 2.18
  const stackPosition = new THREE.Vector3(portrait ? -1.66 : -3.40, -2.225, 1.32)
  const stackScale = portrait ? 0.69 : 1
  const printerPosition = new THREE.Vector3(portrait ? -2.28 : -.86, -2.24, portrait ? -2.58 : -1.31)
  const printerScale = portrait ? 0.66 : 1
  const keypadScale = portrait ? .84 : .73
  const keypadPosition = new THREE.Vector3(portrait ? .46 : -.29, -2.24 + .47 * keypadScale, 2.43)
  const instructionPosition = new THREE.Vector3(portrait ? 2.35 : 4.03, -2.24, 2.12)
  const instructionScale = portrait ? .69 : 1
  const instructionAngle = .31
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
  const stackHalfWidth = COUPON_BOX_WIDTH * stackScale / 2
  const stackHalfDepth = COUPON_BOX_DEPTH * stackScale / 2
  fit([stackPosition.x - stackHalfWidth, -2.25, stackPosition.z - stackHalfDepth],
    [stackPosition.x + stackHalfWidth, stackPosition.y + 1.5 * stackScale, stackPosition.z + stackHalfDepth])
  fit(
    [printerPosition.x - 1.16 * printerScale, -2.24, printerPosition.z - .83 * printerScale],
    [printerPosition.x + 1.16 * printerScale, -2.24 + 3.8 * printerScale, printerPosition.z + .83 * printerScale],
  )
  fit([keypadPosition.x - 1.45 * keypadScale, -2.24, 1.61], [keypadPosition.x + 1.45 * keypadScale, -1.33, 3.4])
  const instructionHalfWidth = instructionScale *
    (INSTRUCTION_WIDTH * Math.cos(instructionAngle) + INSTRUCTION_DEPTH * Math.sin(instructionAngle)) / 2
  fit([instructionPosition.x - instructionHalfWidth, -2.24, 1.05],
    [instructionPosition.x + instructionHalfWidth, -2.2, 3.4])
  const farDistance = Math.max(34, Math.min(70, 30 / aspect))
  const browseSpan = (COUPON_BOX_WIDTH + Math.abs(COUPON_PREVIEW_X)) * stackScale
  const browseDistance = Math.max(7.2, browseSpan / (2 * halfHeight * aspect * .83))
  const browseTarget = stackPosition.clone().add(new THREE.Vector3(COUPON_PREVIEW_X * stackScale / 2, .92 * stackScale, .02))
  const drawerDistance = Math.max(8.8, (DRAWER_WIDTH + .85) / (2 * halfHeight * aspect * .9))
  const drawerTarget = new THREE.Vector3(DRAWER_X + (portrait ? 0 : .52), -3.13, 4.96)
  const instructionDistance = instructionScale / (2 * halfHeight) *
    Math.max(INSTRUCTION_WIDTH / (aspect * .86), INSTRUCTION_DEPTH / .76)
  return {
    portrait, machineX, stackPosition, stackScale, printerPosition, printerScale, keypadPosition, keypadScale,
    nearPosition: nearTarget.clone().addScaledVector(direction, distance), nearTarget,
    browsePosition: browseTarget.clone().add(new THREE.Vector3(0, browseDistance * .8, browseDistance * .6)),
    browseTarget,
    drawerPosition: drawerTarget.clone().add(new THREE.Vector3(0, drawerDistance * .85, drawerDistance * .53)),
    drawerTarget,
    instructionPosition, instructionScale, instructionAngle,
    instructionCamera: instructionPosition.clone().add(
      new THREE.Vector3(0, instructionDistance, instructionDistance * .11).applyAxisAngle(up, instructionAngle),
    ),
    farPosition: new THREE.Vector3(farDistance * 0.19, -3.8, farDistance),
    farTarget: new THREE.Vector3(-0.2, -0.65, 0),
  }
}

export function sceneCamera() {
  return new THREE.PerspectiveCamera(FOV, 1, 0.12, 210)
}
