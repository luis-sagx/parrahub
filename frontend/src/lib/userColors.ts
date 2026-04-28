const USER_COLORS = [
  '#7dd3fc',
  '#86efac',
  '#fca5a5',
  '#fcd34d',
  '#c4b5fd',
  '#f9a8d4',
  '#67e8f9',
  '#fdba74',
  '#a7f3d0',
  '#93c5fd',
]

const hashName = (name: string) =>
  [...name].reduce((hash, char) => hash + char.charCodeAt(0), 0)

export const getUserColor = (name: string) =>
  USER_COLORS[hashName(name) % USER_COLORS.length]
