import { BASE_COUPONS } from './catalog'
import { downloadPng } from './downloadPng'

export interface Coupon {
  src: string
  name: string
  aspect: number
  demo: boolean
  id?: string
  title?: string
  description?: string
  category?: string
}

export const DEMO_COUPONS: Coupon[] = BASE_COUPONS
export const DEMO_COUPON = DEMO_COUPONS[0]

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function downloadCoupon(coupon: Coupon) {
  const image = await loadImage(coupon.src)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  const message = 'Не вдалося зберегти купон. Спробуй ще раз.'
  if (!context) throw new Error(message)
  context.drawImage(image, 0, 0)
  await downloadPng(canvas, `cupon-${coupon.id ?? coupon.name.replace(/\.[^.]+$/, '')}.png`, message)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = window.setTimeout(() => {
      image.src = ''
      reject(new Error('Не вдалося прочитати зображення. Спробуй інший файл.'))
    }, 8000)
    image.onload = () => {
      clearTimeout(timeout)
      resolve(image)
    }
    image.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Цей файл не вдалося відкрити. Спробуй інший PNG або SVG.'))
    }
    image.src = src
  })
}

export async function readCoupon(file: File): Promise<Coupon> {
  if (file.size > MAX_FILE_SIZE) throw new Error('Купон завеликий. Обери файл до 10 МБ.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== 'png' && extension !== 'svg') {
    throw new Error('Підійде зображення у форматі PNG або SVG.')
  }

  let blob: Blob = file
  if (extension === 'png') {
    const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => signature[i] === byte)) {
      throw new Error('Схоже, цей файл не є PNG. Перевір зображення й спробуй ще раз.')
    }
  } else {
    const text = await file.text()
    const document = new DOMParser().parseFromString(text, 'image/svg+xml')
    const svg = document.documentElement
    if (document.querySelector('parsererror') || svg.localName !== 'svg') {
      throw new Error('У цьому SVG є помилка. Спробуй експортувати його ще раз.')
    }
    if (document.querySelector('script, foreignObject') || /@import|url\(\s*['"]?https?:/i.test(text)) {
      throw new Error('Експортуй купон як звичайний SVG без скриптів і зовнішніх ресурсів.')
    }
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name.startsWith('on') ||
          (attribute.localName === 'href' && !attribute.value.startsWith('#') && !attribute.value.startsWith('data:image/'))) {
          throw new Error('SVG має містити лише саме зображення, без зовнішніх посилань.')
        }
      }
    }
    const viewBox = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
    if (!svg.hasAttribute('width')) svg.setAttribute('width', String(viewBox?.[2] || 1200))
    if (!svg.hasAttribute('height')) svg.setAttribute('height', String(viewBox?.[3] || 700))
    blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = await loadImage(objectUrl)
    const { naturalWidth: width, naturalHeight: height } = image
    if (!width || !height) throw new Error('У купона немає розміру. Перевір експорт зображення.')
    // Rasterize locally: the same pixels become the preview and the GPU texture.
    const scale = Math.min(1, 2048 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Браузеру не вдалося підготувати купон.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return { src: canvas.toDataURL('image/png'), name: file.name, aspect: width / height, demo: false }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
