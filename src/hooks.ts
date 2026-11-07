import { useCallback, useEffect, useRef, useState } from 'react'
import { SoundPlayer, type SoundKind } from './sound'

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return reduced
}

export function useSound(enabled: boolean) {
  const player = useRef<SoundPlayer | null>(null)
  useEffect(() => () => {
    player.current?.dispose()
    player.current = null
  }, [])
  useEffect(() => { if (!enabled) player.current?.mute() }, [enabled])
  return useCallback((kind: SoundKind, confirmEnable = false) => {
    if (!enabled && !confirmEnable) return
    player.current ??= new SoundPlayer()
    player.current.play(kind)
  }, [enabled])
}
