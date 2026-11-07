import { useEffect, useRef, type KeyboardEvent } from 'react'
import { DEMO_COUPONS } from '../coupons/coupon'
import './experience.css'

interface CouponBrowserProps {
  open: boolean
  activeIndex: number
  onActiveIndex: (index: number) => void
  onChoose: (index: number) => void
  onClose: () => void
}

export function CouponBrowser({ open, activeIndex, onActiveIndex, onChoose, onClose }: CouponBrowserProps) {
  const panel = useRef<HTMLElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const safeIndex = Math.max(0, Math.min(activeIndex, DEMO_COUPONS.length - 1))
  const coupon = DEMO_COUPONS[safeIndex]

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => closeButton.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      if (previous?.isConnected) requestAnimationFrame(() => previous.focus())
    }
  }, [open])

  function step(direction: number) {
    onActiveIndex((safeIndex + direction + DEMO_COUPONS.length) % DEMO_COUPONS.length)
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

  if (!open) return null
  return <div className="coupon-browser-layer">
    <section ref={panel} className="coupon-browser" role="dialog" aria-modal="true"
      aria-label="Готові купони" onKeyDown={keyDown}>
      <button ref={closeButton} type="button" className="experience-icon-button coupon-browser__close"
        onClick={onClose} aria-label="Закрити вибір купонів" title="До столу">
        <span aria-hidden="true">×</span>
      </button>
      <div className="coupon-browser__copy" aria-live="polite" aria-atomic="true">
        <p className="coupon-browser__meta">№ {String(safeIndex + 1).padStart(2, '0')} · {coupon.category}</p>
        <h3>{coupon.title ?? coupon.name}</h3>
        <p>{coupon.description}</p>
      </div>
      <div className="coupon-browser__actions">
        <div className="coupon-browser__paging">
          <button type="button" className="experience-icon-button" onClick={() => step(-1)} aria-label="Попередній купон">←</button>
          <button type="button" className="experience-icon-button" onClick={() => step(1)} aria-label="Наступний купон">→</button>
        </div>
        <button type="button" className="coupon-browser__choose" onClick={() => onChoose(safeIndex)}>Беру цей</button>
      </div>
    </section>
  </div>
}
