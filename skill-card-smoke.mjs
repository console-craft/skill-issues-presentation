import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const card = '#slide-09 [data-skill-card]';

// Player scaling is not included in Puppeteer's iframe element-click coordinates.
async function clickCard(page, selector) {
  const point = await page.evaluate(selector => {
    const iframe = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe');
    const stage = iframe.getBoundingClientRect();
    const target = iframe.contentDocument.querySelector(selector).getBoundingClientRect();
    return {
      x: stage.x + (target.x + target.width / 2) * stage.width / iframe.contentWindow.innerWidth,
      y: stage.y + (target.y + target.height / 2) * stage.height / iframe.contentWindow.innerHeight,
    };
  }, selector);
  await page.mouse.click(point.x, point.y);
}

const settleCard = frame => frame.$eval(card, node => Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))).then(() => null));

async function openEditor(page, scene = '#slide-09') {
  const selector = `${scene} > .skill-open`;
  const hidden = await page.evaluate(selector => document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument.querySelector(selector).hidden, selector);
  if (!hidden) await clickCard(page, selector);
}

export async function checkSkillCard(page, frame) {
  assert.deepEqual(await frame.$$eval('[data-skill-card]', nodes => nodes.map(node => node.closest('.scene').id)),
    ['slide-09', 'slide-10', 'slide-11', 'slide-12', 'slide-13', 'slide-14', 'slide-15', 'slide-16', 'slide-17', 'slide-18'], 'All ten skill slides must have their authored cards');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
  await frame.waitForFunction(() => document.querySelector('#slide-transition')?.hidden !== false);
  assert.deepEqual(await frame.$eval('#slide-09 .skill-open', node => ({ label: getComputedStyle(node.querySelector('span')).color,
    icon: getComputedStyle(node.querySelector('svg')).color, delay: getComputedStyle(node).animationDelay })),
    { label: 'rgb(255, 255, 255)', icon: 'rgb(32, 199, 255)', delay: '0.55s' }, 'Keep the icon cyan, label white, and launcher delay equal to the speaking AI');
  assert.equal(await frame.$$eval('.skill-views button', nodes => nodes.length === 20 && nodes.every(node =>
    getComputedStyle(node).color === 'rgb(255, 255, 255)' && getComputedStyle(node.querySelector('svg')).color ===
    (node.getAttribute('aria-selected') === 'true' ? 'rgb(32, 199, 255)' : 'rgb(169, 177, 214)'))), true,
    'All Content/Demo labels must be white without changing their selected/unselected icon colors');
  await checkGlobalTextSize(page, frame);
  await checkManualOpening(page, frame);
  await checkEditorClose(page, frame);
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
  await openEditor(page);
  await frame.$eval('#slide-09 .slide-title', title => title.getAnimations().forEach(animation => animation.finish()));
  assert.deepEqual(await frame.$$eval(`${card} .skill-files [role="tab"]`, tabs => tabs.map(tab => tab.textContent.trim())),
    ['instructions/soul.md'], 'Show the actual single file, not the sketch placeholders');
  assert.equal(await frame.$eval('#soul-content-tab', tab => tab.getAttribute('aria-selected')), 'true');
  const sourceText = await frame.$eval('#soul-file', node => node.textContent.replace(/\s+/g, ' ').trim());
  assert.equal(createHash('sha256').update(sourceText).digest('hex'),
    '1a84653575b4e2003630f4e8791e9199d2cad5a967c6effcb5208ede11f78f99',
    'The rendered document must preserve all supplied Soul content');
  assert.equal(await frame.$eval('#soul-file', node => Boolean(node.querySelector('h1, h2') && node.querySelector('strong') && node.querySelector('ul') && node.querySelector('blockquote'))), true,
    'Render Markdown semantics rather than a source-text dump');
  const geometry = await frame.$eval(card, card => {
    const box = card.getBoundingClientRect(), document = card.querySelector('.skill-document');
    const title = card.closest('.scene').querySelector('.slide-title .outline').getBoundingClientRect();
    const rail = card.querySelector('.skill-rail').getBoundingClientRect();
    const style = getComputedStyle(card);
    return { aligned: Math.abs(box.left - title.left) < 1 && Math.abs(box.right - title.right) < 1, y: box.y, bottom: box.bottom, rail: rail.width,
      belowTitle: box.top > title.bottom, scrolls: document.scrollHeight > document.clientHeight,
      background: style.backgroundColor, text: getComputedStyle(document).color,
      number: getComputedStyle(card.querySelector('.skill-number')).color };
  });
  assert.deepEqual(geometry, { aligned: true, y: 190, bottom: 1004, rail: 128,
    belowTitle: true, scrolls: true, background: 'rgb(26, 27, 38)', text: 'rgb(192, 202, 245)', number: 'rgb(255, 32, 216)' },
  'The Tokyo Night card must fill the safe area without covering the title or bottom toolbar');
  for (const [asset, selector] of [
    ['numbers/1.svg', '.skill-number svg'], ['icons/file-icon.svg', '#soul-content-tab svg'], ['icons/sparkles-icon.svg', '#soul-demo-tab svg'],
  ]) {
    const source = await readFile(new URL(`../artwork/${asset}`, import.meta.url), 'utf8');
    const paths = [...source.matchAll(/\bd="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(await frame.$$eval(`${card} ${selector} path`, paths => paths.map(path => path.getAttribute('d'))), paths,
      `Keep the original ${asset} path geometry`);
  }
  await clickCard(page, '#soul-demo-tab');
  assert.equal(await frame.$eval('#soul-demo', node => node.hidden), false);
  assert.equal(await frame.$eval('#soul-content', node => node.hidden), true);
  await frame.focus('#soul-demo-tab');
  await page.keyboard.press('Home');
  assert.equal(await frame.$eval('#soul-content-tab', tab => tab.matches(':focus') && tab.getAttribute('aria-selected') === 'true'), true,
    'Vertical rail tabs must support keyboard activation');
  await checkFileFixtures(page, frame);
  await checkCardEntrance(page, frame);
  await checkExpandedNavigation(page, frame);
  await checkWindowPolish(page, frame);
  await checkTextSize(page, frame);
  await checkOverlayControls(page, frame);
  await checkStreaming(page, frame);
  await checkWorkflowCard(page, frame);
  await checkPrimeCard(page, frame);
  await checkBroCard(page, frame);
  await checkClarifyCard(page, frame);
  await checkExplanationsCard(page, frame);
  await checkReviewCard(page, frame);
  await checkScreenshotCards(page, frame);
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
}

async function checkGlobalTextSize(page, frame) {
  if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'idle') await page.click('#play');
  if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'auto') await page.click('#play');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
  await openEditor(page);
  await frame.focus(`${card} input[type="range"]`);
  for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowUp');
  for (const index of [9, 16]) {
    const scene = `#slide-${index + 1}`;
    await page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
    await openEditor(page, scene);
    assert.equal(await frame.$eval(`${scene} .skill-document`, node => getComputedStyle(node).fontSize), '36px', 'A new slide must inherit the chosen content size');
    assert.equal(await frame.$eval(`${scene} input[type="range"]`, node => node.value), '36', 'The destination slider must match the inherited size');
  }
  await frame.focus('#slide-17 input[type="range"]');
  await page.keyboard.press('End');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
  await openEditor(page);
  assert.equal(await frame.$eval('#soul-file', node => getComputedStyle(node).fontSize), '48px', 'Changes on another slide must reach previously visited editors');
  assert.equal(await frame.$$eval('.skill-text-size', nodes => nodes.every(node => node.querySelector('input').value === '48' && node.querySelector('input').getAttribute('aria-valuetext') === '48 pixels' && node.querySelector('output').value === '48px')), true, 'All sliders, outputs and accessible values must stay synchronized');
  await clickCard(page, `${card} .skill-close`);
  await openEditor(page);
  assert.equal(await frame.$eval('#soul-file', node => getComputedStyle(node).fontSize), '48px', 'Close/reopen must preserve the chosen shared text size');
  await page.click('#exit');
  await openEditor(page);
  assert.equal(await frame.$eval('#soul-file', node => getComputedStyle(node).fontSize), '48px', 'Exit must preserve the presentation-wide text size');
  await frame.focus(`${card} input[type="range"]`);
  await page.keyboard.press('Home');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
}

async function checkEditorClose(page, frame) {
  assert.equal(await frame.$$eval('.skill-titlebar > .skill-expand + .skill-close', nodes => nodes.filter(node => node.tagName === 'BUTTON' && node.type === 'button' && node.getAttribute('aria-label') === 'Close editor').length), 10, 'Every editor needs an accessible close control immediately after maximize');
  if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'idle') await page.click('#play');
  if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'auto') await page.click('#play');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
  await openEditor(page);
  const close = `${card} .skill-close`;
  assert.equal(await frame.$eval(close, node => {
    const box = node.getBoundingClientRect(), expand = node.previousElementSibling.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44 && Math.abs(box.left - expand.right) < 1;
  }), true, 'Close must have a usable titlebar target to the right of maximize');
  await frame.focus(`${card} .skill-expand`);
  await page.keyboard.press('Tab');
  assert.equal(await frame.$eval(close, node => node.matches(':focus')), true, 'Close must follow maximize in keyboard tab order');
  await clickCard(page, `${card} .skill-expand`);
  await settleCard(frame);
  await clickCard(page, '#soul-demo-tab');
  for (const side of ['before', 'after']) await clickCard(page, `${card} [data-side="${side}"] .skill-generate`);
  await frame.waitForSelector(`${card} .skill-thinking`);
  await clickCard(page, close);
  assert.equal(await frame.$eval(card, node => node.hidden && node.hasAttribute('data-expanded')), true, 'Closing must preserve the shared maximized preference');
  assert.equal(await frame.$eval('#slide-09 .skill-open', node => !node.hidden && node.matches(':focus') && node.getAttribute('aria-expanded') === 'false'), true, 'Close must return focus to the launcher');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode === 'manual' && deck.controller.position.slideIndex === 8), true, 'Close must not exit or advance the presentation');
  assert.equal(await page.$eval('#music', node => node.paused), false, 'Closing the editor must not stop presentation music');
  assert.equal(await frame.$eval('#slide-09 .slide-title', node => getComputedStyle(node).visibility), 'visible');
  await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 3600)));
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true, 'Closing during thinking must cancel both responses, not populate a hidden editor');
  for (const key of ['Enter', 'Space']) {
    await openEditor(page);
    assert.equal(await frame.$eval('#soul-content-tab', node => node.getAttribute('aria-selected')), 'true', 'Reopening after close must restore Content');
    await frame.focus(close);
    assert.equal(await frame.$eval(close, node => node.matches(':focus')), true);
    await page.keyboard.press(key);
    assert.equal(await frame.$eval(card, node => node.hidden), true, `${key} must activate Close without triggering presentation shortcuts`);
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 8);
  }
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(17));
  await openEditor(page, '#slide-18');
  await clickCard(page, '#save-demo-tab');
  await clickCard(page, '#slide-18 .skill-close');
  assert.equal(await frame.$eval('#slide-18 [data-skill-card]', node => node.hidden), true, 'Screenshot editors must close through the same control');
  await page.click('#exit');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
}

