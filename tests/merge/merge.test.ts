import { test } from 'vitest';
import assert from 'node:assert/strict';
import { DisplayForItem, DurationForItem, LicenseForItem } from '../../src/merge/index.js';

test('DisplayForItem_empty', () => {
  const [display, err] = DisplayForItem(null, null, null);
  assert.equal(err, null);
  assert.equal(display, null);
});

test('DisplayForItem_badOverride', () => {
  assert.throws(
    () => DisplayForItem(null, null, { override: '{' as unknown as string }),
    SyntaxError
  );
});

test('DisplayForItem_defaultsOnly', () => {
  const [display] = DisplayForItem({ display: { scaling: 'fit' } }, null, null);
  assert.deepEqual(display, { scaling: 'fit' });
});

test('DisplayForItem_defaultsThenItem', () => {
  const [display] = DisplayForItem({ display: { scaling: 'fit', autoplay: true } }, null, {
    display: { scaling: 'fill' },
  });
  assert.deepEqual(display, { scaling: 'fill', autoplay: true });
});

test('DisplayForItem_refOverlay', () => {
  const [display] = DisplayForItem(null, { controls: { display: { scaling: 'stretch' } } }, null);
  assert.deepEqual(display, { scaling: 'stretch' });
});

test('DisplayForItem_override', () => {
  const [display] = DisplayForItem(null, null, { override: { display: { scaling: 'auto' } } });
  assert.deepEqual(display, { scaling: 'auto' });
});

test('DisplayForItem_overrideThenItem_itemWins', () => {
  const [display] = DisplayForItem(null, null, {
    override: { display: { scaling: 'stretch' } },
    display: { scaling: 'fill' },
  });
  assert.deepEqual(display, { scaling: 'fill' });
});

test('DisplayForItem_emptyDisplayOverride_itemWins', () => {
  const [display] = DisplayForItem(null, null, {
    override: { display: {} },
    display: { scaling: 'fill' },
  });
  assert.deepEqual(display, { scaling: 'fill' });
});

test('DisplayForItem_refThenOverrideThenItem', () => {
  const [display] = DisplayForItem(
    null,
    { controls: { display: { scaling: 'fit' } } },
    { override: { display: { scaling: 'fill' } }, display: { scaling: 'auto' } }
  );
  assert.deepEqual(display, { scaling: 'auto' });
});

test('DisplayForItem_fullOverlay', () => {
  const [display] = DisplayForItem(
    {
      display: {
        scaling: 'fit',
        autoplay: false,
        interaction: { keyboard: ['KeyA'], mouse: { click: true } },
        userOverrides: { scaling: true },
      },
    },
    {
      controls: {
        display: {
          scaling: 'fill',
          margin: '5%',
          background: '#111111',
          autoplay: true,
          loop: true,
          interaction: { keyboard: ['Space'], mouse: { scroll: true, drag: true, hover: true } },
        },
      },
    },
    {
      display: {
        scaling: 'auto',
        interaction: { keyboard: ['Enter'], mouse: { hover: true } },
        userOverrides: { margin: true },
      },
    }
  );
  assert.deepEqual(display, {
    scaling: 'auto',
    autoplay: true,
    interaction: {
      keyboard: ['Enter'],
      mouse: { scroll: true, drag: true, hover: true },
    },
    userOverrides: { scaling: true, margin: true },
    margin: '5%',
    background: '#111111',
    loop: true,
  });
});

test('applyDisplayJSON_invalidInteractionIgnored', () => {
  const [display] = DisplayForItem(
    { display: { scaling: 'fit' } },
    {
      controls: {
        display: { scaling: 'stretch', interaction: { keyboard: 42 } as unknown as object },
      },
    },
    null
  );
  assert.deepEqual(display, { scaling: 'stretch', interaction: {} });
});

test('applyDisplayJSON_refInteractionKeepsKeyboardWhenMouseNull', () => {
  const [display] = DisplayForItem(
    null,
    {
      controls: {
        display: {
          interaction: { keyboard: ['Space'], mouse: null } as unknown as object,
        },
      },
    },
    null
  );
  assert.deepEqual(display, { interaction: { keyboard: ['Space'] } });
});

test('applyDisplayJSON_refInteractionReplacesMousePrefs', () => {
  const [display] = DisplayForItem(
    { display: { interaction: { mouse: { scroll: true, drag: true, hover: true } } } },
    {
      controls: {
        display: {
          interaction: { mouse: { click: false } },
        },
      },
    },
    null
  );
  assert.deepEqual(display, { interaction: { mouse: { click: false } } });
});

