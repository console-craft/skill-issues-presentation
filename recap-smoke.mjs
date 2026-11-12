import assert from 'node:assert/strict';

const skills = ['clarify-intent', 'codebase-explanations', 'pr-review', 'architecture-documentation'];
const statements = ['Focus: engineer your own development environment', 'Mindset: Work on the system that builds the product', 'Principle: Maximize understanding and confidence per unit of attention', 'Constraint: Your working context is king'];
const ids = ['recap-object', ...skills.map((_, i) => `recap-skill-${i + 1}`), ...statements.map((_, i) => `recap-statement-${i + 1}`)];

export async function checkRecap(page, frame) {
  assert.equal(await frame.$$eval('#slide-19 [data-fragment]', nodes => nodes.length), 9, 'Slide 19 needs a top panel, four numbered skills and four summary panels');
  assert.deepEqual(await frame.$$eval('#slide-19 [data-fragment] p', nodes => nodes.map(node => node.textContent)), ['The object of your work has changed', ...skills, ...statements]);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  const selected = () => frame.$$eval('#slide-19 [data-visible]', nodes => nodes.map(node => node.id));
  await go(18);
  assert.deepEqual(await selected(), []);
  for (let step = 0; step < 9; step++) {
    if (step % 3 === 0) await frame.click('#slide-19', { offset: { x: 950, y: 700 } });
    else if (step % 3 === 1) await page.keyboard.press('ArrowRight');
    else await page.click('[data-hf-next]');
    assert.deepEqual(await selected(), ids.slice(0, step + 1), 'Reveal the top panel, then skills, then summary panels once per input');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 18);
    assert.equal(await frame.$$eval('#slide-19 [data-fragment]', nodes => nodes.every(node => node.inert === !node.hasAttribute('data-visible') && node.getAttribute('aria-hidden') === String(node.inert))), true);
  }
  const layout = await frame.$eval('#slide-19', scene => {
    const ai = scene.querySelector('.slide-ai').getBoundingClientRect(), heading = scene.querySelector('.slide-title').getBoundingClientRect();
    return [...scene.querySelectorAll('[data-fragment]')].map(panel => {
      const box = panel.getBoundingClientRect(), text = panel.querySelector('p');
      const range = document.createRange(); range.selectNodeContents(text); const ink = range.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom,
        fits: box.left >= 80 && box.right <= 1840 && box.top > heading.bottom && box.bottom <= 1050 &&
          ink.left > box.left + (panel.querySelector('.digit') ? 195 : 30) && ink.right < box.right - 30 && ink.top > box.top + 8 && ink.bottom < box.bottom - 8,
        aiClear: box.right <= ai.left || ai.right <= box.left || box.bottom <= ai.top || ai.bottom <= box.top,
        white: getComputedStyle(text).color === 'rgb(255, 255, 255)',
        blue: [...panel.querySelectorAll('.outline')].every(node => getComputedStyle(node).stroke === 'rgb(32, 199, 255)'),
        fill: [...panel.querySelectorAll('.body, .panel')].every(node => getComputedStyle(node).fill === 'rgb(28, 79, 107)' && getComputedStyle(node).fillOpacity === '0.68'),
        noFlare: !panel.querySelector('.panel-flare') };
    });
  });
  assert.ok(layout.every(panel => panel.fits && panel.aiClear && panel.white && panel.blue && panel.fill && panel.noFlare), `All recap text must fit its frame with header/AI clear: ${JSON.stringify(layout)}`);
  assert.ok(layout.slice(1).every(panel => panel.y > layout[0].bottom), 'The top statement must sit below the header and above both columns');
  assert.ok(layout.slice(1, 5).every((panel, index) => panel.x < 910 && layout[index + 5].x > 1010 && panel.y === layout[index + 5].y), 'Four skill/summary rows must align across the two columns');
  for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) {
    const a = layout[i], b = layout[j];
    assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, 'Recap panels must not overlap');
  }
  for (let number = 1; number <= 4; number++) {
    const geometry = selector => frame.$eval(selector, svg => ({ viewBox: svg.getAttribute('viewBox'), paths: [...svg.querySelectorAll('path')].map(node => node.getAttribute('d')) }));
    assert.deepEqual(await geometry(`#recap-skill-${number} svg`), await geometry(`#audience-item-${number} svg`));
  }
  assert.equal(await frame.$$eval('#slide-19 .digit', nodes => nodes.every(node => {
    const style = getComputedStyle(node); return style.stroke === 'rgb(255, 32, 216)' && style.filter.includes('255, 255, 255');
  })), true);
  assert.equal(await frame.$$eval('#slide-19 .recap-statements .digit', nodes => nodes.length), 0);
  await page.click('[data-hf-prev]');
  assert.deepEqual(await selected(), ids.slice(0, 8));
  await page.click('[data-hf-next]');
  await page.click('[data-hf-next]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 19, 'Tenth input advances to the closing slide');
  await go(18);
  assert.deepEqual(await selected(), []);
  await page.click('[data-hf-prev]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 17);
  await go(0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}
