import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { run } from '../../scripts/check-harness.ts';

import { EXPERIENCES } from '../lib/roles.ts';
import { HOME, TABS } from './tabs.ts';

const APP = new URL('../app/', import.meta.url).pathname;

run('tabs.check — every tab has its screen, every screen its tab', (h) => {
  h.check('§1 the app folder is where it should be', readdirSync(APP).includes('_layout.tsx'));

  for (const exp of EXPERIENCES) {
    const dir = join(APP, exp);
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx');
    // A tab with screens of its own is a folder holding a stack (_layout.tsx) and its index.tsx.
    const folders = readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory());
    const routes = [...files.map((f) => f.replace(/\.tsx$/, '')), ...folders].sort();
    const tabs = TABS[exp].map((t) => t.name).sort();

    h.check(`§2 ${exp}: at least one screen found`, routes.length > 0);
    h.check(`§2 ${exp}: 2 to 5 tabs`, tabs.length >= 2 && tabs.length <= 5, `${tabs.length}`);
    h.check(`§2 ${exp}: tabs and screen files match`, JSON.stringify(routes) === JSON.stringify(tabs), `${routes} vs ${tabs}`);
    h.check(`§2 ${exp}: the home is /${exp}`, HOME[exp] === `/${exp}`);
    h.check(`§2 ${exp}: the last tab is Me`, TABS[exp][TABS[exp].length - 1]?.name === 'me');

    const layout = readFileSync(join(dir, '_layout.tsx'), 'utf8');
    h.check(`§3 ${exp}: its layout guards with its own experience`, layout.includes(`experience="${exp}"`));

    for (const f of folders) {
      const stack = join(dir, f, '_layout.tsx');
      h.check(`§3 ${exp}/${f}/ is a stack with its own index`, existsSync(stack) && readFileSync(stack, 'utf8').includes('<Stack') && existsSync(join(dir, f, 'index.tsx')));
    }
    const screenOf = (name: string) => readFileSync(folders.includes(name) ? join(dir, name, 'index.tsx') : join(dir, `${name}.tsx`), 'utf8');
    for (const tab of TABS[exp]) {
      if (!routes.includes(tab.name)) continue;
      const src = screenOf(tab.name);
      const placeholder = src.includes('<TabPlaceholder');
      const ok = tab.name === 'me'
        ? src.includes('<MeScreen />')
        : tab.built
          // a built tab shows its real screen and no placeholder at all
          ? !placeholder && /return <[A-Z][A-Za-z]+Screen \/>;/.test(src) && src.includes(`Tab: ${exp}/${tab.name}`)
          : placeholder && src.includes(`experience="${exp}"`) && src.includes(`name="${tab.name}"`);
      h.check(`§3 ${exp}/${tab.name} shows its own tab${tab.built ? ' (built)' : ''}`, ok);
    }
    for (const t of TABS[exp]) {
      h.check(`§4 ${exp}/${t.name}: a placeholder says what is coming`, t.name === 'me' || !!t.built || t.soon.length > 20);
    }
  }

  // §5 every tab shows its name on Android too (Yasir, 5 Nov 2026) — Android's
  // own default shows only the selected one
  const bar = readFileSync(new URL('./ExperienceTabs.tsx', import.meta.url), 'utf8');
  const modes = bar.match(/labelVisibilityMode="[a-z]+"/g) ?? [];
  h.check('§5 the tab bar sets one label mode, "labeled"', modes.length === 1 && modes[0] === 'labelVisibilityMode="labeled"', modes.join(' | ') || 'none');
});
