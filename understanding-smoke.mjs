import assert from 'node:assert/strict';

const ids = ['understanding-frustration', 'understanding-realization', 'understanding-improvement', 'understanding-goal'];

export async function checkUnderstanding(page, frame) {
  assert.equal(await frame.$$eval('#slide-03 [data-fragment]', nodes => nodes.length), 4, 'Slide 3 needs three ordered top panels and one goal/formula reveal');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  const selected = () => frame.$$eval('#slide-03 [data-visible]', nodes => nodes.map(node => node.id));
  await go(2);
  assert.deepEqual(await selected(), []);
  for (let step = 0; step < 4; step++) {
    if (step === 0) await frame.click('#slide-03', { offset: { x: 500, y: 450 } });
    else if (step === 1) await page.keyboard.press('ArrowRight');
    else if (step === 2) await page.click('[data-hf-next]');
    else await frame.click('#understanding-frustration');
    assert.deepEqual(await selected(), ids.slice(0, step + 1), 'Each real input must reveal one slide-3 panel, in order');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 2);
    assert.equal(await frame.$$eval('#slide-03 [data-fragment]', nodes => nodes.every(node => node.inert === !node.hasAttribute('data-visible') && node.getAttribute('aria-hidden') === String(node.inert))), true);
  }
  assert.deepEqual(await frame.$$eval('#slide-03 .understanding-top p', nodes => nodes.map(node => node.textContent)), ['Frustration', 'Realization', 'Improvement']);
  assert.deepEqual(await frame.$$eval('#understanding-goal p', nodes => nodes.map(node => node.textContent)), [
    'GOAL: Maximize understanding and confidence per unit of attention.', 'Formula: (U + C) / A']);
  const fit = await frame.$eval('#slide-03', scene => {
    const panels = [...scene.querySelectorAll('[data-fragment]')];
    const boxes = panels.map(panel => panel.getBoundingClientRect());
    const ai = scene.querySelector('.slide-ai').getBoundingClientRect();
    const top = scene.querySelector('.slide-title').getBoundingClientRect().bottom;
    return panels.every((panel, index) => {
      const box = boxes[index];
      return box.left >= 80 && box.right <= 1840 && box.top > top && box.bottom <= 1050 &&
        (box.right <= ai.left || box.left >= ai.right || box.bottom <= ai.top || box.top >= ai.bottom) &&
        [...panel.querySelectorAll('p')].every(text => {
          const range = document.createRange(); range.selectNodeContents(text);
          const ink = range.getBoundingClientRect();
          return ink.left > box.left + 30 && ink.right < box.right - 30 && ink.top > box.top + 8 && ink.bottom < box.bottom - 8 &&
            getComputedStyle(text).color === 'rgb(255, 255, 255)' && [...range.getClientRects()].every(rect => Math.abs(rect.top - ink.top) < 1);
        }) && getComputedStyle(panel.querySelector('.body')).fillOpacity === '0.68' &&
        getComputedStyle(panel.querySelector('.outline')).stroke === 'rgb(32, 199, 255)' && !panel.querySelector('.panel-flare');
    }) && boxes.slice(0, 3).every(box => box.top === boxes[0].top && box.bottom < 490) && boxes[3].top > 590;
  });
  const geometry = await frame.$$eval('#slide-03 [data-fragment]', nodes => nodes.map(panel => ({
    box: panel.getBoundingClientRect().toJSON(), opacity: getComputedStyle(panel.querySelector('.body')).fillOpacity,
    text: [...panel.querySelectorAll('p')].map(text => { const range = document.createRange(); range.selectNodeContents(text);
      return { ink: range.getBoundingClientRect().toJSON(), line: getComputedStyle(text).lineHeight, color: getComputedStyle(text).color }; })
  })));
  assert.equal(fit, true, `All four panels must fit, match slide 2, and leave the header and central AI clear: ${JSON.stringify(geometry)}`);
  assert.deepEqual(await frame.$$eval('#slide-03 .understanding-top .outline', nodes => nodes.map(node => node.getAttribute('d'))),
    await frame.$$eval('#slide-02 .audience-concepts .outline', nodes => nodes.map(node => node.getAttribute('d'))));
  assert.equal(await frame.$eval('#understanding-goal .formula', text => getComputedStyle(text).color === 'rgb(255, 32, 216)' && getComputedStyle(text).textShadow.includes('255, 255, 255')), true);
  await page.click('[data-hf-prev]');
  assert.deepEqual(await selected(), ids.slice(0, 3));
  await page.click('[data-hf-next]');
  await page.click('[data-hf-next]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 3, 'The fifth forward input must reach slide 4');
  await go(2);
  assert.deepEqual(await selected(), [], 'Revisiting slide 3 resets its sequence');
  await page.click('[data-hf-prev]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 1);
  await go(0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  // Keep this input early even when browser round-trips outlast the AI entrance.
  await frame.evaluate(() => {
    window.testHoldSlide3AI = event => {
      if (event.target.matches('#slide-03 .slide-ai')) event.target.getAnimations().forEach(animation => animation.pause());
    };
    document.addEventListener('animationstart', window.testHoldSlide3AI);
  });
  await go(2);
  await page.$eval('hyperframes-slideshow', deck => deck.controller.next());
  assert.equal(await frame.$eval('#understanding-frustration', panel => getComputedStyle(panel).visibility), 'hidden', 'Early slide-3 clicks must wait for the title and AI');
  await frame.evaluate(() => {
    document.removeEventListener('animationstart', window.testHoldSlide3AI);
    document.querySelector('#slide-03 .slide-ai').getAnimations().forEach(animation => animation.play());
  });
  await frame.waitForFunction(() => document.querySelector('#slide-03').hasAttribute('data-fragments-ready'));
  await frame.$eval('#understanding-frustration', panel => panel.getAnimations().forEach(animation => animation.finish()));
  assert.equal(await frame.$eval('#understanding-frustration', panel => panel.checkVisibility({ visibilityProperty: true, opacityProperty: true })), true);
  await go(0);
}
