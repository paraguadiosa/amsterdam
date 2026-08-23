import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/themes.js';

const T = globalThis.AMS_THEMES;

describe('theme registry', () => {
  it('exposes the four named palettes', () => {
    assert.deepEqual(T.listThemes(), ['dusk', 'neon', 'alien', 'solar']);
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

  it('palette labels match the redesign spec', () => {
    assert.equal(T.THEMES.dusk.label, 'Dusk');
    assert.equal(T.THEMES.neon.label, 'Cyber Neon');
    assert.equal(T.THEMES.alien.label, 'Alien Green');
    assert.equal(T.THEMES.solar.label, 'EcoPunk');
  });

  it('alien is a night scene and solar is a day scene', () => {
    assert.equal(T.THEMES.alien.scene, 'night');
    assert.equal(T.THEMES.solar.scene, 'day');
  });

  it('the merged palettes stay distinct from their neighbours', () => {
    assert.notEqual(T.THEMES.alien.vars.accent, T.THEMES.dusk.vars.accent);
    assert.notEqual(T.THEMES.alien.vars.accent, T.THEMES.neon.vars.accent);
    assert.notEqual(T.THEMES.solar.vars.bg, T.THEMES.dusk.vars.bg);
    assert.notEqual(T.THEMES.solar.vars.accent, T.THEMES.alien.vars.accent);
  });

  it('the auto option is not a real palette', () => {
    assert.ok(T.THEMES.auto === undefined);
    assert.equal(T.listThemes().includes('auto'), false);
  });

  it('buildThemeCss emits every variable as a custom property', () => {
    const css = T.buildThemeCss('dusk');
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
  it('clockTheme picks solar between 07:00 and 19:59', () => {
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 7)), 'solar');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 12)), 'solar');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 19)), 'solar');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 6)), 'dusk');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 20)), 'dusk');
    assert.equal(T.clockTheme(new Date(2024, 0, 1, 23)), 'dusk');
  });

  it('effectiveTheme honors explicit choices and auto', () => {
    const noon = new Date(2024, 0, 1, 12);
    const midnight = new Date(2024, 0, 1, 0);
    assert.equal(T.effectiveTheme('solar', midnight), 'solar');
    assert.equal(T.effectiveTheme('alien', noon), 'alien');
    assert.equal(T.effectiveTheme('auto', noon), 'solar');
    assert.equal(T.effectiveTheme('auto', midnight), 'dusk');
  });

  it('effectiveTheme falls back to dusk for unknown preferences', () => {
    const noon = new Date(2024, 0, 1, 12);
    assert.equal(T.effectiveTheme('retro', noon), 'dusk');
    assert.equal(T.effectiveTheme(undefined, noon), 'dusk');
    assert.equal(T.effectiveTheme('', noon), 'dusk');
  });
});
