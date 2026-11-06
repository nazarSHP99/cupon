import { useCallback, useEffect, useRef, useState } from 'react'

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
  const context = useRef<AudioContext | null>(null)
  useEffect(() => () => { void context.current?.close() }, [])
  useEffect(() => { if (!enabled) void context.current?.suspend() }, [enabled])
  return useCallback((kind: 'insert' | 'print' | 'success') => {
    if (!enabled) return
    try {
      const audio = context.current ??= new AudioContext()
      void audio.resume()
      if (kind === 'print') {
        const motor = audio.createOscillator()
        const gain = audio.createGain()
        const now = audio.currentTime
        motor.type = 'triangle'
        motor.frequency.setValueAtTime(78, now)
        motor.frequency.linearRampToValueAtTime(94, now + 2.6)
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.025, now + 0.08)
        gain.gain.setValueAtTime(0.025, now + 2.65)
        gain.gain.linearRampToValueAtTime(0, now + 2.9)
        motor.connect(gain).connect(audio.destination)
        motor.start(now)
        motor.stop(now + 3)
        return
      }
      const notes = kind === 'success' ? [523.25, 659.25, 783.99] : [135, 105]
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        const start = audio.currentTime + index * 0.1
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.055, start + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
        oscillator.connect(gain).connect(audio.destination)
        oscillator.start(start)
        oscillator.stop(start + 0.3)
      })
    } catch { /* Sound is optional; activation still works without audio. */ }
  }, [enabled])
}