test('applyDisplayJSON_refInteractionClearsKeyboardWithEmptyArray', () => {
  const [display] = DisplayForItem(
    { display: { interaction: { keyboard: ['KeyA'] } } },
    {
      controls: {
        display: {
          interaction: { keyboard: [] },
        },
      },
    },
    null
  );
  assert.deepEqual(display, { interaction: { keyboard: ['KeyA'] } });
});

test('DisplayForItem_itemMouseFalseOverridesRefFlag', () => {
  const [display] = DisplayForItem(
    null,
    {
      controls: {
        display: {
          interaction: { mouse: { scroll: true, drag: true } },
        },
      },
    },
    {
      display: {
        interaction: { mouse: { click: false } },
      },
    }
  );
  assert.deepEqual(display, {
    interaction: { mouse: { click: false, scroll: true, drag: true } },
  });
});

test('DisplayForItem_itemKeyboardEmptyDoesNotClearInheritedKeyboard', () => {
  const [display] = DisplayForItem({ display: { interaction: { keyboard: ['KeyA'] } } }, null, {
    display: { interaction: { keyboard: [] } },
  });
  assert.deepEqual(display, { interaction: { keyboard: ['KeyA'] } });
});

test('DisplayForItem_itemAutoplayFalseOverlay', () => {
  const [display] = DisplayForItem({ display: { scaling: 'fit', autoplay: true } }, null, {
    display: { autoplay: false },
  });
  assert.deepEqual(display, { scaling: 'fit', autoplay: false });
});

test('DisplayForItem_returnsIsolatedCopy', () => {
  const def = { display: { interaction: { keyboard: ['KeyA'], mouse: { click: true } } } };
  const ref = {
    controls: { display: { interaction: { keyboard: ['Space'], mouse: { scroll: true } } } },
  };
  const item = { display: { interaction: { keyboard: ['Enter'], mouse: { hover: true } } } };
  const [display] = DisplayForItem(def, ref, item);
  assert.ok(display);
  (display as { interaction?: { keyboard?: string[] } }).interaction?.keyboard?.push('KeyB');
  assert.deepEqual(def.display.interaction.keyboard, ['KeyA']);
  assert.deepEqual(ref.controls.display.interaction.keyboard, ['Space']);
  assert.deepEqual(item.display.interaction.keyboard, ['Enter']);
});

test('DisplayForItem_defaultsOnlyIsolatesKeyboard', () => {
  const def = { display: { interaction: { keyboard: ['KeyA'] } } };
  const [display] = DisplayForItem(def, null, null);
  assert.ok(display);
  display.interaction?.keyboard?.push('KeyB');
  assert.deepEqual(def.display.interaction.keyboard, ['KeyA']);
});

test('DisplayForItem_itemFalseOverridesDefaultTrue', () => {
  const [display] = DisplayForItem(
    { display: { interaction: { mouse: { click: true, hover: true }, keyboard: ['Space'] } } },
    null,
    { display: { interaction: { mouse: { click: false }, keyboard: [] } } }
  );
  assert.deepEqual(display, {
    interaction: { mouse: { click: false, hover: true }, keyboard: ['Space'] },
  });
});

test('DisplayForItem_overrideFalseOverridesRefTrue', () => {
  const [display] = DisplayForItem(
    null,
    { controls: { display: { interaction: { mouse: { drag: true, scroll: true } } } } },
    { override: { display: { interaction: { mouse: { drag: false } } } } }
  );
  assert.deepEqual(display, { interaction: { mouse: { drag: false, scroll: true } } });
});

test('DurationForItem_itemThenDefaults', () => {
  assert.equal(DurationForItem({ duration: 10 }, { duration: 3 }), 3);
  assert.equal(DurationForItem({ duration: 10 }, {}), 10);
  assert.equal(DurationForItem({ duration: 10 }, { duration: 0 }), 0);
  assert.equal(DurationForItem({}, {}), undefined);
  assert.equal(DurationForItem(null, null), undefined);
  assert.equal(DurationForItem({ duration: -1 }, { duration: 'x' }), undefined);
});

test('LicenseForItem_itemThenDefaults', () => {
  assert.equal(LicenseForItem({ license: 'open' }, { license: 'token' }), 'token');
  assert.equal(LicenseForItem({ license: 'open' }, {}), 'open');
  assert.equal(LicenseForItem({}, {}), undefined);
  assert.equal(LicenseForItem(undefined, undefined), undefined);
});
