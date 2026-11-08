import type { Coupon } from './coupon'

export const TICKET_DESIGN = { width: 840, height: 480, corner: 26, notchX: 665, notchRadius: 18 }

type Motif = 'heart' | 'sun' | 'cup' | 'ticket' | 'leaf' | 'star' | 'moon' | 'music'
type Card = {
  id: string
  lines: [string, string]
  description: string
  category: string
  motif: Motif
  palette: number
}

const palettes = [
  { paper: '#f5c4bd', ink: '#602e3f', accent: '#d6666d' },
  { paper: '#e8dafa', ink: '#493565', accent: '#9b7bc4' },
  { paper: '#dce7c9', ink: '#365442', accent: '#809b5d' },
  { paper: '#f6e0a6', ink: '#6a472b', accent: '#cf9850' },
  { paper: '#c8e3e9', ink: '#315b66', accent: '#73a9b1' },
  { paper: '#f2ceae', ink: '#71432f', accent: '#c77c50' },
]

const motifs: Record<Motif, string> = {
  heart: '<path d="M0 27C-12 13-38-1-38-23c0-24 29-33 38-12 9-21 38-12 38 12C38-1 12 13 0 27Z"/>',
  sun: '<circle r="22"/><path d="M0-43v-9M0 43v9M-43 0h-9M43 0h9M-31-31l-7-7M31 31l7 7M31-31l7-7M-31 31l-7 7"/>',
  cup: '<path d="M-31-13h50v27c0 27-50 27-50 0ZM19-7h10c22 0 21 27-10 27M-37 40h65M-18-42c-12 12 12 15 0 26M2-42c-12 12 12 15 0 26"/>',
  ticket: '<path d="M-44-28h88v18c-16 0-16 20 0 20v18h-88V10c16 0 16-20 0-20ZM18-28v9m0 8v8m0 8v8m0 8v7"/><path d="m-17-13 4 9 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1Z"/>',
  leaf: '<path d="M-28 29C-55-5-18-43 35-34 42 17 2 47-28 29ZM-37 42 20-19M-18 23l-6-25M-3 8l24 1"/>',
  star: '<path d="m0-43 12 28 31 4-23 21 7 31L0 25l-27 16 7-31-23-21 31-4Z"/>',
  moon: '<path d="M17-38C-42-48-57 22-7 36c21 6 41-2 51-18C4 28-16-14 17-38Z"/><path d="m34-35 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"/>',
  music: '<path d="M-13 25v-52l47-10v52M-13-12l47-10"/><ellipse cx="-25" cy="27" rx="13" ry="10"/><ellipse cx="22" cy="17" rx="13" ry="10"/>',
}

const cards: Card[] = [
  { id: 'warm-hug', lines: ['Теплі', 'обійми'], description: 'Обійматися стільки, скільки захочеться.', category: 'Турбота', motif: 'heart', palette: 0 },
  { id: 'cinema-date', lines: ['Разом', 'у кіно'], description: 'Ти обираєш фільм. Попкорн — з мене.', category: 'Побачення', motif: 'ticket', palette: 1 },
  { id: 'dinner-out', lines: ['Смачна', 'вечеря'], description: 'Наш улюблений заклад або нове відкриття.', category: 'Смаколики', motif: 'star', palette: 5 },
  { id: 'slow-walk', lines: ['Прогулянка', 'без поспіху'], description: 'Без маршруту. З розмовами й зупинками.', category: 'Пригоди', motif: 'leaf', palette: 2 },
  { id: 'coffee-break', lines: ['Кава', 'для двох'], description: 'Дві чашки й час тільки для нас.', category: 'Смаколики', motif: 'cup', palette: 3 },
  { id: 'breakfast', lines: ['Сніданок', 'у ліжко'], description: 'Твій улюблений ранок на таці.', category: 'Турбота', motif: 'sun', palette: 3 },
  { id: 'picnic', lines: ['Маленький', 'пікнік'], description: 'Плед, щось смачне й гарне місце надворі.', category: 'Пригоди', motif: 'leaf', palette: 2 },
  { id: 'sunset', lines: ['Спіймати', 'захід сонця'], description: 'Знайдемо найкраще місце й побудемо поруч.', category: 'Побачення', motif: 'sun', palette: 5 },
  { id: 'movie-night', lines: ['Домашній', 'кіносеанс'], description: 'Плед, улюблений фільм і жодних справ.', category: 'Затишок', motif: 'moon', palette: 1 },
  { id: 'day-trip', lines: ['Мандрівка', 'на один день'], description: 'Вирушимо туди, де ще не були разом.', category: 'Пригоди', motif: 'sun', palette: 4 },
  { id: 'dessert', lines: ['Десерт', 'на твій смак'], description: 'Тістечко, морозиво чи щось шоколадне?', category: 'Смаколики', motif: 'heart', palette: 0 },
  { id: 'massage', lines: ['Час', 'розслабитися'], description: 'Ніжний масаж плечей і тиха музика.', category: 'Турбота', motif: 'leaf', palette: 4 },
  { id: 'board-games', lines: ['Вечір', 'настільних ігор'], description: 'Обирай гру. Смаколики вже чекають.', category: 'Затишок', motif: 'star', palette: 3 },
  { id: 'bookshop', lines: ['Побачення', 'у книгарні'], description: 'Пошукаємо книжку, яку хочеться забрати.', category: 'Побачення', motif: 'ticket', palette: 2 },
  { id: 'playlist', lines: ['Плейлист', 'тільки для тебе'], description: 'Пісні, у яких я чую нас.', category: 'Сюрпризи', motif: 'music', palette: 1 },
  { id: 'cook-together', lines: ['Готуємо', 'разом'], description: 'Новий рецепт і трохи безладу на кухні.', category: 'Смаколики', motif: 'cup', palette: 5 },
  { id: 'stargazing', lines: ['Вечір', 'під зорями'], description: 'Теплий чай і спроба знайти сузір’я.', category: 'Побачення', motif: 'star', palette: 4 },
  { id: 'surprise', lines: ['Маленький', 'сюрприз'], description: 'Без приводу. Просто щоб ти усміхнувся.', category: 'Сюрпризи', motif: 'star', palette: 0 },
  { id: 'phone-free', lines: ['Година', 'тільки для нас'], description: 'Відкладемо телефони й поговоримо.', category: 'Турбота', motif: 'heart', palette: 2 },
  { id: 'museum', lines: ['Відкриваємо', 'нове'], description: 'Виставка, музей або цікава екскурсія.', category: 'Пригоди', motif: 'ticket', palette: 4 },
  { id: 'dance', lines: ['Танець', 'на кухні'], description: 'Улюблена пісня. Навіть якщо не вміємо.', category: 'Затишок', motif: 'music', palette: 5 },
  { id: 'helping-hand', lines: ['День', 'без клопотів'], description: 'Візьму на себе одну твою справу.', category: 'Турбота', motif: 'sun', palette: 3 },
  { id: 'letter', lines: ['Лист', 'від серця'], description: 'Напишу, за що ціную тебе найбільше.', category: 'Сюрпризи', motif: 'heart', palette: 1 },
  { id: 'dream-date', lines: ['Твоя', 'маленька мрія'], description: 'Обери, що хочеш зробити разом.', category: 'Пригоди', motif: 'moon', palette: 0 },
]