async function checkManualOpening(page, frame) {
  if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'idle') await page.click('#play');
  if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'auto') await page.click('#play');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  for (let number = 9; number <= 18; number++) {
    const scene = `#slide-${String(number).padStart(2, '0')}`, editor = `${scene} > [data-skill-card]`, launcher = `${scene} > .skill-open`;
    await page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), number - 1);
    assert.equal(await frame.$eval(editor, node => node.getClientRects().length === 0), true, `Slide ${number} must not render its editor before activation`);
    await frame.waitForFunction(() => document.querySelector('#slide-transition')?.hidden !== false);
    const button = await frame.$eval(launcher, node => {
      const box = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { centered: Math.abs(box.x + box.width / 2 - 960) < 1 && Math.abs(box.y + box.height / 2 - 540) < 1,
        visible: !node.hidden && style.visibility === 'visible' && box.width >= 44 && box.height >= 44,
        controls: document.getElementById(node.getAttribute('aria-controls')) === node.previousElementSibling,
        expanded: node.getAttribute('aria-expanded'), icon: Boolean(node.querySelector('svg[aria-hidden="true"] path')),
        background: style.backgroundColor };
    });
    assert.deepEqual(button, { centered: true, visible: true, controls: true, expanded: 'false', icon: true, background: 'rgba(28, 79, 107, 0.68)' }, 'The launcher must use the header blue and translucency');
    if (number === 10 || number === 11) {
      await frame.focus(launcher);
      await page.keyboard.press(number === 10 ? 'Enter' : 'Space');
    } else await clickCard(page, launcher);
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), number - 1, 'Opening must not advance the deck');
    assert.equal(await frame.$eval(editor, node => !node.hidden && node.getClientRects().length > 0 && node.querySelector('.skill-views [aria-selected="true"]') === document.activeElement), true, 'Opening must reveal the editor and move focus to Content');
    assert.equal(await frame.$eval(launcher, node => node.hidden && node.getAttribute('aria-expanded') === 'true'), true);
    assert.equal(await frame.$$eval('[data-skill-card]', nodes => nodes.filter(node => !node.hidden).length), 1, 'Only the explicitly opened editor may be open');
  }
  await clickCard(page, '#slide-18 .skill-expand');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
  assert.equal(await frame.$eval(card, node => node.hidden && node.hasAttribute('data-expanded')), true, 'Shared maximization must not automatically open another editor');
  assert.equal(await frame.$eval('#slide-09 .slide-title', node => getComputedStyle(node).visibility), 'visible', 'A hidden maximized editor must leave the title visible');
  await openEditor(page);
  assert.equal(await frame.$eval(card, node => !node.hidden && node.hasAttribute('data-expanded')), true, 'Explicit opening must restore the shared maximized appearance');
  await page.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(9); deck.controller.goToSlide(8); });
  assert.equal(await frame.$eval(card, node => node.hidden), true, 'Rapid departure/revisit must require another click');
  for (const [key, index] of [['ArrowRight', 9], ['ArrowLeft', 7]]) {
    await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
    await frame.waitForFunction(() => document.querySelector('#slide-transition')?.hidden !== false);
    await frame.focus('#slide-09 .skill-open');
    assert.equal(await frame.$eval('#slide-09 .skill-open', node => node.matches(':focus')), true, 'The visible launcher must actually have focus before testing arrows');
    await page.keyboard.press(key);
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), index, 'The launcher must preserve slide-arrow navigation before opening');
  }
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
  await openEditor(page);
  await page.click('#exit');
  assert.equal(await frame.$eval(card, node => node.hidden && !node.hasAttribute('data-expanded')), true, 'Exit must close and collapse the editor');
  assert.equal(await frame.$eval('#slide-09 .skill-open', node => !node.hidden && node.getAttribute('aria-expanded') === 'false'), true, 'Exit must restore the launcher');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
}

async function checkWindowPolish(page, frame) {
  const expand = `${card} .skill-expand`;
  assert.equal(await frame.$eval('.skill-titlebar', node => node.contains(document.querySelector('.skill-files')) && node.contains(document.querySelector('.skill-expand'))), true,
    'File tabs and the expand control must share a titlebar');
  const chrome = await frame.$eval(card, node => ({
    titlebar: node.querySelector('.skill-titlebar').getBoundingClientRect().height,
    fileTab: node.querySelector('.skill-files button').getBoundingClientRect().height,
    views: [...node.querySelectorAll('.skill-views button')].map(button => button.getBoundingClientRect().height),
  }));
  assert.ok(chrome.titlebar <= 56 && chrome.fileTab >= 44 && chrome.fileTab <= 55 && chrome.views.every(height => height >= 44 && height <= 90),
    `Compact title/file/view chrome must preserve usable click targets: ${JSON.stringify(chrome)}`);
  await clickCard(page, expand);
  await settleCard(frame);
  const expanded = await frame.$eval(card, node => {
    const box = node.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, pressed: node.querySelector('.skill-expand').getAttribute('aria-pressed') };
  });
  assert.deepEqual(expanded, { left: 0, right: 1920, top: 0, bottom: 1080, pressed: 'true' }, 'Expansion must fill the entire canvas without exposed background strips');
  assert.equal(await frame.evaluate(() => [10, 1070].every(y => document.elementFromPoint(10, y)?.closest('[data-skill-card]'))), true,
    'The editor surface must cover the former top/bottom background strips');
  assert.equal(await frame.$eval('#slide-09 .slide-title', node => getComputedStyle(node).visibility), 'hidden', 'Expansion must hide the whole original title, including ink above the card');
  assert.equal(await page.evaluate(() => document.fullscreenElement), null, 'Expand must not switch browser fullscreen');
  await clickCard(page, '#soul-demo-tab');
  assert.equal(await frame.$eval('.skill-demo-title', node => !node.hidden && node.textContent === 'AI Responses'), true);
  assert.equal(await frame.$eval('.skill-files', node => node.hidden), true);
  assert.equal(await frame.$$eval('.skill-pane-header h3', nodes => nodes.every(node => getComputedStyle(node).color === 'rgb(252, 238, 16)')), true, 'Before/After headings must be yellow on every skill card');
  assert.deepEqual(await frame.$$eval(`${card} .skill-pane-header`, nodes => nodes.map(node => node.textContent.trim())), ['Before', 'After'], 'Remove the redundant pane subtitles');
  assert.ok(await frame.$eval('.skill-pane-header', node => node.getBoundingClientRect().height) <= 58, 'Pane-label padding must leave more room for the response');
  const buttonMetrics = await frame.$eval('.skill-generate', node => ({ height: node.getBoundingClientRect().height,
    footer: node.parentElement.getBoundingClientRect().height, font: getComputedStyle(node).fontSize, padding: getComputedStyle(node).padding }));
  assert.ok(buttonMetrics.height <= 56 && buttonMetrics.footer <= 80, `Generate controls must use compact padding: ${JSON.stringify(buttonMetrics)}`);
  assert.deepEqual(await frame.$$eval(`${card} .skill-generate`, nodes => nodes.map(node => getComputedStyle(node).color)), ['rgb(255, 255, 255)', 'rgb(255, 255, 255)']);
  assert.deepEqual(await frame.$$eval(`${card} .skill-generate`, nodes => nodes.map(node => getComputedStyle(node).borderColor)), ['rgb(32, 199, 255)', 'rgb(32, 199, 255)'], 'Both Generate borders must be cyan');
  assert.equal(await frame.$eval(expand, node => node.getAttribute('aria-pressed')), 'true', 'Switching views must preserve expansion');
  await clickCard(page, expand);
  await settleCard(frame);
  assert.equal(await frame.$eval(card, node => {
    const box = node.getBoundingClientRect(), title = node.closest('.scene').querySelector('.slide-title .outline').getBoundingClientRect();
    return Math.abs(box.left - title.left) < 1 && Math.abs(box.right - title.right) < 1;
  }), true, 'Restore must return to the title frame width');
  assert.equal(await frame.$eval('#slide-09 .slide-title', node => getComputedStyle(node).visibility), 'visible', 'Collapsing must restore the original title');
  await clickCard(page, expand);
  await page.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(0); deck.controller.goToSlide(8); });
  assert.equal(await frame.$eval(expand, node => node.getAttribute('aria-pressed')), 'true', 'Slide changes must preserve the shared maximized state');
  await openEditor(page);
  await clickCard(page, expand);
  await settleCard(frame);
  assert.equal(await frame.$eval('#soul-file', node => Math.abs(node.getBoundingClientRect().top - node.closest('[data-skill-card]').querySelector('.skill-titlebar').getBoundingClientRect().bottom) < 1), true,
    'The document must begin directly below its titlebar, without a duplicated path bar');
}

