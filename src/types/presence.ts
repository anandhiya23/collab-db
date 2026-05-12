export const CURSOR_COLORS = [
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
]

const ADJS = ['Red', 'Blue', 'Fast', 'Calm', 'Bold', 'Dark', 'Wild', 'Keen']
const NOUNS = ['Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Lynx', 'Deer', 'Crow']

export function randomPresence(): Presence {
  const color = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]
  const name =
    ADJS[Math.floor(Math.random() * ADJS.length)] +
    ' ' +
    NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return { color, name }
}

export interface Presence {
  color: string
  name: string
}

export interface RemoteCanvasCursor extends Presence {
  socketId: string
  x: number
  y: number
}

export interface RemoteDBMLCursor extends Presence {
  socketId: string
  line: number
}
