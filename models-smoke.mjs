import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const labels = ['pick one or two good models', 'evaluate cost per task', 'value your time', 'GPT 6.1 Sol (High)', 'Opus 5.5 (High)', 'fewer decisions'];
const ids = labels.map((_, index) => `models-item-${index + 1}`);

export async function checkModels(page, frame) {
  assert.equal(await frame.$$eval('#slide-04 [data-fragment]', nodes => nodes.length), 6, 'Slide 4 must contain six individually revealed numbered boxes');
  assert.deepEqual(await frame.$$eval('#slide-04 .audience-text', nodes => nodes.map(node => node.textContent)), labels);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  const selected = () => frame.$$eval('#slide-04 [data-visible]', nodes => nodes.map(node => node.id));
  await go(3);
  assert.deepEqual(await selected(), []);
  for (let step = 0; step < 6; step++) {
    if (step % 3 === 0) await frame.click('#slide-04', { offset: { x: 950, y: 650 } });
    else if (step % 3 === 1) await page.keyboard.press('ArrowRight');
    else await page.click('[data-hf-next]');
    assert.deepEqual(await selected(), ids.slice(0, step + 1), 'Reveal all left boxes then all right boxes, one per input');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 3);
    assert.equal(await frame.$$eval('#slide-04 [data-fragment]', nodes => nodes.every(node => node.inert === !node.hasAttribute('data-visible') && node.getAttribute('aria-hidden') === String(node.inert))), true);
  }
  for (let number = 1; number <= 6; number++) {
    const source = await readFile(new URL(`../artwork/hud/shape${number}.svg`, import.meta.url), 'utf8');
    const geometry = await frame.$eval(`#models-item-${number} svg`, svg => ({
      viewBox: svg.getAttribute('viewBox'), paths: [...svg.querySelectorAll('path')].map(path => [path.getAttribute('class'), path.getAttribute('d')]),
      transforms: [...svg.querySelectorAll('[transform]')].map(node => node.getAttribute('transform')),
    }));
    assert.deepEqual(geometry, { viewBox: source.match(/viewBox="([^"]+)"/)[1],
      paths: [...source.matchAll(/<path class="([^"]+)" d="([^"]+)"/g)].map(([, name, d]) => [name, d]),
      transforms: [...source.matchAll(/transform="([^"]+)"/g)].map(([, value]) => value) }, `HUD ${number} must retain its original shape and number`);
  }
  const layout = await frame.$eval('#slide-04', scene => {
    const ai = scene.querySelector('.slide-ai').getBoundingClientRect();
    return [...scene.querySelectorAll('[data-fragment]')].map(panel => {
      const box = panel.getBoundingClientRect(), text = panel.querySelector('p');
      const range = document.createRange(); range.selectNodeContents(text);
      const ink = range.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom,
        fits: box.left >= 80 && box.right <= 1840 && box.top >= 180 && box.bottom <= 1050 && ink.left > box.left + 195 && ink.right < box.right - 30 && ink.top > box.top + 10 && ink.bottom < box.bottom - 10,
        aiClear: box.right <= ai.left || ai.right <= box.left || box.bottom <= ai.top || ai.bottom <= box.top,
        palette: getComputedStyle(text).color === 'rgb(255, 255, 255)' && [...panel.querySelectorAll('.digit')].every(digit => {
          const style = getComputedStyle(digit); return style.stroke === 'rgb(255, 32, 216)' && style.filter.includes('255, 255, 255');
        }) && [...panel.querySelectorAll('.outline')].every(node => getComputedStyle(node).stroke === 'rgb(32, 199, 255)') &&
          [...panel.querySelectorAll('.panel')].every(node => getComputedStyle(node).fill === 'rgb(28, 79, 107)' && getComputedStyle(node).fillOpacity === '0.68'),
        noFlare: !panel.querySelector('.panel-flare') };
    });
  });
  assert.ok(layout.every(row => row.fits && row.aiClear && row.palette && row.noFlare), `Rows must fit and retain slide-2 styling without overlapping AI: ${JSON.stringify(layout)}`);
  assert.ok(layout.slice(0, 3).every((row, index) => row.x < 910 && row.y === layout[index + 3].y && layout[index + 3].x > 1010), 'Arrange 1–3 on the left and 4–6 on the right, in three aligned rows');
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const a = layout[i], b = layout[j];
    assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, 'Numbered boxes must not overlap');
  }
  await page.click('[data-hf-prev]');
  assert.deepEqual(await selected(), ids.slice(0, 5));
  await page.click('[data-hf-next]');
  await page.click('[data-hf-next]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 4, 'The seventh input must advance to slide 5');
  await go(3);
  assert.deepEqual(await selected(), [], 'Revisiting slide 4 resets its sequence');
  await page.click('[data-hf-prev]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 2);
  await go(0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}