async function checkExpandedNavigation(page, frame) {
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  for (const [selector, key, expected] of [
    ['.skill-expand', 'ArrowRight', 9], ['.skill-expand', 'ArrowLeft', 7],
    ['#soul-file-tab', 'ArrowRight', 9], ['#soul-file', 'ArrowLeft', 7],
    ['.skill-text-size input', 'ArrowRight', 9], ['[data-side="before"] .skill-generate', 'ArrowLeft', 7],
  ]) {
    await go(8); await openEditor(page); await settleCard(frame);
    if (await frame.$eval(`${card} .skill-expand`, node => node.getAttribute('aria-pressed')) === 'false') {
      await clickCard(page, `${card} .skill-expand`); await settleCard(frame);
    }
    if (selector.includes('skill-generate')) await clickCard(page, '#soul-demo-tab');
    await frame.focus(`${card} ${selector}`);
    await page.keyboard.press(key);
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), expected,
      `${key} from maximized ${selector} must navigate exactly one slide`);
    await go(8); await openEditor(page); await settleCard(frame);
    assert.equal(await frame.$eval(`${card} .skill-expand`, node => node.getAttribute('aria-pressed')), 'true', 'Returning to a skill slide must keep the editor maximized');
  }
  await frame.focus(`${card} .skill-text-size input`);
  await page.keyboard.press('ArrowUp');
  assert.equal(await frame.$eval(`${card} .skill-text-size input`, node => node.value), '22', 'The vertical slider must retain Up/Down while maximized');
  await page.keyboard.press('ArrowDown');
  await frame.focus('#soul-file');
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 8, 'Modified arrows must not become presentation shortcuts');
  await clickCard(page, `${card} .skill-expand`); await settleCard(frame);
}

async function checkCardEntrance(page, frame) {
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'idle') await page.click('#play');
  if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'auto') await page.click('#play');
  const entrance = await page.evaluate(() => new Promise(resolve => {
    const deck = document.querySelector('hyperframes-slideshow');
    deck.controller.goToSlide(7); deck.controller.goToSlide(8);
    const doc = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').contentDocument;
    const overlay = doc.querySelector('#slide-transition'), launcher = doc.querySelector('#slide-09 .skill-open');
    const result = { transition: !overlay.hidden, early: false, delay: 0, waits: false, fades: false };
    const sample = () => {
      const opacity = Number(doc.defaultView.getComputedStyle(launcher).opacity);
      if (!overlay.hidden) { if (opacity > 0 || launcher.getAnimations().some(animation => animation instanceof doc.defaultView.CSSAnimation)) result.early = true; requestAnimationFrame(sample); return; }
      const animation = launcher.getAnimations().find(animation => animation instanceof doc.defaultView.CSSAnimation);
      if (animation) {
        animation.pause();
        const { duration, delay } = animation.effect.getTiming();
        result.delay = delay;
        animation.currentTime = delay / 2; result.waits = Number(doc.defaultView.getComputedStyle(launcher).opacity) === 0;
        animation.currentTime = delay; const start = Number(doc.defaultView.getComputedStyle(launcher).opacity);
        animation.currentTime = delay + duration / 2; const middle = Number(doc.defaultView.getComputedStyle(launcher).opacity);
        animation.finish(); const end = Number(doc.defaultView.getComputedStyle(launcher).opacity);
        result.fades = start === 0 && middle > 0 && middle < 1 && end === 1 && duration <= 800;
      }
      resolve(result);
    };
    sample();
  }));
  assert.deepEqual(entrance, { transition: true, early: false, delay: 550, waits: true, fades: true }, 'Launcher entrance must wait for the transition and speaking-AI delay, then fade in once');
  await openEditor(page);
  assert.equal(await frame.$eval(card, node => node.getAnimations().some(animation => animation instanceof CSSAnimation)), true, 'The editor must fade in only after activation');
  await page.click('#exit');
  await openEditor(page);
  await clickCard(page, `${card} .skill-expand`);
  assert.equal(await frame.$eval(card, node => node.getAnimations().some(animation => animation instanceof CSSTransition)), true, 'Expand must animate its geometry');
  await settleCard(frame);
  await clickCard(page, `${card} .skill-expand`);
  assert.equal(await frame.$eval(card, node => node.getAnimations().some(animation => animation instanceof CSSTransition)), true, 'Restore must animate its geometry');
  await settleCard(frame);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await frame.$eval('#slide-09 .skill-open', node => node.getAnimations().length), 0, 'Reduced motion must disable launcher animation');
  await clickCard(page, `${card} .skill-expand`);
  assert.equal(await frame.$eval(card, node => node.getAnimations().length), 0, 'Reduced motion must disable entrance and resizing animations');
  await clickCard(page, `${card} .skill-expand`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await settleCard(frame);
}

async function checkTextSize(page, frame) {
  const slider = `${card} input[type="range"]`;
  assert.equal(await frame.$eval(slider, node => node.value === node.min && node.value === '20'), true, 'Content size must default to the 20px minimum');
  const sizes = () => frame.$eval(card, node => ({
    content: ['.skill-document', '.skill-document h1', '.skill-document h2', '.skill-document code', '.skill-chat'].map(selector => parseFloat(getComputedStyle(node.querySelector(selector)).fontSize)),
    ui: ['.skill-files button', '.skill-views button', '.skill-generate', '.skill-pane-header h3', '.skill-demo-title'].map(selector => getComputedStyle(node.querySelector(selector)).fontSize),
  }));
  assert.equal(await frame.$eval(slider, node => {
    const box = node.getBoundingClientRect(), card = node.closest('[data-skill-card]');
    return box.height > box.width * 3 && box.top > card.querySelector('.skill-number').getBoundingClientRect().bottom && box.bottom < card.querySelector('.skill-views').getBoundingClientRect().top;
  }), true, 'The text-size slider must sit vertically between the numeral and view buttons');
  const original = await sizes();
  await frame.focus(slider);
  await page.keyboard.press('End');
  assert.equal(await frame.$eval(slider, node => node.value), '48');
  const large = await sizes();
  assert.ok(large.content.every((size, i) => Math.abs(size / original.content[i] - 2.4) < .01), 'The slider must scale file headings/body/code and response text together');
  assert.deepEqual(large.ui, original.ui, 'The slider must never enlarge the UI labels/buttons');
  await page.keyboard.press('Home');
  assert.equal(await frame.$eval(slider, node => node.value), '20');
  assert.ok((await sizes()).content.every((size, i) => size < large.content[i]), 'The slider must also decrease content size');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');
  assert.equal(await frame.$eval(slider, node => node.value), '36', 'Native Up should increase the vertical slider without advancing the deck');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 8);
  await clickCard(page, '#soul-demo-tab');
  await clickCard(page, `${card} .skill-expand`); await settleCard(frame);
  await clickCard(page, `${card} .skill-expand`); await settleCard(frame);
  await page.$eval('hyperframes-slideshow', deck => { deck.controller.goToSlide(0); deck.controller.goToSlide(8); });
  await openEditor(page);
  await settleCard(frame);
  assert.equal(await frame.$eval(slider, node => node.value), '36', 'Content size must survive view/expansion changes and revisits');
  await frame.focus(slider); await page.keyboard.press('Home');
}

