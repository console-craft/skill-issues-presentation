import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ids = ['audience-bell', 'audience-item-1', 'audience-item-2', 'audience-item-3',
  'audience-item-4', 'audience-item-5', 'audience-producing', 'audience-understanding', 'audience-confidence'];

export async function checkNarrationAssets() {
  const html = await readFile(new URL('composition/index.html', import.meta.url), 'utf8');
  for (const [number, count] of Object.entries({ 2:9, 3:4, 4:6, 5:11, 6:7, 7:5, 8:5, 19:9, 20:0 })) {
    const source = new URL(`../audio/narations/slide-${number}.mp3`, import.meta.url);
    const served = new URL(`assets/voice/slide-${number}.mp3`, import.meta.url);
    assert.deepEqual(await readFile(served), await readFile(source), 'Serve the approved narration without re-encoding');
    const data = JSON.parse(await readFile(new URL(`assets/voice/slide-${number}.json`, import.meta.url), 'utf8'));
    assert.equal(fileURLToPath(new URL(data.source, served)), fileURLToPath(source));
    const scene = html.match(new RegExp(`<section[^>]*id="slide-${number.padStart(2, '0')}"[^>]*>([\\s\\S]*?)</section>`))[1];
    const expected = [...scene.matchAll(/<[^>]+\bid="([^"]+)"[^>]*\bdata-fragment\b/g)].map(match => match[1]);
    assert.equal(expected.length, count);
    assert.deepEqual(data.cues.map(cue => cue.id), expected, `Slide ${number}: address every fragment in manual order`);
    const duration = Number(execFileSync('/usr/bin/afinfo', [fileURLToPath(served)], { encoding: 'utf8' })
      .match(/estimated duration:\s*([\d.]+)/)[1]);
    assert.ok(data.cues.every((cue, index) => Number.isFinite(cue.start) && cue.start >= 0 && cue.start < duration &&
      (!index || cue.start > data.cues[index - 1].start) && typeof cue.text === 'string' && cue.text.trim()),
    'Every cue needs an increasing in-recording timestamp and a phrase anchor');
    assert.ok(Array.isArray(data.speech) && data.speech.length > 0 && data.speech.every((span, index) =>
      Array.isArray(span) && span.length === 2 && span.every(Number.isFinite) && span[0] >= 0 &&
      span[1] > span[0] && span[1] <= duration && (!index || span[0] >= data.speech[index - 1][1])),
    'The pulse needs ordered speech windows from the approved recording');
    if (number === '2') {
      assert.equal(data.speech.some(([start, end]) => start <= 1 && 1 < end), true, 'The opening speech is active');
      assert.equal(data.speech.some(([start, end]) => start <= 48.2 && 48.2 < end), false, 'The measured long pause is inactive');
    }
  }
}

async function openNarrationPage(source, setup) {
  const page = await source.browser().newPage();
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.evaluateOnNewDocument(() => {
      const set = window.setTimeout, clear = window.clearTimeout;
      const holds = window.testHolds = new Map();
      let id = -1;
      window.setTimeout = (fn, delay, ...args) => {
        if (delay !== 5000) return set(fn, delay, ...args);
        const key = id--; holds.set(key, () => fn(...args)); return key;
      };
      window.clearTimeout = key => { if (key < 0) holds.delete(key); else clear(key); };
      window.tickHold = () => { const [key, fn] = holds.entries().next().value; holds.delete(key); fn(); };
    });
    const route = setup ? await setup(page) : null;
    await page.setRequestInterception(true);
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      // Audio fixtures keep real voice/foreground/transitions; smoke.mjs separately checks the full-size backgrounds.
      if (path.includes('/assets/backgrounds/')) {
        request.respond({ status: 200, contentType: 'image/gif', headers: { 'Cache-Control': 'no-store' },
          body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
      } else if (typeof route === 'function') route(request);
      else request.continue();
    });
    await page.goto(source.url());
    await page.waitForFunction(() => !document.querySelector('#play').disabled);
    return page;
  } catch (error) { await page.close(); throw error; }
}

async function enterNarration(page) {
  await page.click('#play');
  await page.waitForFunction(() => window.testHolds.size === 1);
  return page.evaluate(() => {
    window.tickHold();
    return document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe')
      .contentDocument.querySelector('#slide-transition')?.hidden === false;
  });
}

export async function checkNarration(source) {
  const context = await source.browser().createBrowserContext();
  try {
    await checkNarrationInContext({ browser: () => context, url: () => source.url() });
  } finally { await context.close(); }
}

