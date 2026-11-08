import type { Coupon } from './coupon'
import { downloadPng } from './downloadPng'

export const FEED_DURATION = 2300
export const PRINT_DURATION = 3100

export interface Receipt {
  id: string
  title: string
  activatedAt: Date
  coupon: Coupon
  canvas: HTMLCanvasElement
}

export function couponTitle(coupon: Coupon) {
  if (coupon.title) return coupon.title
  const demoTitles: Record<string, string> = {
    '/demo-coupon.svg': 'Маленька приємність',
    '/demo-good-things.svg': 'Щось хороше попереду',
    '/demo-happy-moment.svg': 'Щасливий момент',
  }
  return demoTitles[coupon.src] ?? (coupon.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Твій купон')
}

function imageFrom(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image()
    const timeout = window.setTimeout(() => { image.src = ''; resolve(null) }, 6000)
    image.onload = () => { clearTimeout(timeout); resolve(image) }
    image.onerror = () => { clearTimeout(timeout); resolve(null) }
    image.src = src
  })
}

function wrappedText(context: CanvasRenderingContext2D, text: string, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (context.measureText(line ? `${line} ${word}` : word).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  lines.slice(0, maxLines).forEach((value, index) => {
    let visible = value
    const suffix = index === maxLines - 1 && lines.length > maxLines ? '…' : ''
    while (context.measureText(visible + suffix).width > maxWidth && visible.length) visible = visible.slice(0, -1)
    context.fillText(visible + suffix, 450, y + index * lineHeight)
  })
}

export async function createReceipt(coupon: Coupon): Promise<Receipt> {
  const activatedAt = new Date()
  const id = crypto.randomUUID().slice(0, 8).toUpperCase()
  const title = couponTitle(coupon)
  const image = await imageFrom(coupon.src)
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 1340
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Не вдалося підготувати чек. Спробуй ще раз.')

  context.fillStyle = '#fffcf0'
  context.beginPath()
  context.moveTo(0, 12)
  for (let x = 0; x <= 900; x += 15) context.lineTo(x, x % 30 ? 0 : 12)
  context.lineTo(900, 1328)
  for (let x = 900; x >= 0; x -= 15) context.lineTo(x, x % 30 ? 1340 : 1328)
  context.closePath()
  context.fill()
  context.textAlign = 'center'
  context.fillStyle = '#2d4035'
  context.font = 'bold 82px Arial, sans-serif'
  context.fillText('cupon.', 450, 125)
  context.font = '25px monospace'
  context.fillStyle = '#7a8371'
  context.fillText('ЧЕК ПРИЄМНИХ ОБІЦЯНОК', 450, 181)

  const separator = (y: number) => {
    context.save()
    context.strokeStyle = '#a6ae98'
    context.setLineDash([11, 10])
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(70, y)
    context.lineTo(830, y)
    context.stroke()
    context.restore()
  }
  separator(226)
  context.fillStyle = '#60744e'
  context.beginPath()
  context.arc(450, 308, 43, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = '#fffcf0'
  context.lineWidth = 8
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(429, 307)
  context.lineTo(445, 323)
  context.lineTo(474, 291)
  context.stroke()
  context.fillStyle = '#2d4035'
  context.font = 'bold 64px Arial, sans-serif'
  context.fillText('КУПОН', 450, 424)
  context.fillText('АКТИВОВАНО', 450, 495)
  context.font = 'bold 39px Arial, sans-serif'
  wrappedText(context, title, 570, 740, 47, 2)

  if (image) {
    const scale = Math.min(710 / image.naturalWidth, 235 / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    context.drawImage(image, 450 - width / 2, 650 + (235 - height) / 2, width, height)
  }
  separator(929)
  const date = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
  }).format(activatedAt)
  context.fillStyle = '#586650'
  context.font = '27px monospace'
  context.fillText(date, 450, 987)
  context.fillText(`ЧЕК № ${id}`, 450, 1031)
  context.fillStyle = '#2d4035'
  context.font = 'bold 36px Arial, sans-serif'
  wrappedText(context, 'Тепер час виконати обіцянку.', 1115, 710, 44, 2)
  context.font = '27px Arial, sans-serif'
  context.fillStyle = '#7a8371'
  wrappedText(context, 'Покажи цей чек тому, хто подарував купон. І подаруйте одне одному усмішку.', 1210, 735, 36, 3)
  return { id, title, activatedAt, coupon, canvas }
}

export async function downloadReceipt(receipt: Receipt) {
  await downloadPng(receipt.canvas, `cupon-${receipt.id.toLowerCase()}.png`, 'Не вдалося зберегти чек. Спробуй ще раз.')
}
