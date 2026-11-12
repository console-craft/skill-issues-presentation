import { createTransitions } from './transitions.js';

const slideshow = document.querySelector('hyperframes-slideshow');
const music = document.querySelector('#music');
const narration = document.querySelector('#narration');
const button = document.querySelector('#play');
const exitButton = document.querySelector('#exit');
const status = document.querySelector('#status');
const slides = JSON.parse(slideshow.querySelector('script').textContent).slides;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const backgroundMoves = {
  push: ['scale(1.025)', 'scale(1.125)'],
  pull: ['scale(1.125)', 'scale(1.025)'],
  left: ['translate(2.5%, 0) scale(1.085)', 'translate(-2.5%, 0) scale(1.085)'],
  right: ['translate(-2.5%, 0) scale(1.085)', 'translate(2.5%, 0) scale(1.085)'],
  diagonal: ['translate(-1.5%, 1.5%) scale(1.07)', 'translate(1.5%, -1.5%) scale(1.12)'],
};
const slideMoves = ['push', 'left', 'push', 'pull', 'diagonal', 'right', 'pull', 'left', 'diagonal', 'pull', 'push', 'push', 'right', 'pull', 'left', 'diagonal', 'push', 'right', 'push', 'pull'];
const transitionsAfter = { 1: 'whip', 2: 'whip', 3: 'whip', 4: 'crt', 5: 'plunge', 6: 'plunge', 7: 'crt', 8: 'whip', 9: 'whip', 10: 'signal', 11: 'signal', 12: 'plunge', 13: 'plunge', 14: 'signal', 15: 'plunge', 16: 'plunge', 17: 'whip', 18: 'whip', 19: 'crt' };
const transitionDurations = { signal: 700, plunge: 900, crt: 1000, whip: 700 };
// Only the cover uses a wall-clock hold; narrated slides follow their recording.
const hold = 5000;
let controller;
let unbindController;
let unbindFrame;
let boundDocument;
let index = 0;
let active = false;
let auto = false;
let advanceTimer;
let musicURL;
let compositionFrame;
let backgroundMotion;
let transitions;
let transitionGeneration = 0;
let fragments = [];
let fragmentStep = 0;
const narrationTracks = new Map([2,3,4,5,6,7,8,19,20].map(number => [number, { number, speech: [] }]));
let narrationTrack;
let narrationPulse;
let narrationSettling;
let narrationGeneration = 0;
let narrationStarting = false;
let narrationReadiness;
let narrationStartTimer;
let narrationNotBefore = 0;
const audienceMode = slideshow.getAttribute('mode') === 'audience' || new URLSearchParams(location.search).get('mode') === 'audience';
const closingChannel = new BroadcastChannel(`deck-closing:${location.pathname}`);
let closingEnded = false;
let publishedClosing;

closingChannel.addEventListener('message', ({ data }) => {
  if (audienceMode && data?.type === 'closing' && typeof data.ended === 'boolean') {
    closingEnded = data.ended;
    render();
  } else if (!audienceMode && data?.type === 'closing-request' && slideshow.hasAttribute('data-hf-presenting')) {
    closingChannel.postMessage({ type: 'closing', ended: closingEnded });
  }
});
if (audienceMode) closingChannel.postMessage({ type: 'closing-request' });

function shouldNarrate() {
  return active && auto && narrationTrack && !transitions?.running &&
    compositionFrame?.contentDocument?.getElementById(slides[index].sceneId)?.hasAttribute('data-fragments-ready');
}

function currentNarration() {
  return narrationTrack?.url && narration.src === narrationTrack.url && narration.currentSrc === narrationTrack.url;
}

function selectNarration() {
  pauseNarration(true);
  narrationTrack = narrationTracks.get(index + 1);
  if (narrationTrack?.url) narration.src = narrationTrack.url;
  else narration.removeAttribute('src');
  narration.load();
}

function pauseNarration(reset = false) {
  clearTimeout(narrationStartTimer);
  if (reset) narrationNotBefore = 0;
  narrationGeneration++;
  narrationStarting = false;
  narration.pause();
  if (reset && narration.currentTime !== 0) narration.currentTime = 0;
}

