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