async function checkNarrationInContext(source) {
  const { cues } = JSON.parse(await readFile(new URL('assets/voice/slide-2.json', import.meta.url), 'utf8'));
  await checkNarrationRollout(source);
  await checkNarrationTrackChanges(source);
  await checkNarrationDocument(source);
  await checkNarrationLeadIn(source);
  await checkClosingThankYou(source);
  await checkNarrationReadiness(source);
  await checkNarrationMetadataClock(source);
  await checkNarrationController(source);
  await checkNarrationPulse(source);
  const page = await openNarrationPage(source);
  const selected = () => page.evaluate(() => [...document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe')
    .contentDocument.querySelectorAll('#slide-02 [data-visible]')].map(node => node.id));
  const seek = async time => {
    await page.$eval('#narration', (voice, time) => new Promise(resolve => {
      voice.addEventListener('seeked', resolve, { once: true }); voice.currentTime = time;
    }), time);
  };
  try {
    assert.ok(await page.$('#narration'), 'The outer player needs the slide-2 narration transport');
    await page.evaluate(() => {
      window.earlyVoice = false;
      document.querySelector('#narration').addEventListener('play', () => {
        const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
        if (!doc.querySelector('#slide-02').hasAttribute('data-fragments-ready') || doc.querySelector('#slide-transition')?.hidden === false)
          window.earlyVoice = true;
      });
    });
    await enterNarration(page);
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    assert.equal(await page.evaluate(() => window.earlyVoice), false, 'Voice must wait for the transition, title, and AI');
    assert.equal(await page.evaluate(() => window.testHolds.size), 0, 'Slide 2 must not use the five-second clock');
    assert.deepEqual(await selected(), [], 'The spoken handoff precedes the first visual cue');
    await page.evaluate(() => {
      const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
      window.narrationCamera = doc.querySelector('#slide-02 > picture img').getAnimations()[0];
    });
    assert.equal(await page.$eval('#music', music => music.volume), .06655, 'Music ducks to the auditioned global level while narration plays');

    await page.$eval('#narration', voice => voice.pause());
    const stalled = await page.$eval('#narration', voice => voice.currentTime);
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.ok(Math.abs(await page.$eval('#narration', voice => voice.currentTime) - stalled) < .05);
    assert.deepEqual(await selected(), [], 'A stopped media clock must not reveal content on wall time');
    assert.equal(await page.evaluate(() => window.testHolds.size), 0);
    await page.$eval('#narration', voice => voice.play());

    await page.click('#play');
    const held = await page.$eval('#narration', voice => voice.currentTime);
    const musicBeforeHold = await page.$eval('#music', music => music.currentTime);
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.ok(Math.abs(await page.$eval('#narration', voice => voice.currentTime) - held) < .05, 'Hold freezes the media clock');
    assert.equal(await page.$eval('#narration', voice => voice.paused), true);
    assert.deepEqual(await selected(), []);
    assert.ok(await page.$eval('#music', (music, time) => !music.paused && music.currentTime > time, musicBeforeHold));
    assert.equal(await page.$eval('#music', music => music.volume), .18);
    await page.click('#play');
    await page.waitForFunction(time => document.querySelector('#narration').currentTime > time, {}, held);

    await page.click('[data-hf-mute]');
    assert.deepEqual(await page.evaluate(() => ['#music', '#narration'].map(id => document.querySelector(id).muted)), [true, true]);
    await page.click('[data-hf-mute]');
    assert.deepEqual(await page.evaluate(() => ['#music', '#narration'].map(id => document.querySelector(id).muted)), [false, false]);

    await page.click('[data-hf-next]');
    assert.equal(await page.$eval('#narration', voice => voice.paused), true, 'Manual reveal pauses speech');
    assert.deepEqual(await selected(), ids.slice(0, 1));
    await page.click('#play');
    await page.waitForFunction(() => !document.querySelector('#narration').paused);
    assert.deepEqual(await selected(), ids.slice(0, 1), 'Resume must not hide an early manual reveal');
    await page.click('[data-hf-prev]');
    assert.equal(await page.$eval('#narration', voice => voice.paused), true, 'Manual undo pauses speech');
    assert.deepEqual(await selected(), []);
    await page.click('#play');
    await page.waitForFunction(() => !document.querySelector('#narration').paused);
    const frame = page.frames().find(frame => frame.url().includes('/composition/index.html'));
    await frame.click('#slide-02', { offset: { x: 950, y: 500 } });
    assert.equal(await page.$eval('#narration', voice => voice.paused), true, 'Artwork input pauses speech');
    assert.deepEqual(await selected(), ids.slice(0, 1));

    await page.click('#exit');
    await enterNarration(page);
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    await page.evaluate(() => {
      const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
      window.narrationCamera = doc.querySelector('#slide-02 > picture img').getAnimations()[0];
    });
    for (let index = 0; index < cues.length; index++) {
      await seek(cues[index].start - .7);
      assert.deepEqual(await selected(), ids.slice(0, index), `Do not reveal ${ids[index]} before its cue`);
      await seek(cues[index].start + .03);
      await page.waitForFunction(count => document.querySelector('hyperframes-slideshow').controller.position.fragmentIndex === count - 1, {}, index + 1);
      assert.deepEqual(await selected(), ids.slice(0, index + 1));
    }
    assert.equal(await page.evaluate(() => {
      const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
      return doc.querySelector('#slide-02 > picture img').getAnimations()[0] === window.narrationCamera;
    }), true, 'Audio-clock reveals must not restart background motion');
    await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(2));
    assert.deepEqual(await page.$eval('#narration', voice => [voice.paused, voice.currentTime]), [true, 0]);
    await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(1));
    assert.deepEqual(await page.$eval('#narration', voice => [voice.paused, voice.currentTime]), [true, 0], 'Manual revisit is silent and fresh');
    await page.click('#play');
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'idle');
    assert.deepEqual(await page.$eval('#narration', voice => [voice.paused, voice.currentTime]), [true, 0]);

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await enterNarration(page);
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    assert.deepEqual(await selected(), [], 'Reduced motion retains the spoken introduction');
    await seek(cues[0].start + .03);
    await page.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.fragmentIndex === 0);
    assert.deepEqual(await selected(), ids.slice(0, 1), 'Reduced motion keeps the voice-led reveal sequence');
    await page.click('#exit');
  } finally { await page.close(); }

  const data = JSON.parse(await readFile(new URL('assets/voice/slide-2.json', import.meta.url), 'utf8'));
  const failureCases = [
    ['missing audio', '/assets/voice/slide-2.mp3', 404, 'missing'],
    ['corrupt audio', '/assets/voice/slide-2.mp3', 200, 'not an MP3'],
    ['missing cues', '/assets/voice/slide-2.json', 404, 'missing'],
    ['invalid JSON', '/assets/voice/slide-2.json', 200, '{'],
    ['wrong fragment', '/assets/voice/slide-2.json', 200, JSON.stringify({ ...data, cues: data.cues.map((cue, i) => i === 1 ? { ...cue, id: 'absent-panel' } : cue) })],
    ['negative time', '/assets/voice/slide-2.json', 200, JSON.stringify({ ...data, cues: data.cues.map((cue, i) => i === 1 ? { ...cue, start: -1 } : cue) })],
    ['out-of-order time', '/assets/voice/slide-2.json', 200, JSON.stringify({ ...data, cues: data.cues.map((cue, i) => i === 2 ? { ...cue, start: 1 } : cue) })],
    ['out-of-range time', '/assets/voice/slide-2.json', 200, JSON.stringify({ ...data, cues: data.cues.map((cue, i) => i === 8 ? { ...cue, start: 99999 } : cue) })],
  ];
  for (const [name, path, status, body] of failureCases) {
    const failed = await openNarrationPage(source, async page => {
      return request => new URL(request.url()).pathname === path
        ? request.respond({ status, contentType: path.endsWith('.json') ? 'application/json' : 'audio/mpeg', body })
        : request.continue();
    });
    try {
      await enterNarration(failed);
      await failed.waitForFunction(() => /Voice/i.test(document.querySelector('#status').textContent));
      assert.equal(await failed.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual', `${name}: stop auto`);
      assert.equal(await failed.$eval('#narration', voice => voice.paused), true, `${name}: stop speech`);
      assert.equal(await failed.evaluate(() => window.testHolds.size), 0);
      await failed.click('[data-hf-next]');
      assert.equal(await failed.$eval('hyperframes-slideshow', deck => deck.controller.position.fragmentIndex), 0, `${name}: manual controls remain usable`);
    } finally { await failed.close(); }
  }

  for (const action of ['reject', 'hold', 'navigate']) {
    const pending = await openNarrationPage(source, page => page.evaluateOnNewDocument(action => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function() {
        if (this.id !== 'narration') return play.call(this);
        if (action === 'reject') return Promise.reject(new DOMException('Playback blocked', 'NotAllowedError'));
        return new Promise((resolve, reject) => { window.releaseVoice = () => play.call(this).then(resolve, reject); });
      };
    }, action));
    try {
      await enterNarration(pending);
      if (action === 'reject') {
        await pending.waitForFunction(() => /Voice/i.test(document.querySelector('#status').textContent));
      } else {
        await pending.waitForFunction(() => typeof window.releaseVoice === 'function');
        if (action === 'hold') await pending.click('#play');
        else await pending.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(2));
        await pending.evaluate(() => window.releaseVoice());
      }
      assert.equal(await pending.$eval('#narration', voice => voice.paused), true, `${action}: late playback stays cancelled`);
      assert.equal(await pending.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual');
    } finally { await pending.close(); }
  }

  const earlyHold = await openNarrationPage(source);
  try {
    await earlyHold.evaluate(() => {
      const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
      doc.addEventListener('animationstart', event => {
        if (event.target.matches('#audience-ai')) event.target.getAnimations().forEach(animation => animation.pause());
      });
    });
    await enterNarration(earlyHold);
    await earlyHold.click('#play');
    const frame = earlyHold.frames().find(frame => frame.url().includes('/composition/index.html'));
    await frame.waitForFunction(() => document.querySelector('#audience-ai').getAnimations().some(animation => animation.playState === 'paused'));
    await frame.$eval('#audience-ai', image => image.getAnimations().forEach(animation => animation.finish()));
    assert.equal(await earlyHold.$eval('#narration', voice => voice.paused), true, 'Finishing the AI entrance after Hold must not start speech');
    await earlyHold.click('#play');
    await earlyHold.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
  } finally { await earlyHold.close(); }

  const cutOnly = await openNarrationPage(source, page => page.evaluateOnNewDocument(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : getContext.call(this, type, ...args);
    };
  }));
  try {
    await enterNarration(cutOnly);
    await cutOnly.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    assert.equal(await cutOnly.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 1);
    assert.equal(await cutOnly.evaluate(() => document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe')
      .contentDocument.querySelector('#slide-transition')), null, 'Exercise narration on the real WebGL cut-only fallback');
  } finally { await cutOnly.close(); }
}