async function checkOverlayControls(page, frame) {
  await page.click('#play');
  await page.click('#play');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(8));
  await openEditor(page);
  await settleCard(frame);
  await clickCard(page, `${card} .skill-expand`); await settleCard(frame);
  await page.setViewport({ width: 1024, height: 576 });
  await page.waitForFunction(() => Math.abs(document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').getBoundingClientRect().width - innerWidth) < 1);
  await settleCard(frame);
  await clickCard(page, `${card} .skill-expand`);
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual', 'Restore after a small-window resize must not hit the overlaid Exit button');
  assert.equal(await page.$eval('#music', node => node.paused), false, 'Restore must not stop presentation music');
  await settleCard(frame);
  await clickCard(page, `${card} .skill-expand`); await settleCard(frame);
  await clickCard(page, `${card} .skill-close`);
  assert.equal(await frame.$eval(card, node => node.hidden), true, 'Close must remain clickable in a scaled maximized editor');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual', 'Close must not hit the overlaid presentation Exit control');
  await openEditor(page); await settleCard(frame);
  await clickCard(page, `${card} .skill-expand`); await settleCard(frame);
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'manual', 'Expand/restore started in a small window must remain safe too');
  await page.click('#exit');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.waitForFunction(() => Math.abs(document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').getBoundingClientRect().width - innerWidth) < 1);
}

async function checkStreaming(page, frame) {
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  const pane = side => `${card} [data-side="${side}"]`;
  const generate = side => clickCard(page, `${pane(side)} .skill-generate`);
  const finished = side => frame.waitForFunction(selector => !document.querySelector(selector).disabled, {}, `${pane(side)} .skill-generate`);
  const reset = async () => { await go(0); await go(8); await openEditor(page); await clickCard(page, '#soul-demo-tab'); };
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => node.childElementCount === 0)), true, 'Both conversations must begin empty');
  await openEditor(page);
  await clickCard(page, '#soul-demo-tab');
  await frame.evaluate(() => {
    const pane = document.querySelector('[data-side="before"]');
    window.skillPhases = { lines: [] };
    pane.querySelector('button').addEventListener('click', () => window.skillPhases.started = performance.now(), { once: true });
    window.skillPhaseObserver = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches('.skill-thinking')) window.skillPhases.thinking = performance.now();
          if (node.matches('.skill-answer-line')) window.skillPhases.lines.push(performance.now());
        }
        for (const node of record.removedNodes) if (node.nodeType === 1 && node.matches('.skill-thinking')) window.skillPhases.thought = performance.now();
      }
    });
    window.skillPhaseObserver.observe(pane.querySelector('.skill-chat'), { childList: true, subtree: true });
  });
  await generate('before');
  assert.equal(await frame.$eval(`${pane('before')} .skill-generate`, button => button.disabled), true, 'Generate must begin its own response immediately');
  assert.equal(await frame.$eval(`${pane('before')} .skill-generate`, button => button.textContent), '✦ Generating…', 'Busy Generate must keep its sparkle icon');
  assert.equal(await frame.$eval(`${pane('before')} .skill-user p`, node => node.textContent), 'Should I use useEffect in React as my main go-to tool?');
  assert.equal(await frame.$eval(`${pane('before')} .skill-user code`, node => node.textContent), 'useEffect');
  assert.equal(await frame.$$eval(`${pane('before')} .skill-answer-line`, nodes => nodes.length), 0);
  await generate('after');
  assert.equal(await frame.$eval(`${pane('after')} .skill-generate`, button => button.disabled), true, 'Before and After must run independently');
  await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
  assert.equal(await frame.$$eval(`${card} .skill-answer-line`, nodes => nodes.length), 0, 'The question must precede the delayed AI response');
  await frame.waitForSelector(`${pane('before')} .skill-thinking`);
  const thinking = await frame.$eval(`${pane('before')} .skill-thinking`, node => {
    const image = node.querySelector('img'), box = image.getBoundingClientRect(), chat = node.parentElement.getBoundingClientRect();
    return { centered: Math.abs((box.left + box.width / 2) - (chat.left + chat.width / 2)) < 2,
      gif: image.getAttribute('src'), pulse: image.getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity),
      fade: parseFloat(getComputedStyle(node).animationDuration) > 0,
      questionFade: parseFloat(getComputedStyle(node.parentElement.querySelector('.skill-user')).animationDuration) > 0 };
  });
  assert.deepEqual(thinking, { centered: true, gif: 'assets/ai-talking.gif', pulse: true, fade: true, questionFade: true }, 'Thinking must reuse the centered AI GIF with pulse and quick entrance fades');
  assert.equal(await page.$eval('#narration', node => node.paused && !node.getAttribute('src')), true, 'The thinking GIF must not start voice or attach a narration track');
  assert.equal(await frame.$$eval(`${pane('before')} .skill-answer-line`, nodes => nodes.length), 0, 'No response may stream while the AI is thinking');
  await frame.waitForSelector(`${pane('before')} .skill-thinking.is-leaving`);
  assert.ok(await frame.$eval(`${pane('before')} .skill-thinking`, node => parseFloat(getComputedStyle(node).animationDuration)) > 0, 'Thinking must fade out before removal');
  await frame.waitForSelector(`${pane('before')} .skill-answer-line`);
  assert.ok(await frame.$$eval(`${pane('before')} .skill-answer-line`, nodes => nodes.length) < 5, 'Normal mode must reveal incrementally, not all at once');
  await frame.$eval(`${pane('before')} .skill-generate`, button => button.click());
  assert.equal(await frame.$$eval(`${pane('before')} .skill-user`, nodes => nodes.length), 1, 'A second click while busy cannot duplicate the session');
  await clickCard(page, '#soul-content-tab');
  await clickCard(page, '#soul-demo-tab');
  assert.equal(await frame.$$eval(`${pane('before')} .skill-user`, nodes => nodes.length), 1, 'Switching views must preserve this visit');
  await Promise.all([finished('before'), finished('after')]);
  const phases = await frame.evaluate(() => { window.skillPhaseObserver.disconnect(); return window.skillPhases; });
  assert.ok(phases.thinking - phases.started >= 300, 'Thinking must follow a short question-only pause');
  assert.ok(phases.thought - phases.thinking >= 3000 && phases.thought - phases.thinking < 4500, 'Thinking must last about three seconds including fade-out');
  assert.ok(phases.lines[0] >= phases.thought, 'Thinking must disappear before streaming starts');
  assert.ok(phases.lines[1] - phases.lines[0] >= 550, 'Streaming must be gentler than the old 430ms cadence');
  assert.equal(await frame.$$eval(`${pane('before')} .skill-answer-line`, nodes => nodes.length), 5);
  assert.equal(await frame.$$eval(`${pane('after')} .skill-answer-line`, nodes => nodes.length), 7);
  assert.equal(await frame.$eval(`${pane('after')} .skill-answer-line`, node => node.textContent), 'No, Ovi. useEffect is an escape hatch, not your default tool. 🧠');
  assert.equal(await frame.$$eval(`${card} .skill-assistant`, nodes => nodes.length), 2, 'Each pane has exactly one AI response');
  await frame.$eval(`${card} input[type="range"]`, node => { node.value = '36'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  const responseSizes = await frame.$eval(card, node => ['.skill-user p', '.skill-answer-line', '.skill-role', '.skill-generate'].map(selector => parseFloat(getComputedStyle(node.querySelector(selector)).fontSize)));
  assert.ok(responseSizes[0] === 36 && responseSizes[1] === 36 && responseSizes[2] === 18 && responseSizes[3] === 25,
    'Already rendered questions/responses must resize live while role labels and Generate remain fixed');
  await frame.$eval(`${card} input[type="range"]`, node => { node.value = '20'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await generate('before');
  assert.equal(await frame.$$eval(`${pane('before')} .skill-answer-line`, nodes => nodes.length), 0, 'Generate again must start fresh, not append');
  assert.equal(await frame.$$eval(`${pane('after')} .skill-answer-line`, nodes => nodes.length), 7, 'Replay must not clear the other pane');
  await frame.waitForSelector(`${pane('before')} .skill-thinking`);
  await go(0);
  await go(8);
  await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 3400)));
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true, 'Departure during thinking must cancel the fade and response timers');
  await reset();
  await generate('after');
  await frame.waitForSelector(`${pane('after')} .skill-thinking.is-leaving`);
  await go(0);
  await go(8);
  await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true, 'Departure during the thinking fade-out must cancel response startup');
  await openEditor(page);
  await clickCard(page, '#soul-demo-tab');
  await generate('before');
  await go(0);
  await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true, 'Departure during the initial delay must cancel pending output');
  await reset();
  await generate('after');
  await frame.waitForSelector(`${pane('after')} .skill-answer-line`);
  await go(0);
  await go(8);
  assert.equal(await frame.$eval('#soul-content-tab', node => node.getAttribute('aria-selected')), 'true', 'A new visit begins with Content');
  await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 700)));
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true, 'Departure mid-stream must not repopulate a later visit');

  await openEditor(page);
  await frame.focus('#soul-file');
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'PageDown', 'Space', 'End', 'Home']) {
    await page.keyboard.press(key);
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 8, `${key} inside the viewer must not navigate the deck`);
  }
  await frame.$eval('#soul-file', node => node.scrollTop = 0);
  const rail = await frame.$eval(`${card} .skill-rail`, node => node.getBoundingClientRect().toJSON());
  await clickCard(page, '#soul-file');
  await page.mouse.wheel({ deltaY: 700 });
  await frame.waitForFunction(() => document.querySelector('#soul-file').scrollTop > 0);
  assert.deepEqual(await frame.$eval(`${card} .skill-rail`, node => node.getBoundingClientRect().toJSON()), rail, 'Document scrolling must not move the rail');
  await page.click('[data-hf-next]');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 9, 'Outer Next must still advance');
  await page.click('[data-hf-prev]');
  await frame.waitForFunction(() => document.querySelector('#slide-transition')?.hidden !== false);
  await openEditor(page);
  await page.setViewport({ width: 1280, height: 800 });
  await page.waitForFunction(() => document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').getBoundingClientRect().width <= innerWidth);
  await clickCard(page, '#soul-demo-tab');
  await clickCard(page, `${card} .skill-expand`);
  await settleCard(frame);
  assert.equal(await page.evaluate(() => {
    const iframe = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe');
    const stage = iframe.getBoundingClientRect(), titlebar = iframe.contentDocument.querySelector('.skill-titlebar').getBoundingClientRect();
    const footer = iframe.contentDocument.querySelector('[data-side="after"] .skill-pane-footer').getBoundingClientRect();
    const top = document.querySelector('.controls').getBoundingClientRect();
    const bottom = document.querySelector('[data-hf-next]').getBoundingClientRect();
    const scale = stage.width / iframe.contentWindow.innerWidth;
    return stage.top + titlebar.top * scale >= top.bottom && stage.top + footer.bottom * scale <= bottom.top;
  }), true, 'Expanded scaled card must leave the real presentation buttons unobstructed');
  await generate('after');
  const scaled = await page.evaluate(() => {
    const iframe = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe');
    const doc = iframe.contentDocument;
    return { stage: iframe.getBoundingClientRect().toJSON(), inner: [iframe.contentWindow.innerWidth, iframe.contentWindow.innerHeight],
      demo: doc.querySelector('#soul-demo-tab').getAttribute('aria-selected'), selected: document.activeElement?.tagName,
      button: doc.querySelector('[data-side="after"] .skill-generate').getBoundingClientRect().toJSON() };
  });
  assert.equal(await frame.$eval(`${pane('after')} .skill-generate`, node => node.disabled), true, `Scaled iframe controls must remain clickable: ${JSON.stringify(scaled)}`);
  await frame.waitForSelector(`${pane('after')} .skill-thinking`);
  await frame.focus(`${pane('after')} .skill-generate`);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'idle', 'Escape inside the card must retain Exit');
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true, 'Exit must reset the card even when its scene stays selected');
  assert.equal(await frame.$eval(`${card} .skill-expand`, node => node.getAttribute('aria-pressed')), 'false', 'Exit must restore the non-maximized card');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.waitForFunction(() => Math.abs(document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe').getBoundingClientRect().width - innerWidth) < 1);
  await openEditor(page);
  await clickCard(page, '#soul-demo-tab');
  await generate('after');
  assert.equal(await frame.$eval(`${pane('after')} .skill-generate`, node => node.disabled), true, 'Controls must stay clickable after restoring the full-size viewport');
  await frame.waitForSelector(`${pane('after')} .skill-answer-line`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await finished('after');
  assert.equal(await frame.$$eval(`${pane('after')} .skill-answer-line`, nodes => nodes.length), 7, 'Changing reduced motion must finish the answer without further staggering');
  await generate('before');
  assert.equal(await frame.$$eval(`${pane('before')} .skill-answer-line`, nodes => nodes.length), 0, 'Reduced motion still keeps the initial pause');
  await frame.waitForSelector(`${pane('before')} .skill-thinking`);
  assert.equal(await frame.$eval(`${pane('before')} .skill-thinking`, node => node.getAnimations({ subtree: true }).length), 0, 'Reduced motion keeps the thinking hold without added fades or pulse');
  await finished('before');
  assert.equal(await frame.$$eval(`${pane('before')} .skill-answer-line`, nodes => nodes.length), 5);
  await frame.$eval(`${card} input[type="range"]`, node => { node.value = '48'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  const footer = await frame.$eval(`${pane('before')} .skill-pane-footer`, node => node.getBoundingClientRect().toJSON());
  await frame.$eval(`${pane('before')} .skill-chat`, node => node.scrollTop = node.scrollHeight);
  assert.deepEqual(await frame.$eval(`${pane('before')} .skill-pane-footer`, node => node.getBoundingClientRect().toJSON()), footer, 'Chat scrolling must not move Generate');
  assert.equal(await frame.$eval(`${pane('after')} .skill-chat`, node => node.scrollTop > 0), true, 'Each long response must have its own scroll area');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const loaded = frame.waitForNavigation();
  await frame.evaluate(() => location.reload());
  await loaded;
  await frame.waitForFunction(() => document.querySelector('#slide-09').hasAttribute('data-active'));
  await frame.waitForFunction(() => document.querySelector('#slide-transition')?.hidden !== false);
  assert.equal(await frame.$eval(card, node => node.hidden && node.getClientRects().length === 0), true, 'Reload must not automatically reopen the editor');
  assert.equal(await frame.$$eval('.skill-text-size input', nodes => nodes.every(node => node.value === '20')), true, 'Reload must reset the shared size to its 20px default');
  assert.equal(await frame.$eval('#soul-file', node => getComputedStyle(node).fontSize), '20px');
  assert.equal(await frame.$eval('#soul-content-tab', node => node.getAttribute('aria-selected')), 'true');
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true, 'Composition reload must start with usable empty demo panes');
}

async function checkWorkflowCard(page, frame) {
  const workflow = '#slide-10 [data-skill-card]';
  const go = index => page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), index);
  await openEditor(page);
  await clickCard(page, `${card} .skill-expand`);
  await settleCard(frame);
  await frame.focus(`${card} .skill-expand`);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 9);
  await frame.waitForFunction(() => document.querySelector('#slide-transition')?.hidden !== false);
  await openEditor(page, '#slide-10');
  assert.equal(await frame.$eval(workflow, node => node.hasAttribute('data-expanded')), true, 'Slide 10 inherits maximization from slide 9');
  assert.equal(await frame.$eval('#workflow-file-tab', node => node.textContent), 'instructions/workflow-composition.md');
  assert.equal(await frame.$$eval('#workflow-file li', nodes => nodes.length), 7, 'Render all seven rules from the supplied instruction');
  const number = await readFile(new URL('../artwork/numbers/2.svg', import.meta.url), 'utf8');
  assert.deepEqual(await frame.$$eval(`${workflow} .skill-number path`, nodes => nodes.map(node => node.getAttribute('d'))),
    [...number.matchAll(/\bd="([^"]+)"/g)].map(match => match[1]));
  await clickCard(page, '#workflow-demo-tab');
  for (const side of ['before', 'after']) await clickCard(page, `${workflow} [data-side="${side}"] .skill-generate`);
  assert.equal(await frame.$$eval(`${workflow} .skill-chat > .skill-user p`, nodes => nodes.every(node => node.textContent === 'I need a feature that lets users select themes on the website.')), true);
  await frame.waitForSelector(`${workflow} .skill-answer-line`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await frame.waitForFunction(selector => [...document.querySelectorAll(`${selector} .skill-generate`)].every(node => !node.disabled), {}, workflow);
  const transcript = await frame.$eval(workflow, node => {
    const after = node.querySelector('[data-side="after"] .skill-chat');
    const color = selector => getComputedStyle(after.querySelector(selector)).color;
    const bubbles = [...after.querySelectorAll('.skill-user')].map(bubble => {
      const style = getComputedStyle(bubble), label = getComputedStyle(bubble.querySelector('.skill-role'));
      return [style.backgroundColor, style.padding, style.borderRadius, style.color, label.color, label.fontWeight];
    });
    return { bubbles, tool: color('.skill-tool'), toolCode: color('.skill-tool code'), status: color('.skill-status'),
      red: color('.skill-red'), green: color('.skill-green'), skillName: color('.skill-status code'),
      labelsBold: [...after.querySelectorAll('.skill-answer-line > strong')].every(label => Number(getComputedStyle(label).fontWeight) >= 700),
      text: after.textContent, scrolls: after.scrollHeight > after.clientHeight,
      before: node.querySelector('[data-side="before"] .skill-chat').textContent };
  });
  assert.ok(transcript.bubbles.length > 4 && transcript.bubbles.every(bubble => JSON.stringify(bubble) === JSON.stringify(transcript.bubbles[0])), 'Follow-up replies must match the initial User bubble including its label');
  assert.equal(transcript.bubbles[0][3], 'rgb(255, 255, 255)');
  assert.equal(transcript.tool, 'rgb(169, 177, 214)');
  assert.equal(transcript.toolCode, 'rgb(32, 199, 255)', 'Inline code is cyan even within muted Tool lines');
  assert.equal(transcript.status, 'rgb(255, 255, 255)');
  assert.equal(transcript.red, 'rgb(247, 118, 142)');
  assert.equal(transcript.green, 'rgb(158, 206, 106)');
  assert.equal(transcript.skillName, 'rgb(32, 199, 255)', 'Skill names must be cyan, distinct from GREEN tests');
  assert.ok(transcript.labelsBold && transcript.scrolls);
  assert.ok(transcript.before.includes('Done!') && !transcript.before.includes('clarify-intent'));
  for (const phrase of ['clarify-intent', 'brainstorming', 'Approved', 'writing-plans', 'test-driven-development', 'RED', 'GREEN', 'ponytail-review', 'blocked-storage', 'Finally done']) assert.ok(transcript.text.includes(phrase), `Show ${phrase} in the composed workflow`);
  assert.ok(transcript.text.indexOf('Created tests') < transcript.text.indexOf('Implemented the selector'), 'Tests precede implementation');
  await clickCard(page, `${workflow} [data-side="after"] .skill-generate`);
  assert.equal(await frame.$$eval(`${workflow} [data-side="after"] .skill-user`, nodes => nodes.length), 1, 'Replay clears all old User replies');
  await frame.focus(`${workflow} .skill-expand`);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 8);
  assert.equal(await frame.$eval(card, node => node.hasAttribute('data-expanded')), true);
  await go(9);
  assert.equal(await frame.$$eval(`${workflow} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true, 'Departure cancels the complete transcript');
  await openEditor(page, '#slide-10');
  await frame.focus(`${workflow} .skill-expand`);
  await page.keyboard.press('Escape');
  assert.equal(await frame.$$eval('[data-skill-card]', nodes => nodes.every(node => !node.hasAttribute('data-expanded'))), true);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}

async function checkPrimeCard(page, frame) {
  const prime = '#slide-11 [data-skill-card]';
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(10));
  await openEditor(page, '#slide-11');
  assert.equal(await frame.$eval('#prime-file-tab', node => node.textContent), 'commands/prime.md');
  const content = await frame.$eval('#prime-file', node => node.textContent);
  for (const phrase of ['$ARGUMENTS', 'home directory', 'missing or unreadable', 'ongoing session context', 'Do not execute unrelated tasks']) assert.ok(content.includes(phrase));
  const number = await readFile(new URL('../artwork/numbers/3.svg', import.meta.url), 'utf8');
  assert.deepEqual(await frame.$$eval(`${prime} .skill-number path`, nodes => nodes.map(node => node.getAttribute('d'))), [...number.matchAll(/\bd="([^"]+)"/g)].map(match => match[1]));
  await clickCard(page, '#prime-demo-tab');
  for (const side of ['before', 'after']) await clickCard(page, `${prime} [data-side="${side}"] .skill-generate`);
  const questions = await frame.$$eval(`${prime} .skill-chat > .skill-user p`, nodes => nodes.map(node => node.textContent));
  assert.ok(questions[0].startsWith('Remember in this session') && questions[0].includes('WSL') && questions[0].includes('Docker') && questions[0].includes('CDP'));
  assert.ok(!questions[0].includes('…') && !questions[0].includes('\n'), 'Manual environment prompt is complete sentences in one paragraph');
  assert.equal(questions[1], '/prime ~/PROJECT-1-ENV.md', 'Each pane must use its own question');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await frame.waitForFunction(selector => [...document.querySelectorAll(`${selector} .skill-generate`)].every(node => !node.disabled), {}, prime);
  assert.equal(await frame.$eval(`${prime} [data-side="before"] .skill-answer`, node => node.textContent.trim()), 'Agent: Ok.');
  assert.equal(await frame.$$eval(`${prime} [data-side="after"] .skill-answer-point`, nodes => nodes.length), 4);
  assert.equal(await frame.$eval(`${prime} [data-side="after"] .skill-answer-line:last-child`, node => node.textContent), "Agent: I didn't execute any commands. What are we working on in this session?");
  assert.equal(await frame.$eval(`${prime} [data-side="after"] .skill-tool`, node => getComputedStyle(node).color), 'rgb(169, 177, 214)');
  await clickCard(page, `${prime} [data-side="after"] .skill-generate`);
  assert.equal(await frame.$eval(`${prime} [data-side="after"] .skill-user p`, node => node.textContent), questions[1], 'Replay retains the per-pane question');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(9));
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(10));
  assert.equal(await frame.$$eval(`${prime} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true, 'Departure clears both pane-specific conversations');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}

async function checkBroCard(page, frame) {
  const bro = '#slide-12 [data-skill-card]';
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(11));
  await openEditor(page, '#slide-12');
  assert.deepEqual(await frame.$$eval(`${bro} .skill-files button`, nodes => nodes.map(node => node.textContent)), ['commands/bro.md', 'skills/bro/SKILL.md']);
  await clickCard(page, '#bro-skill-tab');
  assert.equal(await frame.$eval('#bro-skill-file', node => !node.hidden && node.scrollHeight > node.clientHeight), true);
  assert.equal(await frame.$$eval('#bro-skill-file h3', nodes => nodes.length), 10, 'Render all ten rules from the supplied skill');
  assert.ok(await frame.$eval('#bro-skill-file', node => node.textContent.includes('disable-model-invocation: true') && node.textContent.includes('If yes, send.')));
  const number = await readFile(new URL('../artwork/numbers/4.svg', import.meta.url), 'utf8');
  assert.deepEqual(await frame.$$eval(`${bro} .skill-number path`, nodes => nodes.map(node => node.getAttribute('d'))), [...number.matchAll(/\bd="([^"]+)"/g)].map(match => match[1]));
  await frame.focus('#bro-skill-tab');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await frame.$eval('#bro-command-file', node => !node.hidden && node.textContent.includes('immediately previous assistant response only.')), true);
  await clickCard(page, '#bro-demo-tab');
  for (const side of ['before', 'after']) await clickCard(page, `${bro} [data-side="${side}"] .skill-generate`);
  assert.equal(await frame.$$eval(`${bro} .skill-chat > .skill-user p`, nodes => nodes.every(node => node.textContent === 'Give me a summary of the comments on my PR.')), true);
  await frame.waitForSelector(`${bro} [data-side="after"] .skill-answer > .skill-user`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await frame.waitForFunction(selector => [...document.querySelectorAll(`${selector} .skill-generate`)].every(node => !node.disabled), {}, bro);
  const results = await frame.$eval(bro, node => {
    const before = node.querySelector('[data-side="before"] .skill-answer'), after = node.querySelector('[data-side="after"] .skill-answer');
    const initial = node.querySelector('[data-side="after"] .skill-chat > .skill-user'), followup = after.querySelector('.skill-user');
    const style = bubble => ['backgroundColor', 'padding', 'borderRadius', 'color'].map(key => getComputedStyle(bubble)[key]);
    return { before: [...before.children].map(child => child.textContent), after: [...after.children].slice(0, 5).map(child => child.textContent),
      followup: followup.querySelector('p').textContent, consistent: JSON.stringify(style(initial)) === JSON.stringify(style(followup)),
      steps: after.querySelectorAll('ol li').length, last: after.lastElementChild.textContent,
      codes: [...node.querySelectorAll('code')].filter(code => !code.closest('pre')).map(code => getComputedStyle(code).color) };
  });
  assert.equal(results.before.length, 5);
  assert.deepEqual(results.after, results.before, 'Both panes must start with exactly the same long answer');
  assert.equal(results.followup, '/bro');
  assert.ok(results.consistent && results.steps === 4);
  assert.equal(results.last, 'Next: Open src/orders/createOrder.ts.');
  assert.ok(results.codes.length > 0 && results.codes.every(color => color === 'rgb(32, 199, 255)'), 'All inline code uses cyan');
  await clickCard(page, `${bro} [data-side="after"] .skill-generate`);
  assert.equal(await frame.$$eval(`${bro} [data-side="after"] .skill-user`, nodes => nodes.length), 1, 'Replay removes the previous /bro turn');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(10));
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(11));
  assert.equal(await frame.$$eval(`${bro} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true);
  assert.equal(await frame.$eval('#bro-command-tab', node => node.getAttribute('aria-selected')), 'true', 'Revisit restores the first Content file');
  assert.equal(await frame.$$eval('#soul-file code', nodes => nodes.every(node => getComputedStyle(node).color === 'rgb(32, 199, 255)')), true, 'Shared inline-code color reaches slide 9 too');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}

async function checkClarifyCard(page, frame) {
  const clarify = '#slide-13 [data-skill-card]';
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(12));
  await openEditor(page, '#slide-13');
  assert.deepEqual(await frame.$$eval(`${clarify} .skill-files button`, nodes => nodes.map(node => node.textContent)), ['commands/clarify-intent.md', 'skills/clarify-intent/SKILL.md']);
  await clickCard(page, '#clarify-skill-tab');
  assert.equal(await frame.$eval('#clarify-skill-file', node => !node.hidden && node.scrollHeight > node.clientHeight), true);
  const content = await frame.$eval('#clarify-skill-file', node => node.textContent);
  for (const phrase of ['This skill owns intent, not design.', 'Ask one question at a time', 'Provisional', 'Redis', 'The intent gate is finished']) assert.ok(content.includes(phrase), `Preserve ${phrase} in the full skill snapshot`);
  assert.equal(await frame.$$eval('#clarify-skill-file table', nodes => nodes.length), 2, 'Render both Markdown comparison tables');
  const number = await readFile(new URL('../artwork/numbers/5.svg', import.meta.url), 'utf8');
  assert.deepEqual(await frame.$$eval(`${clarify} .skill-number path`, nodes => nodes.map(node => node.getAttribute('d'))), [...number.matchAll(/\bd="([^"]+)"/g)].map(match => match[1]));
  await frame.focus('#clarify-skill-tab');
  await page.keyboard.press('Home');
  assert.equal(await frame.$eval('#clarify-command-file', node => !node.hidden && node.textContent.includes('$ARGUMENTS')), true);
  await clickCard(page, '#clarify-demo-tab');
  for (const side of ['before', 'after']) await clickCard(page, `${clarify} [data-side="${side}"] .skill-generate`);
  assert.equal(await frame.$$eval(`${clarify} .skill-chat > .skill-user p`, nodes => nodes.every(node => node.textContent === 'I need a feature that lets users select themes on the website.')), true);
  await frame.waitForSelector(`${clarify} [data-side="after"] .skill-answer > .skill-user`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await frame.waitForFunction(selector => [...document.querySelectorAll(`${selector} .skill-generate`)].every(node => !node.disabled), {}, clarify);
  const result = await frame.$eval(clarify, node => {
    const after = node.querySelector('[data-side="after"] .skill-chat');
    const bubbles = [...after.querySelectorAll('.skill-user')];
    const style = bubble => ['backgroundColor', 'padding', 'borderRadius', 'color'].map(key => getComputedStyle(bubble)[key]);
    return { answers: bubbles.slice(1).map(bubble => bubble.querySelector('p').textContent),
      consistent: bubbles.every(bubble => JSON.stringify(style(bubble)) === JSON.stringify(style(bubbles[0]))),
      points: after.querySelectorAll('.skill-answer-point').length,
      final: after.querySelector('.skill-answer').lastElementChild.textContent,
      skillColor: getComputedStyle(after.querySelector('.skill-status code')).color,
      before: node.querySelector('[data-side="before"] .skill-chat').textContent };
  });
  assert.deepEqual(result.answers, ['Personal preference. One person’s choice must not affect anyone else.', 'Only this browser. We don’t need account syncing.', 'Existing themes only. No custom-theme editor.']);
  assert.ok(result.consistent && result.points === 3);
  assert.equal(result.skillColor, 'rgb(32, 199, 255)');
  assert.ok(result.before.includes('account') && result.before.includes('Done!'));
  assert.equal(result.final, 'Agent: Theme options and interface design come next. No implementation yet.');
  await clickCard(page, `${clarify} [data-side="after"] .skill-generate`);
  assert.equal(await frame.$$eval(`${clarify} [data-side="after"] .skill-user`, nodes => nodes.length), 1);
  await clickCard(page, `${clarify} .skill-expand`);
  await frame.focus(`${clarify} .skill-expand`);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 11);
  await openEditor(page, '#slide-12');
  await frame.focus('#slide-12 .skill-expand');
  await page.keyboard.press('ArrowRight');
  assert.equal(await frame.$eval(clarify, node => node.hasAttribute('data-expanded')), true, 'Maximization survives navigation to/from slide 13');
  assert.equal(await frame.$$eval(`${clarify} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true);
  assert.equal(await frame.$eval('#clarify-command-tab', node => node.getAttribute('aria-selected')), 'true');
  await openEditor(page, '#slide-13');
  await frame.focus(`${clarify} .skill-expand`);
  await page.keyboard.press('Escape');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}

async function checkExplanationsCard(page, frame) {
  const card = '#slide-14 [data-skill-card]';
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(13));
  await openEditor(page, '#slide-14');
  assert.deepEqual(await frame.$$eval(`${card} .skill-files button`, nodes => nodes.map(node => node.textContent)), ['commands/codebase-explanations.md', 'skills/codebase-explanations/SKILL.md', 'skills/codebase-explanations/system.md', 'skills/codebase-explanations/location.md', 'skills/codebase-explanations/behavior.md', 'skills/codebase-explanations/difference.md', 'skills/codebase-explanations/decision.md']);
  await frame.focus('#explanations-command-tab');
  await page.keyboard.press('End');
  assert.equal(await frame.$eval(`${card} .skill-files`, node => node.scrollLeft > 0), true, 'Seven file tabs must scroll to reveal the last tab');
  for (const [name, ending] of [['decision', 'For evaluative questions'], ['difference', 'The Difference grammar only establishes'], ['behavior', 'If the user\'s primary question becomes'], ['location', 'Prefer the smallest repository map']]) {
    assert.equal(await frame.$eval(`#explanations-${name}-file`, (node, ending) => !node.hidden && node.textContent.includes(ending) && node.scrollHeight > node.clientHeight, ending), true, `The ${name} template must be complete and reachable`);
    await page.keyboard.press('ArrowLeft');
  }
  await clickCard(page, '#explanations-system-tab');
  assert.equal(await frame.$eval('#explanations-system-file', node => !node.hidden && node.scrollHeight > node.clientHeight && node.textContent.includes('Snippets are evidence, not miniature tutorials.')), true);
  await frame.focus('#explanations-system-tab');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await frame.$eval('#explanations-skill-file', node => !node.hidden && node.textContent.includes('Template Routing') && node.textContent.includes('Do not create hybrid templates.')), true);
  const number = await readFile(new URL('../artwork/numbers/6.svg', import.meta.url), 'utf8');
  assert.deepEqual(await frame.$$eval(`${card} .skill-number path`, nodes => nodes.map(node => node.getAttribute('d'))), [...number.matchAll(/\bd="([^"]+)"/g)].map(match => match[1]));
  await clickCard(page, '#explanations-demo-tab');
  for (const side of ['before', 'after']) await clickCard(page, `${card} [data-side="${side}"] .skill-generate`);
  assert.equal(await frame.$$eval(`${card} .skill-chat > .skill-user p`, nodes => nodes.every(node => node.textContent === 'how does this app work?')), true);
  await frame.waitForSelector(`${card} [data-side="after"] .skill-answer-line`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await frame.waitForFunction(selector => [...document.querySelectorAll(`${selector} .skill-generate`)].every(node => !node.disabled), {}, card);
  const result = await frame.$eval(card, node => {
    const before = node.querySelector('[data-side="before"] .skill-answer'), after = node.querySelector('[data-side="after"] .skill-answer');
    return { headings: [...after.querySelectorAll('h4')].map(node => node.textContent), beforeHeadings: before.querySelectorAll('h4').length,
      headingStyles: [...after.querySelectorAll('h4')].map(heading => ({ color: getComputedStyle(heading).color, gap: heading.nextElementSibling.getBoundingClientRect().top - heading.getBoundingClientRect().bottom, size: parseFloat(getComputedStyle(heading).fontSize) })),
      diagram: after.querySelector('pre').textContent, steps: after.querySelectorAll('ol li').length,
      snippets: after.querySelectorAll('.skill-code-anchor pre').length,
      before: before.textContent, after: after.textContent,
      fits: [...after.querySelectorAll('pre')].every(pre => pre.getBoundingClientRect().right <= pre.closest('.skill-chat').getBoundingClientRect().right),
      inlineColors: [...after.querySelectorAll('code')].filter(code => !code.closest('pre')).map(code => getComputedStyle(code).color) };
  });
  assert.deepEqual(result.headings, ['Summary', 'Diagram', 'How it works', 'Key code', 'Important details']);
  assert.ok(result.headingStyles.every(style => style.color === 'rgb(255, 32, 216)' && style.gap >= style.size * .9), 'Magenta section headings must have a blank-line-sized gap before their content');
  assert.equal(result.beforeHeadings, 0, 'Before stays an unstructured prose explanation');
  assert.ok(result.diagram.includes('React SPA') && result.diagram.includes('Hono API') && result.diagram.includes('SQLite'));
  assert.ok(result.diagram.split('\n').length >= 12 && result.diagram.includes('API client') && result.diagram.includes('validation') && result.diagram.includes('JSON'), 'Diagram must show browser/server boundaries and internal responsibilities, not just one chain');
  assert.equal(result.steps, 4);
  assert.equal(result.snippets, 5, 'Ground the fictional system in five illustrative code anchors');
  for (const fact of ['SQLite', 'React', 'Hono', 'error', 'web/src/App.tsx', 'server/src/db.ts']) assert.ok(result.before.includes(fact) && result.after.includes(fact), `Both sides explain ${fact} in the same imagined app`);
  assert.ok(result.fits && result.inlineColors.length && result.inlineColors.every(color => color === 'rgb(32, 199, 255)'));
  await frame.$eval(`${card} input[type="range"]`, input => { input.value = '48'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await frame.$eval(`${card} [data-side="after"] .skill-answer`, node => [...node.querySelectorAll('pre')].some(pre => pre.scrollWidth > pre.clientWidth) && [...node.querySelectorAll('pre')].every(pre => pre.getBoundingClientRect().right <= pre.closest('.skill-chat').getBoundingClientRect().right)), true, 'Large snippets scroll horizontally instead of widening the response pane');
  await clickCard(page, `${card} [data-side="after"] .skill-generate`);
  assert.equal(await frame.$$eval(`${card} [data-side="after"] h4`, nodes => nodes.length), 0, 'Replay clears all explanation sections');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(12));
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(13));
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true);
  assert.equal(await frame.$eval('#explanations-command-tab', node => node.getAttribute('aria-selected')), 'true');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}

