import assert from 'node:assert/strict';

export const interiorTitles = [
  'Audience',
  'Understanding  Changes',
  'Choosing  a  Model',
  'Use  an  ADE',
  'Distributing  Work',
  'Fast  Editing',
  'Workflow  Frameworks',
  'SOUL.md',
  'The  Setup',
  'Prime  Context',
  'Bro',
  'Clarify  Intent',
  'Why  is  the  Sky  Blue?',
  'Guided  Tours',
  'Trust  me,  it  works',
  'Forward  Thinking',
  'Someone  Should  Read  This',
  'Recap',
].map((title, index) => ({ id: `slide-${String(index + 2).padStart(2, '0')}`, title }));

export async function checkInteriorTypography(page, frame) {
  await frame.evaluate(() => document.fonts.ready);
  assert.deepEqual(await frame.$$eval('.slide-title h2', headings => headings.map(heading => ({
    id: heading.closest('.scene').id, title: heading.textContent,
  }))), interiorTitles, 'Use every approved short caption with its exact double spaces; leave Audience unchanged');
  const titles = await frame.$$eval('.slide-title h2', headings => headings.map(heading => {
    const style = getComputedStyle(heading), panel = heading.closest('.slide-title');
    const canvas = document.createElement('canvas').getContext('2d'); canvas.font = style.font;
    const text = canvas.measureText(heading.textContent);
    return { id: panel.closest('.scene').id, font: style.fontFamily, size: parseFloat(style.fontSize),
      fits: Math.max(text.width, text.actualBoundingBoxLeft + text.actualBoundingBoxRight) <= panel.clientWidth - 180 + 1 &&
        text.actualBoundingBoxAscent + text.actualBoundingBoxDescent < panel.clientHeight - 24,
      loaded: document.fonts.check('72px Cyberpunk') };
  }));
  assert.equal(titles.length, 18);
  for (const title of titles) {
    assert.ok(title.font.includes('Cyberpunk') && title.loaded, `${title.id}: use the local Cyberpunk Regular face`);
    assert.ok(title.fits && title.size >= 24 && title.size <= 72, `${title.id}: fit every complete heading inside the unchanged panel: ${JSON.stringify(title)}`);
  }
  assert.equal(await frame.$eval('.audience-text', text => getComputedStyle(text).fontFamily.includes('Saira')), true, 'Body text stays in Saira');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(2));
  const widths = await frame.$eval('#slide-03 h2', heading => {
    heading.closest('.slide-title').getAnimations().forEach(animation => animation.finish());
    const original = heading.textContent;
    const width = () => { const range = document.createRange(); range.selectNodeContents(heading); return range.getBoundingClientRect().width; };
    const double = width();
    heading.textContent = original.replace(/ {2}/g, ' ');
    const single = width();
    heading.textContent = original;
    return { double, single };
  });
  assert.ok(widths.double > widths.single + 1, 'Double spaces must add visible separation, not collapse in HTML');
  await page.$eval('hyperframes-slideshow', deck => deck.controller.goToSlide(0));
}