const seekVoice = (page, time) => page.$eval('#narration', (voice, time) => new Promise(resolve => {
  voice.addEventListener('seeked', () => resolve(), { once: true }); voice.currentTime = time;
}), time);

export async function checkNarrationRollout(source) {
  const page = await openNarrationPage(source);
  const frame = page.frames().find(frame => frame.url().includes('/composition/index.html'));
  try {
    await page.evaluate(() => {
      window.earlyVoice = false;
      document.querySelector('#narration').addEventListener('play', () => {
        const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
        const scene = doc.querySelector('.scene[data-active]');
        if (!scene.hasAttribute('data-fragments-ready') || doc.querySelector('#slide-transition')?.hidden === false) window.earlyVoice = true;
      });
    });
    await enterNarration(page);
    for (const number of [2,3,4,5,6,7,8,19,20]) {
      if (number === 19) {
        assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 8, 'Slide 8 ends at the manual section');
        for (let index = 8; index <= 17; index++) {
          assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), index);
          assert.deepEqual(await page.$eval('#play', button => [button.disabled, button.textContent]), [true, 'Manual section']);
          assert.equal(await page.evaluate(() => window.testHolds.size), 0, 'The skills section must have no auto timer');
          assert.equal(await page.$eval('#narration', voice => voice.paused), true);
          assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual');
          await page.click('[data-hf-next]');
        }
        assert.match(await page.$eval('#play', button => button.textContent), /Resume auto/);
        assert.equal(await page.$eval('#narration', voice => voice.paused), true, '19 must wait for explicit Resume');
        await page.click('#play');
      }
      await page.waitForFunction(number => {
        const voice = document.querySelector('#narration');
        return document.querySelector('hyperframes-slideshow').controller.position.slideIndex === number - 1 && !voice.paused && voice.currentTime > .05;
      }, { timeout: 6000 }, number);
      const expectedHash = createHash('sha256').update(await readFile(new URL(`../audio/narations/slide-${number}.mp3`, import.meta.url))).digest('hex');
      const actualHash = await page.$eval('#narration', async voice => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await (await fetch(voice.currentSrc)).arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join(''));
      assert.equal(actualHash, expectedHash, `Slide ${number} must play its own approved recording`);
      assert.equal(await page.$eval('#music', music => music.volume), .06655, `Slide ${number}: use the same increased global ducked music level`);
      assert.equal(await page.evaluate(() => window.testHolds.size), 0);
      const data = JSON.parse(await readFile(new URL(`assets/voice/slide-${number}.json`, import.meta.url), 'utf8'));
      const scene = `#slide-${String(number).padStart(2, '0')}`;
      for (let i = 0; i < data.cues.length; i++) {
        await seekVoice(page, data.cues[i].start - .5);
        assert.equal(await frame.$$eval(`${scene} [data-visible]`, nodes => nodes.length), i, `Slide ${number}: cue ${i} must not fire early`);
        await seekVoice(page, data.cues[i].start + .03);
        assert.deepEqual(await frame.$$eval(`${scene} [data-visible]`, nodes => nodes.map(node => node.id)), data.cues.slice(0, i + 1).map(cue => cue.id));
      }
      const speech = data.speech.find(([a,b]) => b - a > 2);
      await seekVoice(page, speech[0] + .2);
      await frame.waitForFunction(scene => document.querySelector(`${scene} .slide-ai`).getAnimations().some(a => a.effect.getTiming().iterations === Infinity), { timeout: 2500 }, scene).catch(async error => {
        error.message += ` (slide ${number}, voice ${JSON.stringify(await page.$eval('#narration', v => ({time:v.currentTime, duration:v.duration, paused:v.paused, ended:v.ended, seeking:v.seeking, ready:v.readyState, muted:v.muted})))}, speech ${JSON.stringify(data.speech)})`;
        throw error;
      });
      const pulse = await frame.$eval(`${scene} .slide-ai`, image => {
        const animation = image.getAnimations().find(a => a.effect.getTiming().iterations === Infinity);
        animation.pause(); animation.currentTime = animation.effect.getTiming().duration / 2;
        const box = image.getBoundingClientRect();
        const bitmap = document.createElement('canvas'); bitmap.width = Math.ceil(box.width); bitmap.height = Math.ceil(box.height);
        const pixels = bitmap.getContext('2d'); pixels.drawImage(image, 0, 0, box.width, box.height);
        const rgba = pixels.getImageData(0, 0, bitmap.width, bitmap.height).data;
        const ink = { left: bitmap.width, right: 0, top: bitmap.height, bottom: 0 };
        for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 127) {
          const x = ((i - 3) / 4) % bitmap.width, y = Math.floor((i - 3) / 4 / bitmap.width);
          ink.left = Math.min(ink.left, x); ink.right = Math.max(ink.right, x + 1);
          ink.top = Math.min(ink.top, y); ink.bottom = Math.max(ink.bottom, y + 1);
        }
        ink.left += box.left; ink.right += box.left; ink.top += box.top; ink.bottom += box.top;
        const glyphs = document.createElement('canvas'); glyphs.width = bitmap.width; glyphs.height = bitmap.height;
        const canvas = glyphs.getContext('2d');
        const collisions = [];
        const clear = [...image.closest('.scene').querySelectorAll('.slide-title, [data-fragment], .type-letter, h1, .title-footer')].every(panel => {
          const range = document.createRange(); range.selectNodeContents(panel);
          let other = panel.matches('.type-letter, h1, .title-footer') ? range.getBoundingClientRect() : panel.getBoundingClientRect();
          if (panel.matches('.type-letter')) {
            // Both the GIF and Cyberpunk have transparent/empty corners; compare actual ink, not line boxes.
            canvas.font = getComputedStyle(panel).font;
            const m = canvas.measureText(panel.textContent), scale = other.height / (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent);
            const baseline = other.top + m.fontBoundingBoxAscent * scale;
            canvas.clearRect(0, 0, glyphs.width, glyphs.height);
            canvas.save(); canvas.translate(other.left - box.left, baseline - box.top); canvas.scale(scale, scale);
            canvas.fillText(panel.textContent, 0, 0); canvas.restore();
            const text = canvas.getImageData(0, 0, glyphs.width, glyphs.height).data;
            return !rgba.some((value, i) => i % 4 === 3 && value > 127 && text[i] > 127);
          }
          const clear = ink.right <= other.left || ink.left >= other.right || ink.bottom <= other.top || ink.top >= other.bottom;
          if (!clear) collisions.push({id:panel.id, box:other.toJSON()});
          return clear;
        });
        animation.play();
        return { duration: animation.effect.getTiming().duration, width: box.width, clear, collisions,
          others: [...document.querySelectorAll('.scene:not([data-active]) .slide-ai')].some(image => image.getAnimations().some(a => a.effect.getTiming().iterations === Infinity)) };
      });
      assert.ok(pulse.duration >= 450 && pulse.duration <= 700 && pulse.width >= 122 && pulse.width <= 128 && pulse.clear && !pulse.others, `Slide ${number}: faster pulse stays clear of content: ${JSON.stringify(pulse)}`);
      const quiet = data.speech.slice(1).map(([start], i) => [data.speech[i][1], start]).find(([a,b]) => b - a > .55);
      if (quiet) {
        await page.$eval('#narration', voice => { voice.playbackRate = .1; });
        await seekVoice(page, quiet[0] + .05);
        await frame.waitForFunction(scene => !document.querySelector(`${scene} .slide-ai`).getAnimations().some(a => a.effect.getTiming().iterations === Infinity), { timeout: 1500 }, scene);
        assert.equal(await page.$eval('#narration', voice => voice.paused), false, 'Measured silence, not pausing the transport, stops the pulse');
        await page.$eval('#narration', voice => { voice.playbackRate = 1; });
      }
      await seekVoice(page, await page.$eval('#narration', voice => voice.duration - .06));
      if (number !== 20) {
        await page.waitForFunction(number => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === number, { timeout: 2500 }, number);
        if (number === 19) assert.equal(await frame.$eval('#slide-transition', stage => stage.dataset.effect), 'crt');
      }
    }
    await page.waitForFunction(() => document.querySelector('#narration').ended);
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 19, 'Autoplay must hold at20 even with the additional manual slide21');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual');
    assert.match(await page.$eval('#play', button => button.textContent), /Replay slide 20/);
    const music = await page.$eval('#music', music => music.currentTime);
    await page.click('#play');
    await page.waitForFunction(() => !document.querySelector('#narration').paused && document.querySelector('#narration').currentTime < 1);
    const replayMusic = await page.$eval('#music', node => ({ paused: node.paused, time: node.currentTime, duration: node.duration, error: node.error?.message }));
    assert.ok(!replayMusic.paused && replayMusic.time >= music, `Closing replay must preserve music: before=${music}, after=${JSON.stringify(replayMusic)}`);
    assert.equal(await page.evaluate(() => window.earlyVoice), false, 'Every clip must wait for its own transition/title/AI');
  } finally { await page.close(); }
}