async function checkReviewCard(page, frame) {
  const card = '#slide-16 [data-skill-card]';
  assert.equal(await frame.$$eval('#slide-15 .skill-pane', nodes => nodes.length), 0, 'Slide 15 uses a screenshot rather than response panes');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(15));
  await openEditor(page, '#slide-16');
  assert.deepEqual(await frame.$$eval(`${card} .skill-files button`, nodes => nodes.map(node => node.textContent)), ['commands/pr-review.md', 'skills/pr-review/SKILL.md', 'skills/pr-review/architecture-gate.md', 'skills/pr-review/follow-up-reviews.md']);
  await frame.focus('#review-command-tab');
  await page.keyboard.press('End');
  assert.equal(await frame.$eval('#review-followup-file', node => !node.hidden && node.textContent.includes('Invalidate only what the new changes actually invalidate.')), true);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await frame.$eval('#review-architecture-file', node => !node.hidden && node.scrollHeight > node.clientHeight && node.textContent.includes('The Architectural Gate protects the') && node.textContent.includes('direction of travel')), true);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await frame.$eval('#review-skill-file', node => !node.hidden && node.scrollHeight > node.clientHeight && node.textContent.includes('disable-model-invocation: true') && node.textContent.includes('Does the implementation actually work?')), true);
  const number = await readFile(new URL('../artwork/numbers/8.svg', import.meta.url), 'utf8');
  assert.deepEqual(await frame.$$eval(`${card} .skill-number path`, nodes => nodes.map(node => node.getAttribute('d'))), [...number.matchAll(/\bd="([^"]+)"/g)].map(match => match[1]));
  await clickCard(page, '#review-demo-tab');
  for (const side of ['before', 'after']) await clickCard(page, `${card} [data-side="${side}"] .skill-generate`);
  assert.equal(await frame.$$eval(`${card} .skill-chat > .skill-user p`, nodes => nodes.every(node => node.textContent === 'Please review PR https://github.com/ovi-ispas/todo-app/pull/1')), true);
  await frame.waitForSelector(`${card} [data-side="after"] .skill-answer-line`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await frame.waitForFunction(selector => [...document.querySelectorAll(`${selector} .skill-generate`)].every(node => !node.disabled), {}, card);
  const result = await frame.$eval(card, node => {
    const after = node.querySelector('[data-side="after"] .skill-answer');
    return { text: after.textContent, before: node.querySelector('[data-side="before"] .skill-answer').textContent,
      findings: after.querySelectorAll('.skill-review-finding').length, tableRows: after.querySelectorAll('tbody tr').length,
      last: after.lastElementChild.textContent,
      headings: [...after.querySelectorAll('h4')].map(node => getComputedStyle(node).color),
      links: node.querySelectorAll('a[href*="todo-app/pull/1"]').length };
  });
  assert.ok(result.before.includes('looks good to merge') && !result.before.includes('Correctness Issue'));
  assert.equal(result.findings, 1, 'The gated review raises exactly one correctness finding');
  const gates = ['Intent Gate: passed', 'Change Map', 'Architectural Gate: passed', 'Correctness Gate: failed'];
  const positions = gates.map(gate => result.text.indexOf(gate));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), 'Review gates must follow intent → map → architecture → correctness');
  for (const phrase of ['Summary:', 'Important consequences:', 'Diagram', 'Differences', 'toggleTodo(index)', 'A becomes active again', 'B remains unchanged', 'todo.id', 'Regression test:']) assert.ok(result.text.includes(phrase), `Show ${phrase} in the fictional review`);
  assert.equal(result.tableRows, 2);
  assert.equal(result.last, 'Verdict: Fix this before merging.');
  assert.ok(result.headings.every(color => color === 'rgb(255, 32, 216)'));
  assert.equal(result.links, 0, 'The fake PR URL is inert display text');
  await clickCard(page, `${card} [data-side="after"] .skill-generate`);
  assert.equal(await frame.$$eval(`${card} [data-side="after"] .skill-review-finding`, nodes => nodes.length), 0);
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(14));
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(15));
  assert.equal(await frame.$$eval(`${card} .skill-chat`, nodes => nodes.every(node => !node.childElementCount)), true);
  assert.equal(await frame.$eval('#review-command-tab', node => node.getAttribute('aria-selected')), 'true');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}

