/* Amsterdam theme registry.
 *
 * Single source of truth for every palette. The browser loads this file
 * as a plain <script> in <head>, so the stored or clock-derived theme
 * applies before first paint. The test suite side-effect imports it in
 * Node. index.html holds no per-theme colors anymore; every theme is
 * data, and applyThemeCss turns one entry into CSS custom properties.
 */
(function (global) {
  'use strict';

  /* Every theme must define each of these variables. */
  var REQUIRED_VARS = [
    /* surfaces and text */
    'bg', 'bg-soft', 'card', 'card-hover',
    'border', 'border-hi',
    'text', 'muted', 'faint',
    'accent', 'accent-2',
    'green', 'amber', 'red',
    'warn-bg', 'warn-border', 'warn-text',
    'btn-from', 'btn-to',
    'shadow-sm', 'shadow-hover',
    'body-glow',
    /* hero copy and overlays */
    'hero-fade',
    'kicker-color', 'kicker-shadow',
    'hero-title', 'hero-title-shadow',
    'hero-sub', 'hero-sub-shadow',
    'hero-meta', 'hero-meta-shadow',
    'verse', 'verse-shadow',
    'flag-border', 'flag-shadow',
    /* components */
    'credits-fade', 'credits-bar', 'credits-glow', 'live-dot-glow',
    'tag-color', 'tag-bg', 'tag-border',
    'tag-local-color', 'tag-local-bg', 'tag-local-border',
    'tag-row-bg', 'tag-row-border',
    'tag-row-local-bg', 'tag-row-local-border',
    'search-ring',
    'btn-shadow', 'btn-shadow-hover',
    'toggle-bg', 'toggle-border', 'toggle-color', 'toggle-shadow'
  ];

  var THEMES = {
    night: {
      label: 'Night',
      scene: 'night',
      vars: {
        /* surfaces — canal-night palette */
        'bg': '#070b12',
        'bg-soft': '#0e1522',
        'card': '#101828',
        'card-hover': '#16213a',
        'border': '#1a2740',
        'border-hi': '#2d4068',
        'text': '#dde6f5',
        'muted': '#8b9cc0',
        'faint': '#6f85b0',
        'accent': '#5b8def',
        'accent-2': '#a9c4ff',
        'green': '#34d399',
        'amber': '#fbbf24',
        'red': '#f87171',
        'warn-bg': '#181205',
        'warn-border': '#3d2c10',
        'warn-text': '#d4a04a',
        'btn-from': '#3f6fd8',
        'btn-to': '#2b4fa8',
        'shadow-sm': '0 1px 3px rgba(0,0,0,.55)',
        'shadow-hover': '0 6px 20px rgba(0,0,0,.65)',
        'body-glow': '#101c3d',
        'hero-fade': 'linear-gradient(to bottom, rgba(7,11,18,.55) 0%, rgba(7,11,18,.15) 34%, rgba(7,11,18,0) 55%, rgba(7,11,18,.42) 100%)',
        'kicker-color': '#a9c4ff',
        'kicker-shadow': '0 1px 4px rgba(0,0,0,.7)',
        'hero-title': '#eef3ff',
        'hero-title-shadow': '0 2px 14px rgba(0,0,0,.6)',
        'hero-sub': '#c3d2ef',
        'hero-sub-shadow': '0 1px 6px rgba(0,0,0,.7)',
        'hero-meta': '#6f85b0',
        'hero-meta-shadow': '0 1px 4px rgba(0,0,0,.7)',
        'verse': '#b9c8e4',
        'verse-shadow': '0 1px 5px rgba(0,0,0,.75)',
        'flag-border': 'rgba(255,255,255,.16)',
        'flag-shadow': '0 4px 14px rgba(0,0,0,.5)',
        'credits-fade': 'linear-gradient(120deg, rgba(91,141,239,.16), rgba(43,79,168,.1) 55%, rgba(16,24,40,0))',
        'credits-bar': 'linear-gradient(to bottom, #5b8def, #2b4fa8)',
        'credits-glow': 'rgba(52,211,153,.25)',
        'live-dot-glow': '0 0 8px rgba(52,211,153,.75), 0 0 14px rgba(255,178,90,.45)',
        'tag-color': '#a9c4ff',
        'tag-bg': 'rgba(91,141,239,.1)',
        'tag-border': 'rgba(91,141,239,.25)',
        'tag-local-color': '#34d399',
        'tag-local-bg': 'rgba(52,211,153,.08)',
        'tag-local-border': 'rgba(52,211,153,.25)',
        'tag-row-bg': 'rgba(91,141,239,.07)',
        'tag-row-border': 'rgba(91,141,239,.2)',
        'tag-row-local-bg': 'rgba(52,211,153,.07)',
        'tag-row-local-border': 'rgba(52,211,153,.2)',
        'search-ring': '0 0 0 3px rgba(91,141,239,.15)',
        'btn-shadow': '0 2px 8px rgba(43,79,168,.35)',
        'btn-shadow-hover': '0 4px 14px rgba(43,79,168,.5)',
        'toggle-bg': 'rgba(9,13,22,.55)',
        'toggle-border': 'rgba(255,255,255,.16)',
        'toggle-color': '#a9c4ff',
        'toggle-shadow': '0 4px 14px rgba(0,0,0,.4)'
      }
    },

    day: {
      label: 'Day',
      scene: 'day',
      vars: {
        /* surfaces — light sky / paper */
        'bg': '#f6f3ea',
        'bg-soft': '#ece7d9',
        'card': '#ffffff',
        'card-hover': '#f2edde',
        'border': '#ddd5c2',
        'border-hi': '#c3baa2',
        'text': '#20293a',
        'muted': '#44576e',
        'faint': '#52627a',
        'accent': '#e0701a',
        'accent-2': '#a24d08',
        'green': '#16753f',
        'amber': '#a05c00',
        'red': '#b42318',
        'warn-bg': '#fdf4e0',
        'warn-border': '#e7c687',
        'warn-text': '#7c4a06',
        'btn-from': '#b4530d',
        'btn-to': '#a84c0a',
        'shadow-sm': '0 1px 3px rgba(82,66,35,.14)',
        'shadow-hover': '0 6px 20px rgba(82,66,35,.18)',
        'body-glow': '#d9e6f6',
        'hero-fade': 'linear-gradient(112deg, rgba(252,248,238,.88) 0%, rgba(252,248,238,.55) 34%, rgba(252,248,238,0) 58%), linear-gradient(to bottom, rgba(252,248,238,.2) 0%, rgba(252,248,238,0) 28%, rgba(96,128,70,0) 58%, rgba(66,94,52,.32) 100%)',
        'kicker-color': '#7f3c04',
        'kicker-shadow': '0 1px 3px rgba(252,248,238,.85)',
        'hero-title': '#1c2733',
        'hero-title-shadow': '0 1px 10px rgba(252,248,238,.8)',
        'hero-sub': '#2b3d52',
        'hero-sub-shadow': '0 1px 4px rgba(252,248,238,.85)',
        'hero-meta': '#33475f',
        'hero-meta-shadow': '0 1px 3px rgba(252,248,238,.9)',
        'verse': '#17293c',
        'verse-shadow': '0 1px 3px rgba(252,248,238,.9)',
        'flag-border': 'rgba(32,41,58,.35)',
        'flag-shadow': '0 4px 14px rgba(82,66,35,.22)',
        'credits-fade': 'linear-gradient(120deg, rgba(224,112,26,.12), rgba(224,112,26,.05) 55%, rgba(255,255,255,0))',
        'credits-bar': 'linear-gradient(to bottom, #e0701a, #a84c0a)',
        'credits-glow': 'rgba(22,117,63,.22)',
        'live-dot-glow': '0 0 8px rgba(22,117,63,.5)',
        'tag-color': '#a24d08',
        'tag-bg': 'rgba(224,112,26,.1)',
        'tag-border': 'rgba(224,112,26,.3)',
        'tag-local-color': '#16753f',
        'tag-local-bg': 'rgba(22,117,63,.08)',
        'tag-local-border': 'rgba(22,117,63,.3)',
        'tag-row-bg': 'rgba(224,112,26,.08)',
        'tag-row-border': 'rgba(224,112,26,.22)',
        'tag-row-local-bg': 'rgba(22,117,63,.07)',
        'tag-row-local-border': 'rgba(22,117,63,.22)',
        'search-ring': '0 0 0 3px rgba(224,112,26,.18)',
        'btn-shadow': '0 2px 8px rgba(168,76,10,.28)',
        'btn-shadow-hover': '0 4px 14px rgba(168,76,10,.42)',
        'toggle-bg': 'rgba(255,255,255,.75)',
        'toggle-border': 'rgba(32,41,58,.28)',
        'toggle-color': '#a24d08',
        'toggle-shadow': '0 4px 14px rgba(82,66,35,.18)'
      }
    },

    dusk: {
      label: 'Dusk',
      scene: 'night',
      vars: {
        /* surfaces — violet twilight */
        'bg': '#171022',
        'bg-soft': '#221833',
        'card': '#241a36',
        'card-hover': '#2f2347',
        'border': '#352a4d',
        'border-hi': '#4d3f6e',
        'text': '#f2e9f7',
        'muted': '#b3a3cc',
        'faint': '#9680bc',
        'accent': '#ff9e5e',
        'accent-2': '#ffc39a',
        'green': '#7fd8a8',
        'amber': '#ffc46b',
        'red': '#ff8f8f',
        'warn-bg': '#2b1a08',
        'warn-border': '#5c3a12',
        'warn-text': '#ffcf9e',
        'btn-from': '#d96a3a',
        'btn-to': '#a84a28',
        'shadow-sm': '0 1px 3px rgba(0,0,0,.55)',
        'shadow-hover': '0 6px 20px rgba(0,0,0,.65)',
        'body-glow': '#2a1a3d',
        'hero-fade': 'linear-gradient(to bottom, rgba(10,6,18,.6) 0%, rgba(10,6,18,.18) 34%, rgba(10,6,18,0) 55%, rgba(10,6,18,.5) 100%)',
        'kicker-color': '#ffc39a',
        'kicker-shadow': '0 1px 4px rgba(0,0,0,.7)',
        'hero-title': '#fff1e6',
        'hero-title-shadow': '0 2px 14px rgba(0,0,0,.6)',
        'hero-sub': '#e8cfdc',
        'hero-sub-shadow': '0 1px 6px rgba(0,0,0,.7)',
        'hero-meta': '#9680bc',
        'hero-meta-shadow': '0 1px 4px rgba(0,0,0,.7)',
        'verse': '#ddc3e6',
        'verse-shadow': '0 1px 5px rgba(0,0,0,.75)',
        'flag-border': 'rgba(255,255,255,.16)',
        'flag-shadow': '0 4px 14px rgba(0,0,0,.5)',
        'credits-fade': 'linear-gradient(120deg, rgba(255,158,94,.18), rgba(168,74,40,.1) 55%, rgba(23,16,34,0))',
        'credits-bar': 'linear-gradient(to bottom, #ff9e5e, #a84a28)',
        'credits-glow': 'rgba(127,216,168,.3)',
        'live-dot-glow': '0 0 8px rgba(127,216,168,.7), 0 0 14px rgba(255,158,94,.4)',
        'tag-color': '#ffc39a',
        'tag-bg': 'rgba(255,158,94,.12)',
        'tag-border': 'rgba(255,158,94,.28)',
        'tag-local-color': '#7fd8a8',
        'tag-local-bg': 'rgba(127,216,168,.1)',
        'tag-local-border': 'rgba(127,216,168,.28)',
        'tag-row-bg': 'rgba(255,158,94,.08)',
        'tag-row-border': 'rgba(255,158,94,.2)',
        'tag-row-local-bg': 'rgba(127,216,168,.07)',
        'tag-row-local-border': 'rgba(127,216,168,.2)',
        'search-ring': '0 0 0 3px rgba(255,158,94,.18)',
        'btn-shadow': '0 2px 8px rgba(168,74,40,.4)',
        'btn-shadow-hover': '0 4px 14px rgba(168,74,40,.55)',
        'toggle-bg': 'rgba(23,16,34,.6)',
        'toggle-border': 'rgba(255,255,255,.16)',
        'toggle-color': '#ffc39a',
        'toggle-shadow': '0 4px 14px rgba(0,0,0,.4)'
      }
    },

    aurora: {
      label: 'Aurora',
      scene: 'night',
      vars: {
        /* surfaces — deep Nordic fjord */
        'bg': '#0a0f14',
        'bg-soft': '#101a22',
        'card': '#12202a',
        'card-hover': '#1a2f3c',
        'border': '#1e3444',
        'border-hi': '#33546a',
        'text': '#e3f2e9',
        'muted': '#93b3a8',
        'faint': '#74a691',
        'accent': '#4fd6a8',
        'accent-2': '#a5f0d5',
        'green': '#4fd6a8',
        'amber': '#f6c962',
        'red': '#f27e8a',
        'warn-bg': '#1c1a06',
        'warn-border': '#4a4112',
        'warn-text': '#e5cd7a',
        'btn-from': '#2f9e7d',
        'btn-to': '#1f6e58',
        'shadow-sm': '0 1px 3px rgba(0,0,0,.55)',
        'shadow-hover': '0 6px 20px rgba(0,0,0,.65)',
        'body-glow': '#0f2a33',
        'hero-fade': 'linear-gradient(to bottom, rgba(5,12,10,.6) 0%, rgba(5,12,10,.15) 34%, rgba(5,12,10,0) 55%, rgba(5,12,10,.48) 100%)',
        'kicker-color': '#a5f0d5',
        'kicker-shadow': '0 1px 4px rgba(0,0,0,.7)',
        'hero-title': '#eafff5',
        'hero-title-shadow': '0 2px 14px rgba(0,0,0,.6)',
        'hero-sub': '#bfe8d8',
        'hero-sub-shadow': '0 1px 6px rgba(0,0,0,.7)',
        'hero-meta': '#74a691',
        'hero-meta-shadow': '0 1px 4px rgba(0,0,0,.7)',
        'verse': '#c3e0d8',
        'verse-shadow': '0 1px 5px rgba(0,0,0,.75)',
        'flag-border': 'rgba(255,255,255,.14)',
        'flag-shadow': '0 4px 14px rgba(0,0,0,.5)',
        'credits-fade': 'linear-gradient(120deg, rgba(79,214,168,.16), rgba(31,110,88,.1) 55%, rgba(10,15,20,0))',
        'credits-bar': 'linear-gradient(to bottom, #4fd6a8, #1f6e58)',
        'credits-glow': 'rgba(79,214,168,.3)',
        'live-dot-glow': '0 0 8px rgba(79,214,168,.75), 0 0 14px rgba(166,124,255,.4)',
        'tag-color': '#a5f0d5',
        'tag-bg': 'rgba(79,214,168,.12)',
        'tag-border': 'rgba(79,214,168,.28)',
        'tag-local-color': '#4fd6a8',
        'tag-local-bg': 'rgba(79,214,168,.1)',
        'tag-local-border': 'rgba(79,214,168,.28)',
        'tag-row-bg': 'rgba(79,214,168,.08)',
        'tag-row-border': 'rgba(79,214,168,.2)',
        'tag-row-local-bg': 'rgba(79,214,168,.07)',
        'tag-row-local-border': 'rgba(79,214,168,.2)',
        'search-ring': '0 0 0 3px rgba(79,214,168,.18)',
        'btn-shadow': '0 2px 8px rgba(31,110,88,.4)',
        'btn-shadow-hover': '0 4px 14px rgba(31,110,88,.55)',
        'toggle-bg': 'rgba(10,15,20,.55)',
        'toggle-border': 'rgba(255,255,255,.15)',
        'toggle-color': '#a5f0d5',
        'toggle-shadow': '0 4px 14px rgba(0,0,0,.4)'
      }
    },

    retro: {
      label: 'Retro',
      scene: 'night',
      vars: {
        /* surfaces — CRT phosphor green */
        'bg': '#0d1009',
        'bg-soft': '#161a10',
        'card': '#1a1f12',
        'card-hover': '#242b18',
        'border': '#2b3320',
        'border-hi': '#45522f',
        'text': '#d8f5c2',
        'muted': '#8fa87a',
        'faint': '#84a06c',
        'accent': '#7ce038',
        'accent-2': '#b7f58a',
        'green': '#7ce038',
        'amber': '#e0c24a',
        'red': '#ff6b57',
        'warn-bg': '#1c1505',
        'warn-border': '#4d3d10',
        'warn-text': '#e8c15c',
        'btn-from': '#5aa52c',
        'btn-to': '#3c7a1e',
        'shadow-sm': '0 1px 3px rgba(0,0,0,.55)',
        'shadow-hover': '0 6px 20px rgba(0,0,0,.65)',
        'body-glow': '#1c260f',
        'hero-fade': 'linear-gradient(to bottom, rgba(6,8,4,.6) 0%, rgba(6,8,4,.15) 34%, rgba(6,8,4,0) 55%, rgba(6,8,4,.5) 100%)',
        'kicker-color': '#b7f58a',
        'kicker-shadow': '0 1px 4px rgba(0,0,0,.7)',
        'hero-title': '#eaffd9',
        'hero-title-shadow': '0 0 14px rgba(124,224,56,.25)',
        'hero-sub': '#bfe39a',
        'hero-sub-shadow': '0 1px 6px rgba(0,0,0,.7)',
        'hero-meta': '#84a06c',
        'hero-meta-shadow': '0 1px 4px rgba(0,0,0,.7)',
        'verse': '#c9e8ae',
        'verse-shadow': '0 1px 5px rgba(0,0,0,.75)',
        'flag-border': 'rgba(255,255,255,.14)',
        'flag-shadow': '0 4px 14px rgba(0,0,0,.5)',
        'credits-fade': 'linear-gradient(120deg, rgba(124,224,56,.14), rgba(60,122,30,.1) 55%, rgba(13,16,9,0))',
        'credits-bar': 'linear-gradient(to bottom, #7ce038, #3c7a1e)',
        'credits-glow': 'rgba(124,224,56,.3)',
        'live-dot-glow': '0 0 8px rgba(124,224,56,.75), 0 0 14px rgba(224,194,74,.3)',
        'tag-color': '#b7f58a',
        'tag-bg': 'rgba(124,224,56,.12)',
        'tag-border': 'rgba(124,224,56,.28)',
        'tag-local-color': '#7ce038',
        'tag-local-bg': 'rgba(124,224,56,.1)',
        'tag-local-border': 'rgba(124,224,56,.28)',
        'tag-row-bg': 'rgba(124,224,56,.08)',
        'tag-row-border': 'rgba(124,224,56,.2)',
        'tag-row-local-bg': 'rgba(124,224,56,.07)',
        'tag-row-local-border': 'rgba(124,224,56,.2)',
        'search-ring': '0 0 0 3px rgba(124,224,56,.2)',
        'btn-shadow': '0 2px 8px rgba(60,122,30,.45)',
        'btn-shadow-hover': '0 4px 14px rgba(60,122,30,.6)',
        'toggle-bg': 'rgba(13,16,9,.55)',
        'toggle-border': 'rgba(255,255,255,.14)',
        'toggle-color': '#b7f58a',
        'toggle-shadow': '0 4px 14px rgba(0,0,0,.4)'
      }
    }
  };

  var THEME_ORDER = ['night', 'day', 'dusk', 'aurora', 'retro'];

  function isThemeId(id) {
    return Object.prototype.hasOwnProperty.call(THEMES, id);
  }

  /* 07:00-19:59 is day, everything else is night. */
  function clockTheme(date) {
    var h = (date || new Date()).getHours();
    return (h >= 7 && h < 20) ? 'day' : 'night';
  }

  function effectiveTheme(pref, date) {
    if (pref === 'auto') return clockTheme(date);
    return isThemeId(pref) ? pref : 'night';
  }

  function listThemes() {
    return THEME_ORDER.filter(isThemeId);
  }

  /* One <style> rule that overrides the :root defaults in index.html. */
  function buildThemeCss(id) {
    var t = THEMES[id];
    if (!t) return '';
    var css = ':root{';
    for (var key in t.vars) {
      if (Object.prototype.hasOwnProperty.call(t.vars, key)) {
        css += '--' + key + ':' + t.vars[key] + ';';
      }
    }
    return css + '}';
  }

  global.AMS_THEMES = {
    THEMES: THEMES,
    THEME_ORDER: THEME_ORDER,
    REQUIRED_VARS: REQUIRED_VARS,
    isThemeId: isThemeId,
    clockTheme: clockTheme,
    effectiveTheme: effectiveTheme,
    listThemes: listThemes,
    buildThemeCss: buildThemeCss
  };
})(typeof window !== 'undefined' ? window : globalThis);
