import { useEffect, useRef } from 'react'
import { INSTRUCTION_STEPS } from './instructions'

export function InstructionReader({ fallback, onClose }: { fallback: boolean; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => { close.current?.focus({ preventScroll: true }) }, [])

  return <section className="instruction-reader" data-fallback={fallback} role="dialog" aria-modal="true"
    aria-label="Як це працює" onKeyDown={event => {
      if (event.key === 'Tab') event.preventDefault()
      if (event.key === 'Escape') onClose()
    }}>
    <div className={fallback ? 'instruction-reader__paper' : 'sr-only'}>
      <h2>Як це працює</h2>
      <ol>{INSTRUCTION_STEPS.map(({ title, body }) => <li key={title}><strong>{title}</strong><p>{body}</p></li>)}</ol>
    </div>
    <button ref={close} className="instruction-reader__close" type="button" onClick={onClose}>
      До столу
    </button>
  </section>
}
