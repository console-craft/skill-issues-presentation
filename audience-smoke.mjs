import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const labels = [
  'deadlines, codebase, teammates',
  'new model every day',
  'products in an afternoon',
  'no time nor freedom',
  'responsible for maintaing',
  'producing code', 'understanding code', 'confidence in code',
];
const ids = ['audience-bell', ...[1, 2, 3, 4, 5].map(number => `audience-item-${number}`),
  'audience-producing', 'audience-understanding', 'audience-confidence'];

export async function checkAudienceSync(page) {
  const presenter = await page.browser().newPage();
  let audience;
  try {
    await presenter.setViewport({ width: 1920, height: 1080 });
    await presenter.goto(page.url(), { timeout: 120000 });
    await presenter.waitForFunction(() => !document.querySelector('#play').disabled);
    const popup = page.browser().waitForTarget(target => target.opener() === presenter.target());
    await presenter.click('[data-hf-present]');
    audience = await (await popup).page();
    await audience.setViewport({ width: 1920, height: 1080 });
    await audience.waitForFunction(() => !document.querySelector('#play').disabled);
    // Exercise our live synchronization after both players are ready, not the SDK's startup retry window.
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(1));
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow')?.controller?.position.slideIndex === 1);
    assert.deepEqual(await audience.$eval('#narration', voice => [voice.paused, voice.currentTime]), [true, 0],
      'Visual synchronization must not start narration in the idle audience window');
    const frame = audience.frames().find(frame => frame.url().includes('/composition/index.html'));
    const expectReveals = async count => {
      await frame.waitForFunction(count => document.querySelectorAll('#slide-02 [data-visible]').length === count,
        { timeout: 2000 }, count).catch(() => {});
      assert.deepEqual(await frame.$$eval('#slide-02 [data-visible]', nodes => nodes.map(node => node.id)), ids.slice(0, count),
        'The real Present audience window must receive every reveal and undo');
    };
    for (let count = 1; count <= 9; count++) {
      await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
      await expectReveals(count);
    }
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.prev());
    await expectReveals(8);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
    await expectReveals(9);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 2);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(1));
    await expectReveals(0);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(2));
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 2);
    for (let step = 1; step <= 4; step++) {
      await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
      await frame.waitForFunction(step => document.querySelectorAll('#slide-03 [data-visible]').length === step, {}, step);
    }
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.prev());
    await frame.waitForFunction(() => document.querySelectorAll('#slide-03 [data-visible]').length === 3);
    await presenter.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(3); deck.controller.goToSlide(2); });
    await frame.waitForFunction(() => document.querySelectorAll('#slide-03 [data-visible]').length === 0);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(3));
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 3);
    for (let step = 1; step <= 6; step++) {
      await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
      await frame.waitForFunction(step => document.querySelectorAll('#slide-04 [data-visible]').length === step, {}, step);
    }
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.prev());
    await frame.waitForFunction(() => document.querySelectorAll('#slide-04 [data-visible]').length === 5);
    await presenter.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(4); deck.controller.goToSlide(3); });
    await frame.waitForFunction(() => document.querySelectorAll('#slide-04 [data-visible]').length === 0);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(4));
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 4);
    for (let step = 1; step <= 11; step++) {
      await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
      await frame.waitForFunction(step => document.querySelectorAll('#slide-05 [data-visible]').length === step, {}, step);
    }
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.prev());
    await frame.waitForFunction(() => document.querySelectorAll('#slide-05 [data-visible]').length === 10);
    await presenter.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(5); deck.controller.goToSlide(4); });
    await frame.waitForFunction(() => document.querySelectorAll('#slide-05 [data-visible]').length === 0);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(5));
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 5);
    for (let step = 1; step <= 7; step++) {
      await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
      await frame.waitForFunction(step => document.querySelectorAll('#slide-06 [data-visible]').length === step, {}, step);
    }
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.prev());
    await frame.waitForFunction(() => document.querySelectorAll('#slide-06 [data-visible]').length === 6);
    await presenter.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(6); deck.controller.goToSlide(5); });
    await frame.waitForFunction(() => document.querySelectorAll('#slide-06 [data-visible]').length === 0);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(6));
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 6);
    for (let step = 1; step <= 5; step++) {
      await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
      await frame.waitForFunction(step => document.querySelectorAll('#slide-07 [data-visible]').length === step, {}, step);
    }
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.prev());
    await frame.waitForFunction(() => document.querySelectorAll('#slide-07 [data-visible]').length === 4);
    await presenter.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(7); deck.controller.goToSlide(6); });
    await frame.waitForFunction(() => document.querySelectorAll('#slide-07 [data-visible]').length === 0);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(7));
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 7);
    for (let step = 1; step <= 5; step++) {
      await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
      await frame.waitForFunction(step => document.querySelectorAll('#slide-08 [data-visible]').length === step, {}, step);
    }
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.prev());
    await frame.waitForFunction(() => document.querySelectorAll('#slide-08 [data-visible]').length === 4);
    await presenter.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(8); deck.controller.goToSlide(7); });
    await frame.waitForFunction(() => document.querySelectorAll('#slide-08 [data-visible]').length === 0);
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(18));
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 18);
    for (let step = 1; step <= 9; step++) {
      await presenter.$eval('hyperframes-slideshow', deck => deck.controller.next());
      await frame.waitForFunction(step => document.querySelectorAll('#slide-19 [data-visible]').length === step, {}, step);
    }
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.prev());
    await frame.waitForFunction(() => document.querySelectorAll('#slide-19 [data-visible]').length === 8);
    await presenter.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(19); deck.controller.goToSlide(18); });
    await frame.waitForFunction(() => document.querySelectorAll('#slide-19 [data-visible]').length === 0);
    await presenter.bringToFront();
    await presenter.click('#play');
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(19));
    await presenter.click('#play');
    await presenter.waitForFunction(() => !document.querySelector('#narration').paused);
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 19);
    assert.equal(await frame.$$eval('#slide-20 .type-letter', letters => letters.every(letter => getComputedStyle(letter).visibility === 'hidden')), true, 'The audience must not see Thank You before the presenter voice ends');
    await presenter.$eval('#narration', voice => { voice.currentTime = voice.duration - .08; });
    await presenter.waitForFunction(() => document.querySelector('#narration').ended);
    await audience.bringToFront();
    await frame.waitForFunction(() => [...document.querySelectorAll('#slide-20 .type-letter')].every(letter => getComputedStyle(letter).visibility === 'visible'), { timeout: 4000 });
    assert.equal(await audience.$eval('#narration', voice => voice.paused), true, 'Closing visual synchronization must not duplicate audience audio');
    await presenter.bringToFront();
    await presenter.click('#play');
    await audience.bringToFront();
    await frame.waitForFunction(() => [...document.querySelectorAll('#slide-20 .type-letter')].every(letter => getComputedStyle(letter).visibility === 'hidden'), { timeout: 1500 });
    await presenter.bringToFront();
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(20));
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 20);
    for (const target of [presenter, audience]) {
      assert.deepEqual(await target.evaluate(() => ({
        hidden: [...document.querySelectorAll('.controls,[data-hf-chrome]')].every(node => node.getClientRects().length === 0),
        black: getComputedStyle(document.body).backgroundColor,
        full: Math.abs(document.querySelector('hyperframes-player').getBoundingClientRect().height - innerHeight) < 1,
        voice: [document.querySelector('#narration').paused, document.querySelector('#narration').hasAttribute('src')],
      })), { hidden: true, black: 'rgb(0, 0, 0)', full: true, voice: [true, false] }, 'The manual prompt must occupy the full view without chrome or speech in both windows');
    }
    await presenter.$eval('hyperframes-slideshow', deck => deck.controller.prev());
    await audience.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 19);
    assert.equal(await presenter.$eval('[data-hf-chrome]', node => node.getClientRects().length > 0), true, 'Presenter notes/chrome must return after leaving21');
    assert.equal(await presenter.evaluate(() => document.querySelector('hyperframes-player').getBoundingClientRect().height < innerHeight), true, 'Presenter layout must restore its notes inset');
    await presenter.click('#exit');
  } finally {
    await audience?.close();
    await presenter.close();
  }
}

