import { readdirSync, readFileSync } from 'node:fs';
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
    const routes = files.map((f) => f.replace(/\.tsx$/, '')).sort();
    const tabs = TABS[exp].map((t) => t.name).sort();

    h.check(`§2 ${exp}: at least one screen found`, routes.length > 0);
    h.check(`§2 ${exp}: 2 to 5 tabs`, tabs.length >= 2 && tabs.length <= 5, `${tabs.length}`);
    h.check(`§2 ${exp}: tabs and screen files match`, JSON.stringify(routes) === JSON.stringify(tabs), `${routes} vs ${tabs}`);
    h.check(`§2 ${exp}: the home is /${exp}`, HOME[exp] === `/${exp}`);
    h.check(`§2 ${exp}: the last tab is Me`, TABS[exp][TABS[exp].length - 1]?.name === 'me');

    const layout = readFileSync(join(dir, '_layout.tsx'), 'utf8');
    h.check(`§3 ${exp}: its layout guards with its own experience`, layout.includes(`experience="${exp}"`));

    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      const name = f.replace(/\.tsx$/, '');
      const ok = name === 'me'
        ? src.includes('<MeScreen />')
        : src.includes(`experience="${exp}"`) && src.includes(`name="${name}"`);
      h.check(`§3 ${exp}/${f} shows its own tab`, ok);
    }
    for (const t of TABS[exp]) {
      h.check(`§4 ${exp}/${t.name}: a placeholder says what is coming`, t.name === 'me' || t.soon.length > 20);
    }
  }
});