export async function checkNarrationTrackChanges(source) {
  const page = await openNarrationPage(source);
  try {
    await enterNarration(page);
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    await page.click('[data-hf-mute]');
    for (const number of [5,3,20,19,4]) {
      await page.$eval('hyperframes-slideshow', (deck, number) => deck.controller.goToSlide(number - 1), number);
      await page.$eval('#narration', voice => {
        voice.dispatchEvent(new Event('ended'));
        voice.dispatchEvent(new Event('loadedmetadata'));
      });
      assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual', 'Stale events must not restart a newly selected track');
      await page.click('#play');
      await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05 && !document.querySelector('#narration').paused);
      assert.equal(await page.$eval('#narration', voice => voice.muted), true, 'Mute survives source changes');
      assert.equal(await page.$eval('#music', music => music.volume), .06655);
      await page.$eval('#narration', voice => voice.dispatchEvent(new Event('ended')));
      assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), number - 1, 'A stale ended event must not skip the current clip');
      await page.click('#play');
      assert.equal(await page.$eval('#narration', voice => voice.paused), true);
    }
  } finally { await page.close(); }
  let delayed;
  const loading = await openNarrationPage(source, () => request => {
    if (new URL(request.url()).pathname === '/assets/voice/slide-5.mp3') delayed = request;
    else request.continue();
  });
  try {
    await enterNarration(loading);
    await loading.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    await loading.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(4));
    await loading.click('#play');
    await loading.click('#play');
    const loaded = loading.waitForResponse(response => new URL(response.url()).pathname === '/assets/voice/slide-5.mp3');
    await delayed.continue(); await (await loaded).buffer();
    await loading.waitForFunction(() => document.querySelector('#narration').readyState >= 1);
    assert.equal(await loading.$eval('#narration', voice => voice.paused), true, 'Hold before loading must survive source selection and metadata');
    await loading.click('#play');
    await loading.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
  } finally { await loading.close(); }
  const pending = await openNarrationPage(source, page => page.evaluateOnNewDocument(() => {
    const play = HTMLMediaElement.prototype.play;
    let first = true;
    HTMLMediaElement.prototype.play = function() {
      if (this.id === 'narration' && first) {
        first = false;
        return new Promise((resolve, reject) => { window.rejectOldVoice = () => reject(new DOMException('Old track blocked', 'NotAllowedError')); });
      }
      return play.call(this);
    };
  }));
  try {
    await enterNarration(pending);
    await pending.waitForFunction(() => typeof window.rejectOldVoice === 'function');
    await pending.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(2));
    await pending.click('#play');
    await pending.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    await pending.evaluate(() => window.rejectOldVoice());
    assert.equal(await pending.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'auto', 'A rejected old play promise cannot stop the new track');
    assert.equal(await pending.$eval('#narration', voice => voice.paused), false);
  } finally { await pending.close(); }
  for (const body of [null, 'not an MP3']) {
    const failed = await openNarrationPage(source, () => request => new URL(request.url()).pathname === '/assets/voice/slide-5.mp3'
      ? request.respond({ status: body ? 200 : 404, contentType: 'audio/mpeg', body: body || 'missing' }) : request.continue());
    try {
      await enterNarration(failed);
      await failed.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
      assert.equal(await failed.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'auto', 'Unselected failure cannot interrupt current narration');
      await failed.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(4));
      await failed.click('#play');
      await failed.waitForFunction(() => /Voice unavailable/.test(document.querySelector('#status').textContent));
      assert.equal(await failed.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual');
      await failed.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(5));
      await failed.click('#play');
      await failed.waitForFunction(() => document.querySelector('#narration').currentTime > .05 && !document.querySelector('#narration').paused);
    } finally { await failed.close(); }
  }
}

