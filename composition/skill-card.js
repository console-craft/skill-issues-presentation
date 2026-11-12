const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const expansionSetters = [];

// Only bundled, escaped snapshots belong here; source templates are display data, never executable HTML.
for (const snapshot of document.querySelectorAll('[data-skill-document]')) {
  fetch(snapshot.dataset.skillDocument).then(response => {
    if (!response.ok) throw new Error(`Document: HTTP ${response.status}`);
    return response.text();
  }).then(html => {
    snapshot.innerHTML = html;
    snapshot.dataset.documentState = 'loaded';
  }).catch(() => {
    snapshot.textContent = 'Could not load this document. Reload the presentation to try again.';
    snapshot.dataset.documentState = 'error';
  }).finally(() => snapshot.removeAttribute('aria-busy'));
}

document.addEventListener('deck-exit', () => {
  for (const setExpanded of expansionSetters) setExpanded(false);
});

for (const card of document.querySelectorAll('[data-skill-card]')) {
  const resets = [], mediaHandlers = [];
  card.id ||= `${card.querySelector('.skill-content').id}-editor`;
  card.hidden = true;
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'skill-open';
  open.setAttribute('aria-controls', card.id);
  open.setAttribute('aria-expanded', 'false');
  open.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M2 7h4M2 11h4M2 15h4M2 19h4M9 17h4"/><path d="m16 4 4 4m1-1a2.12 2.12 0 0 0-3-3l-6 6-1 4 4-1Z"/></svg><span>Open editor</span>';
  card.after(open);
  open.addEventListener('click', () => {
    open.hidden = true;
    open.setAttribute('aria-expanded', 'true');
    card.hidden = false;
    card.querySelector('.skill-views [aria-selected="true"]').focus({ preventScroll: true });
  });
  open.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
  });
  const title = card.closest('.scene').querySelector('.slide-title');
  const outline = title?.querySelector('.outline');
  if (outline) {
    const box = outline.getBBox(), width = title.querySelector('svg').viewBox.baseVal.width;
    // SVG ink is narrower than its padded viewBox; offset dimensions ignore the title entrance scale.
    card.style.setProperty('--skill-left', `${title.offsetLeft + title.offsetWidth * box.x / width}px`);
    card.style.setProperty('--skill-right', `${card.parentElement.clientWidth - title.offsetLeft - title.offsetWidth * (box.x + box.width) / width}px`);
  }
  const player = window.frameElement?.getRootNode().host;
  function updateControlSpace() {
    if (!player) return;
    const host = player.getBoundingClientRect();
    const scale = Math.min(host.width / innerWidth, host.height / innerHeight);
    if (!scale) return;
    // Use the host's containment geometry so a pending player transform cannot lag a viewport resize.
    const top = host.top + (host.height - innerHeight * scale) / 2;
    const bottom = top + innerHeight * scale;
    const upper = parent.document.querySelector('.controls')?.getBoundingClientRect();
    const lower = parent.document.querySelector('[data-hf-next]')?.parentElement.getBoundingClientRect();
    if (upper) card.style.setProperty('--skill-control-top', `${Math.ceil(Math.max(0, upper.bottom + 8 - top) / scale)}px`);
    if (lower) card.style.setProperty('--skill-control-bottom', `${Math.ceil(Math.max(0, bottom - lower.top + 8) / scale)}px`);
    if (card.hasAttribute('data-expanded')) for (const animation of card.getAnimations()) {
      if (animation instanceof CSSTransition && animation.transitionProperty.startsWith('padding')) animation.finish();
    }
  }
  const controlSpaceObserver = player ? new ResizeObserver(updateControlSpace) : null;
  if (player) {
    controlSpaceObserver.observe(player);
    const controls = parent.document.querySelector('.controls');
    if (controls) controlSpaceObserver.observe(controls);
  }
  const expand = card.querySelector('.skill-expand');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'skill-close';
  close.title = 'Close editor';
  close.setAttribute('aria-label', close.title);
  close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  expand.after(close);
  function setExpanded(expanded) {
    if (expanded) updateControlSpace();
    card.toggleAttribute('data-expanded', expanded);
    expand.setAttribute('aria-pressed', String(expanded));
    expand.setAttribute('aria-label', expanded ? 'Collapse window' : 'Expand window');
    expand.title = expand.getAttribute('aria-label');
  }
  expansionSetters.push(setExpanded);
  expand.addEventListener('click', () => {
    const expanded = !card.hasAttribute('data-expanded');
    for (const setExpanded of expansionSetters) setExpanded(expanded);
  });
  const textSize = card.querySelector('.skill-text-size input');
  textSize.addEventListener('input', () => {
    document.documentElement.style.setProperty('--skill-content-size', `${textSize.value}px`);
    for (const input of document.querySelectorAll('.skill-text-size input')) {
      input.value = textSize.value;
      input.parentElement.querySelector('output').value = `${textSize.value}px`;
      input.setAttribute('aria-valuetext', `${textSize.value} pixels`);
    }
  });
  for (const list of card.querySelectorAll('[role="tablist"]')) {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    function select(tab) {
      for (const item of tabs) {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
        card.querySelector(`#${item.getAttribute('aria-controls')}`).hidden = !active;
      }
      if (list.classList.contains('skill-views')) {
        const content = tab.getAttribute('aria-controls') === card.querySelector('.skill-content').id;
        card.querySelector('.skill-files').hidden = !content;
        card.querySelector('.skill-demo-title').hidden = content;
      }
    }
    resets.push(() => select(tabs[0]));
    list.addEventListener('click', event => {
      const tab = event.target.closest('[role="tab"]');
      if (tabs.includes(tab)) select(tab);
    });
    list.addEventListener('keydown', event => {
      const position = tabs.indexOf(event.target);
      if (position < 0) return;
      const vertical = list.getAttribute('aria-orientation') === 'vertical';
      const previous = vertical ? 'ArrowUp' : 'ArrowLeft';
      const next = vertical ? 'ArrowDown' : 'ArrowRight';
      let target;
      if (event.key === previous) target = tabs[(position + tabs.length - 1) % tabs.length];
      if (event.key === next) target = tabs[(position + 1) % tabs.length];
      if (event.key === 'Home') target = tabs[0];
      if (event.key === 'End') target = tabs.at(-1);
      if (!target) return;
      event.preventDefault();
      select(target);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
  for (const pane of card.querySelectorAll('.skill-pane')) {
    const button = pane.querySelector('.skill-generate');
    const chat = pane.querySelector('.skill-chat');
    let timer, thinking, assistant, body, lines = [], position = 0;

    function finish() {
      clearTimeout(timer);
      assistant.classList.remove('is-streaming');
      button.disabled = false;
      button.textContent = '✦ Generate again';
    }
    function appendLine() {
      body.append(lines[position++]);
      chat.scrollTop = chat.scrollHeight;
      if (position < lines.length) timer = setTimeout(appendLine, 600);
      else finish();
    }
    function finishWithoutStagger() {
      while (position < lines.length) body.append(lines[position++]);
      chat.scrollTop = chat.scrollHeight;
      finish();
    }
    function startResponse() {
      thinking.remove();
      thinking = null;
      const response = pane.querySelector('[data-answer]').content.cloneNode(true);
      assistant = response.querySelector('.skill-assistant');
      body = assistant.querySelector('.skill-answer');
      lines = [...body.children];
      position = 0;
      body.replaceChildren();
      assistant.classList.add('is-streaming');
      chat.append(response);
      if (reducedMotion.matches) finishWithoutStagger();
      else appendLine();
    }
    button.addEventListener('click', () => {
      button.disabled = true;
      button.textContent = '✦ Generating…';
      assistant = null;
      chat.replaceChildren((pane.querySelector('[data-question]') || card.querySelector('[data-question]')).content.cloneNode(true));
      chat.scrollTop = 0;
      timer = setTimeout(() => {
        thinking = card.querySelector('[data-thinking]').content.firstElementChild.cloneNode(true);
        chat.append(thinking);
        timer = setTimeout(() => {
          thinking.classList.add('is-leaving');
          timer = setTimeout(startResponse, 180);
        }, 3000);
      }, 400);
    });
    const onReducedMotion = () => {
      if (reducedMotion.matches && button.disabled && assistant) finishWithoutStagger();
    };
    reducedMotion.addEventListener('change', onReducedMotion);
    mediaHandlers.push(onReducedMotion);
    resets.push(() => {
      clearTimeout(timer);
      thinking = assistant = body = null;
      lines = [];
      position = 0;
      chat.replaceChildren();
      button.disabled = false;
      button.textContent = '✦ Generate';
    });
  }
  function reset() {
    for (const reset of resets) reset();
    for (const animation of card.getAnimations()) if (animation instanceof CSSTransition) animation.finish();
    for (const document of card.querySelectorAll('.skill-document')) document.scrollTop = 0;
    if (card.contains(document.activeElement)) document.activeElement.blur();
    card.hidden = true;
    open.hidden = false;
    open.setAttribute('aria-expanded', 'false');
  }
  close.addEventListener('click', () => {
    reset();
    open.focus({ preventScroll: true });
  });
  card.addEventListener('keydown', event => {
    if (!card.hasAttribute('data-expanded') || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const controller = player?.closest('hyperframes-slideshow')?.controller;
    if (!controller) return;
    event.preventDefault();
    event.stopPropagation();
    controller[event.key === 'ArrowLeft' ? 'prev' : 'next']();
  }, true);
  card.addEventListener('keydown', event => {
    if (event.key !== 'Escape') event.stopPropagation();
  });
  // oldValue catches a leave-and-return that happens before the observer's callback.
  const observer = new MutationObserver(records => {
    if (records.some(record => record.oldValue !== null)) reset();
  });
  observer.observe(card.closest('.scene'), { attributes: true, attributeOldValue: true, attributeFilter: ['data-active'] });
  document.addEventListener('deck-exit', reset);
  window.addEventListener('pagehide', () => {
    reset();
    observer.disconnect();
    controlSpaceObserver?.disconnect();
    document.removeEventListener('deck-exit', reset);
    for (const handler of mediaHandlers) reducedMotion.removeEventListener('change', handler);
  }, { once: true });
}
