import { useEffect, useRef } from 'react'
import './experience.css'

export function CustomCursor() {
  const cursor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = cursor.current
    if (!node) return
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const root = document.documentElement
    const hide = () => {
      root.classList.remove('cupon-cursor')
      node.dataset.visible = 'false'
      node.dataset.pressed = 'false'
    }
    const move = (event: PointerEvent) => {
      if (!finePointer.matches || event.pointerType !== 'mouse') { hide(); return }
      node.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest('button, a, [role="button"]')
      const scene = target?.closest<HTMLElement>('[data-cursor]')
      const sceneCursor = scene?.dataset.cursor
      node.dataset.interactive = String(
        !!button && !button.matches(':disabled, [aria-disabled="true"]')
        || sceneCursor === 'pointer' || sceneCursor === 'grab' || sceneCursor === 'grabbing',
      )
      node.dataset.visible = 'true'
      root.classList.add('cupon-cursor')
    }
    const press = (event: PointerEvent) => { if (event.pointerType === 'mouse') node.dataset.pressed = 'true' }
    const release = () => { node.dataset.pressed = 'false' }
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) hide() }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', press, { passive: true })
    window.addEventListener('pointerup', release, { passive: true })
    window.addEventListener('pointercancel', release, { passive: true })
    window.addEventListener('pointerout', leave, { passive: true })
    window.addEventListener('blur', hide)
    finePointer.addEventListener('change', hide)
    return () => {
      hide()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', press)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('pointerout', leave)
      window.removeEventListener('blur', hide)
      finePointer.removeEventListener('change', hide)
    }
  }, [])
  return <div ref={cursor} className="meadow-cursor" aria-hidden="true"><span /></div>
}