export async function checkNarrationLeadIn(source) {
  const page = await openNarrationPage(source);
  try {
    await page.evaluate(() => {
      const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
      window.voiceLead = null;
      let readyAt;
      new MutationObserver(records => {
        if (records.some(record => record.target.id === 'slide-02') && doc.querySelector('#slide-02').hasAttribute('data-fragments-ready')) readyAt = performance.now();
      }).observe(doc.querySelector('#slide-02'), { attributes: true, attributeFilter: ['data-fragments-ready'] });
      document.querySelector('#narration').addEventListener('play', () => {
        if (document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 1 && window.voiceLead === null) window.voiceLead = performance.now() - readyAt;
      });
    });
    await enterNarration(page);
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    assert.ok(await page.evaluate(() => window.voiceLead >= 900), 'Leave about one extra second after the title/AI settles before speaking');
    await page.click('#play');
    const resumed = Date.now();
    await page.click('#play');
    await page.waitForFunction(() => !document.querySelector('#narration').paused);
    assert.ok(Date.now() - resumed < 800, 'Mid-recording Resume must not repeat the entrance delay');
  } finally { await page.close(); }
}

export async function checkClosingThankYou(source) {
  const page = await openNarrationPage(source);
  try {
    await page.click('#play');
    await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(19));
    await page.click('#play');
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    const frame = page.frames().find(frame => frame.url().includes('/composition/index.html'));
    const hidden = () => frame.$$eval('#slide-20 .type-letter', letters => letters.every(letter => getComputedStyle(letter).visibility === 'hidden'));
    await seekVoice(page, 5);
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > 6.6);
    assert.equal(await hidden(), true, 'Thank You must remain hidden while the closing voice speaks');
    await page.click('#play');
    assert.equal(await hidden(), true, 'Holding closing narration must not reveal Thank You');
    await page.click('#play');
    await seekVoice(page, await page.$eval('#narration', voice => voice.duration - .06));
    await page.waitForFunction(() => document.querySelector('#narration').ended);
    await frame.waitForFunction(() => [...document.querySelectorAll('#slide-20 .type-letter')].every(letter => getComputedStyle(letter).visibility === 'visible'), { timeout: 4000 });
    await page.click('#play');
    assert.equal(await hidden(), true, 'Replay hides Thank You again until narration finishes');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.waitForFunction(() => !document.querySelector('#narration').paused);
    assert.equal(await hidden(), true, 'Reduced motion must keep the same voice-completion gate');
    await seekVoice(page, await page.$eval('#narration', voice => voice.duration - .06));
    await page.waitForFunction(() => document.querySelector('#narration').ended);
    await frame.waitForFunction(() => [...document.querySelectorAll('#slide-20 .type-letter')].every(letter => getComputedStyle(letter).visibility === 'visible'));
    await page.click('#exit');
    assert.equal(await hidden(), true, 'Exit resets closing text even in reduced motion');
  } finally { await page.close(); }

  const held = await openNarrationPage(source);
  try {
    await enterNarration(held);
    const frame = held.frames().find(frame => frame.url().includes('/composition/index.html'));
    await frame.waitForFunction(() => document.querySelector('#slide-02').hasAttribute('data-fragments-ready'));
    await held.click('#play');
    await held.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
    await held.waitForFunction(() => document.querySelector('#music').currentTime > 2.5);
    assert.equal(await held.$eval('#narration', voice => voice.paused), true, 'Hold/navigation cancels a pending first-play delay');
    assert.equal(await held.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 8);
  } finally { await held.close(); }
}

