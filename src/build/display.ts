import { assertHexColor } from './helpers.js';
import type {
  DisplayControls,
  DisplayPrefs,
  DisplayScaling,
  InteractionPrefs,
  Margin,
  MouseInteraction,
} from './types.js';

function assertScaling(value: string, fieldName: string): asserts value is DisplayScaling {
  if (!['fit', 'fill', 'stretch', 'auto'].includes(value)) {
    throw new Error(`dp1: ${fieldName} must be one of fit|fill|stretch|auto`);
  }
}

function assertMargin(value: Margin, fieldName: string): void {
  if (typeof value === 'number') {
    if (!(value >= 0)) throw new Error(`dp1: ${fieldName} must be >= 0`);
    return;
  }
  if (typeof value === 'string' && /^\d+(\.\d+)?(px|%|vw|vh)$/.test(value)) return;
  throw new Error(`dp1: ${fieldName} must be a number (px) or a string with px|%|vw|vh`);
}

function normalizeMouse(value: MouseInteraction | undefined): MouseInteraction | undefined {
  if (!value) return undefined;
  return {
    ...(value.click === undefined ? {} : { click: Boolean(value.click) }),
    ...(value.scroll === undefined ? {} : { scroll: Boolean(value.scroll) }),
    ...(value.drag === undefined ? {} : { drag: Boolean(value.drag) }),
    ...(value.hover === undefined ? {} : { hover: Boolean(value.hover) }),
  };
}

function normalizeInteraction(value: InteractionPrefs | undefined): InteractionPrefs | undefined {
  if (!value) return undefined;
  return {
    ...(value.keyboard === undefined ? {} : { keyboard: value.keyboard.map(String) }),
    ...(value.mouse === undefined ? {} : { mouse: normalizeMouse(value.mouse) }),
  };
}

export class MouseInteractionBuilder {
  private mouse: MouseInteraction = {};
  click(value: boolean) {
    this.mouse.click = value;
    return this;
  }
  scroll(value: boolean) {
    this.mouse.scroll = value;
    return this;
  }
  drag(value: boolean) {
    this.mouse.drag = value;
    return this;
  }
  hover(value: boolean) {
    this.mouse.hover = value;
    return this;
  }
  build(): MouseInteraction {
    return structuredClone(normalizeMouse(this.mouse) ?? {});
  }
}

export class InteractionBuilder {
  private interaction: InteractionPrefs = {};
  keyboard(keys: string[]) {
    this.interaction.keyboard = keys;
    return this;
  }
  mouse(value: MouseInteraction | MouseInteractionBuilder) {
    this.interaction.mouse = typeof value === 'object' && 'build' in value ? value.build() : value;
    return this;
  }
  build(): InteractionPrefs {
    return structuredClone(normalizeInteraction(this.interaction) ?? {});
  }
}

function validateDisplayCommon(
  display: Pick<DisplayPrefs, 'scaling' | 'margin' | 'background' | 'autoplay' | 'loop' | 'interaction'>,
  fieldName: string
) {
  if (display.scaling !== undefined) assertScaling(String(display.scaling), `${fieldName}.scaling`);
  if (display.margin !== undefined) assertMargin(display.margin as Margin, `${fieldName}.margin`);
  if (display.background !== undefined)
    assertHexColor(String(display.background), `${fieldName}.background`);
  if (display.autoplay !== undefined && typeof display.autoplay !== 'boolean')
    throw new Error(`dp1: ${fieldName}.autoplay must be a boolean`);
  if (display.loop !== undefined && typeof display.loop !== 'boolean')
    throw new Error(`dp1: ${fieldName}.loop must be a boolean`);
}

export class DisplayPrefsBuilder {
  private display: DisplayPrefs = {};

  scaling(value: DisplayScaling) {
    this.display.scaling = value;
    return this;
  }

  margin(value: Margin) {
    this.display.margin = value;
    return this;
  }

  background(value: string | 'transparent') {
    this.display.background = value;
    return this;
  }

  autoplay(value: boolean) {
    this.display.autoplay = value;
    return this;
  }

  loop(value: boolean) {
    this.display.loop = value;
    return this;
  }

  interaction(value: InteractionPrefs | InteractionBuilder) {
    this.display.interaction = typeof value === 'object' && 'build' in value ? value.build() : value;
    return this;
  }

  userOverride(key: string, allowed: boolean) {
    if (!this.display.userOverrides) this.display.userOverrides = {};
    this.display.userOverrides[String(key)] = Boolean(allowed);
    return this;
  }

  build(): DisplayPrefs {
    validateDisplayCommon(this.display, 'display');
    const out: DisplayPrefs = {
      ...(this.display.scaling === undefined ? {} : { scaling: this.display.scaling }),
      ...(this.display.margin === undefined ? {} : { margin: this.display.margin }),
      ...(this.display.background === undefined ? {} : { background: this.display.background }),
      ...(this.display.autoplay === undefined ? {} : { autoplay: this.display.autoplay }),
      ...(this.display.loop === undefined ? {} : { loop: this.display.loop }),
      ...(this.display.interaction === undefined
        ? {}
        : { interaction: normalizeInteraction(this.display.interaction) }),
      ...(this.display.userOverrides === undefined ? {} : { userOverrides: this.display.userOverrides }),
    };
    return structuredClone(out);
  }
}

export class DisplayControlsBuilder {
  private display: DisplayControls = {};

  scaling(value: DisplayScaling) {
    this.display.scaling = value;
    return this;
  }

  margin(value: Margin) {
    this.display.margin = value;
    return this;
  }

  background(value: string | 'transparent') {
    this.display.background = value;
    return this;
  }

  autoplay(value: boolean) {
    this.display.autoplay = value;
    return this;
  }

  loop(value: boolean) {
    this.display.loop = value;
    return this;
  }

  interaction(value: InteractionPrefs | InteractionBuilder) {
    this.display.interaction = typeof value === 'object' && 'build' in value ? value.build() : value;
    return this;
  }

  build(): DisplayControls {
    validateDisplayCommon(this.display, 'controls.display');
    const out: DisplayControls = {
      ...(this.display.scaling === undefined ? {} : { scaling: this.display.scaling }),
      ...(this.display.margin === undefined ? {} : { margin: this.display.margin }),
      ...(this.display.background === undefined ? {} : { background: this.display.background }),
      ...(this.display.autoplay === undefined ? {} : { autoplay: this.display.autoplay }),
      ...(this.display.loop === undefined ? {} : { loop: this.display.loop }),
      ...(this.display.interaction === undefined
        ? {}
        : { interaction: normalizeInteraction(this.display.interaction) }),
    };
    return structuredClone(out);
  }
}

