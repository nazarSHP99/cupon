export type SoundKind = 'click' | 'paper' | 'insert' | 'print' | 'success'

/** Short local sounds; no files, requests or audio context until Sound is enabled. */
export class SoundPlayer {
  private context: AudioContext | null = null
  private output: GainNode | null = null
  private noise: AudioBuffer | null = null
  private voices = new Set<AudioScheduledSourceNode>()
  private lastPaper = -Infinity

  constructor(private createContext: () => AudioContext = () => new AudioContext()) {}

  private audio() {
    if (!this.context) {
      this.context = this.createContext()
      this.output = this.context.createGain()
      this.output.gain.value = .55
      this.output.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    return this.context
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    this.voices.add(source)
    source.onended = () => {
      source.onended = null
      this.voices.delete(source)
      source.disconnect()
      for (const node of nodes) node.disconnect()
    }
  }

  private tone(audio: AudioContext, frequency: number, endFrequency: number,
    start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    const source = audio.createOscillator(), gain = audio.createGain()
    source.type = type
    source.frequency.setValueAtTime(frequency, start)
    source.frequency.exponentialRampToValueAtTime(endFrequency, start+duration)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start+Math.min(.012, duration*.12))
    gain.gain.exponentialRampToValueAtTime(.0001, start+duration)
    source.connect(gain).connect(this.output!)
    this.track(source, [gain])
    source.start(start)
    source.stop(start+duration+.015)
  }

  private rustle(audio: AudioContext, paper: boolean) {
    if (!this.noise) {
      this.noise = audio.createBuffer(1, Math.ceil(audio.sampleRate*.5), audio.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i=0; i<data.length; i++) data[i] = Math.random()*2-1
    }
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain()
    const now = audio.currentTime, duration = paper ? .19 : .045
    source.buffer = this.noise
    filter.type = 'bandpass'
    filter.Q.value = paper ? .65 : .9
    filter.frequency.setValueAtTime(paper ? 850 : 1900, now)
    filter.frequency.exponentialRampToValueAtTime(paper ? 2400 : 1050, now+duration*.4)
    filter.frequency.exponentialRampToValueAtTime(paper ? 1100 : 750, now+duration)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(paper ? .11 : .13, now+(paper ? .035 : .002))
    gain.gain.exponentialRampToValueAtTime(.0001, now+duration)
    source.connect(filter).connect(gain).connect(this.output!)
    this.track(source, [filter, gain])
    source.start(now, Math.random()*.2)
    source.stop(now+duration+.01)
  }

  play(kind: SoundKind) {
    try {
      // Entering a new coupon can trigger a sound; pointer jitter must not stack it.
      if (kind === 'paper') {
        const now = performance.now()
        if (now-this.lastPaper < 150) return
        this.lastPaper = now
      }
      const audio = this.audio(), now = audio.currentTime
      if (kind === 'click') {
        this.rustle(audio, false)
        this.tone(audio, 230, 95, now, .065, .09)
      } else if (kind === 'paper') {
        this.rustle(audio, true)
      } else if (kind === 'print') {
        const motor = audio.createOscillator(), gain = audio.createGain()
        motor.type = 'triangle'
        motor.frequency.setValueAtTime(78, now)
        motor.frequency.linearRampToValueAtTime(94, now+2.6)
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(.04, now+.08)
        gain.gain.setValueAtTime(.04, now+2.65)
        gain.gain.linearRampToValueAtTime(0, now+2.9)
        motor.connect(gain).connect(this.output!)
        this.track(motor, [gain])
        motor.start(now)
        motor.stop(now+3)
      } else {
        const notes = kind === 'success' ? [523.25, 659.25, 783.99] : [135, 105]
        notes.forEach((frequency, i) => this.tone(audio, frequency, frequency, now+i*.1, .25, .085))
      }
    } catch { /* Audio is optional; interaction remains available. */ }
  }

  mute() {
    for (const voice of this.voices) {
      try { voice.stop() } catch { /* The source may already have ended. */ }
      // Disconnect immediately, including when the audio clock is suspended.
      voice.onended?.(new Event('ended'))
    }
    this.voices.clear()
    this.lastPaper = -Infinity
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {})
  }

  dispose() {
    this.mute()
    this.output?.disconnect()
    void this.context?.close().catch(() => {})
    this.context = null
    this.output = null
    this.noise = null
  }
}
