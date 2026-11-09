import { generateMeadowData, meadowTransfers, type MeadowData } from './meadowData'

self.onmessage = (event: MessageEvent<boolean>) => {
  const generation = generateMeadowData(event.data)
  const tiles: MeadowData['tiles'] = []
  let result = generation.next()
  while (!result.done) {
    tiles.push(result.value)
    result = generation.next()
  }
  const data: MeadowData = { ground: result.value, tiles }
  self.postMessage(data, { transfer: meadowTransfers(data) })
}
