/** Convert 0-based column index to A1-style letter(s): 0→A, 25→Z, 26→AA */
export function colIndexToLetter(col: number): string {
  let label = "";
  let n = col;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

/** Convert A1-style column letter(s) to 0-based index: A→0, Z→25, AA→26 */
export function letterToColIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

/** Convert {row, col} to A1 notation: {0,0}→"A1", {9,26}→"AA10" */
export function toA1(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}

/** Parse A1 notation to {row, col}. Handles optional $ for absolute refs. */
export function fromA1(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
  if (!match) return null;
  const col = letterToColIndex(match[1].toUpperCase());
  const row = parseInt(match[2], 10) - 1;
  if (row < 0 || col < 0) return null;
  return { row, col };
}