const motifCenters: Record<Card['motif'], [number, number]> = {
  heart: [0, -9.89],
  sun: [0, 0],
  cup: [3.55, -1],
  ticket: [0, 0],
  leaf: [-.63, 3.33],
  star: [0, -1],
  moon: [3.92, -.49],
  music: [-1.5, 0],
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

function artwork(card: Card, index: number) {
  const { paper, ink, accent } = palettes[card.palette]
  const serial = String(index + 1).padStart(2, '0')
  const { width, height, corner, notchX, notchRadius } = TICKET_DESIGN
  const notchLeft = notchX - notchRadius
  const notchRight = notchX + notchRadius
  const [motifX, motifY] = motifCenters[card.motif]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path fill="${paper}" d="M${corner} 0 H${notchLeft}
      A${notchRadius} ${notchRadius} 0 0 0 ${notchRight} 0 H${width - corner}
      A${corner} ${corner} 0 0 1 ${width} ${corner} V${height - corner}
      A${corner} ${corner} 0 0 1 ${width - corner} ${height} H${notchRight}
      A${notchRadius} ${notchRadius} 0 0 0 ${notchLeft} ${height} H${corner}
      A${corner} ${corner} 0 0 1 0 ${height - corner} V${corner}
      A${corner} ${corner} 0 0 1 ${corner} 0 Z"/>
    <rect x="18" y="18" width="804" height="444" rx="16" fill="none" stroke="${ink}" stroke-opacity=".32" stroke-width="2"/>
    <path d="M665 20v440" stroke="${ink}" stroke-opacity=".45" stroke-width="2" stroke-dasharray="5 9"/>
    <circle cx="740" cy="124" r="53" fill="${accent}" opacity=".24"/>
    <g transform="translate(740 124) scale(.79) translate(${-motifX} ${-motifY})" fill="none" stroke="${ink}" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round">${motifs[card.motif]}</g>
    <g fill="${ink}" font-family="Arial, sans-serif">
      <text x="49" y="65" font-size="24" font-weight="700">cupon.</text>
      <text x="615" y="63" text-anchor="end" font-size="15" letter-spacing="2">${escapeXml(card.category.toUpperCase())}</text>
      <text x="48" y="182" font-size="57" font-weight="700" letter-spacing="-2">${escapeXml(card.lines[0])}</text>
      <text x="48" y="234" font-size="57" font-weight="700" letter-spacing="-2">${escapeXml(card.lines[1])}</text>
      <text x="49" y="278" font-size="22">${escapeXml(card.description)}</text>
      <path d="M49 354h562" stroke="${ink}" stroke-opacity=".24"/>
      <text x="49" y="408" font-size="19" letter-spacing="1">ОДНА ПРИЄМНА ОБІЦЯНКА</text>
      <text x="612" y="408" font-size="21" text-anchor="end">для тебе</text>
      <text x="741" y="252" text-anchor="middle" font-size="47" font-weight="700">${serial}</text>
      <text x="741" y="276" text-anchor="middle" font-size="19" letter-spacing="1">/ ${cards.length}</text>
      <text transform="translate(747 425) rotate(-90)" font-size="17" textLength="120">ЗБЕРИ МОМЕНТ</text>
    </g>
  </svg>`
}

export const BASE_COUPONS: Coupon[] = cards.map((card, index) => ({
  id: card.id,
  title: card.lines.join(' '),
  description: card.description,
  category: card.category,
  name: card.id + '.svg',
  src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artwork(card, index)),
  aspect: TICKET_DESIGN.width / TICKET_DESIGN.height,
  demo: true,
}))
