import * as THREE from 'three'
import type { Phase } from '../MachineScene'

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
const typeInterval = .052
const eraseInterval = .054
const promptSteps = phases.empty[0].length + phases.empty[1].length + 1
const eraseStart = promptSteps * typeInterval + 2.6
const symbolStart = eraseStart + promptSteps * eraseInterval + .13
const symbolDuration = 1.7
const idleBeat = symbolStart + symbolDuration + .2
const idleSymbols = ['wink', 'heart', 'spark'] as const
const heartSizes = [1, 1.08, 1.17, 1.12, 1.05, 1]
const sparkSizes = [.65, .82, 1, .91, .76, .65]
const lavender = ['#563b83', '#bb8cff', '#edd2ff'] as const
const rose = ['#7d3f64', '#f591c2', '#ffdaed'] as const
const amber = ['#725136', '#f2b369', '#ffe4a8'] as const

function drawWink(pixels: CanvasRenderingContext2D, wink: boolean) {
  pixels.lineWidth = 1.8
  pixels.lineCap = 'round'
  pixels.beginPath()
  pixels.arc(0, 0, 12.2, 0, Math.PI * 2)
  pixels.moveTo(-5, 3)
  pixels.quadraticCurveTo(0, 9, 5, 3)
  pixels.stroke()
  pixels.beginPath()
  pixels.ellipse(-4.5, -3, 1.3, 2.1, 0, 0, Math.PI * 2)
  pixels.fill()
  pixels.beginPath()
  if (wink) {
    pixels.moveTo(2.4, -2)
    pixels.quadraticCurveTo(4.6, -4.6, 7, -2)
    pixels.stroke()
  } else {
    pixels.ellipse(4.5, -3, 1.3, 2.1, 0, 0, Math.PI * 2)
    pixels.fill()
  }
}

function drawHeart(pixels: CanvasRenderingContext2D) {
  pixels.beginPath()
  pixels.moveTo(0, 10)
  pixels.bezierCurveTo(-4, 7, -12, 2, -12, -4)
  pixels.bezierCurveTo(-12, -10, -5, -12, 0, -6.5)
  pixels.bezierCurveTo(5, -12, 12, -10, 12, -4)
  pixels.bezierCurveTo(12, 2, 4, 7, 0, 10)
  pixels.fill()
}

function drawSpark(pixels: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const inner = radius * .23
  pixels.beginPath()
  pixels.moveTo(x, y - radius)
  pixels.lineTo(x + inner, y - inner)
  pixels.lineTo(x + radius, y)
  pixels.lineTo(x + inner, y + inner)
  pixels.lineTo(x, y + radius)
  pixels.lineTo(x - inner, y + inner)
  pixels.lineTo(x - radius, y)
  pixels.lineTo(x - inner, y - inner)
  pixels.closePath()
  pixels.fill()
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
    if (this.phase === 'empty' && !reducedMotion) {
      this.updateIdle(age)
      return
    }
    const progress = reducedMotion ? Infinity : Math.floor(age / (this.phase === 'inserting' ? .047 : typeInterval))
    this.paintText(progress, age, reducedMotion)
  }

  private updateIdle(age: number) {
    const beat = Math.floor(age / idleBeat)
    const localTime = age % idleBeat
    if (localTime < symbolStart) {
      const progress = localTime < eraseStart
        ? Math.min(promptSteps, Math.floor(localTime / typeInterval))
        : Math.max(0, promptSteps - 1 - Math.floor((localTime - eraseStart) / eraseInterval))
      this.paintText(progress, localTime, false)
      return
    }

    const symbolTime = localTime - symbolStart
    if (symbolTime >= symbolDuration) {
      this.paintText(0, localTime, false)
      return
    }

    const symbol = idleSymbols[beat % idleSymbols.length]
    if (symbol === 'wink') {
      const wink = symbolTime >= .52 && symbolTime < .84
      this.paint('wink|' + wink, pixels => {
        pixels.translate(columns / 2, rows / 2)
        drawWink(pixels, wink)
      })
    } else if (symbol === 'heart') {
      const size = heartSizes[Math.floor(symbolTime * 7.5) % heartSizes.length]
      this.paint('heart|' + size, pixels => {
        pixels.translate(columns / 2, rows / 2)
        pixels.scale(size, size)
        drawHeart(pixels)
      }, rose)
    } else {
      const step = Math.floor(symbolTime / .28) % sparkSizes.length
      this.paint('spark|' + step, pixels => {
        drawSpark(pixels, 39, 19.5, 12 * sparkSizes[step])
        drawSpark(pixels, 24, 25, 3.1 + step * .25)
        drawSpark(pixels, 54, 12, 4.3 - step * .24)
      }, amber)
    }
  }

  private paintText(progress: number, age: number, reducedMotion: boolean) {
    const [first, second] = phases[this.phase]
    const inserting = this.phase === 'inserting'
    const a = first.slice(0, progress)
    const b = inserting
      ? '.'.repeat(reducedMotion ? 3 : age < .28 ? 0 : 1 + Math.floor((age - .28) / .18) % 3)
      : second.slice(0, Math.max(0, progress - first.length - 1))
    this.paint(a + '|' + b, pixels => {
      pixels.font = '900 15px Arial, sans-serif'
      pixels.textBaseline = 'alphabetic'
      pixels.fillText(a, Math.round((columns - pixels.measureText(first).width) / 2), 16)
      const secondWidth = pixels.measureText(inserting ? '...' : second).width
      pixels.fillText(b, Math.round((columns - secondWidth) / 2), 33)
    })
  }

  private paint(signature: string, draw: (pixels: CanvasRenderingContext2D) => void,
    colors: readonly [string, string, string] = lavender) {
    if (signature === this.signature) return
    this.signature = signature
    const pixels = this.pixels
    pixels.clearRect(0, 0, columns, rows)
    pixels.save()
    pixels.fillStyle = '#fff'
    pixels.strokeStyle = '#fff'
    draw(pixels)
    pixels.restore()
    const { data } = pixels.getImageData(0, 0, columns, rows)
    this.face.drawImage(this.idleFace.canvas, 0, 0)
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      if (data[(row * columns + column) * 4 + 3] < 128) continue
      this.dot(this.face, column, row, colors[0], 4.9)
      this.dot(this.face, column, row, colors[1], 3.8)
      this.dot(this.face, column, row, colors[2], 2.4)
    }
    this.texture.needsUpdate = true
  }
}
