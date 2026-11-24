function noiseGenerator(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2147483648 - 1
  }
}

/** A switch snap, a short plastic resonance, and the lighter key return. */
export function keyboardClick(sampleRate: number) {
  const samples = new Float32Array(Math.ceil(sampleRate * .075))
  const noise = noiseGenerator(71)
  let previous = 0
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate, n = noise(), bright = n - previous * .85
    previous = n
    const attack = Math.min(1, t / .00035)
    const snap = bright * Math.exp(-t / .0028) * .42
    const plastic = (Math.sin(t * 2 * Math.PI * 1850) + .35 * Math.sin(t * 2 * Math.PI * 3200)) * Math.exp(-t / .0055) * .1
    const release = t > .029 ? bright * Math.exp(-(t - .029) / .0035) * .16 : 0
    samples[i] = (snap + plastic) * attack + release
  }
  return samples
}

/** Short feed cycles, roller friction and the final cutter of a thermal printer. */
export function thermalPrinter(sampleRate: number, duration: number) {
  const samples = new Float32Array(Math.ceil(sampleRate * duration))
  const noise = noiseGenerator(287)
  let smoothNoise = 0, previous = 0, phase = 0
  const cuttingAt = duration - .19
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate, n = noise()
    smoothNoise += (n - smoothNoise) * .18
    const paper = smoothNoise - previous * .65
    previous = smoothNoise
    const feedTime = Math.max(0, t - .045)
    const cycle = feedTime % .218
    const running = t > .045 && t < cuttingAt - .04
    const burst = running ? Math.min(1, cycle / .009, Math.max(0, (.186 - cycle) / .016)) : 0
    const ramp = Math.min(1, feedTime / .06, Math.max(0, (cuttingAt - .04 - t) / .09))
    phase += 2 * Math.PI * (166 + 18 * Math.sin(feedTime * 5.3) + cycle * 94) / sampleRate
    const motor = Math.sin(phase) * .026 + Math.sin(phase * 3.04) * .011
    const teeth = Math.max(0, 1 - (feedTime * 72 % 1) / .13) * paper * .25
    const rollers = paper * .16 + (n - smoothNoise) * .018
    const engage = t < .045 ? (n - smoothNoise) * Math.exp(-t / .006) * .15 : 0
    const cutTime = t - cuttingAt
    const cutter = cutTime >= 0 ? (n - smoothNoise) * Math.exp(-cutTime / .014) * .28 : 0
    const returnTime = cutTime - .065
    const cutterReturn = returnTime >= 0 ? paper * Math.exp(-returnTime / .012) * .21 : 0
    samples[i] = engage + (motor + rollers + teeth) * burst * ramp + cutter + cutterReturn
  }
  return samples
}
