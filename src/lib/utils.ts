export const json = (obj: unknown): string =>
  JSON.stringify(obj, (_, v) => {
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Map) return Object.fromEntries(v);
    if (v instanceof Set) return [...v];
    return v;
  }, 2);

export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseAmounts(str: string): number[] {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number);
}
