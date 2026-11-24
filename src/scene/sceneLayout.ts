import * as THREE from 'three'
import { COUPON_BOX_DEPTH, COUPON_BOX_WIDTH, COUPON_PREVIEW_X, couponBoxViewPoints } from './terminal/CouponBox'
import { DRAWER_WIDTH, DRAWER_X } from './terminal/UsedCouponDrawer'
import { INSTRUCTION_DEPTH, INSTRUCTION_WIDTH } from './terminal/InstructionCard'

import type { GrassCoverage } from './meadow/grassCoverage'

const FOV = 39
const up = new THREE.Vector3(0, 1, 0)
export const COMPACT_SCENE_WIDTH = 1100
export const KEYPAD_TILT = -1.08

export const TABLE_WIDTH = 11.6
export const TABLE_DEPTH = 7

export function getSceneLayout(width: number, height: number) {
  const compact = width <= COMPACT_SCENE_WIDTH
  const portrait = compact && height > width * .8
  const aspect = width / height
  const machineX = compact ? .2 : 2.18
  const machinePosition = new THREE.Vector3(machineX, 0, compact ? -1.55 : 0)
  const stackPosition = new THREE.Vector3(compact ? -1.5 : -3.40, -2.225, compact ? .65 : 1.32)
  const stackScale = compact ? .68 : 1
  const printerPosition = new THREE.Vector3(compact ? 1.2 : -.86, -2.24, compact ? .45 : -1.31)
  const printerScale = compact ? .66 : 1
  const keypadScale = compact ? .8 : .73
  const keypadPosition = new THREE.Vector3(compact ? 1.2 : -.29, -2.24 + .60 * keypadScale, compact ? 2.5 : 2.43)
  const instructionPosition = new THREE.Vector3(compact ? -1.5 : 4.16, -2.24, compact ? 2.7 : 2.22)
  const instructionScale = compact ? .6 : 1
  const instructionAngle = compact ? .31 : .28
  const direction = new THREE.Vector3(compact ? .10 : .27, compact ? .72 : .28, 1).normalize()
  const right = new THREE.Vector3().crossVectors(up, direction).normalize()
  const cameraUp = new THREE.Vector3().crossVectors(direction, right)
  const nearTarget = new THREE.Vector3(compact ? 0 : -.62, compact ? -.4 : -.27, compact ? .4 : .67)
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  let distance = compact ? 6 : 7.6
  const fit = (min: number[], max: number[], matrix?: THREE.Matrix4) => {
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      const p = new THREE.Vector3(x, y, z)
      if (matrix) p.applyMatrix4(matrix)
      p.sub(nearTarget)
      const fitX = Math.abs(p.dot(right)) / (halfHeight * aspect * (compact ? .95 : .89))
      const upDistance = p.dot(cameraUp)
      const verticalMargin = compact ? Math.max(.55, 1 - (upDistance > 0 ? 160 : 40) / height) : .88
      const fitY = Math.abs(upDistance) / (halfHeight * verticalMargin)
      distance = Math.max(distance, p.dot(direction) + Math.max(fitX, fitY))
    }
  }
  fit([machineX - 1.67, -2.24, machinePosition.z - .66], [machineX + 1.67, 2.28, machinePosition.z + .93])
  fit([machineX - 1.17, -1.18, machinePosition.z + 1.03], [machineX + 1.17, .56, machinePosition.z + 1.13])
  const stackHalfWidth = COUPON_BOX_WIDTH * stackScale / 2
  const stackHalfDepth = COUPON_BOX_DEPTH * stackScale / 2
  fit([stackPosition.x - stackHalfWidth, -2.25, stackPosition.z - stackHalfDepth],
    [stackPosition.x + stackHalfWidth, stackPosition.y + 1.5 * stackScale, stackPosition.z + stackHalfDepth])
  fit(
    [printerPosition.x - 1.16 * printerScale, -2.24, printerPosition.z - .83 * printerScale],
    [printerPosition.x + 1.18 * printerScale, -2.24 + 1.06 * printerScale, printerPosition.z + .83 * printerScale],
  )
  fit([printerPosition.x - .925 * printerScale, -2.24 + 1.045 * printerScale, printerPosition.z + .2 * printerScale],
    [printerPosition.x + .925 * printerScale, -2.24 + 3.795 * printerScale, printerPosition.z + .42 * printerScale])
  const keypadMatrix = new THREE.Matrix4().compose(keypadPosition,
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), KEYPAD_TILT), new THREE.Vector3().setScalar(keypadScale))
  const keypadBounds = new THREE.Box3(new THREE.Vector3(-1.415, -.86, -.22), new THREE.Vector3(1.415, .86, .355))
    .applyMatrix4(keypadMatrix)
  fit([-1.415, -.86, -.22], [1.415, .86, .355], keypadMatrix)
  fit([-INSTRUCTION_WIDTH / 2, 0, -INSTRUCTION_DEPTH / 2], [INSTRUCTION_WIDTH / 2, .12, INSTRUCTION_DEPTH / 2],
    new THREE.Matrix4().compose(instructionPosition, new THREE.Quaternion().setFromAxisAngle(up, instructionAngle), new THREE.Vector3().setScalar(instructionScale)))
  const farDistance = Math.max(34, Math.min(70, 30 / aspect))
  const browseAxis = compact && !portrait ? new THREE.Vector3(0, .58, .815).normalize() : new THREE.Vector3(0, .8, .6)
  const browseSpan = (COUPON_BOX_WIDTH + (portrait ? 0 : Math.abs(COUPON_PREVIEW_X))) * stackScale
  let browseDistance = Math.max(portrait ? 4.5 * stackScale / (2 * halfHeight * .78) : 7.2 * (compact ? stackScale : 1), browseSpan / (2 * halfHeight * aspect * (compact ? .88 : .83)))
  const browseTarget = stackPosition.clone().add(new THREE.Vector3(portrait ? 0 : COUPON_PREVIEW_X * stackScale / 2, (portrait ? 1.30 : .92) * stackScale, portrait ? -.45 : .02))
  if (compact) {
    const browseUp = new THREE.Vector3(0, browseAxis.z, -browseAxis.y)
    const verticalMargin = Math.min(.8, Math.max(.5, 1 - 160 / height))
    for (const point of couponBoxViewPoints(portrait)) {
      point.multiplyScalar(stackScale).add(stackPosition).sub(browseTarget)
      browseDistance = Math.max(browseDistance, point.dot(browseAxis) + Math.max(
        Math.abs(point.x) / (halfHeight * aspect * .88), Math.abs(point.dot(browseUp)) / (halfHeight * verticalMargin),
      ))
    }
  }
  const drawerDistance = Math.max(8.8, (DRAWER_WIDTH + .85) / (2 * halfHeight * aspect * .9))
  const drawerTarget = new THREE.Vector3(DRAWER_X + (portrait ? 0 : .52), -3.13, 4.96)
  const instructionDistance = instructionScale / (2 * halfHeight) *
    Math.max(INSTRUCTION_WIDTH / (aspect * .86), INSTRUCTION_DEPTH / .76)
  const keypadTarget = keypadPosition.clone().add(new THREE.Vector3(0, .08, .04))
  const keypadDistance = Math.max(2.83 * keypadScale / (2 * halfHeight * aspect * .86), 1.72 * keypadScale / (2 * halfHeight * .70))
  return {
    compact, portrait, machineX, machinePosition, stackPosition, stackScale, printerPosition, printerScale, keypadPosition, keypadScale,
    keypadBounds,
    rackControlsWidth: compact ? Math.min(216, width - 64) * (2 * halfHeight * browseDistance) / (height * stackScale) : 1.15,
    rackControlsDepth: compact ? 40 * (2 * halfHeight * browseDistance) / (height * browseAxis.y * stackScale) : .28,
    keypadTarget, keypadCamera: keypadTarget.clone().add(new THREE.Vector3(0, .882, .471).multiplyScalar(keypadDistance)),
    nearPosition: nearTarget.clone().addScaledVector(direction, distance), nearTarget,
    browsePosition: browseTarget.clone().addScaledVector(browseAxis, browseDistance),
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

export function grassCameraCoverage(): GrassCoverage[] {
  const cones: GrassCoverage[] = []
  // Cover phone, tablet, desktop and their intermediate aspect ratios together.
  const ratios = [.2, .3, .5, .8, 1.176470588, 1.2, 2, 4]
  for (const widths of [[320, 560, 820, 1024, 1100], [1280]]) for (let i = 1; i < ratios.length; i++) {
    if (widths[0] > COMPACT_SCENE_WIDTH && ratios[i - 1] < .5) continue
    const layouts = widths.flatMap(width => [ratios[i - 1], ratios[i]].map(aspect => getSceneLayout(width, width / aspect)))
    for (const view of ['overview', 'drawer', 'focus'] as const) {
      const cameras = layouts.flatMap(layout => view === 'overview'
        ? [[layout.farPosition, layout.farTarget], [layout.nearPosition, layout.nearTarget]]
        : view === 'drawer' ? [[layout.nearPosition, layout.nearTarget], [layout.drawerPosition, layout.drawerTarget]]
          : [[layout.nearPosition, layout.nearTarget], [layout.drawerPosition, layout.drawerTarget],
            [layout.browsePosition, layout.browseTarget], [layout.instructionCamera, layout.instructionPosition],
            [layout.keypadCamera, layout.keypadTarget]])
      const eye = new THREE.Vector3()
      const axis = new THREE.Vector3()
      const directions = cameras.map(([position, target]) => {
        eye.add(position)
        const direction = target.clone().sub(position).normalize()
        axis.add(direction)
        return direction
      })
      eye.divideScalar(cameras.length)
      axis.normalize()
      const eyeRadius = Math.max(...cameras.map(([position]) => position.distanceTo(eye))) + 2
      const spread = Math.max(...directions.map(direction => axis.angleTo(direction)))
      // The diagonal FOV includes the shifted mobile viewport, plus a generous vertical margin.
      const halfAngle = spread + Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.hypot(ratios[i], 1.2))
      cones.push({ eye: eye.toArray(), eyeRadius, axis: axis.toArray(), halfAngle })
    }
  }
  return cones
}
