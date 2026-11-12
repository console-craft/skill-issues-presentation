import assert from 'node:assert/strict';

const prompt = 'Read https://raw.githubusercontent.com/console-craft/skills/refs/heads/main/README.md and install the listed skills globally in my setup. They are intended for usage in OpenCode but should be generic enough for you to adapt the wiring to the harness that you run in.';

export async function checkInstallSlide(page, frame) {
  assert.ok(await frame.$('#slide-21'), 'The manual installation prompt must exist after slide20');
  const errors = [], requests = [];
  const onError = error => errors.push(error.message);
  const onRequest = request => { if (request.url().includes('raw.githubusercontent.com/console-craft/skills/')) requests.push(request.url()); };
  page.on('pageerror', onError);
  page.on('request', onRequest);
  try {
    if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'idle') await page.click('#play');
    if (await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode) === 'auto') await page.click('#play');
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }]) {
      await page.setViewport(viewport);
      await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(19));
      await page.click('[data-hf-next]');
      assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 20, 'Manual Next must reach slide21');
      await frame.waitForFunction(() => document.querySelector('#slide-21').hasAttribute('data-active'));
      const content = await frame.$eval('#slide-21', scene => {
        const copy = scene.querySelector('.install-prompt'), url = copy.querySelector('span:not(.install-source)');
        const source = copy.querySelector('.install-source');
        const sourceRange = document.createRange();
        if (source) sourceRange.selectNodeContents(source);
        const lines = source ? new Set([...sourceRange.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size : 0;
        const box = copy.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(copy);
        const fits = [...range.getClientRects()].every(rect => rect.left >= 80 && rect.right <= 1840 && rect.top >= 80 && rect.bottom <= 1000);
        return { text: copy.textContent.replace(/\s+/g, ' ').trim(), url: url.textContent,
          firstLine: source?.textContent.trim(), lines, breakAfterSource: source?.nextSibling?.nodeName === 'BR',
          sourceColor: source && getComputedStyle(source).color,
          color: getComputedStyle(copy).color, urlColor: getComputedStyle(url).color, background: getComputedStyle(scene).backgroundColor,
          centered: Math.abs(box.x + box.width / 2 - 960) < 1 && Math.abs(box.y + box.height / 2 - 540) < 1,
          fits, big: parseFloat(getComputedStyle(copy).fontSize) >= 40,
          uniform: [...copy.querySelectorAll('p,span')].every(node => getComputedStyle(node).fontSize === getComputedStyle(copy).fontSize),
          extras: scene.querySelectorAll('h1,h2,button,input,a,img,picture,video,audio,iframe,[data-fragment],.slide-title,.slide-ai,[data-skill-card]').length,
          animations: scene.getAnimations({ subtree: true }).length,
          timeline: window.__timelines['slide-21'].duration() };
      });
      assert.deepEqual(content, { text: prompt, url: 'https://raw.githubusercontent.com/console-craft/skills/refs/heads/main/README.md',
        firstLine: 'Read https://raw.githubusercontent.com/console-craft/skills/refs/heads/main/README.md', lines: 1, breakAfterSource: true,
        sourceColor: 'rgb(255, 255, 255)',
        color: 'rgb(255, 255, 255)', urlColor: 'rgb(32, 199, 255)', background: 'rgb(0, 0, 0)', centered: true,
        fits: true, big: true, uniform: true, extras: 0, animations: 0, timeline: 105 });
      assert.equal(await page.title(), 'Skill Issues');
      assert.equal(await frame.evaluate(() => document.title), 'Skill Issues');
      assert.deepEqual(await page.evaluate(() => ({
        black: getComputedStyle(document.body).backgroundColor,
        uiHidden: [...document.querySelectorAll('.controls,[data-hf-chrome]')].every(node => node.getClientRects().length === 0),
        fullView: Math.abs(document.querySelector('hyperframes-player').getBoundingClientRect().height - innerHeight) < 1,
        voice: [document.querySelector('#narration').paused, document.querySelector('#narration').hasAttribute('src')],
        autoDisabled: document.querySelector('#play').disabled,
        mode: document.querySelector('hyperframes-slideshow').dataset.mode,
      })), { black: 'rgb(0, 0, 0)', uiHidden: true, fullView: true, voice: [true, false], autoDisabled: true, mode: 'manual' });
      assert.equal(await frame.evaluate(() => document.getAnimations().filter(animation => animation.effect.target.matches('.scene > picture img')).length), 0, 'The background-free slide must cancel the previous camera move');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 20, 'Forward navigation must clamp at slide21');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 19, 'Left must return to slide20 with its controls');
      assert.equal(await page.$eval('.controls', node => node.getClientRects().length > 0), true);
      assert.equal(await page.$eval('[data-hf-chrome]', node => node.getClientRects().length > 0), true);
      assert.equal(await page.$eval('body', node => getComputedStyle(node).backgroundColor), 'rgb(8, 11, 25)');
    }
    await page.setViewport({ width: 1920, height: 1080 });
    await frame.click('#slide-20 img');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 20, 'Keyboard navigation from inside the composition must reach21');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.dataset.mode), 'idle', 'Escape remains Exit on the chrome-free slide');
    assert.equal(await page.$eval('#music', music => music.paused), true);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.$eval('hyperframes-slideshow', deck => deck.controller.position.slideIndex), 19);
    assert.equal(await page.$eval('.controls', node => node.getClientRects().length > 0), true, 'Navigation back after Exit must restore the normal UI');
    assert.deepEqual(requests, [], 'The future repository URL must remain inert text');
    assert.deepEqual(errors, [], 'Entering a scene without a background must not throw');
  } finally {
    page.off('pageerror', onError);
    page.off('request', onRequest);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
  }
}
