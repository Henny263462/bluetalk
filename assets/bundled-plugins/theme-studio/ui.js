/**
 * Theme Studio — overrides BlueTalk design tokens via html[data-theme] rules.
 */
(function themeStudioUi() {
  const api = BlueTalkPlugin;
  const STYLE_ID = 'bt-theme-studio-overrides';
  const STORAGE_KEY = 'themeOverrides';

  function hexToRgb(hex) {
    const h = String(hex).replace('#', '');
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    const x = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return `#${((1 << 24) + (x(r) << 16) + (x(g) << 8) + x(b)).toString(16).slice(1)}`;
  }

  function relLum(rgb) {
    if (!rgb) return 0;
    const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  /** Derive accent-related tokens from a single accent color. */
  function accentBundle(accentHex, isDark) {
    const rgb = hexToRgb(accentHex);
    if (!rgb) return {};
    const hover = rgbToHex(
      rgb.r + (isDark ? 28 : -22),
      rgb.g + (isDark ? 28 : -22),
      rgb.b + (isDark ? 28 : -22),
    );
    const lum = relLum(rgb);
    const accentFg = lum > 0.55 ? '#0a0a0a' : '#fafafa';
    const alpha = isDark ? 0.14 : 0.1;
    const soft = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    const sec = rgbToHex(
      rgb.r * 0.65 + (isDark ? 99 : 180) * 0.35,
      rgb.g * 0.65 + (isDark ? 102 : 140) * 0.35,
      rgb.b * 0.65 + (isDark ? 242 : 255) * 0.35,
    );
    return {
      '--accent': accentHex,
      '--accent-hover': hover,
      '--accent-fg': accentFg,
      '--accent-soft': soft,
      '--accent-2': sec,
    };
  }

  const PRESETS = {
    default: { dark: {}, light: {} },
    ocean: {
      dark: {
        '--bg-0': '#0b1220',
        '--bg-1': '#111b2d',
        '--bg-2': '#1a2942',
        '--bg-3': '#243552',
        '--bg-hover': '#152238',
        '--bg-active': '#1e2f4a',
        '--bg-input': '#111b2d',
        '--fg-0': '#e8eef7',
        '--fg-1': '#a8b8d0',
        '--fg-2': '#7a8fb0',
        '--fg-3': '#5a6d8a',
        '--border': '#233348',
        '--border-strong': '#334866',
        ...accentBundle('#3ba4f0', true),
      },
      light: {
        '--bg-0': '#f8fafc',
        '--bg-1': '#f1f5f9',
        '--bg-2': '#e2e8f0',
        '--bg-3': '#cbd5e1',
        '--bg-hover': '#e8edf4',
        '--bg-active': '#dce3ee',
        '--bg-input': '#ffffff',
        '--fg-0': '#0f172a',
        '--fg-1': '#334155',
        '--fg-2': '#64748b',
        '--fg-3': '#94a3b8',
        '--border': '#cbd5e1',
        '--border-strong': '#94a3b8',
        ...accentBundle('#0284c7', false),
      },
    },
    ember: {
      dark: {
        '--bg-0': '#140c0a',
        '--bg-1': '#1c1210',
        '--bg-2': '#281a14',
        '--bg-3': '#352118',
        '--bg-hover': '#221510',
        '--bg-active': '#301c14',
        '--bg-input': '#1c1210',
        '--fg-0': '#f8ece6',
        '--fg-1': '#d4b8a8',
        '--fg-2': '#a88472',
        '--fg-3': '#7d5f50',
        '--border': '#3d2820',
        '--border-strong': '#5c3d30',
        ...accentBundle('#fb923c', true),
      },
      light: {
        '--bg-0': '#fffbf7',
        '--bg-1': '#fff1e6',
        '--bg-2': '#ffe4cc',
        '--bg-3': '#ffd0a8',
        '--bg-hover': '#ffeedd',
        '--bg-active': '#ffe2c4',
        '--bg-input': '#ffffff',
        '--fg-0': '#292524',
        '--fg-1': '#57534e',
        '--fg-2': '#78716c',
        '--fg-3': '#a8a29e',
        '--border': '#e7d5c4',
        '--border-strong': '#cbb89f',
        ...accentBundle('#ea580c', false),
      },
    },
    amethyst: {
      dark: {
        '--bg-0': '#0f0a14',
        '--bg-1': '#16101f',
        '--bg-2': '#20172c',
        '--bg-3': '#2c1f3d',
        '--bg-hover': '#1a1224',
        '--bg-active': '#261a32',
        '--bg-input': '#16101f',
        '--fg-0': '#f3e8ff',
        '--fg-1': '#c4b5d8',
        '--fg-2': '#9480b8',
        '--fg-3': '#6b5a8f',
        '--border': '#342447',
        '--border-strong': '#4a3270',
        ...accentBundle('#c084fc', true),
      },
      light: {
        '--bg-0': '#faf5ff',
        '--bg-1': '#f3e8ff',
        '--bg-2': '#e9d5ff',
        '--bg-3': '#d8b4fe',
        '--bg-hover': '#ede3fa',
        '--bg-active': '#e4d4f7',
        '--bg-input': '#ffffff',
        '--fg-0': '#1e1b2e',
        '--fg-1': '#4c4768',
        '--fg-2': '#6f6888',
        '--fg-3': '#9088a8',
        '--border': '#ddd0f0',
        '--border-strong': '#b9a8d9',
        ...accentBundle('#7c3aed', false),
      },
    },
    forest: {
      dark: {
        '--bg-0': '#0a120e',
        '--bg-1': '#0f1a14',
        '--bg-2': '#15241c',
        '--bg-3': '#1c3226',
        '--bg-hover': '#122018',
        '--bg-active': '#1a2c22',
        '--bg-input': '#0f1a14',
        '--fg-0': '#e8f5ef',
        '--fg-1': '#a8cbb8',
        '--fg-2': '#6fa386',
        '--fg-3': '#4d7a62',
        '--border': '#1f3d2e',
        '--border-strong': '#2d5a44',
        ...accentBundle('#34d399', true),
      },
      light: {
        '--bg-0': '#f4fdf7',
        '--bg-1': '#e8faf0',
        '--bg-2': '#d1fae5',
        '--bg-3': '#a7f3d0',
        '--bg-hover': '#e2f6eb',
        '--bg-active': '#cfeee0',
        '--bg-input': '#ffffff',
        '--fg-0': '#0f2918',
        '--fg-1': '#365745',
        '--fg-2': '#4f7660',
        '--fg-3': '#6d9078',
        '--border': '#c5e5d4',
        '--border-strong': '#8fbf9f',
        ...accentBundle('#059669', false),
      },
    },
  };

  function loadState() {
    return api.storage.get(STORAGE_KEY, {
      preset: 'default',
      dark: {},
      light: {},
    });
  }

  function saveState(state) {
    api.storage.set(STORAGE_KEY, state);
  }

  function varsToCss(obj) {
    return Object.entries(obj)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  }

  function mergeDeep(base, extra) {
    const out = { ...base };
    for (const k of Object.keys(extra || {})) {
      out[k] = extra[k];
    }
    return out;
  }

  function effectiveVars(mode) {
    const st = loadState();
    const preset = PRESETS[st.preset] || PRESETS.default;
    const base = preset[mode] || {};
    return mergeDeep(base, st[mode] || {});
  }

  function syncStyle() {
    const st = loadState();
    let el = document.getElementById(STYLE_ID);
    const dark = effectiveVars('dark');
    const light = effectiveVars('light');
    const rules = [];
    if (Object.keys(dark).length) {
      rules.push(`html[data-theme="dark"]{${varsToCss(dark)}}`);
    }
    if (Object.keys(light).length) {
      rules.push(`html[data-theme="light"]{${varsToCss(light)}}`);
    }
    if (!rules.length) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = rules.join('\n');
  }

  function setPreset(id) {
    const st = loadState();
    st.preset = PRESETS[id] ? id : 'default';
    st.dark = {};
    st.light = {};
    saveState(st);
    syncStyle();
  }

  function setAccentOverride(mode, hex) {
    const st = loadState();
    const isDark = mode === 'dark';
    const bundle = accentBundle(hex, isDark);
    st[mode] = mergeDeep(st[mode] || {}, bundle);
    saveState(st);
    syncStyle();
  }

  function resetAll() {
    api.storage.delete(STORAGE_KEY);
    syncStyle();
  }

  syncStyle();

  api.onDeactivate(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  api.ui.registerTab({
    id: 'studio',
    label: 'Themes',
    icon: 'Palette',
    order: 15,
    render(container) {
      const st = loadState();

      container.innerHTML = `
        <div class="ts-wrap">
          <header class="ts-head">
            <h2>Theme Studio</h2>
            <p>Presets and accent colors apply to the entire app. They stack: preset base + your accent tweaks.</p>
          </header>

          <section class="ts-section">
            <h3>Presets</h3>
            <div class="ts-preset-grid" data-presets></div>
          </section>

          <section class="ts-section ts-split">
            <div class="ts-mode">
              <h3>Dark mode accent</h3>
              <label class="ts-color">
                <input type="color" data-accent="dark" value="#ffffff" />
                <span>Primary accent</span>
              </label>
            </div>
            <div class="ts-mode">
              <h3>Light mode accent</h3>
              <label class="ts-color">
                <input type="color" data-accent="light" value="#000000" />
                <span>Primary accent</span>
              </label>
            </div>
          </section>

          <section class="ts-section ts-actions">
            <button type="button" class="ts-btn ts-btn-danger" data-action="reset">Reset to app default</button>
            <span class="ts-hint">Uses Settings → Appearance for light/dark; this only changes colors.</span>
          </section>
        </div>
        <style>
          .ts-wrap {
            max-width: 720px;
            margin: 0 auto;
            padding: 20px 24px 48px;
            color: var(--fg-0);
          }
          .ts-head h2 {
            margin: 0 0 8px;
            font-size: 20px;
            letter-spacing: -0.02em;
          }
          .ts-head p {
            margin: 0;
            color: var(--fg-2);
            font-size: 13px;
            line-height: 1.5;
            max-width: 560px;
          }
          .ts-section {
            margin-top: 28px;
          }
          .ts-section h3 {
            margin: 0 0 12px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--fg-3);
            font-weight: 600;
          }
          .ts-preset-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;
          }
          .ts-preset {
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px 14px;
            background: var(--bg-1);
            color: var(--fg-0);
            cursor: pointer;
            text-align: left;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.15s, border-color 0.15s;
          }
          .ts-preset:hover {
            background: var(--bg-hover);
            border-color: var(--border-strong);
          }
          .ts-preset.is-active {
            border-color: var(--accent);
            box-shadow: 0 0 0 1px var(--accent-soft);
          }
          .ts-preset small {
            display: block;
            margin-top: 4px;
            font-weight: 400;
            font-size: 11px;
            color: var(--fg-3);
          }
          .ts-split {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          @media (max-width: 600px) {
            .ts-split { grid-template-columns: 1fr; }
          }
          .ts-mode {
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px;
            background: var(--bg-1);
          }
          .ts-color {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 13px;
            color: var(--fg-1);
          }
          .ts-color input[type="color"] {
            width: 48px;
            height: 36px;
            padding: 0;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--bg-0);
            cursor: pointer;
          }
          .ts-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .ts-btn {
            border-radius: 8px;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid var(--border);
            background: var(--bg-2);
            color: var(--fg-0);
          }
          .ts-btn:hover {
            background: var(--bg-hover);
          }
          .ts-btn-danger {
            border-color: color-mix(in srgb, var(--red) 35%, var(--border));
            color: var(--red);
            background: var(--bg-1);
          }
          .ts-btn-danger:hover {
            background: var(--red-soft);
          }
          .ts-hint {
            font-size: 12px;
            color: var(--fg-3);
          }
        </style>
      `;

      const presetLabels = {
        default: { title: 'Default', desc: 'Built-in BlueTalk' },
        ocean: { title: 'Ocean', desc: 'Cool blues' },
        ember: { title: 'Ember', desc: 'Warm orange' },
        amethyst: { title: 'Amethyst', desc: 'Soft purple' },
        forest: { title: 'Forest', desc: 'Mint & green' },
      };

      const grid = container.querySelector('[data-presets]');
      for (const key of Object.keys(PRESETS)) {
        const meta = presetLabels[key] || { title: key, desc: '' };
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `ts-preset${loadState().preset === key ? ' is-active' : ''}`;
        btn.dataset.preset = key;
        btn.innerHTML = `${meta.title}<small>${meta.desc}</small>`;
        grid.appendChild(btn);
      }

      function refreshPresetActive() {
        const cur = loadState().preset;
        grid.querySelectorAll('.ts-preset').forEach((b) => {
          b.classList.toggle('is-active', b.dataset.preset === cur);
        });
      }

      function pickInitialAccent(mode) {
        const v = effectiveVars(mode);
        const hex = (v['--accent'] || (mode === 'dark' ? '#ffffff' : '#000000')).replace(/\s/g, '');
        if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
        return mode === 'dark' ? '#ffffff' : '#000000';
      }

      const darkInput = container.querySelector('[data-accent="dark"]');
      const lightInput = container.querySelector('[data-accent="light"]');
      darkInput.value = pickInitialAccent('dark');
      lightInput.value = pickInitialAccent('light');

      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.ts-preset');
        if (!btn) return;
        setPreset(btn.dataset.preset);
        refreshPresetActive();
        darkInput.value = pickInitialAccent('dark');
        lightInput.value = pickInitialAccent('light');
        api.notify.toast?.({ variant: 'success', title: 'Theme updated' });
      });

      darkInput.addEventListener('input', () => {
        setAccentOverride('dark', darkInput.value);
      });
      lightInput.addEventListener('input', () => {
        setAccentOverride('light', lightInput.value);
      });

      container.querySelector('[data-action="reset"]').addEventListener('click', () => {
        resetAll();
        refreshPresetActive();
        darkInput.value = pickInitialAccent('dark');
        lightInput.value = pickInitialAccent('light');
        api.notify.toast?.({ variant: 'success', title: 'Theme reset' });
      });

      return undefined;
    },
  });

  api.log.info('Theme Studio UI registered');
})();