function failNarration(message) {
  narrationTrack.error = message;
  pauseNarration();
  auto = false;
  clearTimeout(advanceTimer);
  render();
}

function updateNarrationPulse() {
  const scene = compositionFrame?.contentDocument?.getElementById(slides[index].sceneId);
  const image = scene?.querySelector('.slide-ai');
  const visible = active && narrationTrack && !reducedMotion.matches && !transitions?.running &&
    scene?.hasAttribute('data-fragments-ready');
  const speaking = visible && auto && currentNarration() && !narration.paused && !narration.ended && !narration.seeking &&
    !narration.muted && narration.volume > 0 && narration.readyState >= 3 &&
    narrationTrack.speech.some(([start, end]) => start <= narration.currentTime && narration.currentTime < end);
  if (speaking) {
    if (narrationPulse?.effect.target === image) return;
    narrationPulse?.cancel();
    narrationSettling?.cancel();
    narrationPulse = image.animate([
      { scale: '1.06', opacity: .95 }, { scale: '1.25', opacity: 1 }, { scale: '1.06', opacity: .95 },
    ], { duration: 600, iterations: Infinity, easing: 'ease-in-out' });
  } else {
    if (narrationPulse) {
      const target = narrationPulse.effect.target;
      const style = visible && target === image ? target.ownerDocument.defaultView?.getComputedStyle(target) : null;
      const from = style && { scale: style.scale, opacity: style.opacity };
      narrationPulse.cancel();
      narrationPulse = null;
      if (from) narrationSettling = image.animate([
        from, { scale: '1', opacity: .8 },
      ], { duration: 180, easing: 'ease-out' });
    }
    if (!visible) { narrationSettling?.cancel(); narrationSettling = null; }
  }
}

function syncNarration() {
  updateNarrationPulse();
  if (!active || !auto || !currentNarration() || !Array.isArray(narrationTrack.cues) || (narration.paused && !narration.ended)) return;
  const due = narrationTrack.cues.filter(cue => cue.start <= narration.currentTime).length;
  if (due > fragmentStep) controller.syncTo('main', index, due - 1);
}

async function playNarration() {
  if (!shouldNarrate() || !currentNarration() || narration.readyState < 1 || narrationStarting || !narration.paused || narration.ended) return;
  const track = narrationTrack, narrationCues = track.cues;
  if (!Array.isArray(narrationCues) || narrationCues.length !== fragments.length ||
    !narrationCues.every((cue, position) => cue?.id === fragments[position].id && Number.isFinite(cue.start) &&
      cue.start >= 0 && cue.start < narration.duration && (!position || cue.start > narrationCues[position - 1].start))) {
    failNarration(`Invalid slide ${index + 1} reveal cues.`);
    return;
  }
  narrationStarting = true;
  const generation = ++narrationGeneration;
  try {
    await narration.play();
    if (generation !== narrationGeneration) {
      if (!shouldNarrate()) narration.pause();
      return;
    }
    syncNarration();
  } catch (error) {
    if (generation === narrationGeneration && error.name !== 'AbortError') failNarration(error.message);
  } finally {
    if (generation === narrationGeneration) narrationStarting = false;
    render();
  }
}

async function loadNarration(track) {
  try {
    const [audio, cues] = await Promise.all([`assets/voice/slide-${track.number}.mp3`, `assets/voice/slide-${track.number}.json`].map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response;
    }));
    const data = await cues.json();
    track.cues = data.cues;
    // shortcut: speech windows belong to this recording; regenerate them if its MP3 changes.
    track.speech = Array.isArray(data.speech) ? data.speech : [];
    track.url = URL.createObjectURL(await audio.blob());
    if (track === narrationTrack) selectNarration();
  } catch (error) {
    track.error = error.message;
    if (track === narrationTrack) { if (active && auto) failNarration(track.error); else render(); }
  }
}

function setFragmentStep(step) {
  fragmentStep = step;
  fragments.forEach((fragment, index) => {
    const visible = index < step;
    fragment.toggleAttribute('data-visible', visible);
    fragment.setAttribute('aria-hidden', String(!visible));
    fragment.inert = !visible;
  });
}

