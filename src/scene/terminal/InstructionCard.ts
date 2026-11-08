import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { INSTRUCTION_STEPS } from '../../components/instructions'
import { canvasTexture } from './canvasTexture'

export const INSTRUCTION_WIDTH = 1.76
export const INSTRUCTION_DEPTH = 2.14

function drawInstructions(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#f7ead0'
  ctx.fillRect(0, 0, 880, 1070)
  ctx.strokeStyle = '#ba9d73'
  ctx.lineWidth = 3
  ctx.strokeRect(27, 27, 826, 1016)
  ctx.fillStyle = '#96492f'
  ctx.font = 'bold 35px Arial, sans-serif'
  ctx.fillText('cupon.', 61, 93)
  ctx.fillStyle = '#342e24'
  ctx.font = 'bold 71px Arial, sans-serif'
  ctx.fillText('Як це працює', 57, 184)

  INSTRUCTION_STEPS.forEach(({ title, body }, index) => {
    const y = 235 + index * 194
    ctx.fillStyle = '#ba9d73'
    ctx.fillRect(61, y, 758, 2)
    ctx.fillStyle = '#96492f'
    ctx.font = 'bold 28px Arial, sans-serif'
    ctx.fillText(String(index + 1).padStart(2, '0'), 62, y + 53)
    ctx.fillStyle = '#342e24'
    ctx.font = 'bold 37px Arial, sans-serif'
    ctx.fillText(title, 135, y + 53)
    ctx.font = '34px Arial, sans-serif'
    let line = ''
    let baseline = y + 100
    for (const word of body.split(' ')) {
      const next = line ? line + ' ' + word : word
      if (line && ctx.measureText(next).width > 682) {
        ctx.fillText(line, 135, baseline)
        baseline += 39
        line = word
      } else line = next
    }
    ctx.fillText(line, 135, baseline)
  })
}

export function instructionCard() {
  const card = new THREE.Group()
  const edge = new THREE.Mesh(new RoundedBoxGeometry(INSTRUCTION_WIDTH, .025, INSTRUCTION_DEPTH, 2, .009),
    new THREE.MeshStandardMaterial({ color: '#dac5a4', roughness: .9 }))
  edge.position.y = .0125
  edge.castShadow = true
  card.add(edge)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(INSTRUCTION_WIDTH, INSTRUCTION_DEPTH).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: canvasTexture(880, 1070, drawInstructions), toneMapped: false }))
  face.position.y = .026
  card.add(face)
  return card
}
