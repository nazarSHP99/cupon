import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { DEMO_COUPONS, downloadCoupon } from '../coupons/coupon'
import { Icon } from './Icons'
import './experience.css'

interface CouponBrowserProps {
  fallback: boolean
  rackControls: RefObject<HTMLDivElement | null>
  activeIndex: number
  onActiveIndex: (index: number) => void
  onChoose: (index: number) => void
  onClose: () => void
}

export function CouponBrowser({ fallback, rackControls, activeIndex, onActiveIndex, onChoose, onClose }: CouponBrowserProps) {
  const panel = useRef<HTMLElement>(null)
  const previousButton = useRef<HTMLButtonElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const safeIndex = Math.max(0, Math.min(activeIndex, DEMO_COUPONS.length - 1))
  const coupon = DEMO_COUPONS[safeIndex]

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => previousButton.current?.focus({ preventScroll: true }))
    return () => {
      cancelAnimationFrame(frame)
      if (previous?.isConnected) requestAnimationFrame(() => previous.focus())
    }
  }, [])

  function step(direction: number) {
    onActiveIndex((safeIndex + direction + DEMO_COUPONS.length) % DEMO_COUPONS.length)
  }

  async function saveCoupon() {
    setDownloadError('')
    setDownloading(true)
    try { await downloadCoupon(coupon) }
    catch (cause) { setDownloadError(cause instanceof Error ? cause.message : 'Не вдалося завантажити купон.') }
    finally { setDownloading(false) }
  }

  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      step(event.key === 'ArrowRight' ? 1 : -1)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      onActiveIndex(event.key === 'Home' ? 0 : DEMO_COUPONS.length - 1)
    } else if (event.key === 'Tab') {
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      if (!buttons?.length) return
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return <section ref={panel} className="coupon-browser-layer" role="dialog" aria-modal="true"
    aria-label="Готові купони" onKeyDown={keyDown}>
    <div ref={rackControls} className="coupon-rack-actions" data-fallback={fallback} role="group" aria-label="Керування стосом">
      <button ref={previousButton} type="button" onClick={() => step(-1)} aria-label="Попередній купон" title="Попередній купон"><Icon name="left" size={21} /></button>
      <button type="button" onClick={() => step(1)} aria-label="Наступний купон" title="Наступний купон"><Icon name="right" size={21} /></button>
      <button type="button" onClick={() => void saveCoupon()} disabled={downloading} aria-label="Завантажити купон як PNG" title="Завантажити PNG"><Icon name="download" size={21} /></button>
    </div>
    <button type="button" className={fallback ? 'fallback-catalog-preview' : 'catalog-keyboard-action'}
      aria-label={`Взяти купон «${coupon.title ?? coupon.name}»`} onClick={() => onChoose(safeIndex)}>
      {fallback ? <img src={coupon.src} alt="" /> : 'Взяти купон'}
    </button>
    <button type="button" className="catalog-keyboard-action" onClick={onClose}>До столу</button>
    <span className="sr-only" role="status">{coupon.title ?? coupon.name}</span>
    {downloadError && <p className="catalog-error" role="alert">{downloadError}</p>}
  </section>
}