function stepFragment(direction) {
  if (!fragments.length) return false;
  const next = fragmentStep + direction;
  if (next < 0 || next > fragments.length) return false;
  controller.syncTo('main', index, next - 1);
  return true;
}

function advance(direction, manual = false) {
  if (manual) { auto = false; clearTimeout(advanceTimer); pauseNarration(); }
  if (!stepFragment(direction)) navigate(index + direction);
  render();
}

function handleFragmentClick(event) {
  if (fragments.length && event.button === 0 && !event.defaultPrevented &&
    !event.target.closest('button, a, input, select, textarea, [contenteditable]')) controller.next();
}

function cancelTransition() {
  transitionGeneration++;
  transitions?.cancel();
}

function moveBackground() {
  backgroundMotion?.cancel();
  if (!active || reducedMotion.matches || !compositionFrame) return;
  const image = compositionFrame.contentDocument.getElementById(slides[index].sceneId).querySelector(':scope > picture img');
  const move = slideMoves[index];
  if (!image || !move) return;
  // Live framing stays outside the seek clock, so manual holds keep moving.
  backgroundMotion = image.animate(backgroundMoves[move].map(transform => ({ transform })), {
    duration: 14000,
    direction: 'alternate',
    iterations: Infinity,
    easing: 'linear',
  });
  backgroundMotion.id = `background-${move}`;
}

function render() {
  document.body.toggleAttribute('data-install-slide', index === 20);
  if (!audienceMode) closingEnded = Boolean(active && index === 19 && currentNarration() && narration.ended);
  compositionFrame?.contentDocument?.getElementById('slide-20')?.toggleAttribute('data-narration-ended',
    index === 19 && closingEnded);
  if (!audienceMode && slideshow.hasAttribute('data-hf-presenting') && closingEnded !== publishedClosing) {
    closingChannel.postMessage({ type: 'closing', ended: closingEnded });
    publishedClosing = closingEnded;
  }
  slideshow.dataset.mode = active ? (auto ? 'auto' : 'manual') : 'idle';
  button.textContent = !active ? '▶ Start auto' : auto ? 'Ⅱ Hold auto' : '▶ Resume auto';
  const manualSection = active && ((index >= 8 && index <= 17) || slides[index].autoplay === false);
  if (manualSection) button.textContent = 'Manual section';
  if (active && index === 19 && narration.ended) button.textContent = '↻ Replay slide 20';
  button.disabled = !controller || manualSection;
  status.textContent = `${index + 1}/${slides.length} · ${active ? (auto ? 'Auto' : 'Manual') : 'Ready'}${fragments.length ? ` · ${fragmentStep}/${fragments.length}` : ''}`;
  if (narrationTrack?.error) status.textContent += ` · Voice unavailable: ${narrationTrack.error} Use Next/Previous or reload.`;
  music.volume = narration.paused ? .18 : .06655;
  exitButton.disabled = !active;
  updateNarrationPulse();
}

function scheduleAdvance() {
  clearTimeout(advanceTimer);
  clearTimeout(narrationStartTimer);
  if (narrationTrack) {
    if (active && auto) {
      if (narrationTrack.error) failNarration(narrationTrack.error);
      else if (shouldNarrate()) {
        narrationNotBefore ||= performance.now() + 1000;
        const delay = narrationNotBefore - performance.now();
        if (delay > 0) narrationStartTimer = setTimeout(scheduleAdvance, Math.ceil(delay));
        else playNarration();
      }
    }
    return;
  }
  if (active && auto && !transitions?.running && index === 0) advanceTimer = setTimeout(() => {
    if (!active || !auto) return;
    const scene = compositionFrame.contentDocument.getElementById(slides[index].sceneId);
    if (fragments.length && !scene.hasAttribute('data-fragments-ready')) { scheduleAdvance(); return; }
    advance(1);
  }, hold);
}

