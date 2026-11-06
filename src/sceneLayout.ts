import * as THREE from 'three'

export function getSceneLayout(width: number, height: number) {
  const portrait = width < 760 && height > width * 0.8
  const machineX = portrait ? 0.3 : 1.85
  const stackPosition: [number, number, number] = portrait ? [-0.55, -2.225, 2] : [-2.45, -2.225, 1.1]
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(...(portrait ? [1.7, 3.7, 10.5] : [4.4, 3.3, 10]) as [number, number, number])
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  const projected = new THREE.Box2()
  const point = new THREE.Vector3()
  const include = (min: [number, number, number], max: [number, number, number]) => {
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      point.set(x, y, z).project(camera)
      projected.expandByPoint(new THREE.Vector2(point.x, point.y))
    }
  }
  include([machineX - 1.7, -2.25, -0.7], [machineX + 1.7, 2.3, 2.1])
  include([stackPosition[0] - 1.55, -2.25, stackPosition[2] - 1.1], [stackPosition[0] + 1.55, -2.05, stackPosition[2] + 1.1])
  const size = projected.getSize(new THREE.Vector2())
  const center = projected.getCenter(new THREE.Vector2())
  const margin = Math.min(64, Math.max(18, width * 0.035))
  const availableHeight = Math.max(120, height - (portrait ? 200 : 88))
  const zoom = Math.min((width - margin * 2) / size.x, availableHeight / size.y)
  const shiftUp = portrait ? 85 : 8
  const target = right.multiplyScalar(center.x).add(up.multiplyScalar(center.y - shiftUp / zoom))
  camera.position.add(target)
  camera.lookAt(target)
  camera.left = -width / 2
  camera.right = width / 2
  camera.top = height / 2
  camera.bottom = -height / 2
  camera.zoom = zoom
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  const printerPosition: [number, number, number] = portrait ? [-1.88, -2.24, 0.4] : [stackPosition[0] - 1.45, -2.24, stackPosition[2] - 2.3]
  return {
    portrait,
    machineX,
    stackPosition,
    zoom,
    cameraPosition: camera.position.toArray() as [number, number, number],
    cameraTarget: target.toArray() as [number, number, number],
    printerPosition,
    printerScale: portrait ? 0.5 : 1,
  }
}
