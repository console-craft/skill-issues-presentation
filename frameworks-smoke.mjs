import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const labels = ["Matt Pocock's skills", 'Superpowers', 'Ponytail', 'PStack by Poteto'];
const ids = ['frameworks-image', ...labels.map((_, i) => `frameworks-item-${i + 1}`)];

export async function checkFrameworks(page, frame) {
  assert.equal(await frame.$$eval('#slide-08 [data-fragment]', nodes => nodes.length), 5, 'Slide 8 needs one image panel and four numbered rows');
  assert.deepEqual(await frame.$$eval('#slide-08 .audience-text', nodes => nodes.map(node => node.textContent)), labels);
  assert.deepEqual(await readFile(new URL('composition/assets/no-slop.jpg', import.meta.url)), await readFile(new URL('../artwork/no-slop.jpg', import.meta.url)), 'The no-slop image must be copied unchanged');
  await frame.$eval('#frameworks-image img', image => image.decode());
  assert.equal(await frame.$eval('#frameworks-image img', image => getComputedStyle(image).objectFit === 'contain' && getComputedStyle(image).transform === 'none' && image.naturalWidth === 500 && image.naturalHeight === 675), true, 'The complete portrait image must remain uncropped and independent of background motion');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  const selected = () => frame.$$eval('#slide-08 [data-visible]', nodes => nodes.map(node => node.id));
  await go(7);
  assert.deepEqual(await selected(), []);
  for (let step = 0; step < 5; step++) {
    if (step === 0) await frame.click('#slide-08', { offset: { x: 950, y: 650 } });
    else if (step === 1) await frame.click('#frameworks-image img');
    else if (step === 2) await page.keyboard.press('ArrowRight');
    else await page.click('[data-hf-next]');
    assert.deepEqual(await selected(), ids.slice(0, step + 1), 'Reveal image first, then numbered rows top-to-bottom, once per input');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 7);
    assert.equal(await frame.$$eval('#slide-08 [data-fragment]', nodes => nodes.every(node => node.inert === !node.hasAttribute('data-visible') && node.getAttribute('aria-hidden') === String(node.inert))), true);
  }
  const layout = await frame.$eval('#slide-08', scene => {
    const ai = scene.querySelector('.slide-ai').getBoundingClientRect(), heading = scene.querySelector('.slide-title').getBoundingClientRect();
    return [...scene.querySelectorAll('[data-fragment]')].map(panel => {
      const box = panel.getBoundingClientRect(), text = panel.querySelector('p');
      let textFits = true;
      if (text) {
        const range = document.createRange(); range.selectNodeContents(text); const ink = range.getBoundingClientRect();
        textFits = ink.left > box.left + 195 && ink.right < box.right - 30 && ink.top > box.top + 8 && ink.bottom < box.bottom - 8 && getComputedStyle(text).color === 'rgb(255, 255, 255)';
      }
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom,
        fits: box.left >= 80 && box.right <= 1840 && box.top > heading.bottom && box.bottom <= 1050 && textFits,
        aiClear: box.right <= ai.left || ai.right <= box.left || box.bottom <= ai.top || ai.bottom <= box.top,
        blue: [...panel.querySelectorAll('.outline')].every(node => getComputedStyle(node).stroke === 'rgb(32, 199, 255)'),
        fill: [...panel.querySelectorAll('.body, .panel')].every(node => getComputedStyle(node).fill === 'rgb(28, 79, 107)' && getComputedStyle(node).fillOpacity === '0.68'),
        noFlare: !panel.querySelector('.panel-flare') };
    });
  });
  assert.ok(layout.every(panel => panel.fits && panel.aiClear && panel.blue && panel.fill && panel.noFlare), `Image/HUD panels must fit and preserve styling with AI/title clear: ${JSON.stringify(layout)}`);
  assert.ok(layout.slice(1).every(panel => panel.x > layout[0].right && panel.y >= layout[0].y && panel.bottom <= layout[0].bottom), 'Image belongs left, four rows right');
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    const a = layout[i], b = layout[j];
    assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);
  }
  for (let number = 1; number <= 4; number++) {
    const geometry = selector => frame.$eval(selector, svg => ({ viewBox: svg.getAttribute('viewBox'), paths: [...svg.querySelectorAll('path')].map(node => node.getAttribute('d')) }));
    assert.deepEqual(await geometry(`#frameworks-item-${number} svg`), await geometry(`#audience-item-${number} svg`));
  }
  assert.equal(await frame.$$eval('#slide-08 .digit', nodes => nodes.every(node => {
    const style = getComputedStyle(node); return style.stroke === 'rgb(255, 32, 216)' && style.filter.includes('255, 255, 255');
  })), true);
  await page.click('[data-hf-prev]');
  assert.deepEqual(await selected(), ids.slice(0, 4));
  await page.click('[data-hf-next]');
  await page.click('[data-hf-next]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 8, 'Sixth input advances to slide 9');
  await go(7);
  assert.deepEqual(await selected(), []);
  await page.click('[data-hf-prev]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 6);
  await go(0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}