export async function checkNarrationReadiness(source) {
  const ending = await openNarrationPage(source);
  try {
    await ending.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await enterNarration(ending);
    await ending.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    const frame = ending.frames().find(frame => frame.url().includes('/composition/index.html'));
    await frame.evaluate(() => document.addEventListener('animationstart', event => {
      if (event.target.matches('#audience-ai')) event.target.getAnimations().forEach(animation => animation.pause());
    }));
    await ending.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await frame.waitForFunction(() => !document.querySelector('#slide-02').hasAttribute('data-fragments-ready'));
    await seekVoice(ending, await ending.$eval('#narration', voice => voice.duration - .05));
    await ending.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 2, { timeout: 2500 });
  } finally { await ending.close(); }
  for (const stage of ['transition', 'title']) {
    const page = await openNarrationPage(source);
    try {
      const frame = page.frames().find(frame => frame.url().includes('/composition/index.html'));
      if (stage === 'title') await frame.evaluate(() => document.addEventListener('animationstart', event => {
        if (event.target.matches('#slide-02 .slide-title')) event.target.getAnimations().forEach(animation => animation.pause());
      }));
      const transitioning = await enterNarration(page);
      if (stage === 'transition') assert.equal(transitioning, true, 'Exercise the real incoming transition');
      else await frame.waitForFunction(() => document.querySelector('#slide-02 .slide-title').getAnimations().some(animation => animation.playState === 'paused'));
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await frame.waitForFunction(() => document.querySelector('#slide-02').hasAttribute('data-fragments-ready'));
      await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05, { timeout: 2500 });
      assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'auto',
        `Switching reduced motion during ${stage} must not strand narration`);
    } finally { await page.close(); }
  }
}

