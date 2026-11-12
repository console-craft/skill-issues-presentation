import assert from 'node:assert/strict';

const labels = ['navigating', 'inspecting diffs', 'quick one-off edits', 'neovim', 'zed'];
const ids = ['editing-navigating', 'editing-diffs', 'editing-one-off', 'editing-neovim', 'editing-zed'];

export async function checkEditing(page, frame) {
  assert.equal(await frame.$$eval('#slide-07 [data-fragment]', nodes => nodes.length), 5, 'Slide 7 needs three numbered top boxes and two bottom panels');
  assert.deepEqual(await frame.$$eval('#slide-07 [data-fragment] p', nodes => nodes.map(node => node.textContent)), labels);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  const selected = () => frame.$$eval('#slide-07 [data-visible]', nodes => nodes.map(node => node.id));
  await go(6);
  assert.deepEqual(await selected(), []);
  for (let step = 0; step < 5; step++) {
    if (step % 3 === 0) await frame.click('#slide-07', { offset: { x: 950, y: 650 } });
    else if (step % 3 === 1) await page.keyboard.press('ArrowRight');
    else await page.click('[data-hf-next]');
    assert.deepEqual(await selected(), ids.slice(0, step + 1), 'Reveal numbered top boxes then bottom panels, one per input');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 6);
    assert.equal(await frame.$$eval('#slide-07 [data-fragment]', nodes => nodes.every(node => node.inert === !node.hasAttribute('data-visible') && node.getAttribute('aria-hidden') === String(node.inert))), true);
  }
  const layout = await frame.$eval('#slide-07', scene => {
    const ai = scene.querySelector('.slide-ai').getBoundingClientRect(), heading = scene.querySelector('.slide-title').getBoundingClientRect();
    return [...scene.querySelectorAll('[data-fragment]')].map(panel => {
      const box = panel.getBoundingClientRect(), text = panel.querySelector('p');
      const range = document.createRange(); range.selectNodeContents(text); const ink = range.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom,
        fits: box.left >= 80 && box.right <= 1840 && box.top > heading.bottom && box.bottom <= 1050 &&
          ink.left > box.left + (panel.querySelector('.digit') ? box.width * .24 : 30) && ink.right < box.right - 30 && ink.top > box.top + 8 && ink.bottom < box.bottom - 8 &&
          [...range.getClientRects()].every(rect => Math.abs(rect.top - ink.top) < 1),
        aiClear: box.right <= ai.left || ai.right <= box.left || box.bottom <= ai.top || ai.bottom <= box.top,
        white: getComputedStyle(text).color === 'rgb(255, 255, 255)',
        blue: [...panel.querySelectorAll('.outline')].every(node => getComputedStyle(node).stroke === 'rgb(32, 199, 255)'),
        fill: [...panel.querySelectorAll('.body, .panel')].every(node => getComputedStyle(node).fill === 'rgb(28, 79, 107)' && getComputedStyle(node).fillOpacity === '0.68'),
        noFlare: !panel.querySelector('.panel-flare') };
    });
  });
  assert.ok(layout.every(panel => panel.fits && panel.aiClear && panel.white && panel.blue && panel.fill && panel.noFlare), `All editing boxes must fit on single lines and leave title/AI clear: ${JSON.stringify(layout)}`);
  assert.ok(layout.slice(0, 3).every(panel => panel.y === layout[0].y && panel.bottom < 490), 'Three HUD boxes form one top row');
  assert.ok(layout.slice(3).every(panel => panel.y === layout[3].y && panel.y > 590), 'Two panels form one bottom row');
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    const a = layout[i], b = layout[j];
    assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, 'Editing panels must not overlap');
  }
  for (let number = 1; number <= 3; number++) {
    const geometry = selector => frame.$eval(selector, svg => ({ viewBox: svg.getAttribute('viewBox'), paths: [...svg.querySelectorAll('path')].map(node => node.getAttribute('d')) }));
    assert.deepEqual(await geometry(`#${ids[number - 1]} svg`), await geometry(`#audience-item-${number} svg`), 'Top HUD numbers/shapes match slide 2');
  }
  assert.equal(await frame.$$eval('#slide-07 .digit', nodes => nodes.every(node => {
    const style = getComputedStyle(node); return style.stroke === 'rgb(255, 32, 216)' && style.filter.includes('255, 255, 255');
  })), true);
  assert.equal(await frame.$$eval('#slide-07 .editing-bottom .digit', nodes => nodes.length), 0);
  await page.click('[data-hf-prev]');
  assert.deepEqual(await selected(), ids.slice(0, 4));
  await page.click('[data-hf-next]');
  await page.click('[data-hf-next]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 7, 'Sixth input advances to slide 8');
  await go(6);
  assert.deepEqual(await selected(), []);
  await page.click('[data-hf-prev]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 5);
  await go(0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}
