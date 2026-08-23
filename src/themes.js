/* Amsterdam theme registry.
 *
 * Single source of truth for every palette. The browser loads this file
 * as a plain <script> in <head>, so the stored or clock-derived theme
 * applies before first paint. The test suite side-effect imports it in
 * Node. index.html holds no per-theme colors anymore; every theme is
 * data, and applyThemeCss turns one entry into CSS custom properties.
 *
 * Palettes follow the bio-luminescent HUD language: dark slate
 * surfaces, emerald/cyan/amber neon accents, glassmorphism panels,
 * and CRT scanlines. BASE carries the shared Dusk values; each other
 * theme overrides only what differs, so every palette always exposes
 * the exact same variable set.
 */
(function (global) {
  'use strict';

  /* Base palette — Dusk. Dark slate (#0B0E14) with emerald (#00FF88),
     cyan/teal (#00E5FF), and warning amber (#FFB000) accents. */
  var BASE = {
    /* surfaces and text */
    'bg': '#0b0e14',
    'bg-soft': '#10151f',
    'card': '#0f172a',
    'card-hover': '#16233a',
    'border': '#1e2a3a',
    'border-hi': 'rgba(0,255,136,.4)',
    'text': '#e6eef4',
    'muted': '#8fa3b8',
    'faint': '#5c7186',
    'accent': '#00e5ff',
    'accent-2': '#7df6ff',
    'green': '#00ff88',
    'amber': '#ffb000',
    'red': '#ff4d6d',
    'warn-bg': 'rgba(255,176,0,.07)',
    'warn-border': 'rgba(255,176,0,.32)',
    'warn-text': '#ffcf7a',
    'btn-from': '#00e5a8',
    'btn-to': '#00a07a',
    'shadow-sm': '0 1px 3px rgba(0,0,0,.6)',
    'shadow-hover': '0 8px 24px rgba(0,0,0,.6)',
    'body-glow': '#0b2e2a',
    /* hero copy and overlays */
    'hero-fade': 'linear-gradient(to bottom, rgba(4,6,10,.62) 0%, rgba(4,6,10,.16) 34%, rgba(4,6,10,0) 55%, rgba(4,6,10,.5) 100%)',
    'kicker-color': '#00ff88',
    'kicker-shadow': '0 0 10px rgba(0,255,136,.45)',
    'hero-title': '#f2fff8',
    'hero-title-shadow': '0 0 18px rgba(0,255,136,.25)',
    'hero-sub': '#cfe9df',
    'hero-sub-shadow': '0 1px 6px rgba(0,0,0,.7)',
    'hero-meta': '#5c7186',
    'hero-meta-shadow': '0 1px 4px rgba(0,0,0,.7)',
    'verse': '#b8d8cb',
    'verse-shadow': '0 1px 5px rgba(0,0,0,.75)',
    'flag-border': 'rgba(255,255,255,.16)',
    'flag-shadow': '0 4px 14px rgba(0,0,0,.5)',
    /* components */
    'credits-fade': 'linear-gradient(120deg, rgba(0,255,136,.14), rgba(0,229,255,.08) 55%, rgba(15,23,42,0))',
    'credits-bar': 'linear-gradient(to bottom, #00ff88, #00b37a)',
    'credits-glow': 'rgba(0,255,136,.3)',
    'live-dot-glow': '0 0 8px rgba(0,255,136,.8), 0 0 16px rgba(0,229,255,.45)',
    'tag-color': '#7df6ff',
    'tag-bg': 'rgba(0,229,255,.1)',
    'tag-border': 'rgba(0,229,255,.3)',
    'tag-local-color': '#00ff88',
    'tag-local-bg': 'rgba(0,255,136,.08)',
    'tag-local-border': 'rgba(0,255,136,.3)',
    'tag-row-bg': 'rgba(0,229,255,.07)',
    'tag-row-border': 'rgba(0,229,255,.22)',
    'tag-row-local-bg': 'rgba(0,255,136,.07)',
    'tag-row-local-border': 'rgba(0,255,136,.22)',
    'search-ring': '0 0 0 3px rgba(0,255,136,.18)',
    'btn-shadow': '0 0 12px rgba(0,255,136,.25)',
    'btn-shadow-hover': '0 0 20px rgba(0,255,136,.45)',
    'toggle-bg': 'rgba(11,14,20,.65)',
    'toggle-border': 'rgba(0,255,136,.25)',
    'toggle-color': '#00ff88',
    'toggle-shadow': '0 4px 18px rgba(0,0,0,.5)',
    /* glassmorphism + HUD */
    'glass-bg': 'rgba(15,23,42,.75)',
    'glass-border': 'rgba(0,255,136,.2)',
    'glass-blur': '12px',
    'panel-glow': '0 0 15px rgba(0,255,136,.15)',
    'panel-glow-hover': '0 0 26px rgba(0,255,136,.28)',
    'spark': '#00e5ff',
    'spark-fade': 'linear-gradient(180deg, rgba(0,229,255,.28), rgba(0,229,255,0))',
    'scanline': 'repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, rgba(0,0,0,.02) 1px 3px)',
    'row-glow': 'rgba(0,255,136,.12)'
  };

  /* Every theme must define each of these variables. */
  var REQUIRED_VARS = Object.keys(BASE);

  function palette(overrides) {
    var vars = {};
    var key;
    for (key in BASE) {
      if (Object.prototype.hasOwnProperty.call(BASE, key)) vars[key] = BASE[key];
    }
    for (key in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) vars[key] = overrides[key];
    }
    return vars;
  }

  var THEMES = {
    dusk: {
      label: 'Dusk',
      scene: 'night',
      vars: palette({})
    },


    neon: {
      label: 'Cyber Neon',
      scene: 'night',
      vars: palette({
        'bg': '#0a0118',
        'bg-soft': '#120523',
        'card': '#16092b',
        'card-hover': '#210e3d',
        'border': '#2a1340',
        'border-hi': 'rgba(255,43,214,.45)',
        'text': '#f4ecff',
        'muted': '#b39bd4',
        'faint': '#8a70b0',
        'accent': '#ff2bd6',
        'accent-2': '#7df9ff',
        'green': '#00ffc8',
        'amber': '#ffb000',
        'red': '#ff5470',
        'warn-bg': 'rgba(255,176,0,.08)',
        'warn-border': 'rgba(255,176,0,.32)',
        'warn-text': '#ffd166',
        'btn-from': '#ff2bd6',
        'btn-to': '#8b17a8',
        'body-glow': '#2a0a3d',
        'hero-fade': 'linear-gradient(to bottom, rgba(6,1,14,.62) 0%, rgba(6,1,14,.16) 34%, rgba(6,1,14,0) 55%, rgba(6,1,14,.5) 100%)',
        'kicker-color': '#7df9ff',
        'kicker-shadow': '0 0 10px rgba(125,249,255,.5)',
        'hero-title': '#fff3ff',
        'hero-title-shadow': '0 0 18px rgba(255,43,214,.3)',
        'hero-sub': '#e6cdf2',
        'hero-meta': '#8a70b0',
        'verse': '#d6bce6',
        'credits-fade': 'linear-gradient(120deg, rgba(255,43,214,.16), rgba(125,249,255,.1) 55%, rgba(22,9,43,0))',
        'credits-bar': 'linear-gradient(to bottom, #ff2bd6, #8b17a8)',
        'credits-glow': 'rgba(0,255,200,.3)',
        'live-dot-glow': '0 0 8px rgba(0,255,200,.85), 0 0 16px rgba(255,43,214,.5)',
        'tag-color': '#7df9ff',
        'tag-bg': 'rgba(125,249,255,.1)',
        'tag-border': 'rgba(125,249,255,.3)',
        'tag-local-color': '#00ffc8',
        'tag-local-bg': 'rgba(0,255,200,.08)',
        'tag-local-border': 'rgba(0,255,200,.3)',
        'tag-row-bg': 'rgba(125,249,255,.07)',
        'tag-row-border': 'rgba(125,249,255,.22)',
        'tag-row-local-bg': 'rgba(0,255,200,.07)',
        'tag-row-local-border': 'rgba(0,255,200,.22)',
        'search-ring': '0 0 0 3px rgba(255,43,214,.2)',
        'btn-shadow': '0 0 12px rgba(255,43,214,.3)',
        'btn-shadow-hover': '0 0 20px rgba(255,43,214,.5)',
        'toggle-bg': 'rgba(10,1,24,.65)',
        'toggle-border': 'rgba(255,43,214,.28)',
        'toggle-color': '#7df9ff',
        'glass-bg': 'rgba(22,9,43,.75)',
        'glass-border': 'rgba(255,43,214,.2)',
        'panel-glow': '0 0 15px rgba(255,43,214,.16)',
        'panel-glow-hover': '0 0 26px rgba(255,43,214,.3)',
        'spark': '#ff2bd6',
        'spark-fade': 'linear-gradient(180deg, rgba(255,43,214,.28), rgba(255,43,214,0))',
        'scanline': 'repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, rgba(0,0,0,.03) 1px 3px)',
        'row-glow': 'rgba(255,43,214,.14)'
      })
    },

    alien: {
      label: 'Alien Green',
      scene: 'night',
      vars: palette({
        'bg': '#04120b',
        'bg-soft': '#071a10',
        'card': '#0a2014',
        'card-hover': '#0f2a1b',
        'border': '#163523',
        'border-hi': 'rgba(90,255,61,.42)',
        'text': '#eafff3',
        'muted': '#8fc9ad',
        'faint': '#5e8f77',
        'accent': '#5aff3d',
        'accent-2': '#a5ffd9',
        'green': '#5aff3d',
        'amber': '#ffd166',
        'red': '#ff5d6c',
        'warn-bg': 'rgba(255,209,102,.07)',
        'warn-border': 'rgba(255,209,102,.32)',
        'warn-text': '#ffe3a1',
        'btn-from': '#44ea3c',
        'btn-to': '#008f59',
        'shadow-sm': '0 1px 3px rgba(0,0,0,.6)',
        'shadow-hover': '0 8px 24px rgba(0,0,0,.6)',
        'body-glow': '#0e2b18',
        'hero-fade': 'linear-gradient(to bottom, rgba(2,10,6,.62) 0%, rgba(2,10,6,.16) 34%, rgba(2,10,6,0) 55%, rgba(2,10,6,.5) 100%)',
        'kicker-color': '#a5ffd9',
        'kicker-shadow': '0 0 10px rgba(90,255,61,.5)',
        'hero-title': '#f0fff7',
        'hero-title-shadow': '0 0 18px rgba(90,255,61,.3)',
        'hero-sub': '#cdf5e2',
        'hero-sub-shadow': '0 1px 6px rgba(0,0,0,.7)',
        'hero-meta': '#5e8f77',
        'hero-meta-shadow': '0 1px 4px rgba(0,0,0,.7)',
        'verse': '#bce5d1',
        'verse-shadow': '0 1px 5px rgba(0,0,0,.75)',
        'flag-border': 'rgba(255,255,255,.16)',
        'flag-shadow': '0 4px 14px rgba(0,0,0,.5)',
        'credits-fade': 'linear-gradient(120deg, rgba(90,255,61,.16), rgba(0,224,143,.08) 55%, rgba(10,32,20,0))',
        'credits-bar': 'linear-gradient(to bottom, #5aff3d, #1c7a34)',
        'credits-glow': 'rgba(90,255,61,.32)',
        'live-dot-glow': '0 0 8px rgba(90,255,61,.85), 0 0 16px rgba(165,255,217,.4)',
        'tag-color': '#a5ffd9',
        'tag-bg': 'rgba(90,255,61,.1)',
        'tag-border': 'rgba(90,255,61,.3)',
        'tag-local-color': '#5aff3d',
        'tag-local-bg': 'rgba(90,255,61,.08)',
        'tag-local-border': 'rgba(90,255,61,.3)',
        'tag-row-bg': 'rgba(90,255,61,.07)',
        'tag-row-border': 'rgba(90,255,61,.22)',
        'tag-row-local-bg': 'rgba(90,255,61,.07)',
        'tag-row-local-border': 'rgba(90,255,61,.22)',
        'search-ring': '0 0 0 3px rgba(90,255,61,.2)',
        'btn-shadow': '0 0 12px rgba(90,255,61,.28)',
        'btn-shadow-hover': '0 0 20px rgba(90,255,61,.5)',
        'toggle-bg': 'rgba(4,18,11,.65)',
        'toggle-border': 'rgba(90,255,61,.25)',
        'toggle-color': '#5aff3d',
        'toggle-shadow': '0 4px 18px rgba(0,0,0,.5)',
        'glass-bg': 'rgba(9,28,18,.75)',
        'glass-border': 'rgba(90,255,61,.2)',
        'glass-blur': '12px',
        'panel-glow': '0 0 15px rgba(90,255,61,.15)',
        'panel-glow-hover': '0 0 26px rgba(90,255,61,.28)',
        'spark': '#5aff3d',
        'spark-fade': 'linear-gradient(180deg, rgba(90,255,61,.28), rgba(90,255,61,0))',
        'scanline': 'repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, rgba(0,0,0,.03) 1px 3px)',
        'row-glow': 'rgba(90,255,61,.14)'
      })
    },


    solar: {
      label: 'EcoPunk',
      scene: 'day',
      vars: palette({
        'bg': '#eef2e4',
        'bg-soft': '#e5ecda',
        'card': '#f8faf1',
        'card-hover': '#edf3e1',
        'border': '#cfd9c1',
        'border-hi': 'rgba(31,106,64,.45)',
        'text': '#1c2b20',
        'muted': '#4e6353',
        'faint': '#657a6a',
        'accent': '#1f6a40',
        'accent-2': '#175031',
        'green': '#2c7a48',
        'amber': '#c26a00',
        'red': '#b9382c',
        'warn-bg': '#fbeecf',
        'warn-border': '#e6c27a',
        'warn-text': '#7a4d06',
        'btn-from': '#2c8a50',
        'btn-to': '#1b5c35',
        'shadow-sm': '0 1px 3px rgba(60,50,20,.14)',
        'shadow-hover': '0 8px 24px rgba(60,50,20,.2)',
        'body-glow': '#d3e4c4',
        'hero-fade': 'linear-gradient(to bottom, rgba(238,242,228,.72) 0%, rgba(238,242,228,.28) 34%, rgba(238,242,228,0) 55%, rgba(238,242,228,.45) 100%)',
        'kicker-color': '#175031',
        'kicker-shadow': '0 1px 3px rgba(248,250,241,.8)',
        'hero-title': '#14231a',
        'hero-title-shadow': '0 1px 10px rgba(248,250,241,.75)',
        'hero-sub': '#27402f',
        'hero-sub-shadow': '0 1px 4px rgba(248,250,241,.8)',
        'hero-meta': '#43584a',
        'hero-meta-shadow': '0 1px 3px rgba(248,250,241,.85)',
        'verse': '#1f3a2a',
        'verse-shadow': '0 1px 3px rgba(248,250,241,.85)',
        'flag-border': 'rgba(28,43,32,.4)',
        'flag-shadow': '0 4px 14px rgba(60,50,20,.25)',
        'credits-fade': 'linear-gradient(120deg, rgba(31,106,64,.14), rgba(23,80,49,.06) 55%, rgba(248,250,241,0))',
        'credits-bar': 'linear-gradient(to bottom, #1f6a40, #175031)',
        'credits-glow': 'rgba(44,122,72,.25)',
        'live-dot-glow': '0 0 8px rgba(44,122,72,.55)',
        'tag-color': '#175031',
        'tag-bg': 'rgba(31,106,64,.1)',
        'tag-border': 'rgba(31,106,64,.32)',
        'tag-local-color': '#2c7a48',
        'tag-local-bg': 'rgba(44,122,72,.08)',
        'tag-local-border': 'rgba(44,122,72,.32)',
        'tag-row-bg': 'rgba(31,106,64,.08)',
        'tag-row-border': 'rgba(31,106,64,.24)',
        'tag-row-local-bg': 'rgba(44,122,72,.07)',
        'tag-row-local-border': 'rgba(44,122,72,.24)',
        'search-ring': '0 0 0 3px rgba(31,106,64,.2)',
        'btn-shadow': '0 2px 8px rgba(23,80,49,.28)',
        'btn-shadow-hover': '0 4px 14px rgba(23,80,49,.42)',
        'toggle-bg': 'rgba(251,248,238,.75)',
        'toggle-border': 'rgba(29,42,36,.3)',
        'toggle-color': '#175031',
        'toggle-shadow': '0 4px 14px rgba(60,50,20,.18)',
        'glass-bg': 'rgba(251,248,238,.78)',
        'glass-border': 'rgba(31,106,64,.22)',
        'panel-glow': '0 0 15px rgba(31,106,64,.12)',
        'panel-glow-hover': '0 0 24px rgba(31,106,64,.22)',
        'spark': '#1f6a40',
        'spark-fade': 'linear-gradient(180deg, rgba(31,106,64,.22), rgba(31,106,64,0))',
        'scanline': 'repeating-linear-gradient(0deg, rgba(0,0,0,.02) 0 1px, rgba(255,255,255,.02) 1px 3px)',
        'row-glow': 'rgba(31,106,64,.12)'
      })
    }
  };

  var THEME_ORDER = ['dusk', 'neon', 'alien', 'solar'];

  function isThemeId(id) {
    return Object.prototype.hasOwnProperty.call(THEMES, id);
  }

  /* 07:00-19:59 is the solar (light) scene, everything else is dusk.
     alien is a night scene and solar is the day scene, so they slot
     into the same night/day hero artwork as dusk and solar. */
  function clockTheme(date) {
    var h = (date || new Date()).getHours();
    return (h >= 7 && h < 20) ? 'solar' : 'dusk';
  }

  function effectiveTheme(pref, date) {
    if (pref === 'auto') return clockTheme(date);
    return isThemeId(pref) ? pref : 'dusk';
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
