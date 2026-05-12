function escapeString(value: string) {
  return JSON.stringify(value);
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return escapeString(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('dp1: non-finite number in JSON');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map(key => `${escapeString(key)}:${canonicalize(obj[key])}`)
      .join(',')}}`;
  }
  throw new Error(`dp1: unsupported JSON value type: ${typeof value}`);
}

export function transform(input: Buffer | string) {
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  return Buffer.from(canonicalize(JSON.parse(text)), 'utf8');
}