async function checkScreenshotCards(page, frame) {
  for (const [number, prefix, digits, image, files] of [
    [15, 'tour', [7], 'guided-tour.png', ['skills/visual-changes/SKILL.md', 'skills/visual-changes/references/tour-and-rendering.md', 'skills/visual-changes/references/template.html']],
    [17, 'architecture', [9], 'architecture-documentation.png', ['skills/architecture-documentation/SKILL.md', 'skills/architecture-documentation/documentation.md', 'skills/architecture-documentation/generation.md', 'skills/architecture-documentation/maintenance.md']],
    [18, 'save', [1, 0], 'saved-response.png', ['commands/save.md', 'skills/save-response/SKILL.md']],
  ]) {
    const card = `#slide-${number} [data-skill-card]`;
    await page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), number - 1);
    await openEditor(page, `#slide-${number}`);
    await frame.waitForFunction(selector => [...document.querySelectorAll(`${selector} [data-skill-document]`)].every(node => node.dataset.documentState === 'loaded'), {}, card);
    assert.deepEqual(await frame.$$eval(`${card} .skill-files button`, nodes => nodes.map(node => node.textContent)), files);
    for (let index = 0; index < digits.length; index++) {
      const svg = await readFile(new URL(`../artwork/numbers/${digits[index]}.svg`, import.meta.url), 'utf8');
      assert.deepEqual(await frame.$$eval(`${card} .skill-number svg:nth-child(${index + 1}) path`, nodes => nodes.map(node => node.getAttribute('d'))), [...svg.matchAll(/\bd="([^"]+)"/g)].map(match => match[1]));
    }
    await frame.focus(`${card} .skill-files button`);
    for (let index = 0; index < files.length; index++) {
      const document = await frame.$eval(`${card} .skill-document:not([hidden])`, node => ({ text: node.textContent.trim(), busy: node.hasAttribute('aria-busy'), executable: node.querySelectorAll('script, iframe, object, embed').length }));
      assert.ok(document.text.length > 100 && !document.busy && document.executable === 0, `Load the full inert ${files[index]} snapshot`);
      if (index + 1 < files.length) await page.keyboard.press('ArrowRight');
    }
    await clickCard(page, `#${prefix}-demo-tab`);
    assert.equal(await frame.$eval(`${card} .skill-demo-title`, node => !node.hidden && node.textContent === 'Screenshot Preview'), true);
    assert.equal(await frame.$$eval(`${card} .skill-pane, ${card} .skill-generate, ${card} .skill-thinking, ${card} [data-thinking], ${card} [data-answer]`, nodes => nodes.length), 0, 'Screenshot cards must contain no chat machinery');
    await frame.$eval(`${card} .skill-screenshot img`, image => image.decode());
    const metrics = () => frame.$eval(`${card} .skill-screenshot`, node => {
      const image = node.querySelector('img'), box = node.getBoundingClientRect(), imageBox = image.getBoundingClientRect();
      return { fills: Math.abs(box.width - imageBox.width) < 1 && Math.abs(box.height - imageBox.height) < 1,
        fit: getComputedStyle(image).objectFit, alt: image.alt, loaded: image.naturalWidth > 0,
        src: image.getAttribute('src'), children: node.children.length };
    });
    const normal = await metrics();
    assert.ok(normal.fills && normal.loaded && normal.alt && normal.children === 1);
    assert.equal(normal.fit, 'contain', 'Fill the preview element without stretching or cropping the screenshot');
    assert.equal(normal.src, `assets/skill-demos/${image}`);
    await clickCard(page, `${card} .skill-expand`);
    await frame.$eval(card, node => Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))).then(() => null));
    assert.ok((await metrics()).fills, 'Image must fill the maximized preview as well');
    await clickCard(page, `#${prefix}-content-tab`);
    await frame.$eval(`${card} input[type="range"]`, input => { input.value = '36'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await frame.$eval(`${card} .skill-document:not([hidden])`, node => getComputedStyle(node).fontSize), '36px');
    await clickCard(page, `#${prefix}-demo-tab`);
    assert.ok((await metrics()).fills, 'Text-size changes must not alter screenshot sizing');
    await frame.focus(`${card} .skill-expand`);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), number - 2);
    await page.$eval('hyperframes-slideshow', (deck, index) => deck.controller.goToSlide(index), number - 1);
    assert.equal(await frame.$eval(card, node => node.hasAttribute('data-expanded')), true);
    assert.equal(await frame.$eval(`#${prefix}-content-tab`, node => node.getAttribute('aria-selected')), 'true');
    await openEditor(page, `#slide-${number}`);
    await frame.focus(`${card} .skill-expand`);
    await page.keyboard.press('Escape');
    assert.equal(await frame.$eval(card, node => node.hasAttribute('data-expanded')), false);
  }
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(14));
  await openEditor(page, '#slide-15');
  await clickCard(page, '#tour-file-2-tab');
  const templateText = await frame.$eval('#tour-file-2 pre code', node => node.textContent);
  assert.equal(createHash('sha256').update(templateText).digest('hex'), 'e0574475f07c54be7c9058a2d5bebfd86b24c37dcb278bc872eb71b1aa09ac22', 'The complete template source must be displayed without executing it');
  await checkDocumentFailure(page);
}

