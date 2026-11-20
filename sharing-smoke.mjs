import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const head = (await readFile(new URL('./index.html', import.meta.url), 'utf8')).match(/<head>([\s\S]*?)<\/head>/)[1];
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
const meta = [...head.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => attributes(tag));
const links = [...head.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attributes(tag));
const content = name => {
  const matches = meta.filter(tag => tag.property === name || tag.name === name);
  assert.equal(matches.length, 1, `Exactly one ${name} tag must be available without JavaScript`);
  assert.ok(matches[0].content?.trim(), `${name} must not be empty`);
  return matches[0].content;
};

const site = 'https://skill-issues.console-craft.com/';
assert.equal(content('og:type'), 'website');
assert.equal(content('og:url'), site);
assert.equal(content('og:site_name'), 'Console Craft');
assert.equal(content('twitter:card'), 'summary_large_image');
assert.equal(content('twitter:title'), content('og:title'));
assert.equal(content('twitter:description'), content('og:description'));
assert.equal(content('description'), content('og:description'));
assert.equal(content('twitter:image'), content('og:image'));
assert.equal(content('twitter:image:alt'), content('og:image:alt'));
assert.equal(links.find(tag => tag.rel === 'canonical')?.href, site);

const imageURL = new URL(content('og:image'));
assert.equal(imageURL.origin, new URL(site).origin, 'Sharing image must use the public HTTPS origin');
assert.equal(imageURL.pathname, '/assets/social-preview.png');
const image = await readFile(new URL(`.${imageURL.pathname}`, import.meta.url));
assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Sharing image must be a PNG');
assert.equal(image.readUInt32BE(16), 1200);
assert.equal(image.readUInt32BE(20), 630);
assert.equal(content('og:image:width'), '1200');
assert.equal(content('og:image:height'), '630');
assert.equal(content('og:image:type'), 'image/png');
assert.ok(image.length < 5 * 1024 * 1024, 'Sharing image must fit common social-card upload limits');

const icons = links.filter(tag => tag.rel === 'icon');
const pngIcon = icons.find(tag => tag.type === 'image/png');
assert.ok(pngIcon, 'A real PNG favicon must replace the empty data URL');
const png = await readFile(new URL(pngIcon.href, import.meta.url));
assert.equal(png.readUInt32BE(16), 64);
assert.equal(png.readUInt32BE(20), 64);
assert.equal(pngIcon.sizes, '64x64');
const icoIcon = icons.find(tag => tag.href.endsWith('.ico'));
assert.ok(icoIcon, 'An ICO fallback must be provided');
const ico = await readFile(new URL(icoIcon.href, import.meta.url));
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico.readUInt8(6 + i * 16));
assert.deepEqual(sizes, [16, 32, 48], 'ICO must include crisp small-tab sizes');

console.log(`Sharing metadata, ${image.length}-byte 1200×630 preview, and PNG/ICO favicons passed.`);
