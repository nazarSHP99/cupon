import type { CSSProperties } from 'react'
import './experience.css'

interface JourneyNavProps {
  progress: number
  onNavigate: (checkpoint: 0 | 1 | 2) => void
  disabled?: boolean
}

const checkpoints = ['Краєвид', 'Стіл', 'Шухляда'] as const
const ticksPerSection = 6
const edgeTicks = 7
const routeLength = (checkpoints.length - 1) * ticksPerSection
const tickCount = edgeTicks * 2 + routeLength + 1
const ticks = Array.from({ length: tickCount }, (_, index) => index - edgeTicks)

export function JourneyNav({ progress, onNavigate, disabled = false }: JourneyNavProps) {
  const value = Math.max(0, Math.min(1, progress))
  const section = value * (checkpoints.length - 1)
  const active = Math.round(section)
  const offset = -(edgeTicks + .5 + value * routeLength) / tickCount * 100
  return <nav className="journey-nav" aria-label="Точки прогулянки"
    style={{ '--ruler-tick-count': tickCount, '--ruler-offset': `${offset}%` } as CSSProperties}>
    <span className="journey-nav__pointer" aria-hidden="true" />
    <div className="journey-nav__track">
      {ticks.map(tick => {
        if (tick < 0 || tick > routeLength || tick % ticksPerSection !== 0) {
          return <span key={tick} className="journey-nav__cell" aria-hidden="true">
            <span className="journey-nav__tick" />
          </span>
        }
        const checkpoint = tick / ticksPerSection as 0 | 1 | 2
        const labelOpacity = Math.min(1, Math.max(0, (.5 - Math.abs(section - checkpoint)) / .14))
        return <button type="button" key={tick} className="journey-nav__cell journey-nav__stop"
          aria-label={`Перейти до точки «${checkpoints[checkpoint]}»`}
          aria-current={checkpoint === active ? 'step' : undefined}
          tabIndex={Math.abs(value - tick / routeLength) <= .55 ? 0 : -1}
          disabled={disabled}
          onClick={() => onNavigate(checkpoint)}>
          <span className="journey-nav__tick" aria-hidden="true" />
          <span className="journey-nav__label" aria-hidden="true" style={{ opacity: labelOpacity }}>{checkpoints[checkpoint]}</span>
        </button>
      })}
    </div>
  </nav>
}