async function checkDocumentFailure(source) {
  const page = await source.browser().newPage();
  const url = new URL('composition/assets/skill-documents/save-command.html', source.url()).href;
  try {
    await page.setRequestInterception(true);
    page.on('request', request => request.url() === url ? request.respond({ status: 503, contentType: 'text/plain', body: 'Unavailable' }) : request.continue());
    await page.goto(source.url(), { waitUntil: 'load', timeout: 120000 });
    const frame = page.frames().find(frame => frame.url().includes('/composition/index.html'));
    await frame.waitForFunction(() => document.querySelector('#save-file-0')?.dataset.documentState === 'error');
    assert.equal(await frame.$eval('#save-file-0', node => !node.hasAttribute('aria-busy') && node.textContent.includes('Reload')), true, 'Document failures must show a recoverable message, not an empty panel');
  } finally { await page.close(); }
}

async function checkFileFixtures(page, frame) {
  const fixtureMarkup = await frame.$eval(card, card => {
    const first = card.cloneNode(true), second = card.cloneNode(true);
    for (const copy of [first, second]) copy.querySelector('.skill-close')?.remove();
    const list = second.querySelector('.skill-files'), panel = second.querySelector('.skill-document');
    for (let i = 1; i < 6; i++) {
      const tab = list.firstElementChild.cloneNode(true), file = panel.cloneNode(false);
      tab.id = `fixture-tab-${i}`; file.id = `fixture-file-${i}`;
      tab.setAttribute('aria-controls', file.id); tab.setAttribute('aria-selected', 'false'); tab.tabIndex = -1;
      file.setAttribute('aria-labelledby', tab.id); file.hidden = true;
      tab.textContent = `examples/long-example-filename-number-${i}.${i === 1 ? 'html' : 'js'}`;
      const pre = document.createElement('pre'), code = document.createElement('code'), token = document.createElement('span');
      token.className = 'syntax-keyword';
      token.textContent = i === 1 ? '<script>window.exampleExecuted = true</script>' : 'const';
      code.append(token, document.createTextNode(i === 1 ? '' : ' answer = 42;')); pre.append(code); file.append(pre);
      list.append(tab); panel.parentElement.append(file);
    }
    for (const node of [second, ...second.querySelectorAll('[id], [aria-controls], [aria-labelledby]')]) {
      if (node.id) node.id = `second-${node.id}`;
      for (const attr of ['aria-controls', 'aria-labelledby']) if (node.hasAttribute(attr)) node.setAttribute(attr, `second-${node.getAttribute(attr)}`);
    }
    return [first, second].map(node => `<section class="scene" data-active>${node.outerHTML}</section>`).join('');
  });
  const fixture = await page.browser().newPage();
  const url = new URL('/composition/skill-card-fixture.html', page.url()).href;
  try {
    await fixture.setViewport({ width: 1920, height: 1080 });
    await fixture.setRequestInterception(true);
    fixture.on('request', request => request.url() === url ? request.respond({ status: 200, contentType: 'text/html',
      body: `<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="skill-card.css"><style>body{margin:0}.scene{position:relative;height:1080px;width:1920px}</style>${fixtureMarkup}<script type="module" src="skill-card.js"></script>` }) : request.continue());
    await fixture.goto(url);
    await fixture.click('.scene:nth-child(2) > .skill-open');
    await fixture.click('#second-fixture-tab-1');
    assert.equal(await fixture.$eval('#second-fixture-file-1', node => !node.hidden && node.textContent.includes('<script>')), true);
    assert.equal(await fixture.evaluate(() => window.exampleExecuted), undefined, 'HTML examples must remain inert code');
    assert.equal(await fixture.$eval('#soul-file-tab', tab => tab.getAttribute('aria-selected')), 'true', 'Card instances must not share tab state');
    await fixture.focus('#second-fixture-tab-1');
    await fixture.keyboard.press('End');
    assert.equal(await fixture.$eval('#second-fixture-tab-5', tab => tab.matches(':focus') && tab.tabIndex === 0 && tab.getAttribute('aria-selected') === 'true'), true);
    assert.equal(await fixture.$eval('#second-fixture-file-5', node => !node.hidden && getComputedStyle(node.querySelector('.syntax-keyword')).color === 'rgb(187, 154, 247)'), true,
      'JavaScript examples must display static Tokyo Night tokens');
    assert.equal(await fixture.$eval('.scene:nth-child(2) .skill-files', node => node.scrollWidth > node.clientWidth), true, 'Long file labels must scroll horizontally');
    await fixture.focus('.scene:nth-child(2) input[type="range"]');
    await fixture.keyboard.press('End');
    assert.ok(Math.abs(await fixture.$eval('#second-fixture-file-5 pre code', node => parseFloat(getComputedStyle(node).fontSize)) - 41.6) < .01, 'Static code blocks must scale with document content');
    assert.equal(await fixture.$eval('#soul-file', node => getComputedStyle(node).fontSize), '48px', 'Text size must be shared across card instances');
    await fixture.click('.scene:first-child > .skill-open');
    await fixture.click('.scene:first-child .skill-expand');
    assert.equal(await fixture.$$eval('[data-skill-card]', nodes => nodes.every(node => node.hasAttribute('data-expanded') && node.querySelector('.skill-expand').getAttribute('aria-pressed') === 'true')), true,
      'Maximized mode must be shared by all skill cards in the presentation');
    await fixture.waitForFunction(() => [...document.querySelectorAll('[data-skill-card]')].every(node => node.getAnimations().every(animation => animation.playState === 'finished')));
    await fixture.click('.scene:nth-child(2) .skill-expand');
    assert.equal(await fixture.$$eval('[data-skill-card]', nodes => nodes.every(node => !node.hasAttribute('data-expanded'))), true, 'Restoring any skill card must update the shared presentation mode');
    assert.equal(await fixture.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(node => node.id); return ids.length === new Set(ids).size; }), true);
  } finally { await fixture.close(); }
}