export async function checkNarrationMetadataClock(source) {
  let delayed;
  const page = await openNarrationPage(source, async page => {
    return request => {
      if (new URL(request.url()).pathname === '/assets/voice/slide-2.mp3') delayed = request;
      else request.continue();
    };
  });
  try {
    await page.click('#play');
    await page.waitForFunction(() => document.querySelector('#music').currentTime > .05 && window.testHolds.size === 1);
    const hold = await page.evaluate(() => window.testHolds.keys().next().value);
    const loaded = page.waitForResponse(response => new URL(response.url()).pathname === '/assets/voice/slide-2.mp3');
    await delayed.continue();
    await (await loaded).buffer();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(hold => window.testHolds.has(hold), hold), true,
      'Prefetching slide 2 audio must not reset the cover deadline');
  } finally { await page.close(); }
}

export async function checkNarrationDocument(source) {
  for (const [number, held] of [[20, false], [20, true], [3, false], [3, true]]) {
    const page = await openNarrationPage(source);
    try {
      await page.click('#play');
      await page.$eval('hyperframes-slideshow', (deck, number) => deck.controller.goToSlide(number - 1), number);
      await page.click('#play');
      await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
      await seekVoice(page, number === 3 ? 6 : 3);
      if (held) await page.click('#play');
      const before = await page.$eval('#narration', voice => voice.currentTime);
      await page.evaluateOnNewDocument(() => document.addEventListener('animationstart', event => {
        if (event.target.matches('.slide-ai')) event.target.getAnimations().forEach(animation => animation.pause());
      }));
      await page.evaluate(() => {
        window.replacementReady = false;
        const player = document.querySelector('hyperframes-player');
        player.addEventListener('ready', () => { window.replacementReady = true; }, { once: true });
        player.setAttribute('src', 'composition/index.html?document-replacement');
      });
      await page.waitForFunction(() => window.replacementReady);
      const frame = page.frames().find(frame => frame.url().includes('/composition/index.html'));
      await frame.waitForFunction(number => document.querySelector(`#slide-${String(number).padStart(2, '0')}`).hasAttribute('data-active'), { timeout: 2500 }, number);
      assert.equal(await page.$eval('#narration', voice => voice.paused), true, 'A replacement document must gate existing voice on its fresh entrance');
      assert.ok(await page.$eval('#narration', (voice, before) => voice.currentTime >= before && voice.currentTime < before + 1, before), 'Replacement preserves the current clip position');
      if (number === 3) assert.equal(await frame.$$eval('#slide-03 [data-visible]', nodes => nodes.length), 1, 'Replacement preserves fragment progress');
      const image = `#slide-${String(number).padStart(2, '0')} .slide-ai`;
      await frame.waitForFunction(image => document.querySelector(image).getAnimations().some(a => a.playState === 'paused'), {}, image);
      await frame.$eval(image, image => image.getAnimations().forEach(a => a.finish()));
      if (held) assert.equal(await page.$eval('#narration', voice => voice.paused), true, 'Replacement does not release Hold');
      else await page.waitForFunction(() => !document.querySelector('#narration').paused);
      assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), held ? 'manual' : 'auto');
    } finally { await page.close(); }
  }
}

export async function checkNarrationController(source) {
  const page = await openNarrationPage(source);
  try {
    await enterNarration(page);
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > .05);
    await page.$eval('#narration', voice => { voice.currentTime = 22; });
    await page.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.fragmentIndex === 0);
    const time = await page.$eval('#narration', voice => voice.currentTime);
    await page.$eval('hyperframes-slideshow', deck => {
      const previous = deck.controller;
      deck.bindController(new previous.constructor(previous.player, previous.show));
    });
    await page.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 1, { timeout: 2500 });
    assert.ok(await page.$eval('#narration', (voice, time) => !voice.paused && voice.currentTime >= time, time),
      'SDK controller replacement must not restart or lose active narration');
    await page.click('[data-hf-next]');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.fragmentIndex), 1,
      'Replacement controller must retain our one-reveal-per-input adapter');
    assert.equal(await page.$eval('#narration', voice => voice.paused), true);
  } finally { await page.close(); }
}