export async function checkAudience(page, frame) {
  assert.equal(await frame.$$eval('#slide-02 [data-fragment]', nodes => nodes.length), 9, 'Slide 2 must have nine ordered, individually revealed components');
  assert.equal(await frame.$$eval('#audience-ai', nodes => nodes.length), 1, 'Slide 2 must include the automatic central speaking AI outside the nine manual reveals');
  assert.deepEqual(await frame.$$eval('#slide-02 .audience-text', nodes => nodes.map(node => node.textContent.trim())), labels);
  const source = await readFile(new URL('../artwork/bell-curve.png', import.meta.url));
  assert.deepEqual(await readFile(new URL('composition/assets/bell-curve.png', import.meta.url)), source, 'The complete bell-curve PNG must be copied unchanged');
  assert.deepEqual(await readFile(new URL('composition/assets/ai-talking.gif', import.meta.url)),
    await readFile(new URL('../artwork/ai-talking.gif', import.meta.url)), 'The AI GIF must be copied unchanged');
  for (let number = 1; number <= 5; number++) {
    const original = await readFile(new URL(`../artwork/hud/shape${number}.svg`, import.meta.url), 'utf8');
    const geometry = await frame.$eval(`#audience-item-${number} svg`, svg => ({
      viewBox: svg.getAttribute('viewBox'),
      paths: [...svg.querySelectorAll('path')].map(path => [path.getAttribute('class'), path.getAttribute('d')]),
      transforms: [...svg.querySelectorAll('[transform]')].map(node => node.getAttribute('transform')),
    }));
    assert.deepEqual(geometry, { viewBox: original.match(/viewBox="([^"]+)"/)[1],
      paths: [...original.matchAll(/<path class="([^"]+)" d="([^"]+)"/g)].map(([, name, d]) => [name, d]),
      transforms: [...original.matchAll(/transform="([^"]+)"/g)].map(([, value]) => value) }, `HUD ${number} must retain its original geometry and number`);
  }
  assert.notEqual(await frame.$eval('#audience-bell .outline', path => path.getAttribute('d')),
    await frame.$eval('#slide-02 .slide-title .outline', path => path.getAttribute('d')), 'The image frame must differ from the title shape');
  await frame.$eval('#audience-bell img', image => image.decode());
  assert.equal(await frame.$eval('#audience-bell img', image => getComputedStyle(image).objectFit), 'contain', 'The image must not be cropped');

  const visible = () => frame.$$eval('#slide-02 [data-fragment]', nodes => nodes.filter(node =>
    node.checkVisibility({ visibilityProperty: true, opacityProperty: true })).map(node => node.id));
  const selected = () => frame.$$eval('#slide-02 [data-fragment][data-visible]', nodes => nodes.map(node => node.id));
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  const finish = () => frame.$$eval('#slide-02 [data-fragment][data-visible]', nodes => {
    for (const node of nodes) for (const animation of node.getAnimations()) animation.finish();
  });
  await frame.evaluate(() => {
    window.audienceEntrances = [];
    window.audienceEntranceTiming = null;
    for (const type of ['animationstart', 'animationend']) document.addEventListener(type, event => {
      if (!event.target.matches('#slide-02 .slide-title, #audience-ai, #audience-bell')) return;
      window.audienceEntrances.push(`${event.target.id || 'title'}:${type}`);
      if (event.target.id === 'audience-ai' && type === 'animationstart') {
        const title = document.querySelector('#slide-02 .slide-title');
        const heading = title.getAnimations().find(animation => animation.animationName === 'panel-appear');
        const ai = event.target.getAnimations().find(animation => animation.animationName === 'ai-appear');
        window.audienceEntranceTiming = { titleEnd: heading.startTime + heading.effect.getComputedTiming().endTime,
          aiStart: ai.startTime + ai.effect.getTiming().delay, titleOpacity: Number(getComputedStyle(title).opacity) };
      }
    });
  });
  await go(0);
  await frame.$eval('#title-next', button => button.click());
  assert.deepEqual(await selected(), [], 'The cover arrow must not also reveal a component as its click bubbles');
  assert.deepEqual(await visible(), []);
  assert.equal(await frame.$eval('#audience-ai', image => image.checkVisibility({ visibilityProperty: true, opacityProperty: true })), false, 'AI must wait for the title entrance');
  for (let index = 0; index < 9; index++) {
    if (index === 0) await frame.click('#slide-02', { offset: { x: 950, y: 500 } });
    else if (index === 3) await frame.click('#audience-bell img');
    else if (index === 6) await frame.click('#audience-item-1 .audience-text');
    else if (index % 3 === 1) await page.keyboard.press('ArrowRight');
    else await page.click('[data-hf-next]');
    if (index === 0) {
      assert.deepEqual(await visible(), [], 'Early manual input must wait for the title and automatic AI entrance');
      await frame.waitForFunction(() => document.querySelector('#slide-02').hasAttribute('data-fragments-ready'));
    }
    await finish();
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 1);
    assert.deepEqual(await selected(), ids.slice(0, index + 1), 'Every input must reveal exactly the next component');
    assert.deepEqual(await visible(), ids.slice(0, index + 1));
    assert.deepEqual(await frame.$$eval('#slide-02 [data-fragment]', nodes => nodes.map(node => ({ hidden: node.getAttribute('aria-hidden'), inert: node.inert }))),
      ids.map((_, position) => ({ hidden: String(position > index), inert: position > index })), 'Unrevealed content must remain absent from the accessibility tree');
  }
  const layout = await frame.$$eval('#slide-02 [data-fragment]', nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    const text = node.querySelector('.audience-text');
    let textFits = true;
    if (text) {
      const range = document.createRange(); range.selectNodeContents(text);
      const ink = range.getBoundingClientRect();
      textFits = ink.left > box.left + 20 && ink.right < box.right - 20 && ink.top > box.top + 4 && ink.bottom < box.bottom - 4;
    }
    return { id: node.id, x: box.x, y: box.y, right: box.right, bottom: box.bottom,
      fits: box.left >= 80 && box.right <= 1840 && box.top >= 180 && box.bottom <= 1050 && textFits,
      accessible: node.getAttribute('aria-hidden') === 'false' && !node.inert,
      noFlare: node.getAnimations({ subtree: true }).every(animation => !['title-shine', 'frame-shine'].includes(animation.animationName)),
      white: !text || getComputedStyle(text).color === 'rgb(255, 255, 255)' };
  }));
  assert.ok(layout.every(node => node.fits && node.accessible && node.noFlare && node.white), `All components must fit, be accessible, and use solid white text: ${JSON.stringify(layout)}`);
  const entrances = await frame.evaluate(() => window.audienceEntrances);
  const timing = await frame.evaluate(() => window.audienceEntranceTiming);
  // Title end and AI start share a frame; event delivery order is not animation order.
  assert.ok(timing && timing.titleEnd <= timing.aiStart + .01 && timing.titleOpacity === 1 &&
    entrances.indexOf('audience-ai:animationend') < entrances.indexOf('audience-bell:animationstart'),
    `Entrance timing must be title, automatic AI, then queued/manual content: ${JSON.stringify(timing)}, ${entrances}`);
  assert.equal(await frame.$eval('#audience-bell img', image => {
    const panel = image.parentElement.getBoundingClientRect(), box = image.getBoundingClientRect();
    return box.width <= panel.width * .82 && box.left > panel.left + panel.width * .08 && box.right < panel.right - panel.width * .08;
  }), true, 'The PNG must have a smaller inset footprint clear of the panel notches');
  const ai = await frame.$eval('#audience-ai', image => {
    const box = image.getBoundingClientRect();
    return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height,
      fit: getComputedStyle(image).objectFit, glow: getComputedStyle(image).filter, opacity: getComputedStyle(image).opacity,
      loaded: image.complete && image.naturalWidth > 0 };
  });
  assert.deepEqual([ai.x, ai.y, ai.width, ai.height, ai.fit, ai.loaded], [910, 490, 100, 100, 'contain', true], 'AI must fit a stationary 100×100 box at page center');
  assert.ok(ai.glow.includes('drop-shadow(rgb(32, 199, 255)'), 'The AI must have a cyan glow to separate it from the background');
  assert.ok([...ai.glow.matchAll(/0px 0px ([\d.]+)px/g)].some(([, blur]) => Number(blur) >= 20), 'The AI must have a broader, soft outer halo');
  assert.equal(ai.opacity, '0.8', 'The visible AI must remain 20% transparent after its entrance');
  assert.ok(layout.every(panel => panel.right <= ai.x || ai.right <= panel.x || panel.bottom <= ai.y || ai.bottom <= panel.y), 'The AI must not overlap any panel');
  for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
    const a = layout[i], b = layout[j];
    assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `${a.id} must not overlap ${b.id}`);
  }
  assert.ok(layout[0].x < layout[1].x && layout[0].right <= layout[1].x, 'The large image must be left of the five HUD rows');
  assert.ok(layout.slice(6).every(node => node.y === layout[6].y && node.y >= layout[0].bottom), 'The three bottom panels must share one row below the main content');
  assert.equal(await frame.$$eval('#slide-02 .content-panel .body', nodes => nodes.length), 4, 'The image and all three bottom labels need their control-panel frames');
  assert.equal(await frame.$$eval('#slide-02 .audience-hud .panel', nodes => nodes.length), 10, 'Each HUD row needs both its numbered badge and label panel');
  const palette = await frame.evaluate(() => {
    const header = getComputedStyle(document.querySelector('#slide-02 .slide-title .body'));
    return [...document.querySelectorAll('#slide-02 .content-panel .body, #slide-02 .audience-hud .panel')].every(node => {
      const style = getComputedStyle(node);
      return style.fill === header.fill && style.fillOpacity === header.fillOpacity;
    }) && [...document.querySelectorAll('#slide-02 .audience-hud .outline, #slide-02 .content-panel .outline')].every(node => getComputedStyle(node).stroke === 'rgb(32, 199, 255)') &&
      [...document.querySelectorAll('#slide-02 .audience-hud .digit')].every(node => {
        const style = getComputedStyle(node);
        return style.stroke === 'rgb(255, 32, 216)' && style.filter.includes('255, 255, 255');
      });
  });
  assert.equal(palette, true, 'Content panels must share the header fill/translucency, blue outlines, and magenta HUD digits with a subtle white glow');
  const muted = await page.$eval('#music', music => music.muted);
  await page.focus('[data-hf-mute]');
  await page.keyboard.press('Space');
  assert.equal(await page.$eval('#music', music => music.muted), !muted, 'Space on focused Mute must activate Mute, not advance the presentation');
  assert.deepEqual(await selected(), ids, 'Keyboard use of toolbar controls must not consume reveal steps');
  await page.focus('[data-hf-mute]');
  await page.keyboard.press('Space');
  assert.equal(await page.$eval('#music', music => music.muted), muted);
  await page.focus('[data-hf-prev]');
  await page.keyboard.press('Space');
  assert.deepEqual(await selected(), ids.slice(0, 8), 'Space on focused Previous must undo one reveal');
  await page.focus('[data-hf-next]');
  await page.keyboard.press('Space');
  await finish();
  assert.deepEqual(await selected(), ids, 'Space on focused Next must reveal only one component');
  await page.focus('hyperframes-slideshow');
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await selected(), ids.slice(0, 8), 'Previous must undo a reveal instead of leaving the slide');
  await page.keyboard.press('Space');
  await finish();
  assert.deepEqual(await selected(), ids, 'Space must restore exactly one reveal');
  await frame.click('#slide-02', { offset: { x: 950, y: 500 } });
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 2, 'The tenth forward input must advance to slide 3');
  await go(1);
  assert.deepEqual(await selected(), [], 'A new visit must reset the sequence');
  await frame.waitForFunction(() => document.querySelector('#slide-02').hasAttribute('data-fragments-ready'));
  assert.equal(await frame.$eval('#audience-ai', image => image.checkVisibility({ visibilityProperty: true, opacityProperty: true })), true, 'AI must reappear automatically on every visit');
  assert.deepEqual(await selected(), [], 'Automatic AI entrance must not consume any of the nine reveal steps');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 0, 'Previous at zero must leave for the cover');

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await go(1);
  assert.equal(await frame.$eval('#audience-ai', image => image.checkVisibility({ visibilityProperty: true, opacityProperty: true })), true, 'Reduced motion must show AI immediately without adding a click');
  assert.equal(await frame.$eval('#audience-ai', image => getComputedStyle(image).opacity), '0.8', 'Reduced motion must preserve AI transparency');
  for (let count = 1; count <= 9; count++) {
    await page.$eval('hyperframes-slideshow', deck => deck.controller.next());
    assert.deepEqual(await visible(), ids.slice(0, count));
    assert.equal(await frame.$$eval('#slide-02 [data-fragment]', nodes => nodes.flatMap(node => node.getAnimations({ subtree: true })).length), 0, 'Reduced motion must keep click sequencing without entrance animations');
  }
  await go(0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.click('#play');
  await page.waitForFunction(() => document.querySelector('#music').currentTime > .1);
  const beforeMusic = await page.$eval('#music', music => music.currentTime);
  await go(1);
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual', 'Entering slide 2 must hold autoplay for manual reveals');
  assert.equal(await page.$eval('#play', button => button.disabled), false, 'Resume auto must be available on reveal slides');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.next());
  assert.equal(await frame.$eval('#audience-bell', node => getComputedStyle(node).visibility), 'hidden', 'Early reveal clicks must stay hidden behind the slide transition');
  await frame.waitForFunction(() => document.querySelector('#slide-transition')?.hidden !== false);
  await frame.waitForFunction(() => document.querySelector('#slide-02').hasAttribute('data-fragments-ready'));
  await frame.waitForFunction(() => document.querySelector('#audience-bell').getAnimations().every(animation => animation.playState === 'finished'));
  const stationary = await frame.$eval('#audience-bell img', image => image.getBoundingClientRect().toJSON());
  const camera = await frame.$eval('#slide-02 > picture img', image => getComputedStyle(image).transform);
  await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.notEqual(await frame.$eval('#slide-02 > picture img', image => getComputedStyle(image).transform), camera);
  assert.deepEqual(await frame.$eval('#audience-bell img', image => image.getBoundingClientRect().toJSON()), stationary, 'The PNG must stay fixed while its background moves');
  assert.equal(await frame.$eval('#audience-bell img', image => getComputedStyle(image).transform), 'none');
  await frame.evaluate(() => { window.audienceCamera = document.querySelector('#slide-02 > picture img').getAnimations()[0]; });
  await page.$eval('hyperframes-slideshow', deck => deck.controller.next());
  assert.equal(await frame.evaluate(() => document.querySelector('#slide-02 > picture img').getAnimations()[0] === window.audienceCamera), true, 'Fragment synchronization must not restart background motion');
  assert.deepEqual(await frame.$eval('#audience-bell img', image => image.getBoundingClientRect().toJSON()), stationary, 'Revealing another item must not replay the image entrance');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.prev());
  await page.click('[data-hf-mute]');
  assert.deepEqual(await selected(), ids.slice(0, 1), 'Toolbar controls must not consume reveal steps');
  await page.click('[data-hf-mute]');
  assert.ok(await page.$eval('#music', (music, before) => !music.paused && music.currentTime >= before, beforeMusic), 'Reveals must not stop or restart music');
  await page.click('#exit');
  assert.deepEqual(await selected(), [], 'Exit must clear all reveals');
  await go(0);
  await frame.focus('#title-next');
  await page.keyboard.press('Space');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 1, 'Space on the focused iframe cover button must activate it natively');
  assert.deepEqual(await selected(), [], 'Native cover-button activation must not also consume a reveal');
  await go(0);
}
