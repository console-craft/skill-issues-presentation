import assert from 'node:assert/strict';

const tools = ['Claude Code', 'Codex', 'Open Code', 'PI', 'T3Code'];
const features = ['diff viewer', 'mermaid diagrams', 'file explorer', 'integrated browser', 'make it your own'];
const ids = ['ade-definition', ...tools.map((_, i) => `ade-tool-${i + 1}`), ...features.map((_, i) => `ade-feature-${i + 1}`)];

export async function checkADE(page, frame) {
  assert.equal(await frame.$$eval('#slide-05 [data-fragment]', nodes => nodes.length), 11, 'Slide 5 needs a separate definition panel, five numbered tools and five feature panels');
  assert.equal(await frame.$eval('#slide-05 h2', title => title.textContent), 'Use  an  ADE', 'Use the approved short ADE title and double spaces');
  assert.deepEqual(await frame.$$eval('#slide-05 [data-fragment] p', nodes => nodes.map(node => node.textContent)), ['Agentic Development Environment', ...tools, ...features]);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  const selected = () => frame.$$eval('#slide-05 [data-visible]', nodes => nodes.map(node => node.id));
  await go(4);
  assert.deepEqual(await selected(), []);
  for (let step = 0; step < 11; step++) {
    if (step % 3 === 0) await frame.click('#slide-05', { offset: { x: 950, y: 650 } });
    else if (step % 3 === 1) await page.keyboard.press('ArrowRight');
    else await page.click('[data-hf-next]');
    assert.deepEqual(await selected(), ids.slice(0, step + 1), 'Reveal definition, then tools, then features, one per input');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 4);
    assert.equal(await frame.$$eval('#slide-05 [data-fragment]', nodes => nodes.every(node => node.inert === !node.hasAttribute('data-visible') && node.getAttribute('aria-hidden') === String(node.inert))), true);
  }
  const layout = await frame.$eval('#slide-05', scene => {
    const ai = scene.querySelector('.slide-ai').getBoundingClientRect();
    const heading = scene.querySelector('.slide-title').getBoundingClientRect();
    return [...scene.querySelectorAll('[data-fragment]')].map(panel => {
      const box = panel.getBoundingClientRect(), text = panel.querySelector('p');
      const range = document.createRange(); range.selectNodeContents(text);
      const ink = range.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom,
        fits: box.left >= 80 && box.right <= 1840 && box.top > heading.bottom && box.bottom <= 1050 &&
          ink.left > box.left + 30 && ink.right < box.right - 30 && ink.top > box.top + 8 && ink.bottom < box.bottom - 8,
        aiClear: box.right <= ai.left || ai.right <= box.left || box.bottom <= ai.top || ai.bottom <= box.top,
        white: getComputedStyle(text).color === 'rgb(255, 255, 255)',
        blue: [...panel.querySelectorAll('.outline')].every(node => getComputedStyle(node).stroke === 'rgb(32, 199, 255)'),
        fill: [...panel.querySelectorAll('.panel, .body')].every(node => getComputedStyle(node).fill === 'rgb(28, 79, 107)' && getComputedStyle(node).fillOpacity === '0.68'),
        noFlare: !panel.querySelector('.panel-flare') };
    });
  });
  assert.ok(layout.every(panel => panel.fits && panel.aiClear && panel.white && panel.blue && panel.fill && panel.noFlare), `All ADE content must fit and preserve styling with clear title/AI: ${JSON.stringify(layout)}`);
  assert.ok(layout.slice(1).every(panel => panel.y > layout[0].bottom), 'Definition must sit above both lists, not replace the title');
  assert.ok(layout.slice(1, 6).every((panel, index) => panel.x < 910 && layout[index + 6].x > 1010 && panel.y === layout[index + 6].y), 'Tools left and features right must align across five rows');
  for (let i = 0; i < 11; i++) for (let j = i + 1; j < 11; j++) {
    const a = layout[i], b = layout[j];
    assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, 'ADE panels must not overlap');
  }
  assert.equal(await frame.$$eval('#slide-05 .ade-features .digit', nodes => nodes.length), 0, 'Feature panels remain unnumbered');
  for (let number = 1; number <= 5; number++) {
    const geometry = selector => frame.$eval(selector, svg => ({ viewBox: svg.getAttribute('viewBox'), paths: [...svg.querySelectorAll('path')].map(path => path.getAttribute('d')) }));
    assert.deepEqual(await geometry(`#ade-tool-${number} svg`), await geometry(`#audience-item-${number} svg`), 'Tool HUD numbers/shapes match slide 2');
  }
  assert.equal(await frame.$$eval('#slide-05 .digit', nodes => nodes.every(node => {
    const style = getComputedStyle(node); return style.stroke === 'rgb(255, 32, 216)' && style.filter.includes('255, 255, 255');
  })), true);
  await page.click('[data-hf-prev]');
  assert.deepEqual(await selected(), ids.slice(0, 10));
  await page.click('[data-hf-next]');
  await page.click('[data-hf-next]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 5, 'The twelfth input advances to slide 6');
  await go(4);
  assert.deepEqual(await selected(), []);
  await page.click('[data-hf-prev]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 3);
  await go(0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}
