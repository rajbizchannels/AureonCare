#!/usr/bin/env node
/**
 * Development helper for writing video scripts.
 *
 * Boots the app with the same mocked API the recordings use, walks an optional
 * workspace ▸ module path, then prints every button, link, input and select on
 * screen (plus a screenshot). Use it to find the selectors a script needs
 * instead of guessing them and burning a full recording run.
 *
 *   NODE_PATH=$(npm root -g) node docs/demo/video-harness/probe.js "Patients" "Patient Records"
 */

const path = require('path');
const harness = require('./harness');

const SHOT = process.env.PROBE_SHOT
  || path.join(require('os').tmpdir(), 'aureoncare-probe.png');

async function main() {
  const [group, item, extraClick] = process.argv.slice(2);
  const spec = {
    id: 'PROBE',
    slug: 'probe',
    title: 'Probe',
    moduleLabel: group || 'App shell',
    audience: 'Development',
    intro: 'Selector probe',
    journey: '-',
    youtubeTitle: 'probe',
    description: '-',
    tags: [],
    recap: ['-'],
    async run(d, page) {
      if (group) {
        await page.locator('nav[aria-label="Primary"]').getByRole('button', { name: group }).click();
        await page.waitForTimeout(1200);
      }
      if (item) {
        await page.getByRole('button', { name: new RegExp('^' + item) }).first().click();
        await page.waitForTimeout(2000);
      }
      if (extraClick) {
        await page.getByRole('button', { name: new RegExp(extraClick, 'i') }).first().click();
        await page.waitForTimeout(2000);
      }

      const dump = await page.evaluate(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const text = (el) => (el.innerText || el.value || el.placeholder || el.title || '')
          .replace(/\s+/g, ' ').trim().slice(0, 70);
        const grab = (sel) => Array.from(document.querySelectorAll(sel))
          .filter(visible).map((el) => `${el.tagName.toLowerCase()}${el.type ? '[' + el.type + ']' : ''} :: ${text(el)}`);
        return {
          buttons: grab('button'),
          inputs: grab('input, textarea'),
          selects: Array.from(document.querySelectorAll('select')).filter(visible).map((s) =>
            `select :: ${Array.from(s.options).map((o) => o.text).slice(0, 8).join(' | ')}`),
          headings: grab('h1, h2, h3'),
        };
      });

      console.log('\n== headings ==\n' + dump.headings.join('\n'));
      console.log('\n== buttons ==\n' + dump.buttons.join('\n'));
      console.log('\n== inputs ==\n' + dump.inputs.join('\n'));
      console.log('\n== selects ==\n' + dump.selects.join('\n'));
      await page.screenshot({ path: SHOT });
      console.log(`\nscreenshot: ${SHOT}`);
    },
  };

  // Probe runs need no artefacts; short-circuit the card/encode work.
  spec.skipOutputs = true;
  await harness.record(spec);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