function navigate(next, manual = false) {
  if (manual) { auto = false; clearTimeout(advanceTimer); pauseNarration(); }
  const target = Math.max(0, Math.min(next, slides.length - 1));
  if (target !== index) {
    cancelTransition();
    const pair = Math.min(index, target);
    const effect = Math.abs(target - index) === 1 ? transitionsAfter[pair + 1] : null;
    const source = active && !reducedMotion.matches && effect
      ? transitions?.capture(compositionFrame.contentDocument.getElementById(slides[index].sceneId)) : null;
    controller.syncTo('main', target, -1);
    if (source) {
      const generation = transitionGeneration;
      transitions.play(source, compositionFrame.contentDocument.getElementById(slides[target].sceneId), effect, transitionDurations[effect])
        .then(() => { if (generation === transitionGeneration) scheduleAdvance(); });
      scheduleAdvance();
    }
  }
  render();
}

function exit() {
  active = false;
  auto = false;
  compositionFrame?.contentDocument?.dispatchEvent(new Event('deck-exit'));
  clearTimeout(advanceTimer);
  pauseNarration(true);
  music.pause();
  backgroundMotion?.cancel();
  cancelTransition();
  if (fragments.length) controller.syncTo('main', index, -1);
  else setFragmentStep(0);
  render();
}

function handleKeydown(event) {
  if (event.key === 'Escape') exit();
  // Keep native Space activation on buttons out of the player's slide shortcut.
  if (event.key === ' ' && event.target.closest?.('button')) event.stopImmediatePropagation();
}

button.addEventListener('click', async () => {
  slideshow.focus({ preventScroll: true });
  if (active) {
    if (index === 19 && narration.ended) {
      pauseNarration(true);
      controller.syncTo('main', index, -1);
    }
    auto = !auto;
    if (!auto) pauseNarration();
    scheduleAdvance();
    render();
    return;
  }
  cancelTransition();
  active = true;
  auto = true;
  music.currentTime = 0;
  controller.syncTo('main', 0, -1);
  try {
    await music.play();
    scheduleAdvance();
    render();
  } catch (error) {
    if (!active) return;
    exit();
    status.textContent = `Audio could not start: ${error.message}. Try Start again.`;
  }
});

exitButton.addEventListener('click', exit);
window.addEventListener('keydown', handleKeydown, true);
slideshow.addEventListener('hf-sound', event => { music.muted = narration.muted = event.detail.muted; });
narration.addEventListener('loadedmetadata', () => {
  if (!currentNarration() || narration.readyState < 1) return;
  const track = narrationTrack;
  if (!track.speech.every((span, position) => Array.isArray(span) && span.length === 2 &&
    span.every(Number.isFinite) && span[0] >= 0 && span[1] > span[0] && span[1] <= narration.duration &&
    (!position || span[0] >= track.speech[position - 1][1]))) track.speech = [];
  scheduleAdvance();
});
narration.addEventListener('timeupdate', syncNarration);
narration.addEventListener('seeked', syncNarration);
narration.addEventListener('play', () => { if (!shouldNarrate()) pauseNarration(); render(); });
narration.addEventListener('pause', render);
for (const event of ['playing', 'waiting', 'seeking', 'volumechange']) narration.addEventListener(event, updateNarrationPulse);
narration.addEventListener('ended', () => {
  if (!active || !auto || !currentNarration() || !narration.ended) return;
  syncNarration();
  if (index < slides.length - 1 && slides[index + 1].autoplay !== false) navigate(index + 1);
  else auto = false;
  render();
});
narration.addEventListener('error', () => {
  if (currentNarration() && narration.error) failNarration(`The slide ${index + 1} recording could not be decoded.`);
});
music.addEventListener('error', () => {
  exit();
  status.textContent = 'Music could not load. Reload the presentation.';
});
window.addEventListener('pagehide', () => {
  exit();
  closingChannel.close();
  narrationReadiness?.disconnect();
  unbindController?.();
  unbindFrame?.();
  if (musicURL) URL.revokeObjectURL(musicURL);
  for (const track of narrationTracks.values()) if (track.url) URL.revokeObjectURL(track.url);
});

for (const track of narrationTracks.values()) loadNarration(track);

