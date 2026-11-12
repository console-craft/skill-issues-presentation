import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import puppeteer from '/Applications/HyperFrames.app/Contents/Resources/app.asar.unpacked/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { checkTransitionShaders } from './shader-smoke.mjs';
import { checkAudience, checkAudienceSync } from './audience-smoke.mjs';
import { checkUnderstanding } from './understanding-smoke.mjs';
import { checkModels } from './models-smoke.mjs';
import { checkADE } from './ade-smoke.mjs';
import { checkRemote } from './remote-smoke.mjs';
import { checkEditing } from './editing-smoke.mjs';
import { checkFrameworks } from './frameworks-smoke.mjs';
import { checkRecap } from './recap-smoke.mjs';
import { checkNarrationAssets, checkNarration } from './narration-smoke.mjs';
import { checkInteriorTypography, interiorTitles } from './typography-smoke.mjs';
import { checkSkillCard } from './skill-card-smoke.mjs';
import { checkInstallSlide } from './install-slide-smoke.mjs';

await checkNarrationAssets();

const root = fileURLToPath(new URL('.', import.meta.url));
const index = await readFile(resolve(root, 'index.html'), 'utf8').catch(() => '');
assert.ok(index.includes('hyperframes-slideshow'), 'The output must contain a playable HyperFrames deck');
const manifest = html => JSON.parse(html.match(/<script type="application\/hyperframes-slideshow\+json">([\s\S]*?)<\/script>/)[1]);
assert.equal(manifest(index).slides.length, 21, 'Twenty presentation slides plus the manual epilogue');
assert.deepEqual(manifest(index).slides.at(-1), { sceneId: 'slide-21', autoplay: false });
assert.deepEqual(manifest(index), manifest(await readFile(resolve(root, 'composition/index.html'), 'utf8')));
const panelOutlines = await Promise.all([1, 2, 3, 4].map(async number => {
  const artwork = await readFile(resolve(root, `../artwork/control-panel/shape${number}.svg`), 'utf8');
  return artwork.match(/class="outline" d="([^"]+)"/)[1];
}));

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const server = createServer(async (request, response) => {
  const path = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
  if (path !== root.slice(0, -1) && !path.startsWith(root)) { response.writeHead(403).end(); return; }
  try {
    const file = path === root.slice(0, -1) ? resolve(root, 'index.html') : path;
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const slide = () => page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex);
const mode = () => page.$eval('hyperframes-slideshow', deck => deck.dataset.mode);
const musicTime = () => page.$eval('#music', music => music.currentTime);
const expectedTransitions = new Map([[1, 'whip'], [2, 'whip'], [3, 'whip'], [4, 'crt'], [5, 'plunge'], [6, 'plunge'], [7, 'crt'], [8, 'whip'], [9, 'whip'], [10, 'signal'], [11, 'signal'], [12, 'plunge'], [13, 'plunge'], [14, 'signal'], [15, 'plunge'], [16, 'plunge'], [17, 'whip'], [18, 'whip'], [19, 'crt']]);
try {
  await page.setViewport({ width: 1920, height: 1080 });
  // Full visual fixtures load 217 MiB of GIFs, including while the live audition is open.
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('#play').disabled);
  await checkNarration(page);
  const frame = page.frames().find(frame => frame.url().includes('/composition/index.html'));
  assert.ok(frame, 'The slide composition must load');
  assert.ok(await frame.$('#slide-01 .title-lockup'), 'Slide 1 must show the presentation title');
  await frame.evaluate(() => document.fonts.ready);
  await checkInstallSlide(page, frame);
  await checkSkillCard(page, frame);
  await checkInteriorTypography(page, frame);
  await checkRecap(page, frame);
  await checkFrameworks(page, frame);
  await checkEditing(page, frame);
  await checkRemote(page, frame);
  await checkADE(page, frame);
  await checkModels(page, frame);
  await checkUnderstanding(page, frame);
  await checkAudienceSync(page);
  await checkAudience(page, frame);
  const aiSlides = [2, 3, 4, 5, 6, 7, 8, 19, 20].map(number => `slide-${String(number).padStart(2, '0')}`);
  assert.deepEqual(await frame.$$eval('img[src="assets/ai-talking.gif"]', images => images.map(image => image.closest('.scene').id)),
    aiSlides, 'Only slides 2–8 and 19–20 must contain the centered AI GIF, once each');
  for (const id of aiSlides) {
    await page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), Number(id.slice(-2)) - 1);
    const ai = await frame.$eval(`#${id} .slide-ai`, image => {
      image.getAnimations().forEach(animation => animation.finish());
      const box = image.getBoundingClientRect(), style = getComputedStyle(image);
      return { x: box.x, y: box.y, width: box.width, height: box.height, opacity: style.opacity,
        cyanGlow: style.filter.includes('rgb(32, 199, 255)'),
        visible: image.checkVisibility({ visibilityProperty: true, opacityProperty: true }) };
    });
    assert.deepEqual(ai, { x: 910, y: 490, width: 100, height: 100, opacity: '0.8', cyanGlow: true, visible: true },
      `${id} must show the same centered, translucent AI and cyan glow`);
    assert.equal(await frame.$$eval('.scene:not([data-active]) .slide-ai', images => images.some(image =>
      image.checkVisibility({ visibilityProperty: true, opacityProperty: true }))), false, 'AI must stay hidden on inactive slides');
  }
  const closingOffsets = await frame.$eval('#slide-20', scene => {
    const title = scene.querySelector('.title-subtitle');
    const elements = [title, scene.querySelector('h1'), scene.querySelector('.title-footer'), scene.querySelector('.slide-ai')];
    const shifted = elements.map(element => element.getBoundingClientRect().top);
    title.style.top = '0px';
    const original = elements.map(element => element.getBoundingClientRect().top);
    title.style.removeProperty('top');
    return shifted.map((top, index) => top - original[index]);
  });
  assert.deepEqual(closingOffsets, [-40, 0, 0, 0], 'Move only the closing Thank You text up 40px total, keeping contacts and AI fixed');
  const headers = await frame.$$eval('.scene .slide-title', panels => panels.map(panel => ({ id: panel.closest('.scene').id, title: panel.querySelector('h2').textContent })));
  assert.deepEqual(headers, interiorTitles, 'Every interior slide must show its approved caption, without adding a panel to the intro or outro');
  const shapes = await frame.$$eval('.slide-title .outline', outlines => outlines.map(path => path.getAttribute('d')));
  assert.ok(new Set(shapes).size === 4 && shapes.every((shape, i) => panelOutlines.includes(shape) && (i === 0 || shape !== shapes[i - 1])), 'Use all four supplied shapes without repeating one on consecutive slides');
  assert.equal(await frame.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    return new Set(ids).size === ids.length;
  }), true, 'Every panel mask, gradient, and line group must have a unique ID');
  for (const { id } of interiorTitles) {
    await page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), Number(id.slice(-2)) - 1);
    const header = await frame.$eval(`#${id} .slide-title`, panel => {
      const entrance = panel.getAnimations().find(animation => animation.animationName === 'panel-appear');
      const single = entrance?.effect.getTiming().iterations === 1;
      entrance?.finish();
      const heading = panel.querySelector('h2');
      const range = document.createRange(); range.selectNodeContents(heading);
      const ink = range.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      const fill = getComputedStyle(panel.querySelector('.body'));
      const [red, green, blue] = fill.fill.match(/\d+/g).map(Number);
      return { single, color: getComputedStyle(heading).color, blue: getComputedStyle(panel.querySelector('.outline')).stroke,
        translucentBlue: blue > red * 2 && green > red * 1.5 && Number(fill.fillOpacity) >= .5 && Number(fill.fillOpacity) <= .8,
        visible: getComputedStyle(panel).opacity === '1' && heading.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
        fits: box.top === 24 && box.height === 136 && ink.left >= box.left + 90 && ink.right <= box.right - 90 && ink.top > box.top && ink.bottom < box.bottom,
        loops: [heading, panel.querySelector('.panel-flare')].every(element => element.getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity && animation.effect.getTiming().duration === 4000)) };
    });
    assert.deepEqual(header, { single: true, color: 'rgb(252, 238, 10)', blue: 'rgb(32, 199, 255)', translucentBlue: true, visible: true, fits: true, loops: true }, `${id} must preserve the compact header, use a translucent blue fill, fit its complete title, and run the same entrance and shine`);
  }
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  assert.equal(await frame.$$eval('.slide-title', panels => panels.reduce((count, panel) => count + panel.getAnimations({ subtree: true }).length, 0)), 0, 'All interior title effects must stop on the intro slide');
  assert.ok(await frame.$('#slide-02 .slide-title'), 'Slide 2 must have its draft title inside a control-panel header');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(1));
  const panelEntrance = await frame.$eval('#slide-02 .slide-title', panel => {
    const animation = panel.getAnimations().find(animation => animation.animationName === 'panel-appear');
    if (!animation) return null;
    const { duration, iterations } = animation.effect.getTiming();
    animation.pause();
    const samples = [0, duration / 2, duration, duration + 5000].map(time => {
      animation.currentTime = time;
      const box = panel.getBoundingClientRect();
      return { opacity: Number(getComputedStyle(panel).opacity), width: box.width, height: box.height, center: [box.x + box.width / 2, box.y + box.height / 2] };
    });
    animation.finish();
    return { duration, iterations, samples };
  });
  assert.ok(panelEntrance && panelEntrance.iterations === 1 && panelEntrance.duration <= 800, 'The whole title panel must have a brief, one-shot entrance');
  const [panelHidden, panelGrowing, panelFull, panelHeld] = panelEntrance.samples;
  assert.equal(panelHidden.opacity, 0);
  assert.equal(panelHidden.width, 0, 'The panel must grow from nothing');
  assert.ok(panelGrowing.opacity > 0 && panelGrowing.opacity < 1 && panelGrowing.width > 0 && panelGrowing.width < panelFull.width, 'The entrance must fade and scale together');
  assert.equal(panelFull.opacity, 1);
  assert.equal(panelFull.width, 1720, 'The entrance must settle at the approved panel size');
  assert.deepEqual(panelHeld, panelFull, 'The entrance must not repeat while the slide is held');
  assert.ok(panelEntrance.samples.every(sample => Math.abs(sample.center[0] - 960) < .01 && Math.abs(sample.center[1] - 92) < .01), 'The compact panel must grow around its center');
  const audience = await frame.$eval('#slide-02 .slide-title', panel => {
    const heading = panel.querySelector('h2');
    const svg = panel.querySelector('svg');
    const box = panel.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(heading);
    const ink = range.getBoundingClientRect();
    return { text: heading.textContent, color: getComputedStyle(heading).color,
      strokes: [...svg.querySelectorAll('path')].map(path => getComputedStyle(path).stroke).filter(stroke => stroke !== 'none'),
      decorative: svg.getAttribute('aria-hidden') === 'true', visible: heading.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
      top: box.top >= 16 && box.bottom <= 180 && box.left >= 80 && box.right <= 1840 && box.height <= 140 && parseFloat(getComputedStyle(heading).fontSize) < 96,
      fits: ink.left > box.left && ink.right < box.right && ink.top > box.top && ink.bottom < box.bottom };
  });
  assert.equal(audience.text, 'Audience');
  assert.equal(audience.color, 'rgb(252, 238, 10)', 'The header text must use the cover’s yellow');
  assert.ok(audience.strokes.length > 0 && audience.strokes.every(stroke => stroke === 'rgb(32, 199, 255)'), 'Every panel line must use the cover’s bright blue');
  assert.ok(audience.decorative && audience.visible && audience.top && audience.fits, 'The title must be readable inside a decorative panel at the top of the slide');
  const panelShine = await frame.$$eval('#slide-02 .slide-title h2, #slide-02 .panel-flare', elements => elements.map(element => {
    const animation = element.getAnimations().find(animation => ['title-shine', 'frame-shine'].includes(animation.animationName));
    if (!animation) return null;
    const { duration, iterations } = animation.effect.getTiming();
    animation.pause();
    const positions = [.25, .75, 1.25].map(progress => {
      animation.currentTime = progress * duration;
      const style = getComputedStyle(element);
      return element.matches('rect') ? -new DOMMatrix(style.transform).m41 : parseFloat(style.backgroundPositionX);
    });
    return { duration, looping: iterations === Infinity, positions };
  }));
  assert.ok(panelShine.length === 2 && panelShine.every(shine => shine?.looping && shine.duration === 4000 && shine.positions[0] > shine.positions[1] && shine.positions[0] === shine.positions[2]), 'Frame and lettering must reuse the cover’s looping four-second left-to-right shine');
  for (const number of [2, 3, 4, 5]) {
    const id = `#slide-${String(number).padStart(2, '0')}`;
    await page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), number - 1);
    await frame.$eval(`${id} .slide-title`, panel => panel.getAnimations().find(animation => animation.animationName === 'panel-appear').finish());
    await frame.$eval(`${id} picture`, picture => picture.style.visibility = 'hidden');
    const panelPixels = [];
    for (const progress of [.35, .65]) {
      await frame.$$eval(`${id} .slide-title h2, ${id} .panel-flare`, (elements, progress) => {
        for (const element of elements) {
          const animation = element.getAnimations().find(animation => ['title-shine', 'frame-shine'].includes(animation.animationName));
          animation.pause();
          animation.currentTime = progress * 4000;
        }
      }, progress);
      const png = await (await frame.$(`${id} .slide-title`)).screenshot({ encoding: 'base64' });
      panelPixels.push(await frame.evaluate(async png => {
        const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, image.width, image.height);
        const parts = { frame: { count: 0, x: 0 }, text: { count: 0, x: 0 } };
        for (let i = 0; i < data.length; i += 4) {
          const y = Math.floor(i / 4 / image.width) / image.height;
          const edge = y < .16 || y > .84;
          // Thin frame strokes blend white into the blue base; letters have solid-white interiors.
          if (data[i] < (edge ? 60 : 235) || data[i + 1] < (edge ? 180 : 235) || data[i + 2] < (edge ? 220 : 235)) continue;
          const part = edge ? parts.frame : parts.text;
          part.count++; part.x += (i / 4) % image.width;
        }
        return Object.fromEntries(Object.entries(parts).map(([name, part]) => [name, { count: part.count, x: part.x / part.count }]));
      }, png));
    }
    assert.ok(['frame', 'text'].every(part => panelPixels.every(sample => sample[part].count > 10) && panelPixels[1][part].x > panelPixels[0][part].x + 40), `${id}: a rendered white flare must travel right across both the blue frame and yellow letters: ${JSON.stringify(panelPixels)}`);
    await frame.$eval(`${id} picture`, picture => picture.style.visibility = '');
  }
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  assert.equal(await frame.$eval('#slide-02 .slide-title', panel => panel.getAnimations({ subtree: true }).length), 0, 'Panel effects must stop while the slide is hidden');
  await page.setViewport({ width: 1600, height: 1000 });
  await page.waitForFunction(() => document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').getBoundingClientRect().width <= innerWidth);
  assert.ok(await frame.$('#title-next'), 'Slide 1 must have a label-only next-slide button');
  assert.ok(await frame.$('#slide-20 .title-lockup'), 'Slide 20 must have the matching closing-slide lockup');
  const glitch = await frame.$eval('.title-subtitle', subtitle => {
    const animation = subtitle.getAnimations().find(animation => animation.animationName === 'title-glitch');
    const pulse = subtitle.getAnimations().find(animation => animation.animationName === 'title-pulse');
    if (!animation || !pulse) return null;
    const running = animation.playState === 'running' && pulse.playState === 'running';
    const time = animation.currentTime;
    const { duration, iterations } = animation.effect.getTiming();
    animation.pause();
    pulse.pause();
    pulse.currentTime = 0;
    const sample = progress => {
      animation.currentTime = progress * duration;
      const box = subtitle.getBoundingClientRect();
      const blue = document.querySelector('#slide-01 h1').getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, blueX: blue.x, blueY: blue.y,
        words: [...subtitle.children].map(word => word.getBoundingClientRect().x) };
    };
    const samples = [.1, .312, .322, .5, 1.1, .762, .772].map(sample);
    animation.currentTime = 0;
    const pulseTiming = pulse.effect.getTiming();
    return { running, time, loops: iterations === Infinity && pulseTiming.iterations === Infinity && pulseTiming.duration === duration, samples };
  });
  assert.ok(glitch?.running && glitch.loops, 'The yellow title must have synchronized looping glitch and pulse animations');
  const [rest, left, right, pause, repeat, secondLeft, secondRight] = glitch.samples;
  assert.ok(left.x < rest.x && right.x > rest.x && secondLeft.x < rest.x && secondRight.x > rest.x, 'Each glitch burst must jump both left and right');
  assert.deepEqual(pause, rest, 'The title must rest between short glitch bursts');
  assert.deepEqual(repeat, rest, 'Each glitch cycle must return to the original position');
  assert.ok(glitch.samples.every(sample => sample.y === rest.y && sample.blueX === rest.blueX && sample.blueY === rest.blueY && sample.x >= 0 && sample.right <= 1920 &&
    sample.words.every((x, i) => x - rest.words[i] === sample.x - rest.x)), 'Both yellow words must shake together horizontally, stay on-canvas, and leave the blue line still');
  const pulse = await frame.$eval('.title-subtitle', subtitle => {
    const animation = subtitle.getAnimations().find(animation => animation.animationName === 'title-pulse');
    const duration = animation.effect.getTiming().duration;
    const samples = [.1, .31, .32, .34, .36, .5, .77, .81, 1.1].map(progress => {
      animation.currentTime = progress * duration;
      const box = subtitle.getBoundingClientRect();
      const blue = document.querySelector('#slide-01 h1').getBoundingClientRect();
      return { width: box.width, height: box.height, centerX: box.x + box.width / 2, centerY: box.y + box.height / 2,
        blueX: blue.x, blueY: blue.y, fits: box.left >= 16 && box.right <= 1904 && box.top >= 0 && box.bottom <= 1080 };
    });
    animation.currentTime = 0;
    return samples;
  });
  const [base, rising, peak, settle, reset, idle, secondPeak, secondReset, pulseRepeat] = pulse;
  assert.ok(peak.width > base.width * 1.01 && peak.width <= base.width * 1.04 && rising.width > base.width && rising.width < peak.width && settle.width < base.width, 'Each glitch must get a subtle eased scale bump and settle, not a stepped size jump');
  assert.deepEqual(secondPeak, peak, 'The second glitch burst must get the same pulse');
  for (const sample of [reset, idle, secondReset, pulseRepeat]) assert.deepEqual(sample, base, 'The pulse must return to the approved size between bursts');
  assert.ok(pulse.every(sample => sample.fits && Math.abs(sample.centerX - base.centerX) < .01 && Math.abs(sample.centerY - base.centerY) < .01 && sample.blueX === base.blueX && sample.blueY === base.blueY &&
    Math.abs(sample.width / base.width - sample.height / base.height) < .0001), 'The pulse must scale around the yellow group center, leave jitter room on-canvas, and keep the blue text still');
  const title = await frame.evaluate(() => {
    const heading = document.querySelector('#slide-01 h1');
    const subtitle = document.querySelector('#slide-01 .title-subtitle');
    const text = element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const bounds = range.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { text: element.innerText.replace(/\s+/g, ' ').trim(), lines: element.innerText.split('\n').filter(line => line.trim()),
        family: style.fontFamily, color: style.color, shadow: style.textShadow, size: parseFloat(style.fontSize), weight: Number(style.fontWeight), leading: parseFloat(style.lineHeight) / parseFloat(style.fontSize), tracking: parseFloat(style.letterSpacing),
        fits: bounds.left >= 100 && bounds.right <= 1820 && bounds.top >= 80 && bounds.bottom <= 1000,
        insideBox: bounds.top >= box.top && bounds.bottom <= box.bottom,
        topmost: element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
    };
    return { heading: text(heading), subtitle: text(subtitle), wordSizes: [...subtitle.children].map(word => parseFloat(getComputedStyle(word).fontSize)),
      leadGap: subtitle.getBoundingClientRect().top - heading.getBoundingClientRect().bottom,
      rowStep: subtitle.children[1].getBoundingClientRect().top - subtitle.children[0].getBoundingClientRect().top,
      fonts: [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family) };
  });
  assert.equal(title.heading.text, "If you're still reading the code, you have");
  assert.equal(title.subtitle.text, 'skill issues');
  assert.equal(title.heading.lines.length, 1, 'The blue lead-in must stay on one line');
  assert.ok(title.heading.size < 86 && title.heading.weight <= 300, 'The lead-in must be smaller and lighter');
  assert.deepEqual(title.subtitle.lines, ['skill', 'issues'], 'The yellow punchline must occupy two separate rows');
  assert.equal(title.subtitle.size, 585, 'The yellow title must be exactly 50% larger than 390px');
  assert.deepEqual(title.wordSizes, [585, 438.75], 'Keep skill at 585px and make only issues 25% smaller');
  assert.ok(title.leadGap >= 48, 'Leave more breathing room below the blue lead-in');
  assert.ok(title.rowStep < 350, 'Bring the yellow rows closer than the previous 374px step');
  assert.ok(title.subtitle.leading < .8 && title.subtitle.tracking < 0, 'The enlarged title must keep tight rows and tighter letter spacing');
  assert.ok(title.heading.family.includes('Saira') && title.fonts.includes('Saira'), 'The local Saira font must load');
  assert.ok(title.subtitle.family.includes('Cyberpunk') && title.fonts.includes('Cyberpunk'), 'The local Cyberpunk font must load');
  assert.equal(title.heading.color, 'rgb(32, 199, 255)');
  assert.ok(title.heading.shadow.includes('255, 255, 255'), 'The blue lead-in must have a white glow without changing its blue fill');
  assert.equal(title.subtitle.color, 'rgb(252, 238, 10)');
  assert.ok(title.heading.fits && title.subtitle.fits, 'All title text must fit inside the slide safe area');
  assert.ok(title.subtitle.insideBox, 'Tight leading must not clip the font above or below its gradient box');
  assert.ok(title.heading.topmost, 'The padded reflection layer must not cover the blue lead-in');
  const arrowStyle = () => frame.$eval('#title-next', button => {
    const style = getComputedStyle(button);
    const box = button.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(button);
    const label = range.getBoundingClientRect();
    return { label: button.textContent, name: button.getAttribute('aria-label'), color: style.color, glow: style.filter,
      background: style.backgroundColor, clip: style.backgroundClip, border: style.borderWidth, outline: style.outlineStyle, boxShadow: style.boxShadow, opacity: style.opacity,
      inkFits: label.top >= box.top && label.bottom <= box.bottom,
      fits: box.top >= document.querySelector('.title-subtitle').getBoundingClientRect().bottom && box.bottom <= 1030 && Math.abs(box.x + box.width / 2 - 960) < 1 };
  });
  // Puppeteer's iframe click coordinates omit the player's presentation scaling.
  const arrowPoint = () => page.evaluate(() => {
    const iframe = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe');
    const stage = iframe.getBoundingClientRect();
    const button = iframe.contentDocument.querySelector('#title-next').getBoundingClientRect();
    return { x: stage.x + (button.x + button.width / 2) * stage.width / iframe.contentWindow.innerWidth,
      y: stage.y + (button.y + button.height / 2) * stage.height / iframe.contentWindow.innerHeight };
  });
  const normalArrow = await arrowStyle();
  assert.equal(normalArrow.label, '>>>>>>');
  assert.equal(normalArrow.name, 'Next slide');
  assert.ok(normalArrow.glow.includes('255, 255, 255'), 'The arrow must keep its white glow around the clipped shine');
  assert.ok(normalArrow.fits, 'Center the arrow below the yellow text without clipping it');
  assert.ok(normalArrow.inkFits, 'Keep the arrow font bounds inside its gradient paint box');
  await frame.focus('#title-next');
  await page.keyboard.press('Shift');
  const focusedArrow = await arrowStyle();
  assert.equal(await frame.$eval('#title-next', button => button.matches(':focus-visible')), true);
  assert.notEqual(focusedArrow.glow, normalArrow.glow, 'Keyboard focus must be visible through the label glow, not a button box');
  await frame.$eval('#title-next', button => button.blur());
  const hoverPoint = await arrowPoint();
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  assert.equal(await frame.$eval('#title-next', button => button.matches(':hover')), true);
  const hoveredArrow = await arrowStyle();
  await page.mouse.down();
  const pressedState = await frame.$eval('#title-next', button => ({ active: button.matches(':active'), hover: button.matches(':hover'),
    disabled: button.disabled, focused: document.activeElement?.id, box: button.getBoundingClientRect().toJSON() }));
  assert.equal(pressedState.active, true, `The cover arrow must remain active while held: ${JSON.stringify(pressedState)}`);
  const pressedArrow = await arrowStyle();
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  await frame.$eval('#title-next', button => { button.blur(); button.disabled = true; });
  const disabledArrow = await arrowStyle();
  await frame.$eval('#title-next', button => button.disabled = false);
  for (const style of [normalArrow, focusedArrow, hoveredArrow, pressedArrow, disabledArrow]) {
    assert.equal(style.color, 'rgb(255, 32, 216)');
    assert.deepEqual([style.background, style.clip, style.border, style.outline, style.boxShadow, style.opacity], ['rgba(0, 0, 0, 0)', 'text', '0px', 'none', 'none', '1'], 'Only the arrow label may be visible in every button state');
  }
  const arrowShine = await frame.$eval('#title-next', button => {
    const animation = button.getAnimations().find(animation => animation.animationName === 'title-shine');
    if (!animation) return null;
    const time = animation.currentTime;
    const { duration, iterations } = animation.effect.getTiming();
    animation.currentTime = duration * .25;
    const left = parseFloat(getComputedStyle(button).backgroundPositionX);
    animation.currentTime = duration * .75;
    const right = parseFloat(getComputedStyle(button).backgroundPositionX);
    animation.currentTime = time;
    return { left, right, duration, looping: iterations === Infinity && animation.playState === 'running' };
  });
  assert.ok(arrowShine?.looping && arrowShine.duration === 4000 && arrowShine.left > arrowShine.right, 'The arrow must reuse the title’s four-second left-to-right shine');
  const shine = await frame.$eval('.title-subtitle', subtitle => {
    const animation = subtitle.getAnimations().find(animation => animation.animationName === 'title-shine');
    if (!animation) return null;
    const time = animation.currentTime;
    const duration = animation.effect.getTiming().duration;
    const sample = progress => {
      animation.currentTime = progress * duration;
      return parseFloat(getComputedStyle(subtitle).backgroundPositionX);
    };
    const result = { running: animation.playState === 'running', loops: animation.effect.getTiming().iterations === Infinity,
      left: sample(.25), right: sample(.75), repeat: sample(1.25), clip: getComputedStyle(subtitle).backgroundClip };
    animation.currentTime = time;
    return result;
  });
  assert.ok(shine?.running && shine.loops, 'The title shine must loop while slide 1 is visible, even before Start');
  assert.ok(shine.left > shine.right, 'The oversized gradient must move from left to right');
  assert.equal(shine.left, shine.repeat, 'Each shine pass must repeat the same sweep');
  assert.equal(shine.clip, 'text', 'The reflection must stay inside the letter shapes');
  await frame.$eval('#slide-01 picture', picture => picture.style.visibility = 'hidden');
  const shineTime = await frame.$eval('.title-subtitle', subtitle => subtitle.getAnimations().find(animation => animation.animationName === 'title-shine').currentTime);
  const shinePixels = [];
  for (const progress of [.35, .65]) {
    await frame.$eval('.title-subtitle', (subtitle, progress) => {
      const animation = subtitle.getAnimations().find(animation => animation.animationName === 'title-shine');
      animation.pause();
      animation.currentTime = progress * animation.effect.getTiming().duration;
    }, progress);
    const png = await (await frame.$('.title-subtitle')).screenshot({ encoding: 'base64' });
    shinePixels.push(await frame.evaluate(async png => {
      const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, image.width, image.height);
      let yellow = 0, white = 0, whiteX = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 230 && data[i + 1] > 200 && data[i + 2] < 80) yellow++;
        if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) { white++; whiteX += (i / 4) % image.width; }
      }
      return { yellow, white, whiteX: whiteX / white };
    }, png));
  }
  await frame.$eval('#slide-01 picture', picture => picture.style.visibility = '');
  await frame.$eval('.title-subtitle', (subtitle, time) => { const animation = subtitle.getAnimations().find(animation => animation.animationName === 'title-shine'); animation.currentTime = time; animation.play(); }, shineTime);
  assert.ok(shinePixels.every(sample => sample.yellow > 30000 && sample.white > 1000), 'The rendered letters must stay bright yellow with a visible white reflection, not dark shadow-filled outlines');
  assert.ok(shinePixels[1].whiteX > shinePixels[0].whiteX + 200, 'The rendered white highlight must travel right across the letters');
  await frame.$eval('.title-subtitle', (subtitle, time) => {
    for (const animation of subtitle.getAnimations().filter(animation => ['title-glitch', 'title-pulse'].includes(animation.animationName))) { animation.currentTime = time; animation.play(); }
  }, glitch.time);
  const lockupStyles = id => frame.$eval(`#${id} .title-lockup`, lockup => [lockup.querySelector('h1'), lockup.querySelector('.title-subtitle'), lockup.querySelector('.title-footer')].map(element => {
    const style = getComputedStyle(element);
    return Object.fromEntries(['font', 'letterSpacing', 'color', 'textShadow', 'filter', 'backgroundImage', 'backgroundClip', 'animationName', 'animationDuration', 'animationTimingFunction'].map(key => [key, style[key]]));
  }));
  const openingStyles = await lockupStyles('slide-01');
  const finishClosingNarration = async () => {
    if (await mode() === 'idle') {
      await page.click('#play');
      await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(19));
    }
    await page.click('#play');
    await page.waitForFunction(() => !document.querySelector('#narration').paused);
    await page.$eval('#narration', voice => { voice.currentTime = voice.duration - .08; });
    await page.waitForFunction(() => document.querySelector('#narration').ended);
  };
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(19));
  const fades = await frame.$$eval('#slide-20 .closing-appear', elements => {
    if (elements.length !== 2) return null;
    return elements.map(element => {
      const animation = element.getAnimations().find(animation => animation.animationName === 'closing-appear');
      if (!animation) return null;
      const timing = animation.effect.getTiming();
      animation.pause();
      const samples = [0, 500, 1000, 8000].map(time => { animation.currentTime = time; return Number(getComputedStyle(element).opacity); });
      return { samples, single: timing.iterations === 1 && timing.duration === 1000 };
    });
  });
  assert.ok(fades?.every(fade => fade?.single && fade.samples[0] === 0 && fade.samples[1] > 0 && fade.samples[1] < 1 && fade.samples[2] === 1 && fade.samples[3] === 1), 'The closing handle and website must fade from hidden to visible once over one second');
  await finishClosingNarration();
  const typing = await frame.$eval('#slide-20 .title-subtitle', title => {
    const letters = [...title.querySelectorAll('.type-letter')];
    const animations = title.getAnimations({ subtree: true }).filter(animation => animation.animationName === 'letter-type');
    if (animations.length !== 9) return null;
    for (const animation of animations) animation.pause();
    const rowBounds = () => [...title.children].map(row => row.getBoundingClientRect().width);
    const before = rowBounds();
    const samples = [0, 990, 1010, 1170, 1330, 1490, 1650, 1810, 1970, 2130, 2290, 8000].map(time => {
      for (const animation of animations) animation.currentTime = time;
      return letters.filter(letter => getComputedStyle(letter).visibility === 'visible').map(letter => letter.textContent).join('');
    });
    return { samples, single: animations.every(animation => animation.effect.getTiming().iterations === 1), stable: JSON.stringify(before) === JSON.stringify(rowBounds()), accessible: title.getAttribute('aria-label') };
  });
  assert.ok(typing?.single && typing.stable, 'The closing title must type once without moving its layout');
  assert.deepEqual(typing.samples, ['', '', 'T', 'Th', 'Tha', 'Than', 'Thank', 'ThankY', 'ThankYo', 'ThankYou', 'ThankYou!', 'ThankYou!']);
  assert.equal(typing.accessible, 'Thank You!', 'Assistive technology must get the complete phrase immediately');
  const closing = await frame.$eval('#slide-20 .title-lockup', lockup => {
    const animations = lockup.getAnimations({ subtree: true });
    const effects = animations.filter(animation => !['letter-type', 'closing-appear'].includes(animation.animationName));
    const running = effects.length === 4 && effects.every(animation => animation.playState === 'running');
    for (const animation of animations) { animation.pause(); animation.currentTime = ['letter-type', 'closing-appear'].includes(animation.animationName) ? 4000 : 0; }
    const elements = [lockup.querySelector('h1'), ...lockup.querySelectorAll('.title-subtitle > span'), lockup.querySelector('.title-footer')];
    const fits = elements.every(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      const box = range.getBoundingClientRect();
      return box.left >= 80 && box.right <= 1840 && box.top >= 0 && box.bottom <= 1080;
    });
    const footer = lockup.querySelector('.title-footer');
    return { blue: elements[0].innerText, yellow: elements.slice(1, 3).map(element => element.innerText), magenta: footer.innerText,
      sizes: elements.slice(1, 3).map(element => parseFloat(getComputedStyle(element).fontSize)), running, fits,
      plainText: !footer.matches('button,a,[role="button"],[role="link"]') && footer.tabIndex === -1 && getComputedStyle(footer).cursor !== 'pointer' };
  });
  assert.equal(closing.blue, '@ovi_ispas');
  assert.deepEqual(closing.yellow, ['Thank', 'You!']);
  assert.equal(closing.magenta, 'console-craft.com');
  assert.deepEqual(closing.sizes, [480, 360], 'The closing-only fit must leave room for Cyberpunk’s capital glyphs');
  assert.ok(closing.plainText, 'The closing website must be plain text, not a button or link');
  assert.ok(closing.running && closing.fits, 'The closing slide must run all four text effects without clipping');
  const closingStyles = await lockupStyles('slide-20');
  assert.deepEqual(closingStyles[0], openingStyles[0], 'The closing contact line must keep the opening blue-text style');
  assert.deepEqual(closingStyles[2], openingStyles[2], 'The non-button website must keep the opening magenta-text style');
  const { font: openingFont, letterSpacing: openingTracking, ...openingEffects } = openingStyles[1];
  const { font: closingFont, letterSpacing: closingTracking, ...closingEffects } = closingStyles[1];
  assert.ok(closingFont.includes('Cyberpunk') && openingFont.includes('Cyberpunk'));
  assert.deepEqual(closingEffects, openingEffects, 'The closing yellow words must keep the same color, glow, shine, glitch and pulse');
  await frame.$eval('#slide-20 .title-footer', footer => footer.click());
  assert.equal(await slide(), 19, 'The closing website must not navigate');
  assert.equal(await frame.$eval('#slide-01 .title-lockup', lockup => lockup.getAnimations({ subtree: true }).length), 0);
  await frame.$eval('#slide-20', scene => {
    window.previousClosingEntrances = new Map([...scene.querySelectorAll('.type-letter, .closing-appear')].map(node =>
      [node, node.getAnimations().find(animation => ['letter-type', 'closing-appear'].includes(animation.animationName))]));
  });
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  assert.equal(await frame.$eval('#slide-20 .title-lockup', lockup => lockup.getAnimations({ subtree: true }).length), 0, 'Closing effects must stop when its slide is hidden');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(19));
  assert.equal(await frame.$$eval('#slide-20 .type-letter', letters => letters.every(letter => getComputedStyle(letter).visibility === 'hidden' && letter.getAnimations().length === 0)), true, 'Revisiting waits for the closing voice again');
  await finishClosingNarration();
  assert.equal(await frame.$$eval('#slide-20 .type-letter', letters => letters.every(letter => {
    const animation = letter.getAnimations().find(animation => animation.animationName === 'letter-type');
    return animation && animation !== window.previousClosingEntrances.get(letter);
  })), true, 'Typing must start fresh after narration on a later visit to slide 20');
  assert.equal(await frame.$$eval('#slide-20 .closing-appear', elements => elements.every(element =>
    element.getAnimations().some(animation => animation.animationName === 'closing-appear' && animation !== window.previousClosingEntrances.get(element)))), true, 'The contact fades must restart on a later visit');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  await page.click('#play');
  await page.waitForFunction(() => document.querySelector('hyperframes-slideshow').dataset.mode === 'auto');
  await page.click('#play');
  const arrival = await page.evaluate(() => new Promise(resolve => {
    const deck = document.querySelector('hyperframes-slideshow');
    const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
    deck.controller.goToSlide(18);
    for (let step = 0; step < 9; step++) deck.controller.next();
    deck.controller.next();
    const stage = doc.querySelector('#slide-transition');
    const start = performance.now();
    const result = { hadTransition: !stage.hidden, early: '', landed: '', earlyFade: false, landedOpacity: [] };
    const sample = () => {
      const text = [...doc.querySelectorAll('#slide-20 .type-letter')].filter(letter => doc.defaultView.getComputedStyle(letter).visibility === 'visible').map(letter => letter.textContent).join('');
      const opacity = [...doc.querySelectorAll('#slide-20 .closing-appear')].map(element => Number(doc.defaultView.getComputedStyle(element).opacity));
      if (stage.hidden || performance.now() - start > 4000) { result.landed = text; result.landedOpacity = opacity; resolve(result); return; }
      if (text && !result.early) result.early = text;
      if (opacity.some(value => value > 0)) result.earlyFade = true;
      requestAnimationFrame(sample);
    };
    sample();
  }));
  assert.ok(arrival.hadTransition, 'Exercise the real CRT transition into slide 20');
  assert.equal(arrival.early, '', 'No closing letters may type while the CRT transition is still visible');
  assert.equal(arrival.landed, '', 'The closing reveal must begin fresh after the transition finishes');
  assert.equal(arrival.earlyFade, false, 'The handle and website must remain invisible throughout the transition');
  assert.deepEqual(arrival.landedOpacity, [0, 0], 'Both one-second fades must begin only after the transition clears');
  await frame.waitForFunction(() => [...document.querySelectorAll('#slide-20 .closing-appear')].every(element => getComputedStyle(element).opacity === '1'), { timeout: 2000 });
  assert.equal(await frame.$$eval('#slide-20 .type-letter', letters => letters.every(letter => getComputedStyle(letter).visibility === 'hidden')), true, 'Manual arrival must not reveal Thank You before narration completes');
  for (const from of [0, 2]) {
    const entrance = await page.evaluate(from => new Promise(resolve => {
      const deck = document.querySelector('hyperframes-slideshow');
      const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
      deck.controller.goToSlide(from);
      from === 0 ? deck.controller.next() : deck.controller.prev();
      const stage = doc.querySelector('#slide-transition');
      const panel = doc.querySelector('#slide-02 .slide-title');
      const result = { transition: !stage.hidden, early: false, landedOpacity: null };
      const sample = () => {
        const opacity = Number(doc.defaultView.getComputedStyle(panel).opacity);
        if (stage.hidden) { result.landedOpacity = opacity; resolve(result); return; }
        if (opacity > 0 || panel.getAnimations({ subtree: true }).length) result.early = true;
        requestAnimationFrame(sample);
      };
      sample();
    }), from);
    assert.ok(entrance.transition && !entrance.early && entrance.landedOpacity === 0, 'The entire title must stay hidden and idle until the incoming transition clears, forward and backward');
    await frame.waitForFunction(() => document.querySelector('#slide-02 .slide-title').getAnimations().some(animation => animation.animationName === 'panel-appear' && animation.playState === 'finished'));
    assert.equal(await frame.$eval('#slide-02 .slide-title', panel => panel.getAnimations().find(animation => animation.animationName === 'panel-appear').playState), 'finished', 'Each visit must finish one entrance, not loop it');
  }
  await page.click('#exit');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  await checkTransitionShaders(frame);
  const transition = () => frame.evaluate(() => {
    const canvas = document.querySelector('#slide-transition');
    return canvas ? { visible: !canvas.hidden, effect: canvas.dataset.effect } : null;
  });
  const settled = () => frame.waitForFunction(() => document.querySelector('#slide-transition')?.hidden !== false);
  assert.equal(await slide(), 0);
  assert.equal(await mode(), 'idle');
  assert.equal(await page.$eval('#music', music => music.paused), true, 'Music waits for Start');
  for (const key of ['Enter', 'Space']) {
    await frame.focus('#title-next');
    await page.keyboard.press(key);
    assert.equal(await slide(), 1, `The arrow must advance exactly one slide with ${key}`);
    await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  }
  await page.$eval('hyperframes-slideshow', deck => deck.controller.prev());
  assert.equal(await slide(), 0, 'Previous holds on the first slide');
  await page.$eval('hyperframes-slideshow', deck => deck.requestFullscreen());
  assert.equal(await page.$eval('#play', button => document.fullscreenElement.contains(button)), true, 'Playback controls must remain available in fullscreen');
  await page.evaluate(() => document.exitFullscreen());

  await page.click('#play');
  await page.waitForFunction(() => document.querySelector('#music').currentTime > .1);
  const titleBounds = await frame.$eval('.title-lockup', title => title.getBoundingClientRect().toJSON());
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.deepEqual(await frame.$eval('.title-lockup', title => title.getBoundingClientRect().toJSON()), titleBounds, 'The title layout must stay fixed while its background moves');
  await page.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 1, { timeout: 7000 });
  assert.deepEqual(await transition(), { visible: true, effect: 'whip' }, 'Autoplay must use Neon Whip after slide 1');
  await settled();
  assert.equal(await frame.$eval('.title-lockup', title => title.checkVisibility({ visibilityProperty: true, opacityProperty: true })), false, 'The title must not leak onto slide 2');
  assert.equal(await frame.$eval('.title-subtitle', subtitle => subtitle.getAnimations().length), 0, 'Shine, glitch and pulse must stop on hidden slides');
  assert.equal(await frame.$eval('#title-next', button => button.getAnimations().length), 0, 'The arrow shine must stop on hidden slides');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  const beforeArrow = await musicTime();
  const clickPoint = await arrowPoint();
  await page.mouse.click(clickPoint.x, clickPoint.y);
  assert.equal(await slide(), 1, 'Clicking the title arrow must advance exactly one slide');
  assert.deepEqual(await transition(), { visible: true, effect: 'whip' }, 'The arrow must use the existing slide transition');
  assert.equal(await mode(), 'manual');
  assert.ok(await musicTime() >= beforeArrow, 'The arrow must not restart music');
  await settled();
  const beforeNavigation = await musicTime();
  await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 9; step++) deck.controller.next(); });
  await page.keyboard.press('ArrowRight');
  assert.equal(await slide(), 2);
  assert.deepEqual(await transition(), { visible: true, effect: 'whip' }, 'Neon Whip must connect slides 2 and 3');
  assert.equal(await mode(), 'manual', 'Manual navigation holds autoplay');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await slide(), 1);
  assert.ok(await musicTime() >= beforeNavigation, 'Navigation must not reset the music');
  await new Promise(resolve => setTimeout(resolve, 5200));
  assert.equal(await slide(), 1, 'Cancelled autoplay must not advance later');
  assert.equal(await page.$eval('#music', music => music.paused), false, 'Music continues during manual holds');
  const foregroundBefore = await frame.$eval('#slide-02 .slide-title', panel => panel.getBoundingClientRect().toJSON());
  const beforeMotion = await frame.$eval('#slide-02 > picture img', image => getComputedStyle(image).transform);
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.notEqual(await frame.$eval('#slide-02 > picture img', image => getComputedStyle(image).transform), beforeMotion, 'Background framing must keep moving while the slide is held manually');
  assert.deepEqual(await frame.$eval('#slide-02 .slide-title', panel => panel.getBoundingClientRect().toJSON()), foregroundBefore, 'The title panel must stay stationary while the background moves');

  // Autoplay uses Neon Whip before slide 4 and CRT Blackout after it.
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(2));
  await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 4; step++) deck.controller.next(); });
  await page.click('#play');
  await page.waitForFunction(() => !document.querySelector('#narration').paused);
  await page.$eval('#narration', voice => { voice.currentTime = voice.duration - .08; });
  await page.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 3, { timeout: 7000 });
  assert.deepEqual(await transition(), { visible: true, effect: 'whip' }, 'Neon Whip must connect slides 3 and 4');
  await settled();
  await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 6; step++) deck.controller.next(); });
  await page.click('#play');
  await page.waitForFunction(() => !document.querySelector('#narration').paused);
  await page.$eval('#narration', voice => { voice.currentTime = voice.duration - .08; });
  await page.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 4, { timeout: 7000 });
  assert.deepEqual(await transition(), { visible: true, effect: 'crt' });
  await settled();
  // Interrupt both effects; the latest navigation must win.
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(7));
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await transition(), { visible: true, effect: 'crt' }, 'CRT Blackout must connect slides 7 and 8');
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await transition(), { visible: true, effect: 'plunge' });
  await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 7; step++) deck.controller.next(); });
  await page.keyboard.press('ArrowRight');
  assert.equal(await slide(), 6);
  assert.equal((await transition()).effect, 'plunge');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await settled();
  assert.equal((await transition()).visible, false, 'Changing reduced motion must cancel an active shader');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await frame.waitForFunction(() => document.getAnimations().filter(animation => animation.effect.target.matches('.scene > picture img')).length === 1);
  await frame.waitForFunction(() => [...document.querySelectorAll('.scene > picture img')].every(image => image.complete && image.currentSrc.endsWith('-recording.gif')));
  await page.keyboard.press('ArrowLeft');
  assert.equal((await transition()).visible, true, 'Start another effect before testing a jump cut');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(3));
  assert.equal((await transition()).visible, false, 'An ordinary cut must cancel the previous shader');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(5));
  await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 7; step++) deck.controller.next(); });
  const entry = await page.evaluate(() => {
    document.querySelector('hyperframes-slideshow').controller.next();
    const composition = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
    const stage = composition.querySelector('#slide-transition');
    return { liveSource: stage.querySelector('img').src, shaderOpacity: stage.querySelector('canvas').style.opacity };
  });
  assert.equal(new URL(entry.liveSource).pathname.split('/').at(-1), '06-recording.gif', 'Entry must retain the outgoing native live GIF, not expose a canvas first-frame grab');
  assert.equal(entry.shaderOpacity, '0', 'The shader must start transparent over the live outgoing image');
  await frame.waitForFunction(() => document.querySelector('#slide-transition canvas').style.opacity === '1');
  assert.equal(await frame.$eval('#slide-transition canvas', canvas => canvas.style.opacity), '1', 'The central distortion should be opaque');
  await mkdir(resolve(root, 'stills'), { recursive: true });
  await page.screenshot({ path: resolve(root, 'stills/transition-06-07.png') });
  await settled();
  assert.equal(await frame.$eval('#slide-transition canvas', canvas => canvas.style.opacity), '0', 'The shader must fade completely back to the live incoming GIF before removal');
  await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 5; step++) deck.controller.next(); });
  await page.keyboard.press('ArrowRight');
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.screenshot({ path: resolve(root, 'stills/transition-07-08.png') });
  await settled();
  assert.ok(await musicTime() >= beforeNavigation, 'Music must not reset during either effect');
  await page.keyboard.press('ArrowLeft');
  await page.click('#exit');
  assert.equal((await transition()).visible, false, 'Exit must immediately clear an in-flight transition');
  await page.click('#play');
  assert.equal(await slide(), 0);
  assert.equal((await transition()).visible, false, 'Restart is a clean cut, not a leftover transition');
  await page.click('#play');

  for (const [after, effect] of [[1, 'whip'], [2, 'whip'], [3, 'whip'], [7, 'crt'], [8, 'whip'], [9, 'whip'], [10, 'signal'], [11, 'signal'], [17, 'whip'], [18, 'whip'], [19, 'crt']]) {
    await page.$eval('hyperframes-slideshow', (deck, index) => {
      deck.controller.goToSlide(index);
      if (index === 1) for (let step = 0; step < 9; step++) deck.controller.next();
      if (index === 2) for (let step = 0; step < 4; step++) deck.controller.next();
      if (index === 3) for (let step = 0; step < 6; step++) deck.controller.next();
      if (index === 4) for (let step = 0; step < 11; step++) deck.controller.next();
      if (index === 5) for (let step = 0; step < 7; step++) deck.controller.next();
      if (index === 6) for (let step = 0; step < 5; step++) deck.controller.next();
      if (index === 7) for (let step = 0; step < 5; step++) deck.controller.next();
      if (index === 18) for (let step = 0; step < 9; step++) deck.controller.next();
    }, after - 1);
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(await transition(), { visible: true, effect });
    await page.keyboard.press('ArrowLeft');
    assert.deepEqual(await transition(), { visible: true, effect }, `${effect} must support immediate reversal`);
    await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(4));
    assert.equal((await transition()).visible, false, `A direct jump must cancel ${effect}`);
  }

  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  await mkdir(resolve(root, 'stills'), { recursive: true });
  const motionStyles = new Set();
  for (let i = 0; i < 20; i++) {
    if (i === 2) await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 9; step++) deck.controller.next(); });
    if (i === 3) await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 4; step++) deck.controller.next(); });
    if (i === 4) await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 6; step++) deck.controller.next(); });
    if (i === 5) await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 11; step++) deck.controller.next(); });
    if (i === 6) await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 7; step++) deck.controller.next(); });
    if (i === 7) await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 5; step++) deck.controller.next(); });
    if (i === 8) await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 5; step++) deck.controller.next(); });
    if (i === 19) await page.$eval('hyperframes-slideshow', deck => { for (let step = 0; step < 9; step++) deck.controller.next(); });
    const navigationStarted = Date.now();
    if (i) await page.keyboard.press('ArrowRight');
    assert.equal(await slide(), i);
    const expectedEffect = expectedTransitions.get(i);
    if (expectedEffect) assert.deepEqual(await transition(), { visible: true, effect: expectedEffect }, `Wrong transition after slide ${i}`);
    else assert.equal((await transition()).visible, false, `Unexpected transition after slide ${i}`);
    await frame.waitForFunction(i => {
      const scenes = [...document.querySelectorAll('.scene')];
      const visible = scenes.filter(scene => getComputedStyle(scene).visibility === 'visible' && +getComputedStyle(scene).opacity > .9);
      return visible.length === 1 && visible[0] === scenes[i] && visible[0].querySelector(':scope > picture img').naturalWidth > 0;
    }, {}, i);
    const src = await frame.$eval(`#slide-${String(i + 1).padStart(2, '0')} > picture img`, image => image.getAttribute('src'));
    const expectedSrc = `assets/backgrounds/${String(i + 1).padStart(2, '0')}-recording.gif`;
    assert.equal(src, expectedSrc, 'Every slide should use the approved recording treatment');
    assert.equal(await frame.$eval(`#slide-${String(i + 1).padStart(2, '0')} > picture img`, image => new URL(image.currentSrc).pathname.split('/').at(-1)), `${String(i + 1).padStart(2, '0')}-recording.gif`);
    const motion = await frame.$eval(`#slide-${String(i + 1).padStart(2, '0')} > picture img`, image => {
      const animations = document.getAnimations().filter(animation => animation.effect.target.matches('.scene > picture img'));
      const animation = image.getAnimations()[0];
      if (!animation) return { count: animations.length };
      const time = animation.currentTime;
      const duration = animation.effect.getTiming().duration;
      const scene = image.parentElement.getBoundingClientRect();
      animation.currentTime = 0;
      const start = image.getBoundingClientRect();
      animation.currentTime = 250;
      const afterQuarterSecond = image.getBoundingClientRect();
      const startupTravel = Math.max(...['left', 'top', 'right', 'bottom'].map(edge => Math.abs(afterQuarterSecond[edge] - start[edge])));
      animation.currentTime = 5000;
      const afterFiveSeconds = image.getBoundingClientRect();
      const earlyTravel = Math.max(...['left', 'top', 'right', 'bottom'].map(edge => Math.abs(afterFiveSeconds[edge] - start[edge])));
      const covers = [0, duration / 2, duration, duration * 1.5, duration * 2].every(t => {
        animation.currentTime = t;
        const rect = image.getBoundingClientRect();
        return rect.left <= scene.left && rect.top <= scene.top && rect.right >= scene.right && rect.bottom >= scene.bottom;
      });
      animation.currentTime = time;
      return { count: animations.length, id: animation.id, running: animation.playState === 'running', covers, startupTravel, earlyTravel };
    });
    assert.equal(motion.count, 1, 'Only the visible background should animate');
    assert.equal(motion.running, true, 'Background motion must run independently of the held slide clock');
    assert.equal(motion.covers, true, 'Motion must never expose empty canvas edges');
    assert.ok(motion.startupTravel >= 1, `Background travel must start immediately, without a slow ease-in; slide ${i + 1} moved only ${motion.startupTravel.toFixed(2)} canvas pixels in 250ms`);
    assert.ok(motion.earlyTravel >= 12, `Background movement should be noticeable within five seconds; slide ${i + 1} moved only ${motion.earlyTravel.toFixed(1)} canvas pixels`);
    motionStyles.add(motion.id);
    if ([1, 2, 3, 4, 8, 9, 10, 11, 17, 18, 19].includes(i)) {
      const sampleTime = { 1: 300, 2: 300, 3: 300, 4: 380, 8: 300, 9: 300, 10: 300, 11: 300, 17: 300, 18: 300, 19: 380 }[i];
      await new Promise(resolve => setTimeout(resolve, Math.max(0, sampleTime - (Date.now() - navigationStarted))));
      assert.equal((await transition()).visible, true, 'Capture the effect while it is still active');
      await page.screenshot({ path: resolve(root, `stills/transition-${String(i).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}.png`) });
    }
    await settled();
    if ([0, 9, 19].includes(i)) await page.screenshot({ path: resolve(root, `stills/${String(i + 1).padStart(2, '0')}.png`) });
  }
  assert.ok(motionStyles.size >= 4, 'Use varied, restrained background moves');
  for (let i = 19; i > 0; i--) {
    await page.keyboard.press('ArrowLeft');
    assert.equal(await slide(), i - 1);
    const expectedEffect = expectedTransitions.get(i);
    if (expectedEffect) assert.deepEqual(await transition(), { visible: true, effect: expectedEffect }, `Wrong reverse transition across slide ${i}`);
    else assert.equal((await transition()).visible, false);
    await settled();
  }
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(19));
  await page.keyboard.press('ArrowRight');
  assert.equal(await slide(), 20, 'Manual Next reaches the additional prompt after the finale');
  await page.keyboard.press('ArrowRight');
  assert.equal(await slide(), 20, 'Next holds on the manual epilogue');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await slide(), 19, 'Return from the epilogue restores the closing slide');
  assert.equal(await page.$eval('#music', music => music.paused), false, 'Music continues on the final slide');
  await page.$eval('#music', music => { music.currentTime = music.duration - .1; });
  await page.waitForFunction(() => document.querySelector('#music').currentTime < 1, { timeout: 5000 });
  assert.equal(await page.$eval('#music', music => music.paused), false, 'Music loops instead of stopping at the end');
  await page.$eval('hyperframes-slideshow', deck => deck.toggleMute());
  assert.equal(await page.$eval('#music', music => music.muted), true);
  await page.$eval('hyperframes-slideshow', deck => deck.toggleMute());
  assert.equal(await page.$eval('#music', music => music.muted), false);
  await frame.click('#slide-20 img');
  await page.keyboard.press('Escape');
  assert.equal(await mode(), 'idle');
  assert.equal(await page.$eval('#music', music => music.paused), true, 'Exit stops music');
  assert.equal(await frame.evaluate(() => document.getAnimations().filter(animation => animation.effect.target.matches('.scene > picture img')).length), 0, 'Exit stops added background motion');
  await page.click('#play');
  assert.equal(await slide(), 0, 'Start after exit restarts the presentation');
  await page.click('#play');
  assert.equal(await mode(), 'manual', 'Hold auto keeps the current slide');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await frame.waitForFunction(() => document.getAnimations().length === 0);
  assert.equal(await frame.$eval('.title-subtitle', subtitle => getComputedStyle(subtitle).webkitTextFillColor), 'rgb(252, 238, 10)', 'Reduced motion must leave readable solid-yellow text without a shine');
  assert.equal(await frame.$eval('#title-next', button => getComputedStyle(button).webkitTextFillColor), 'rgb(255, 32, 216)', 'Reduced motion must leave the arrow solid magenta');
  for (let i = 0; i < 20; i++) {
    await page.$eval('hyperframes-slideshow', (deck, i) => deck.controller.goToSlide(i), i);
    await frame.waitForFunction(i => document.querySelector(`#slide-${String(i + 1).padStart(2, '0')} > picture img`).currentSrc.endsWith(`/${String(i + 1).padStart(2, '0')}.gif`), {}, i);
    assert.equal((await transition()).visible, false, 'Reduced motion uses cuts on every slide');
    if (i >= 1 && i <= 18) assert.deepEqual(await frame.$eval(`#slide-${String(i + 1).padStart(2, '0')} .slide-title`, panel => ({ opacity: getComputedStyle(panel).opacity, transform: getComputedStyle(panel).transform,
      text: getComputedStyle(panel.querySelector('h2')).webkitTextFillColor, animations: panel.getAnimations({ subtree: true }).length })),
      { opacity: '1', transform: 'none', text: 'rgb(252, 238, 10)', animations: 0 }, 'Reduced motion must show the complete title immediately, solid yellow and without flares');
  }
  assert.equal(await frame.$eval('#slide-20 img', image => getComputedStyle(image).transform), 'none', 'Reduced motion disables the added camera moves');
  assert.equal(await frame.evaluate(() => document.getAnimations().length), 0, 'Reduced motion must disable closing-slide text effects too');
  assert.equal(await frame.$$eval('#slide-20 .type-letter', letters => letters.length === 9 && letters.every(letter => getComputedStyle(letter).visibility === 'hidden')), true, 'Reduced motion still waits for closing narration before showing Thank You');
  assert.equal(await frame.$$eval('#slide-20 .closing-appear', elements => elements.length === 2 && elements.every(element => getComputedStyle(element).opacity === '1')), true, 'Reduced motion must show the handle and website immediately');
  assert.equal(await frame.$eval('#slide-20 .title-footer', footer => getComputedStyle(footer).webkitTextFillColor), 'rgb(255, 32, 216)');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await frame.waitForFunction(() => document.getAnimations().filter(animation => animation.effect.target.matches('.scene > picture img')).length === 1);
  await frame.waitForFunction(() => document.querySelector('#slide-20 img').currentSrc.endsWith('/20-recording.gif'));
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  await page.click('#play');
  await page.waitForFunction(() => document.querySelector('hyperframes-slideshow').controller.position.slideIndex === 1, { timeout: 7000 });
  await page.click('#exit');
  assert.equal(await page.$eval('#music', music => music.paused), true);
  const fallback = await browser.newPage();
  await fallback.setViewport({ width: 1920, height: 1080 });
  fallback.on('pageerror', error => errors.push(error.message));
  fallback.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await fallback.evaluateOnNewDocument(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : getContext.call(this, type, ...args);
    };
  });
  await fallback.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load', timeout: 120000 });
  await fallback.waitForFunction(() => !document.querySelector('#play').disabled);
  await fallback.click('#play');
  await fallback.waitForFunction(() => document.querySelector('#music').currentTime > .1);
  for (const after of [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 17, 18, 19]) {
    await fallback.$eval('hyperframes-slideshow', (deck, after) => {
      deck.controller.goToSlide(after - 1);
      if (after === 2) for (let step = 0; step < 9; step++) deck.controller.next();
      if (after === 3) for (let step = 0; step < 4; step++) deck.controller.next();
      if (after === 4) for (let step = 0; step < 6; step++) deck.controller.next();
      if (after === 5) for (let step = 0; step < 11; step++) deck.controller.next();
      if (after === 6) for (let step = 0; step < 7; step++) deck.controller.next();
      if (after === 7) for (let step = 0; step < 5; step++) deck.controller.next();
      if (after === 8) for (let step = 0; step < 5; step++) deck.controller.next();
      if (after === 19) for (let step = 0; step < 9; step++) deck.controller.next();
      deck.controller.next();
    }, after);
    assert.equal(await fallback.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), after, 'Without WebGL, every configured effect must work as a cut');
  }
  const fallbackFrame = fallback.frames().find(frame => frame.url().includes('/composition/index.html'));
  assert.equal(await fallbackFrame.$('#slide-transition'), null);
  await fallback.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(1));
  await fallbackFrame.click('#slide-02', { offset: { x: 950, y: 500 } });
  assert.equal(await fallbackFrame.$$eval('#slide-02 [data-fragment][data-visible]', nodes => nodes.length), 1, 'Click reveals must work without WebGL');
  assert.equal(await fallback.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 1);
  await fallback.click('#exit');
  await fallback.close();
  assert.deepEqual(errors, [], 'No browser or missing-asset errors');
} finally {
  await browser.close();
  // The bundled Puppeteer can leave Chrome's stdio pipes open after closing the browser.
  for (const pipe of browser.process()?.stdio || []) pipe?.destroy();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
console.log('PASS: all nine narration tracks/cue boundaries/600ms pulses, auto 2–8 → manual 9–18 → Resume 19–20, finale hold/replay and manual-only chrome-free21, failures and cancellation, layouts/manual reveals/accessibility, two-window visual sync, all 18 titles/19 transitions, reduced-motion/WebGL fallbacks, backgrounds, motion, music and controls.');