export async function checkNarrationPulse(source) {
  const page = await openNarrationPage(source);
  const frame = page.frames().find(frame => frame.url().includes('/composition/index.html'));
  const pulsing = () => frame.$eval('#audience-ai', image => image.getAnimations().some(animation =>
    animation.effect.getTiming().iterations === Infinity));
  const rest = () => frame.waitForFunction(() => {
    const image = document.querySelector('#audience-ai'), style = getComputedStyle(image);
    return !image.getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity) &&
      (!image.closest('.scene').hasAttribute('data-active') || (['none', '1'].includes(style.scale) && style.opacity === '0.8'));
  }, { timeout: 1500 });
  const seek = time => page.$eval('#narration', (voice, time) => new Promise(resolve => {
    voice.addEventListener('seeked', () => resolve(), { once: true }); voice.currentTime = time;
  }), time);
  try {
    await enterNarration(page);
    await page.waitForFunction(() => document.querySelector('#narration').currentTime > .1);
    await seek(85.5);
    await frame.waitForFunction(() => document.querySelector('#audience-ai').getAnimations().some(animation =>
      animation.effect.getTiming().iterations === Infinity), { timeout: 2500 });
    assert.equal(await pulsing(), true, 'The AI must gently pulse during audible narration');
    const samples = await frame.$eval('#audience-ai', image => {
      const animation = image.getAnimations().find(animation => animation.effect.getTiming().iterations === Infinity);
      animation.pause();
      const sample = time => {
        animation.currentTime = time;
        const box = image.getBoundingClientRect(), style = getComputedStyle(image);
        const panels = [...image.closest('.scene').querySelectorAll('.slide-title, [data-fragment]')];
        return { width: box.width, height: box.height, x: box.x + box.width / 2, y: box.y + box.height / 2,
          opacity: Number(style.opacity), filter: style.filter,
          clear: panels.every(panel => { const other = panel.getBoundingClientRect();
            return box.right <= other.left || box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom; }) };
      };
      const duration = animation.effect.getTiming().duration;
      const values = [sample(0), sample(duration / 2), sample(duration)];
      animation.play();
      return { duration, values };
    });
    const [base, peak, repeat] = samples.values;
    assert.ok(samples.duration >= 450 && samples.duration <= 700, 'Use the approved faster speaking pulse');
    assert.ok(base.width >= 104 && base.width <= 108 && base.opacity >= .94,
      'Speaking must remain visibly distinct from the idle 100px / 0.8-opacity state between peaks');
    assert.ok(peak.width >= 122 && peak.width <= 128 && peak.height > base.height && peak.opacity >= .99 && peak.opacity > base.opacity,
      'The speaking peak must have a clearly visible size and brightness boost');
    assert.ok(samples.values.every(sample => Math.abs(sample.x - 960) < .1 && Math.abs(sample.y - 540) < .1 && sample.filter === base.filter),
      'Pulse around the existing center without replacing its approved cyan halo');
    assert.ok(samples.values.every(sample => sample.clear), 'The stronger pulse must not overlap the heading or content panels');
    assert.ok(Math.abs(repeat.width - base.width) < .1 && Math.abs(repeat.opacity - base.opacity) < .01);

    await seek(48.2);
    await rest();
    assert.equal(await page.$eval('#narration', voice => voice.paused), false, 'A natural pause does not pause the recording');
    assert.equal(await page.$eval('#music', music => music.paused), false, 'Music must not cause a pulse during speech silence');
    await seek(85.5);
    assert.equal(await pulsing(), true, 'Pulsing resumes with speech after a long pause');
    await page.click('#play');
    await rest();
    await page.click('#play');
    await frame.waitForFunction(() => document.querySelector('#audience-ai').getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity));
    await page.click('[data-hf-mute]');
    await rest();
    assert.equal(await page.$eval('#narration', voice => voice.paused), false, 'Mute must not change voice timing');
    await page.click('[data-hf-mute]');
    await frame.waitForFunction(() => document.querySelector('#audience-ai').getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await rest();
    assert.equal(await page.$eval('#narration', voice => voice.paused), false, 'Reduced motion must not interrupt narration');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await seek(85.5);
    await frame.waitForFunction(() => document.querySelector('#audience-ai').getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity));
    await seek(await page.$eval('#narration', voice => voice.duration - .03));
    await page.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 2, { timeout: 2500 }).catch(async error => {
      error.message += JSON.stringify(await page.evaluate(() => {
        const v=document.querySelector('#narration'),d=document.querySelector('hyperframes-slideshow'),doc=document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
        return {position:d.controller.position,mode:d.dataset.mode,time:v.currentTime,duration:v.duration,ended:v.ended,paused:v.paused,ready:doc.querySelector('#slide-02').hasAttribute('data-fragments-ready'),transition:doc.querySelector('#slide-transition')?.hidden,status:document.querySelector('#status').textContent};
      })); throw error;
    });
    await rest();
    await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(1));
    await page.click('#play');
    await frame.waitForFunction(() => document.querySelector('#audience-ai').getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity));
    await page.click('#exit');
    await rest();
    await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(2));
    assert.equal(await frame.$$eval('.slide-ai', images => images.some(image => image.getAnimations()
      .some(animation => animation.effect.getTiming().iterations === Infinity))), false, 'No pulse may leak onto another slide');
  } finally { await page.close(); }

  const data = JSON.parse(await readFile(new URL('assets/voice/slide-2.json', import.meta.url), 'utf8'));
  const invalid = await openNarrationPage(source, () => request => new URL(request.url()).pathname === '/assets/voice/slide-2.json'
    ? request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...data, speech: [null] }) })
    : request.continue());
  try {
    await enterNarration(invalid);
    await invalid.waitForFunction(() => document.querySelector('#narration').currentTime > .1);
    assert.equal(await invalid.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'auto', 'Invalid optional pulse data must not break narration');
    const iframe = invalid.frames().find(frame => frame.url().includes('/composition/index.html'));
    assert.equal(await iframe.$eval('#audience-ai', image => image.getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity)), false);
  } finally { await invalid.close(); }

  const detached = await openNarrationPage(source);
  try {
    await enterNarration(detached);
    await detached.waitForFunction(() => document.querySelector('#narration').currentTime > .1);
    await detached.$eval('#narration', voice => { voice.currentTime = 85.5; });
    const iframe = detached.frames().find(frame => frame.url().includes('/composition/index.html'));
    await iframe.waitForFunction(() => document.querySelector('#audience-ai').getAnimations().some(animation =>
      animation.effect.getTiming().iterations === Infinity));
    const result = await detached.evaluate(() => {
      const errors = [], capture = event => { errors.push(event.message); event.preventDefault(); };
      window.addEventListener('error', capture);
      const frame = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe');
      const image = frame.contentDocument.querySelector('#audience-ai');
      frame.remove();
      document.querySelector('#narration').dispatchEvent(new Event('volumechange'));
      window.removeEventListener('error', capture);
      return { errors, detached: image.ownerDocument.defaultView === null };
    });
    assert.equal(result.detached, true, 'Exercise an actual discarded composition document');
    assert.deepEqual(result.errors, [], 'Discarding the composition must clean up its pulse without throwing');
  } finally { await detached.close(); }
}
