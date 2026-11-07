import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FLOWER_DRIFTS, flowerDrift, meadowRandom, terrainHeight } from './terrain'

const SPECIES = [
  { petal: '#9c79cb', tip: '#c4a4e5', center: '#8061a5' },
  { petal: '#d489a8', tip: '#f1b5cb', center: '#c18b54' },
  { petal: '#b49aca', tip: '#e8d7eb', center: '#d1ae6f' },
]

function flowerGeometry(species: number) {
  const parts: THREE.BufferGeometry[] = []
  const colors = SPECIES[species]
  const add = (geometry: THREE.BufferGeometry, hex: string) => {
    const color = new THREE.Color(hex)
    const positions = geometry.getAttribute('position')
    const shades = new Float32Array(positions.count * 3)
    for (let i = 0; i < positions.count; i++) color.toArray(shades, i * 3)
    geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3))
    parts.push(geometry)
  }
  const bud = (x: number, y: number, z: number, width: number, height: number, color: string) => {
    add(new THREE.OctahedronGeometry(1).scale(width, height, width).translate(x, y, z), color)
  }
  const stem = species === 0 ? .78 : .62
  add(new THREE.CylinderGeometry(.009, .018, stem, 3).toNonIndexed().translate(0, stem / 2, 0), '#657b3e')
  add(new THREE.OctahedronGeometry(1).scale(.106, .019, .037).rotateZ(.46).translate(.077, .24, 0), '#798d50')
  add(new THREE.OctahedronGeometry(1).scale(.096, .016, .035).rotateY(2.2).translate(-.067, .36, .037), '#859751')
  if (species === 0) {
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4
      const radius = .058 - i * .0045
      bud(Math.cos(angle) * radius, .48 + i * .058, Math.sin(angle) * radius,
        .073 - i * .005, .069 - i * .003, i % 2 ? colors.tip : colors.petal)
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3
      bud(Math.cos(angle) * .094, stem + Math.sin(angle) * .045, Math.sin(angle) * .09,
        .081, .051, i % 2 ? colors.tip : colors.petal)
    }
    bud(0, stem + .049, 0, .057, .053, colors.center)
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
      pose.position.set(x, terrainHeight(x, z) - .026, z)
      pose.rotation.set((random() - .5) * .32, random() * Math.PI * 2, (random() - .5) * .32)
      pose.scale.set(size, size * (.88 + random() * .25), size)
      pose.updateMatrix()
      poses[species].push(pose.matrix.clone())
    }
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true })
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
