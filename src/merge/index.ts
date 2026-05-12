type DisplayLike = Record<string, unknown> | null | undefined;
type ItemLike =
  | { override?: string | Record<string, unknown> | null; display?: Record<string, unknown> | null }
  | null
  | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function DisplayForItem(def: DisplayLike, ref: DisplayLike, item: ItemLike) {
  const defObj = isRecord(def) ? def : {};
  const refObj = isRecord(ref) ? ref : {};
  const defDisplay = isRecord(defObj.display) ? defObj.display : defObj;
  const refControls = isRecord(refObj.controls) ? refObj.controls : undefined;
  const refDisplay = refControls && isRecord(refControls.display) ? refControls.display : null;
  const base = structuredClone(defDisplay);
  if (refDisplay) {
    Object.assign(base, structuredClone(refDisplay));
  }
  let override = item?.override ?? null;
  if (typeof override === 'string') {
    override = JSON.parse(override);
  }
  const overrideObj = isRecord(override) ? override : null;
  if (overrideObj && isRecord(overrideObj.display)) {
    Object.assign(base, structuredClone(overrideObj.display));
  }
  if (isRecord(item?.display)) {
    Object.assign(base, structuredClone(item.display));
  }
  const out = Object.keys(base).length ? base : null;
  return [out, null] as const;
}
