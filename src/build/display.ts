import { resolve } from './helpers.js';
import type {
  DisplayControls,
  DisplayPrefs,
  DisplayScaling,
  InteractionPrefs,
  Margin,
  MouseInteraction,
} from './types.js';
import {
  DisplayControls as ValidateDisplayControls,
  DisplayPrefs as ValidateDisplayPrefs,
} from '../validate/index.js';

function normalizeMouse(value: MouseInteraction | undefined): MouseInteraction | undefined {
  if (!value) return undefined;
  // Pass values through unchanged so AJV sees the real types (no Boolean() coercion).
  return {
    ...(value.click === undefined ? {} : { click: value.click }),
    ...(value.scroll === undefined ? {} : { scroll: value.scroll }),
    ...(value.drag === undefined ? {} : { drag: value.drag }),
    ...(value.hover === undefined ? {} : { hover: value.hover }),
  };
}

function normalizeInteraction(value: InteractionPrefs | undefined): InteractionPrefs | undefined {
  if (!value) return undefined;
  return {
    ...(value.keyboard === undefined ? {} : { keyboard: value.keyboard }),
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
    this.interaction.mouse = resolve(value);
    return this;
  }
  build(): InteractionPrefs {
    return structuredClone(normalizeInteraction(this.interaction) ?? {});
  }
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
    this.display.interaction = resolve(value);
    return this;
  }

  userOverride(key: string, allowed: boolean) {
    if (!this.display.userOverrides) this.display.userOverrides = {};
    this.display.userOverrides[String(key)] = allowed;
    return this;
  }

  build(): DisplayPrefs {
    const out: DisplayPrefs = {
      ...(this.display.scaling === undefined ? {} : { scaling: this.display.scaling }),
      ...(this.display.margin === undefined ? {} : { margin: this.display.margin }),
      ...(this.display.background === undefined ? {} : { background: this.display.background }),
      ...(this.display.autoplay === undefined ? {} : { autoplay: this.display.autoplay }),
      ...(this.display.loop === undefined ? {} : { loop: this.display.loop }),
      ...(this.display.interaction === undefined
        ? {}
        : { interaction: normalizeInteraction(this.display.interaction) }),
      ...(this.display.userOverrides === undefined
        ? {}
        : { userOverrides: this.display.userOverrides }),
    };
    ValidateDisplayPrefs(out);
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
    this.display.interaction = resolve(value);
    return this;
  }

  build(): DisplayControls {
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
    ValidateDisplayControls(out);
    return structuredClone(out);
  }
}
