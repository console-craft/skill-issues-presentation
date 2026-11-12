import assert from 'node:assert/strict';

const labels = ['separate the interface', 'WSL: Linux FS + Windows UI', 'smart server / dumb client', 'SSH', 'Network Tools', 'Remote Services', 'Tailscale'];
const ids = ['remote-interface', 'remote-wsl', 'remote-server', 'remote-ssh', 'remote-network', 'remote-services', 'remote-tailscale'];

export async function checkRemote(page, frame) {
  assert.equal(await frame.$$eval('#slide-06 [data-fragment]', nodes => nodes.length), 7, 'Slide 6 needs three top panels and four bottom panels');
  assert.deepEqual(await frame.$$eval('#slide-06 [data-fragment] p', nodes => nodes.map(node => node.textContent)), labels);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  const selected = () => frame.$$eval('#slide-06 [data-visible]', nodes => nodes.map(node => node.id));
  await go(5);
  assert.deepEqual(await selected(), []);
  for (let step = 0; step < 7; step++) {
    if (step % 3 === 0) await frame.click('#slide-06', { offset: { x: 950, y: 650 } });
    else if (step % 3 === 1) await page.keyboard.press('ArrowRight');
    else await page.click('[data-hf-next]');
    assert.deepEqual(await selected(), ids.slice(0, step + 1), 'Reveal the top row, then bottom row, one panel per input');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 5);
    assert.equal(await frame.$$eval('#slide-06 [data-fragment]', nodes => nodes.every(node => node.inert === !node.hasAttribute('data-visible') && node.getAttribute('aria-hidden') === String(node.inert))), true);
  }
  const layout = await frame.$eval('#slide-06', scene => {
    const ai = scene.querySelector('.slide-ai').getBoundingClientRect();
    const heading = scene.querySelector('.slide-title').getBoundingClientRect();
    return [...scene.querySelectorAll('[data-fragment]')].map(panel => {
      const box = panel.getBoundingClientRect(), text = panel.querySelector('p');
      const range = document.createRange(); range.selectNodeContents(text);
      const ink = range.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom,
        fits: box.left >= 80 && box.right <= 1840 && box.top > heading.bottom && box.bottom <= 1050 &&
          ink.left > box.left + 30 && ink.right < box.right - 30 && ink.top > box.top + 8 && ink.bottom < box.bottom - 8 &&
          [...range.getClientRects()].every(rect => Math.abs(rect.top - ink.top) < 1),
        aiClear: box.right <= ai.left || ai.right <= box.left || box.bottom <= ai.top || ai.bottom <= box.top,
        white: getComputedStyle(text).color === 'rgb(255, 255, 255)',
        blue: getComputedStyle(panel.querySelector('.outline')).stroke === 'rgb(32, 199, 255)',
        fill: getComputedStyle(panel.querySelector('.body')).fill === 'rgb(28, 79, 107)' && getComputedStyle(panel.querySelector('.body')).fillOpacity === '0.68',
        noFlare: !panel.querySelector('.panel-flare') };
    });
  });
  assert.ok(layout.every(panel => panel.fits && panel.aiClear && panel.white && panel.blue && panel.fill && panel.noFlare), `Remote panels must fit on single lines with title/AI clear and matching style: ${JSON.stringify(layout)}`);
  assert.ok(layout.slice(0, 3).every(panel => panel.y === layout[0].y && panel.bottom < 490), 'Three panels belong below the title, above the AI');
  assert.ok(layout.slice(3).every(panel => panel.y === layout[3].y && panel.y > 590), 'Four panels belong in a single bottom row');
  for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) {
    const a = layout[i], b = layout[j];
    assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, 'Remote panels must not overlap');
  }
  await page.click('[data-hf-prev]');
  assert.deepEqual(await selected(), ids.slice(0, 6));
  await page.click('[data-hf-next]');
  await page.click('[data-hf-next]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 6, 'The eighth input advances to slide 7');
  await go(5);
  assert.deepEqual(await selected(), []);
  await page.click('[data-hf-prev]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 4);
  await go(0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}