try {
  // shortcut: buffer the MP3 for reliable looping on hosts without HTTP byte ranges.
  const response = await fetch('assets/latent-understanding-take-a.mp3');
  if (!response.ok) throw new Error(`Music: HTTP ${response.status}`);
  musicURL = URL.createObjectURL(await response.blob());
  music.src = musicURL;
  music.volume = .18;
  reducedMotion.addEventListener('change', () => { cancelTransition(); moveBackground(); scheduleAdvance(); updateNarrationPulse(); });
  const ready = setInterval(() => {
    // The SDK can replace its controller after player initialization; keep our adapters attached.
    if (!slideshow.controller || slideshow.controller === controller) return;
    const position = controller && active ? { slide: index, fragment: fragmentStep - 1 } : null;
    unbindController?.();
    controller = slideshow.controller;
    controller.next = () => advance(1, true);
    controller.prev = () => advance(-1, true);
    controller.goToSlide = next => navigate(next, true);
    const updatePosition = () => {
      const changedSlide = index !== controller.position.slideIndex;
      if (changedSlide) setFragmentStep(0);
      index = controller.position.slideIndex;
      if (changedSlide) selectNarration();
      if ((index >= 8 && index <= 17) || slides[index].autoplay === false) { auto = false; pauseNarration(); }
      fragments = [...compositionFrame.contentDocument.getElementById(slides[index].sceneId).querySelectorAll('[data-fragment]')];
      setFragmentStep(fragments.length ? controller.position.fragmentIndex + 1 : 0);
      if (changedSlide) moveBackground();
      scheduleAdvance();
      render();
    };
    unbindController = controller.onChange(updatePosition);
    // Keyboard events inside the composition iframe do not bubble to this window.
    unbindFrame?.();
    compositionFrame = document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe');
    const bindKeyboard = () => {
      if (boundDocument === compositionFrame.contentDocument) return;
      if (boundDocument) { pauseNarration(); narrationNotBefore = 0; }
      boundDocument = compositionFrame.contentDocument;
      compositionFrame.contentWindow.addEventListener('pagehide', () => {
        pauseNarration();
        clearTimeout(advanceTimer);
        updateNarrationPulse();
      }, { once: true });
      compositionFrame.contentWindow.addEventListener('keydown', handleKeydown, true);
      compositionFrame.contentDocument.addEventListener('click', handleFragmentClick);
      narrationReadiness?.disconnect();
      narrationReadiness = new MutationObserver(records => {
        if (records.some(record => record.target.id === slides[index].sceneId) && narrationTrack) scheduleAdvance();
      });
      for (const number of narrationTracks.keys()) narrationReadiness.observe(compositionFrame.contentDocument.getElementById(slides[number - 1].sceneId), {
        attributes: true, attributeFilter: ['data-fragments-ready'],
      });
      compositionFrame.contentDocument.getElementById('title-next').onclick = () => controller.next();
      index = controller.position.slideIndex;
      fragments = [...compositionFrame.contentDocument.getElementById(slides[index].sceneId).querySelectorAll('[data-fragment]')];
      setFragmentStep(fragments.length ? controller.position.fragmentIndex + 1 : 0);
      cancelTransition();
      transitions = createTransitions(compositionFrame.contentDocument);
      moveBackground();
    };
    compositionFrame.addEventListener('load', bindKeyboard);
    const frame = compositionFrame;
    const player = document.querySelector('hyperframes-player');
    const restorePosition = () => {
      bindKeyboard();
      controller.syncTo('main', index, fragmentStep - 1);
    };
    player.addEventListener('ready', restorePosition);
    unbindFrame = () => {
      frame.removeEventListener('load', bindKeyboard);
      player.removeEventListener('ready', restorePosition);
    };
    bindKeyboard();
    if (position) controller.syncTo('main', position.slide, position.fragment);
    else updatePosition();
    button.disabled = false;
    render();
  }, 100);
  window.addEventListener('pagehide', () => clearInterval(ready), { once: true });
} catch (error) { status.textContent = `Could not load deck: ${error.message}. Serve this folder over localhost.`; }
