import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { TABLE_DEPTH, TABLE_WIDTH } from '../sceneLayout'

function randomSource() {
  let seed = 381413
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function woodTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 192
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(canvas.width, canvas.height)
  const random = randomSource()
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const knotX = (x - 489) * .29
    const knotY = (y - 103) * 1.17
    const knot = Math.exp(-(knotX * knotX + knotY * knotY) / 610)
    const flow = y + 4 * Math.sin(x * .012 + y * .028) + 8 * Math.sin(x * .004 + y * .051)
      + 17 * knot * Math.tanh(knotY * .1)
    const grain = Math.sin(flow * 1.59) * 3 + Math.sin(flow * .34) * 7 + Math.sin(flow * .088 + x * .003) * 9
    const tone = grain * .58 - knot * 13 + (random() - .5) * 4
    const i = (y * canvas.width + x) * 4
    pixels.data[i] = 168 + tone
    pixels.data[i + 1] = 132 + tone * .84
    pixels.data[i + 2] = 90 + tone * .63
    pixels.data[i + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  return map
}

export function woodenTable() {
  const table = new THREE.Group()
  const map = woodTexture()
  const wood = (size: [number, number, number], position: [number, number, number], color: string, radius: number) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, radius), new THREE.MeshStandardMaterial({ color, map, roughness: .71 }))
    mesh.position.set(...position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    table.add(mesh)
    return mesh
  }
  for (let i = 0; i < 5; i++) {
    const plankDepth = TABLE_DEPTH / 5
    wood([TABLE_WIDTH, .27, plankDepth - .012], [0, -2.375, (i - 2) * plankDepth], ['#e4c5a4', '#fff2d8', '#f1d6b5', '#edc8a0', '#f7dfc3'][i], .043)
  }
  const legX = TABLE_WIDTH / 2 - .7
  const legZ = TABLE_DEPTH / 2 - .75
  for (const z of [-legZ, legZ]) wood([TABLE_WIDTH - .62, .4, .2], [0, -2.67, z], '#b99371', .028)
  for (const x of [-legX, legX]) {
    wood([.22, .4, legZ * 2 + .2], [x, -2.67, 0], '#c49d79', .028)
    for (const z of [-legZ, legZ]) {
      const leg = wood([2.57, .47, .44], [x, -3.78, z], '#d9b695', .035)
      leg.rotation.z = Math.PI / 2 + Math.sign(x) * .055
    }
  }
  return table
}
