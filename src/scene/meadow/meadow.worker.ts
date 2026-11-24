import { generateMeadowData, meadowTransfers, type MeadowData, type MeadowRequest, type MeadowWorkerMessage } from './meadowData'

self.onmessage = (event: MessageEvent<MeadowRequest>) => {
  const generation = generateMeadowData(event.data.compact, event.data.coverage)
  const tiles: MeadowData['tiles'] = []
  let completed = 0
  let result = generation.next()
  while (!result.done) {
    if (result.value) tiles.push(result.value)
    if (++completed % 8 === 0) self.postMessage({ type: 'progress', completed } satisfies MeadowWorkerMessage)
    result = generation.next()
  }
  const data: MeadowData = { ground: result.value, tiles }
  self.postMessage({ type: 'complete', data } satisfies MeadowWorkerMessage, { transfer: meadowTransfers(data) })
}
