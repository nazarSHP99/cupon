import * as THREE from 'three'
import type { Phase } from './MachineScene'

const columns = 78
const rows = 39
const pitch = 10
const phases: Record<Phase, [string, string]> = {
  empty: ['ОБЕРИ', 'КУПОН'],
  ready: ['ВСТАВ', 'КУПОН'],
  inserting: ['ЗЧИТУЮ', ''],
  printing: ['ДРУКУЮ', 'ЧЕК'],
  success: ['ГОТОВО', ':)'],
}

function context(width: number, height: number, willReadFrequently = false) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas.getContext('2d', { willReadFrequently })!
}

export class LedDisplay {
  private pixels = context(columns, rows, true)
  private face = context(columns * pitch, rows * pitch)
  private idleFace = context(columns * pitch, rows * pitch)
  private signature = ''
  private start = 0
  private phase: Phase
  readonly texture = new THREE.CanvasTexture(this.face.canvas)

  constructor(phase: Phase) {
    this.phase = phase
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 8
    this.idleFace.fillStyle = '#121119'
    this.idleFace.fillRect(0, 0, columns * pitch, rows * pitch)
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      this.dot(this.idleFace, column, row, '#292630', 2.6)
    }
    this.update(0, true)
    this.signature = ''
  }

  setPhase(phase: Phase, time: number) {
    this.phase = phase
    this.start = time
    this.signature = ''
  }

  private dot(ctx: CanvasRenderingContext2D, column: number, row: number, color: string, radius: number) {
    ctx.beginPath()
    ctx.arc((column + .5) * pitch, (row + .5) * pitch, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  update(time: number, reducedMotion: boolean) {
    const age = Math.max(0, time - this.start)
    const [first, second] = phases[this.phase]
    const inserting = this.phase === 'inserting'
    const progress = reducedMotion ? Infinity : Math.floor(age / (inserting ? .047 : .052))
    const a = first.slice(0, progress)
    const b = inserting
      ? '.'.repeat(reducedMotion ? 3 : age < .28 ? 0 : 1 + Math.floor((age - .28) / .18) % 3)
      : second.slice(0, Math.max(0, progress - first.length - 1))
    const signature = a + '|' + b
    if (signature === this.signature) return
    this.signature = signature
    const pixels = this.pixels
    pixels.clearRect(0, 0, columns, rows)
    pixels.fillStyle = '#fff'
    pixels.font = '900 15px Arial, sans-serif'
    pixels.textBaseline = 'alphabetic'
    pixels.fillText(a, Math.round((columns - pixels.measureText(first).width) / 2), 16)
    const secondWidth = pixels.measureText(inserting ? '...' : second).width
    pixels.fillText(b, Math.round((columns - secondWidth) / 2), 33)
    const { data } = pixels.getImageData(0, 0, columns, rows)
    this.face.drawImage(this.idleFace.canvas, 0, 0)
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      if (data[(row * columns + column) * 4 + 3] < 128) continue
      this.dot(this.face, column, row, '#563b83', 4.9)
      this.dot(this.face, column, row, '#bb8cff', 3.8)
      this.dot(this.face, column, row, '#edd2ff', 2.4)
    }
    this.texture.needsUpdate = true
  }
}
