import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO_COUPONS, type Coupon } from '../coupons/coupon'
import { couponTitle, type Receipt } from '../coupons/receipt'

export interface UsedCoupon {
  id: string
  title: string
  src: string
  aspect: number
  usedAt: string
  demo: boolean
}

type SavedCoupon = Omit<UsedCoupon, 'src' | 'demo'> & {
  version: 1
  src?: string
  demoId?: string
}

const PREFIX = 'cupon.used.v1.'
const SAVE_ERROR = 'Купон додано до шухляди, але браузер не зміг зберегти його надовго. Після перезавантаження цей запис може зникнути.'

function archivedArtwork(title: string) {
  const label = title.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="206" viewBox="0 0 360 206"><rect width="360" height="206" rx="12" fill="#ede0c5"/><rect x="10" y="10" width="340" height="186" rx="7" fill="none" stroke="#8a8972"/><g fill="#354b3c" font-family="Arial,sans-serif"><text x="25" y="46" font-size="20" font-weight="700">cupon.</text><text x="25" y="106" font-size="20" textLength="310" lengthAdjust="spacingAndGlyphs">${label}</text><text x="25" y="170" font-size="12">ЗБЕРЕЖЕНИЙ МОМЕНТ</text></g></svg>`,
  )
}

function newestFirst(entries: Iterable<UsedCoupon>) {
  return Array.from(entries).sort((a, b) => b.usedAt.localeCompare(a.usedAt) || b.id.localeCompare(a.id))
}

function decodeRecord(raw: string | null): UsedCoupon | null {
  if (!raw) return null
  const saved: unknown = JSON.parse(raw)
  if (!saved || typeof saved !== 'object') return null
  const entry = saved as Partial<SavedCoupon>
  if (entry.version !== 1 || typeof entry.id !== 'string' || !entry.id || entry.id.length > 100
    || typeof entry.title !== 'string' || !entry.title || entry.title.length > 1000
    || typeof entry.usedAt !== 'string' || !Number.isFinite(Date.parse(entry.usedAt))
    || typeof entry.aspect !== 'number' || !Number.isFinite(entry.aspect) || entry.aspect <= 0) return null
  const demo = DEMO_COUPONS.find(coupon => coupon.id === entry.demoId)
  const src = demo?.src ?? entry.src ?? (typeof entry.demoId === 'string' ? archivedArtwork(entry.title) : undefined)
  if (typeof src !== 'string' || !/^data:image\/(jpeg|png|webp|svg\+xml)[;,]/i.test(src)) return null
  return { id: entry.id, title: entry.title, src, aspect: entry.aspect, demo: !!demo, usedAt: new Date(entry.usedAt).toISOString() }
}

function readHistory() {
  const entries = new Map<string, UsedCoupon>()
  let error = ''
  try {
    const storage = window.localStorage
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith(PREFIX)) continue
      try {
        const entry = decodeRecord(storage.getItem(key))
        if (entry && key === PREFIX + entry.id) entries.set(entry.id, entry)
        else error = 'Деякі збережені купони пошкоджені. Решта історії доступна у шухляді.'
      } catch {
        error = 'Деякі збережені купони пошкоджені. Решта історії доступна у шухляді.'
      }
    }
  } catch {
    error = 'Збереження в цьому браузері недоступне. Шухляда працюватиме до перезавантаження сторінки.'
  }
  return { entries: newestFirst(entries.values()), error }
}

async function thumbnail(coupon: Coupon) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const timer = window.setTimeout(() => { image.src = ''; reject(new Error('Image timed out')) }, 6000)
    image.onload = () => { clearTimeout(timer); resolve(image) }
    image.onerror = () => { clearTimeout(timer); reject(new Error('Image unavailable')) }
    image.src = coupon.src
  })
  const scale = Math.min(1, 360 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/webp', .84)
}

export function useCouponHistory() {
  const [initial] = useState(readHistory)
  const [entries, setEntries] = useState(initial.entries)
  const [storageError, setStorageError] = useState(initial.error)
  const pending = useRef(new Map<string, UsedCoupon>())
  const writes = useRef(new Map<string, Promise<void>>())

  const refresh = useCallback(() => {
    const stored = readHistory()
    const merged = new Map(stored.entries.map(entry => [entry.id, entry]))
    for (const entry of pending.current.values()) merged.set(entry.id, entry)
    setEntries(newestFirst(merged.values()))
    setStorageError(pending.current.size ? SAVE_ERROR : stored.error)
  }, [])

  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === null) pending.current.clear()
      if (event.key === null || event.key.startsWith(PREFIX)) refresh()
    }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  }, [refresh])

  const saveUsage = useCallback((coupon: Coupon, receipt: Receipt): Promise<void> => {
    const existing = writes.current.get(receipt.id)
    if (existing) return existing
    const entry: UsedCoupon = {
      id: receipt.id,
      title: couponTitle(coupon),
      src: coupon.src,
      aspect: coupon.aspect,
      demo: coupon.demo,
      usedAt: receipt.activatedAt.toISOString(),
    }
    pending.current.set(entry.id, entry)
    setEntries(previous => newestFirst(new Map([...previous, entry].map(item => [item.id, item])).values()))
    const write = (async () => {
      try {
        const demo = DEMO_COUPONS.find(item => item.id === coupon.id)
        const src = demo ? undefined : await thumbnail(coupon)
        const saved: SavedCoupon = {
          version: 1, id: entry.id, title: entry.title, aspect: entry.aspect, usedAt: entry.usedAt,
          ...(demo ? { demoId: demo.id } : { src }),
        }
        // Independent keys make concurrent redemptions in separate tabs atomic.
        window.localStorage.setItem(PREFIX + entry.id, JSON.stringify(saved))
        pending.current.delete(entry.id)
      } catch {
        setStorageError(SAVE_ERROR)
      }
      refresh()
    })()
    writes.current.set(receipt.id, write)
    return write
  }, [refresh])

  return { entries, saveUsage, storageError }
}
