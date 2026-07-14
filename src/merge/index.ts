type MousePrefs = {
  click?: boolean;
  scroll?: boolean;
  drag?: boolean;
  hover?: boolean;
};

type InteractionPrefs = {
  keyboard?: string[];
  mouse?: MousePrefs;
};

type DisplayPrefs = {
  scaling?: string;
  margin?: unknown;
  background?: string;
  autoplay?: boolean;
  loop?: boolean;
  interaction?: InteractionPrefs;
  userOverrides?: Record<string, boolean>;
};

type DisplayControls = {
  scaling?: string;
  margin?: unknown;
  background?: string;
  autoplay?: boolean;
  loop?: boolean;
  interaction?: unknown;
};

type DefaultsLike = { display?: DisplayPrefs | null } | DisplayPrefs | null | undefined;
type RefLike =
  | { controls?: { display?: DisplayControls | null } | null }
  | DisplayControls
  | null
  | undefined;
type ItemLike =
  | {
      override?: string | Record<string, unknown> | null;
      display?: DisplayPrefs | null;
    }
  | null
  | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasMargin(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return true;
  return false;
}

function cloneDisplay(display: DisplayPrefs): DisplayPrefs {
  const out: DisplayPrefs = { ...display };
  if (display.interaction) {
    out.interaction = { ...display.interaction };
    if (display.interaction.mouse) {
      out.interaction.mouse = { ...display.interaction.mouse };
    }
  }
  if (display.userOverrides) {
    out.userOverrides = { ...display.userOverrides };
  }
  return out;
}

function overlayDisplay(dst: DisplayPrefs, src: DisplayPrefs) {
  if (src.scaling) dst.scaling = src.scaling;
  if (hasMargin(src.margin)) dst.margin = src.margin;
  if (src.background) dst.background = src.background;
  if (src.autoplay !== undefined) dst.autoplay = src.autoplay;
  if (src.loop !== undefined) dst.loop = src.loop;
  if (src.interaction) {
    if (!dst.interaction) dst.interaction = {};
    if (src.interaction.keyboard && src.interaction.keyboard.length > 0) {
      dst.interaction.keyboard = [...src.interaction.keyboard];
    }
    if (src.interaction.mouse) {
      if (!dst.interaction.mouse) dst.interaction.mouse = {};
      const m = dst.interaction.mouse;
      const sm = src.interaction.mouse;
      if (sm.click) m.click = sm.click;
      if (sm.scroll) m.scroll = sm.scroll;
      if (sm.drag) m.drag = sm.drag;
      if (sm.hover) m.hover = sm.hover;
    }
  }
  if (src.userOverrides && Object.keys(src.userOverrides).length > 0) {
    dst.userOverrides = { ...(dst.userOverrides ?? {}), ...src.userOverrides };
  }
}

function tryParseInteraction(raw: unknown): InteractionPrefs | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;

  const obj = raw as Record<string, unknown>;
  const out: InteractionPrefs = {};

  if ('keyboard' in obj) {
    if (!Array.isArray(obj.keyboard) || !obj.keyboard.every(value => typeof value === 'string')) {
      return null;
    }
    if (obj.keyboard.length > 0) out.keyboard = [...obj.keyboard];
  }

  if ('mouse' in obj && obj.mouse !== undefined) {
    if (!isRecord(obj.mouse)) return null;
    const mouse: MousePrefs = {};
    for (const key of ['click', 'scroll', 'drag', 'hover'] as const) {
      if (key in obj.mouse) {
        if (typeof obj.mouse[key] !== 'boolean') return null;
        if (obj.mouse[key]) mouse[key] = true;
      }
    }
    if (Object.keys(mouse).length > 0) out.mouse = mouse;
  }

  return out;
}

function applyDisplayJSON(dst: DisplayPrefs, src: DisplayControls) {
  if (src.scaling) dst.scaling = src.scaling;
  if (hasMargin(src.margin)) dst.margin = src.margin;
  if (src.background) dst.background = src.background;
  if (src.autoplay !== undefined) dst.autoplay = src.autoplay;
  if (src.loop !== undefined) dst.loop = src.loop;
  if (src.interaction !== undefined && src.interaction !== null) {
    if (!dst.interaction) dst.interaction = {};
    const parsed = tryParseInteraction(src.interaction);
    if (parsed) {
      if (parsed.keyboard && parsed.keyboard.length > 0) {
        dst.interaction.keyboard = parsed.keyboard;
      }
      if (parsed.mouse) {
        dst.interaction.mouse = { ...parsed.mouse };
      }
    }
  }
}

function isEmptyDisplay(display: DisplayPrefs) {
  return (
    !display.scaling &&
    !hasMargin(display.margin) &&
    !display.background &&
    display.autoplay === undefined &&
    display.loop === undefined &&
    !display.interaction &&
    (!display.userOverrides || Object.keys(display.userOverrides).length === 0)
  );
}

function defaultsDisplay(def: DefaultsLike): DisplayPrefs | null {
  if (!def) return null;
  if (isRecord(def) && 'display' in def) {
    const nested = (def as { display?: DisplayPrefs | null }).display;
    return nested ? cloneDisplay(nested) : null;
  }
  if (isRecord(def)) return cloneDisplay(def as DisplayPrefs);
  return null;
}

function refDisplay(ref: RefLike): DisplayControls | null {
  if (!ref) return null;
  if (isRecord(ref) && 'controls' in ref) {
    const controls = (ref as { controls?: { display?: DisplayControls | null } | null }).controls;
    return controls?.display ?? null;
  }
  if (isRecord(ref)) return ref as DisplayControls;
  return null;
}

export function DisplayForItem(def: DefaultsLike, ref: RefLike, item: ItemLike) {
  const base = defaultsDisplay(def) ?? {};

  const refControls = refDisplay(ref);
  if (refControls) applyDisplayJSON(base, refControls);

  let override = item?.override ?? null;
  if (typeof override === 'string') {
    override = JSON.parse(override);
  }
  const overrideObj = isRecord(override) ? override : null;
  const overrideDisplay =
    overrideObj && isRecord(overrideObj.display)
      ? (overrideObj.display as DisplayPrefs)
      : null;
  if (overrideDisplay) overlayDisplay(base, overrideDisplay);

  if (item?.display) overlayDisplay(base, cloneDisplay(item.display));

  const out = isEmptyDisplay(base) ? null : base;
  return [out, null] as const;
}
