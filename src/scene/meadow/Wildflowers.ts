import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FLOWER_DRIFTS, flowerDrift, hillTurf, meadowRandom, terrainHeight } from './terrain'

const SPECIES = [
  { petal: '#77539c', tip: '#b796cf', center: '#80709a' },
  { petal: '#a65580', tip: '#e9a7bf', center: '#c7a166' },
  { petal: '#afa1c2', tip: '#f2e4e6', center: '#d7b16c' },
]

function petal(length: number, halfWidth: number, lift: number, cup: number) {
  const positions = [0, 0, 0]
  for (const t of [.23, .49, .73, .9]) {
    const roundness = Math.sin(Math.PI * t) ** .66
    for (const side of [-1, 0, 1]) {
      positions.push(side * halfWidth * roundness * (.7 + .3 * t), lift * t * t + cup * side * side * roundness, t * length)
    }
  }
  const tip = positions.length / 3
  positions.push(0, lift, length)
  const indices = [0, 1, 2, 0, 2, 3]
  for (let row = 1; row < tip - 3; row += 3) for (let col = 0; col < 2; col++) {
    const a = row + col, b = a + 3
    indices.push(a, b, a + 1, a + 1, b, b + 1)
  }
  indices.push(tip - 3, tip, tip - 2, tip - 2, tip, tip - 1)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function flowerGeometry(species: number) {
  const parts: THREE.BufferGeometry[] = []
  const colors = SPECIES[species]
  const add = (geometry: THREE.BufferGeometry, base: string, tip = base, axis = 1) => {
    const shade = new THREE.Color(base), highlight = new THREE.Color(tip), color = new THREE.Color()
    const positions = geometry.getAttribute('position')
    const shades = new Float32Array(positions.count * 3)
    geometry.computeBoundingBox()
    const min = geometry.boundingBox!.min.getComponent(axis)
    const span = geometry.boundingBox!.max.getComponent(axis) - min
    for (let i = 0; i < positions.count; i++) {
      const t = (positions.getComponent(i, axis) - min) / span
      color.copy(shade).lerp(highlight, t).toArray(shades, i * 3)
    }
    geometry.deleteAttribute('uv')
    geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3))
    parts.push(geometry)
    return geometry
  }
  const stemHeight = species === 0 ? .98 : .80
  const bend = species === 1 ? .135 : .082
  const stem = new THREE.CylinderGeometry(.006, .014, stemHeight, 5, 4).translate(0, stemHeight / 2, 0)
  const stemVertices = stem.getAttribute('position')
  for (let i = 0; i < stemVertices.count; i++) {
    const t = stemVertices.getY(i) / stemHeight
    stemVertices.setX(i, stemVertices.getX(i) + bend * t * t)
  }
  stem.computeVertexNormals()
  add(stem, '#4d663c', '#71864d')
  for (const [y, direction] of [[.26, 1.3], [.43, -1.55]]) {
    add(petal(.18, .028, .078, .012), '#47663e', '#7c9253', 2)
      .rotateY(direction).translate(bend * (y / stemHeight) ** 2, y, 0)
  }
  if (species === 0) {
    for (let i = 0; i < 10; i++) {
      const angle = i * 2.39
      const y = .55 + i * .048
      const size = 1 - i * .061
      add(new THREE.SphereGeometry(1, 6, 3), colors.petal, colors.tip)
        .scale(.045 * size, .064 * size, .037 * size).rotateZ(-.42).translate(.043 * size, 0, 0)
        .rotateY(angle).translate(bend * (y / stemHeight) ** 2, y, 0)
    }
  } else {
    const lobes = species === 1 ? 5 : 7
    const tilt = species === 1 ? .29 : -.22
    for (let i = 0; i < lobes; i++) {
      const angle = i * Math.PI * 2 / lobes + Math.sin(i * 1.7) * .075
      const length = .137 + Math.sin(i * 2.43 + species) * .019
      add(petal(length, species === 1 ? .067 : .044, .015 + Math.cos(i * 1.8) * .022, .024),
        colors.petal, colors.tip, 2).translate(0, .004, .031).rotateY(angle)
        .rotateX(tilt).rotateZ(.16).translate(bend, stemHeight, 0)
    }
    add(new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#9a714a', colors.center)
      .scale(.055, .027, .055).rotateX(tilt).rotateZ(.16).translate(bend, stemHeight + .009, 0)
  }
  const geometry = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  return geometry
}

export function wildflowers(compact: boolean) {
  const field = new THREE.Group()
  field.name = 'meadow-wildflowers'
  const random = meadowRandom(279113)
  const poses = SPECIES.map(() => [] as THREE.Matrix4[])
  const pose = new THREE.Object3D()
  for (const drift of FLOWER_DRIFTS) {
    const attempts = Math.ceil(drift.width * drift.depth * (compact ? 15 : 23))
    for (let i = 0; i < attempts; i++) {
      const u = (random() - .5) * drift.width * 2.2
      const v = (random() - .5) * drift.depth * 2.5
      const x = drift.x + u * drift.cos - v * drift.sin
      const z = drift.z + u * drift.sin + v * drift.cos
      if (random() > flowerDrift(drift, x, z)) continue
      const variety = random()
      const species = variety < .8 ? drift.species : (drift.species + (variety < .91 ? 1 : 2)) % SPECIES.length
      const size = .55 + random() * .6
      const y = terrainHeight(x, z)
      const stature = 1 - .27 * hillTurf(y, 1)
      pose.position.set(x, y - .026, z)
      pose.rotation.set((random() - .5) * .32, random() * Math.PI * 2, (random() - .5) * .32)
      pose.scale.set(size, size * (.88 + random() * .25) * stature, size)
      pose.updateMatrix()
      poses[species].push(pose.matrix.clone())
    }
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  const shade = new THREE.Color()
  for (let species = 0; species < SPECIES.length; species++) {
    const flowers = new THREE.InstancedMesh(flowerGeometry(species), material, poses[species].length)
    flowers.name = ['lavender-spires', 'pink-blossoms', 'pale-blossoms'][species]
    poses[species].forEach((matrix, index) => {
      flowers.setMatrixAt(index, matrix)
      shade.setScalar(.82 + random() * .28)
      flowers.setColorAt(index, shade)
    })
    flowers.computeBoundingSphere()
    field.add(flowers)
  }
  return field
}
