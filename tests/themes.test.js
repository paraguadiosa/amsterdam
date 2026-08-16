import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/themes.js';

const T = globalThis.AMS_THEMES;

describe('theme registry', () => {
  it('exposes the five named palettes', () => {
    assert.deepEqual(T.listThemes(), ['night', 'day', 'dusk', 'aurora', 'retro']);
  });

  it('every theme defines exactly the required variables', () => {
    for (const id of T.listThemes()) {
      const vars = T.THEMES[id].vars;
      for (const name of T.REQUIRED_VARS) {
        assert.ok(name in vars, `${id} is missing --${name}`);
      }
      assert.equal(
        Object.keys(vars).length,
        T.REQUIRED_VARS.length,
        `${id} declares unexpected variables`
      );
    }
  });

  it('every theme has a label and a valid scene', () => {
    for (const id of T.listThemes()) {
      assert.ok(T.THEMES[id].label.length > 0, `${id} label`);
      assert.ok(['night', 'day'].includes(T.THEMES[id].scene), `${id} scene`);
    }
  });

  it('the auto option is not a real palette', () => {
    assert.ok(T.THEMES.auto === undefined);
    assert.equal(T.listThemes().includes('auto'), false);
  });

  it('buildThemeCss emits every variable as a custom property', () => {
    const css = T.buildThemeCss('night');
    assert.ok(css.startsWith(':root{'));
    assert.ok(css.endsWith('}'));
    for (const name of T.REQUIRED_VARS) {
      assert.ok(css.includes(`--${name}:`), `missing --${name}`);
    }
  });

  it('buildThemeCss rejects unknown themes', () => {
    assert.equal(T.buildThemeCss('nope'), '');
  });
});

describe('theme selection', () => {
  it('clockTheme picks day between 07:00 and 19:59', () => {
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 7)), 'day');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 12)), 'day');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 19)), 'day');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 6)), 'night');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 20)), 'night');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 23)), 'night');
  });

  it('effectiveTheme honors explicit choices and auto', () => {
    const noon = new Date(2024, 0, 1, 12);
    const midnight = new Date(2024, 0, 1, 0);
    assert.equal(T.effectiveTheme('day', midnight), 'day');
    assert.equal(T.effectiveTheme('dusk', noon), 'dusk');
    assert.equal(T.effectiveTheme('auto', noon), 'day');
    assert.equal(T.effectiveTheme('auto', midnight), 'night');
  });

  it('effectiveTheme falls back to night for unknown preferences', () => {
    const noon = new Date(2024, 0, 1, 12);
    assert.equal(T.effectiveTheme('neon', noon), 'night');
    assert.equal(T.effectiveTheme(undefined, noon), 'night');
    assert.equal(T.effectiveTheme('', noon), 'night');
  });
});
