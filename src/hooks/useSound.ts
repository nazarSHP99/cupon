import { useCallback, useEffect, useRef } from 'react'
import { SoundPlayer, type SoundKind } from '../audio/SoundPlayer'

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
