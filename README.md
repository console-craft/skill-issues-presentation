# Presentation skeleton

Twenty-one editable HyperFrames slides: twenty themed slides using backgrounds 01 through 20 in order, with the approved digital-recording treatment, followed by a manual-only black prompt slide. Animated backgrounds fill a 1920×1080 canvas without stretching (wider images are cropped at the sides). Slides 1 and 20 have matching opening/closing lockups; all eighteen interior slides have title panels. Slides 3–19 use the approved shorter captions with two spaces between words; slide 2 remains “Audience”. The original content draft in `../copy/draft.md` is unchanged. Slides 2–8 and 19 have progressively revealed content. All supplied recordings play on slides **2–8 and 19–20**, with speech-aware AI pulsing.

All runtime and media assets are included locally; no package installation, CDN, or paid generation is needed. Originals and the earlier `neon-proof` mock are unchanged.

## Public website

The presentation is published at **https://skill-issues.console-craft.com/** from the **console-craft/skill-issues-presentation** repository.

`.github/workflows/pages.yml` deploys automatically on pushes to `main`, or manually through GitHub Actions. It publishes only `index.html`, `deck.js`, `transitions.js`, `assets/`, and `composition/`; no build or package installation is needed. Tests, stills, and treatment-generation files are excluded from the website, although they remain visible in the public repository.

GitHub **Settings → Pages** uses **GitHub Actions** and the custom domain `skill-issues.console-craft.com`. Cloudflare DNS uses a **DNS-only** CNAME named `skill-issues` pointing to `console-craft.github.io`. GitHub manages the HTTPS certificate; no Cloudflare credentials belong in this repository or workflow. Keep any GitHub Pages verification TXT record in DNS.

Social previews use `assets/social-preview.png`, a 1200×630 crop of the clean `stills/01-title.png` cover screenshot. The PNG/ICO favicons are static, transparent copies of the first frame of `composition/assets/ai-talking.gif`. Run `npm run test:sharing` to check the crawler-visible metadata and image assets without the Mac-only presentation test setup.

## Open the presentation

From Terminal:

```sh
cd /Users/ovi/Projects/console-craft/presentations/dont-read-the-code/output
npm run dev
```

Then open **http://localhost:3018/** in Chrome or your usual browser. Keep Terminal running; Control-C stops the server. Do not double-click the HTML file, use `hyperframes present`, or open `composition/index.html` directly: the first needs HTTP, the second adds duplicate controls, and the third is only the slide artwork.

The browser title is **Skill Issues**. Start and restart both begin at slide1; the temporary demo-section startup override has been removed.

- **Start auto:** starts Take A and advances from the cover after five seconds. Narration drives the existing reveals and advances through slide 8, then lands on slide 9 in manual mode.
- **Manual section (9–18):** automatic playback is disabled; use Next/Previous or keys for the live skills/demo section. At slide **19**, choose **Resume auto** to narrate the recap and closing slide.
- **Hold auto / Resume auto:** pause/resume the recording at the same position without losing reveals. Music keeps playing.
- **Replay slide 20:** after the final recording ends, “Thank You!” types in and the deck holds with looping music. Replay hides the phrase until the closing voice finishes again, without restarting music or returning to the cover.
- **Manual epilogue (21):** Next/→ after slide20 opens the installation prompt. Autoplay never enters it. All presentation controls are hidden there; ← returns to20 and Escape still stops playback. Its URL/instructions are inert display text, not an installation action.
- **Next/Previous or ←/→:** navigate slides and switch to manual mode. On slides 2–8 and 19, Next/→/Space or clicking the artwork reveals one component; Previous/←/Backspace undoes one. After all reveals on the current slide, the next forward input advances. At zero reveals, Previous returns to the preceding slide.
- **Title arrow `>>>>>>`:** advances to slide 2 using the same navigation and transition. It stays label-only in every state: bright magenta with white glow and the title’s four-second diagonal shine; keyboard focus strengthens the glow instead of adding a button box. Enter and Space activate it. Reduced motion disables the shine, keeping the magenta label visible.
- **Speaker control:** mute/unmute both music and narration using the shared player's bottom toolbar.
- **Exit or Escape:** stop narration, playback, and music. Start again restarts at slide 1.

Music loops continuously across navigation, including slides20 and21, until Exit. Slide21 has no AI narration. Use the single deck window for audio; separate presenter/audience audio synchronization is not implemented.

## Build on this

- `composition/index.html`: twenty-one static slide sections, with stable `slide-01`…`slide-21` IDs and the slideshow manifest. The composition spans105 seconds/3150 frames; slide21 starts at100 seconds. Add content inside the appropriate section.
- Slides 2–19 use the unmodified paths from `../artwork/control-panel/shape1.svg` through `shape4.svg`, with cover-blue `#20c7ff` lines and cover-yellow `#fcee0a` text. Four inline SVG templates populate self-contained frames with slide-specific masks and gradients, avoiding Chromium's cross-SVG animated-mask rendering issue. Headers cycle through shapes 1, 2, 3, 4, starting with shape 1 on slide 2. Display captions use the approved shortened wording and stay still while backgrounds move; intro/outro typography is unchanged.
- Panel fills use a lighter blue `#1c4f6b` at 68% opacity (32% transparent), shared by the title and slide-2 content panels; the slide backgrounds, blue outlines, and yellow headings are unchanged.
- The header grows and fades in once over 550 ms after each incoming transition clears (immediately on cut-only navigation). Both its lettering and frame reuse the cover's looping four-second white shine; an SVG mask keeps the frame reflection on the existing lines. Leaving the slide stops the effects; revisiting restarts the entrance. Reduced motion shows the full blue/yellow header immediately with no flare or pop-in.
- The compact header remains 24px from the top and 136px high. The reversible **Cyberpunk Regular header trial** caps titles at 72px, fitting longer headings down after local fonts load so every title stays on one line with 90px inner side clearance. Header-only `white-space: pre` preserves the intentional double spaces instead of collapsing them. Digits and unsupported punctuation use the sans-serif fallback. Body text remains Saira. To revert only the trial, restore `.slide-title h2` to `300 80px/1.2 'Saira', sans-serif` and remove the heading-fit `document.fonts.ready` block; timing changes are independent.
- `composition/assets/fonts/`: local Saira SemiCondensed Light and Cyberpunk Regular, copied from `../fonts/`. Slide 1 uses a single-line, neon-blue Saira lead-in above oversized bright-yellow Cyberpunk “skill” / “issues” on separate rows. The centered text is a stationary sibling of the moving background.
- `index.html`: shared slideshow player, matching manifest, and playback controls.
- `deck.js`: continuous music, shared narration transport, manual/automatic navigation, and live background camera moves. `hold` controls only the cover; `backgroundMoves` and `slideMoves` define framing and per-slide assignments.
- `transitions.js`, `assets/transition-shaders.js`: live WebGL transitions, using the HyperFrames registry's glitch, cinematic zoom, and whip-pan concepts plus a custom CRT collapse; no CDN or new package dependency.
- `composition/assets/backgrounds/`: all twenty supplied GIFs retimed to exactly 2× their original speed, preserving rendered pixels and looping. Originals in `../artwork/backgrounds/` are unchanged, so the previous 1.5× version can be regenerated by dividing original frame delays by 1.5 and rounding to the nearest 10 ms. GIF playback is live, not synchronized to a narration clock; slide dwell time and music are unchanged.
- `composition/assets/backgrounds/??-recording.gif`: separately treated copies used by the first twenty slides. All twenty approved base GIFs remain untouched and provide the clean reduced-motion fallback. Slide21 intentionally has no image or camera move.
- `assets/latent-understanding-take-a.mp3`: the previously selected background music, unchanged, initially at 18% volume.
- `stills/`: representative browser captures of slides 1, 10, and 20.

The yellow title uses tightly spaced 585px “skill” lettering, with “issues” 25% smaller at 438.75px, negative letter spacing, and a diagonal white reflection sweeping left to right every four seconds. Two brief left–right glitch bursts per seven-second cycle move both yellow words together by up to 12px, each with an eased 2.5% scale pulse and tiny settling bounce; the blue line stays still. The pulse returns to the approved size between bursts. Shine, glitch, and pulse run only while the relevant slide is visible, including Ready/manual holds. Reduced-motion mode keeps the lettering solid yellow and stationary.

Slide 20 reuses the same fonts, colors, glow, shine, glitch, and pulse, with the blue contact line “@ovi_ispas”, yellow “Thank” / “You!”, and magenta “console-craft.com”. The capital Cyberpunk glyphs use a closing-only fit of 480px / 360px with extra ink room and row separation. The website is plain text, not a button or link. Its original background and the opening slide’s working arrow are unchanged.

“Thank You!” stays hidden until slide 20's narration finishes, then types after a one-second lead-in at one character every 160ms. Hold or manual arrival does not bypass completion; Replay, navigation, and Exit reset the phrase. Hidden letters keep their layout space. Reduced motion uses the same completion gate but shows the full phrase immediately afterward; assistive technology retains the complete accessible heading. The handle and website keep their original arrival fades. A small visual-only BroadcastChannel mirrors completion/reset into the existing Present audience window without starting audience audio.

The closing handle and website are initially invisible, then fade in together over one second after the transition clears. Their existing glow and the website’s shine stay intact. Each visit restarts the fades; reduced motion shows both immediately. The opening slide is unaffected.

## Slide 21 manual installation prompt

Slide21 is a flat black canvas containing only the corrected two-paragraph prompt, with no quotation marks and “usage in OpenCode” wording. The centered block uses uniform42px white system-ui text, with **Read plus the full URL** held together on one line and an explicit line break afterward. The URL alone is cyan `#20c7ff`. It is a span, not a link: no repository request, installation, title, image, AI, narration, reveal or animation is attached.

Both manifests mark21 `autoplay: false`. Closing narration holds at20 with its existing Thank You/Replay behavior; only manual navigation reaches21. Its outer-page state hides custom controls and all SDK chrome, makes letterboxing black, and temporarily removes the presenter's notes inset so the slide fills both presenter and audience views. Leaving restores normal chrome/layout. Escape stops playback without changing the selected scene; ← then returns to20 and its controls. Forward navigation clamps at21. Background motion safely skips image-free scenes; existing music continues until Exit.

`install-slide-smoke.mjs` checks exact copy, URL color/inertness, centering and bounds in full/scaled views, black/chrome-free presentation, no speech/camera/animation, manual entry, clamping and keyboard return/Exit. Narration and audience tests also cover the automatic endpoint and two-window layout restoration. The new URL is intentionally not validated because the repository does not exist yet.

## Slide 2 audience content

The large left panel uses control-panel shape 3 around the complete, uncropped `composition/assets/bell-curve.png`, copied byte-for-byte from `../artwork/bell-curve.png` and inset clear of its notched edge. The five right-hand rows preserve the geometry and 01–05 numbers of `../artwork/hud/shape1.svg` through `shape5.svg`. Their visual-only labels are “deadlines, codebase, teammates”, “new model every day”, “products in an afternoon”, “no time nor freedom”, and “responsible for maintaing”, exactly as requested; `../copy/draft.md` is unchanged. Three control panels along the bottom say “producing code”, “understanding code”, and “confidence in code”. Labels are white and HUD digits are magenta `#ff20d8`; these components have no traversing flare.

Every visit starts with the existing 550ms heading entrance, followed automatically by a 200ms fade-in of `composition/assets/ai-talking.gif`, copied unchanged from `../artwork/ai-talking.gif`. It occupies a stationary 100×100 box at page center, between the slightly spaced-out columns, and consumes no click. Nine forward inputs reveal the image panel, five list items top to bottom, then the three bottom panels left to right. Each component has one 350ms fade/pop entrance; early clicks are queued but stay hidden until the transition, heading, and AI entrances finish. Unrevealed content is also hidden from assistive technology. The top status shows reveal progress. Auto mode uses the narration cues below, not five-second intervals. Music and background motion continue during Hold. Leaving/revisiting or Exit resets the sequence; reduced motion shows the heading/AI immediately and keeps the reveal sequence without entrance animation.

The AI stays at 80% opacity (20% transparent) after its entrance, including reduced-motion mode, with a broad, soft cyan `#20c7ff` drop-shadow halo for separation from the busy background; the source GIF remains unchanged. The magenta HUD numbers have a subtle white glow. Reveal progress uses the existing controller fragment position, so the built-in Present audience window receives reveals, undo, and resets. Space on a focused toolbar or cover button retains native button activation rather than also advancing the deck.

### Voice-led playback

Run the server from **this checkout's `output/` directory**, then choose **Start auto**. Each narrated slide waits for its transition, title, and AI entrance, then adds **one extra second** before speaking (about 1.75 seconds after a normal transition clears). Hold/Exit/navigation cancel pending starts; mid-recording Resume does not repeat the delay. All nine `assets/voice/slide-N.mp3` files are byte-identical to the approved sources and buffered locally for reliable seeking. Slide 20 retains the approved 0.95× pitch-preserving slowdown; playback adds no rate change. Music drops from 0.18 to **0.06655 globally** during narration (another 10% above 0.0605; 21% above the original 0.055 ducked level) and returns to 0.18 when paused or ended. Voice volume is unchanged.

Each `assets/voice/slide-N.json` holds recording-relative reveal timestamps, fragment IDs, phrase anchors, and speech intervals. Reveals follow the unchanged manual order, aligned to local word-timed transcripts roughly 0.3 seconds ahead of each phrase or passage. Slide 20 has no fragments and an empty cue list. Slide 2's approved timings are unchanged: the bell curve appears at 21.56 seconds, just before “So let's start with who's in the room.” Tune metadata, not audio bytes; the actual media position drives reveals and catches up after seeking/buffering without a separate timer.

Hold/Resume preserves recording position and reveals. A manual click, key, Next, or Previous pauses voice immediately and retains reveal/undo behavior; Resume continues without hiding panels revealed early. It does **not** wait at semantic boundaries or seek to manually selected components. Narration endings advance through 8→9, stop for manual 9–18, and advance 19→20 after explicit Resume. Slide 20 holds on completion with Replay. Missing/bad selected media or cues and rejected playback hold with a readable status; manual navigation remains available. A different track's loading/failure cannot interrupt the current track.

All nine centered AIs use a **600ms speaking cycle**, 106–125% scale and 0.95–1 opacity. Quiet state remains 100×100 at 0.8 opacity; center, cyan halo, and source GIF are unchanged. `speech` intervals use −38 dB silence detection with a 0.45-second minimum pause, bounded by decoded sample duration (not padded MP3 estimates). Brief word gaps do not flicker, and music cannot drive the effect. Hold, mute, buffering/seeking, speech pauses, and completion stop the pulse with a 180ms visible settle. Exit, navigation, and reduced motion clear it immediately; reduced motion disables the added pulse, not the GIF. Invalid optional intervals disable only pulsing. Regenerate them if the recording changes; no Web Audio routing or audio re-encoding is involved.

Segmented narration is not planned. Slides 1 and 9–18 have no recording. Use one window for audio; Present synchronization handles visuals, not voice transport. A composition reload preserves slide, reveals, recording position, and Hold state; active narration waits for the replacement entrance before continuing. Subjective phrase timing, music balance, and pulse feel still need a complete rehearsal.

## Slide 3 understanding content

Three top panels reuse slide 2's bottom shapes and white labels: “Frustration”, “Realization”, and “Improvement”. One wide lower panel contains two separate lines: “GOAL: Maximize understanding and confidence per unit of attention.” and “Formula: (U + C) / A”. Only the expression is magenta with a small white glow. The original heading and centered AI stay clear. Four manual inputs reveal the top panels left to right, then the goal/formula; the fifth advances. Auto uses `slide-3.json` and the shared voice clock. Undo/reset, accessibility, and title/AI gating match slide 2; the draft is unchanged.

## Slide 4 model selection

Six original HUD shapes/numbers 01–06 match slide 2's blue frames, translucent fill, white labels and magenta digits with white glow. The left column reads “pick one or two good models”, “evaluate cost per task”, “value your time”; the right reads “GPT 6.1 Sol (High)”, “Opus 5.5 (High)”, “fewer decisions”. Reveal order is 1–3 down the left, then 4–6 down the right; the seventh manual input advances to slide 5. Shared voice-led auto, undo/reset, accessibility and entrance gating apply. The AI, heading and draft are unchanged.

## Slide 5 agentic development environment

The header uses the approved short caption “Use  an  ADE”. A separate wide panel below it reads “Agentic Development Environment”. The left has five numbered HUD rows: “Claude Code”, “Codex”, “Open Code”, “PI”, “T3Code”. The right has five unnumbered control panels: “diff viewer”, “mermaid diagrams”, “file explorer”, “integrated browser”, “make it your own”. Labels are white; tool digits remain magenta with white glow. All panels share the existing blue styling and leave the central AI clear. Reveal order is definition, tools 1–5, then features top-to-bottom: eleven reveals, with the twelfth input advancing to slide 6. Existing auto, undo/reset, accessible hiding, entrance gating and Present synchronization apply without controller changes. The draft is unchanged.

## Slide 6 remote work

Three control panels below the unchanged title read “separate the interface”, “WSL: Linux FS + Windows UI”, and “smart server / dumb client”. Four bottom panels read “SSH”, “Network Tools”, “Remote Services”, and “Tailscale”. Existing blue frames and white single-line text leave the AI clear. Seven reveals run across the top row then the bottom; the eighth manual input advances. Shared voice-led auto, undo/reset, accessibility, entrance gating and Present synchronization apply. The draft is unchanged.

## Slide 7 quick editing

Three numbered HUD boxes below the unchanged header read “navigating”, “inspecting diffs”, and “quick one-off edits”. Two wider unnumbered bottom panels say “neovim” and “zed”. All use the existing blue frames/translucent fill and white labels; HUD 01–03 retain their original paths and magenta numbers with white glow. The centered AI stays clear. Five reveals run across the top row, then the bottom; the sixth input advances to slide 8. Existing auto, undo/reset, accessible hiding, entrance gating and Present synchronization apply without controller changes. The draft is unchanged.

## Slide 8 workflow frameworks

The left control-panel frame contains the complete, uncropped `composition/assets/no-slop.jpg`, copied unchanged from `../artwork/no-slop.jpg` in the main checkout. Four original numbered HUD rows on the right read “Matt Pocock's skills”, “Superpowers”, “Ponytail”, and “PStack by Poteto”. Existing blue frames/translucent fill, white labels, magenta numbers with white glow, heading, and centered AI are retained. Five reveals show the image first, then rows 1–4; the sixth input advances to slide 9. Auto, undo/reset, accessible hiding, entrance gating and Present synchronization use the shared controller. The image remains stationary while the background moves. The draft is unchanged.

## Slide 9 skill-card trial

The launcher label and sidebar **Content/Demo** labels are white. The launcher SVG/border stay cyan; sidebar icons retain cyan for the selected tab and muted color otherwise. The whole launcher waits **550ms** after the slide transition before its existing 350ms fade, matching the speaking AI's entrance delay. Reduced motion removes the delay and fade; opening the editor itself adds no delay.

All skill-demo slides **9–18** begin with a centered **Open editor** button at the usual AI GIF position. Its notepad-and-pencil line-art SVG, cyan border, rounded corners and icon-over-label layout match the Content/Demo sidebar styling; its translucent blue background matches the slide header's `#1c4f6b` at 68% opacity. The editor is hidden in the initial HTML, so it cannot flash open or receive focus before activation. Click the button or use Enter/Space to reveal the editor and move focus to Content; opening never starts a conversation or voice. Every new visit requires another click, including screenshot slides. The launcher fades in only after a slide transition clears, and the editor fades in over 350ms only when opened. Reduced motion disables both fades.

Slide 9 keeps its original SOUL.md header and background, with the approved large card beneath the title once opened. Its collapsed width follows the title's visible SVG outline, not the wider padded viewBox. The shared titlebar shows file tabs in **Content**, “AI Responses” in **Demo**, and an expand/restore icon on the right. There is no duplicate path strip below the file tabs. Expanding/restoring animates over 300ms. Expansion covers the **entire 1920×1080 canvas**, hiding the original title and all exposed slide background. Presentation controls overlay the editor-colored surface, with internal safe space keeping the editor controls usable; it does not enter browser fullscreen. The left rail uses the original magenta digit 1 and file/sparkles icons. **Content** shows the complete, statically rendered `instructions/soul.md` snapshot in Tokyo Night; scroll inside the document to read it. The source instruction in the dotfiles project is never modified or fetched at runtime.

**Demo** has independent Before / After conversations about “Should I use `useEffect` in React as my main go-to tool?” Both answers are scripted and technically correct: the first is deliberately pompous; the second follows Soul's conversational tone. Pane headers contain only yellow **Before** / **After** labels, with no subtitles, across all skill cards; the compact Generate buttons have white labels. Each **Generate** immediately adds the question with a 150ms fade, then waits 400ms before showing the centered existing AI GIF with a 160ms fade-in. It pulses for a 3000ms thinking hold, fades out over 180ms, and disappears before the answer reveals one authored line every 600ms. This is **visual only: no voice or additional audio**. **Generate again** repeats the full sequence in only that pane. Chats scroll separately and their buttons stay below them. Reduced motion disables card entrance/resize animations and added question/thinking fades/pulsing, keeps the thinking timing, and reveals the complete answer without staggering.

The vertical **Aa** slider between the rail numeral and Content/Demo buttons adjusts content size from **20–48px** in 2px steps (**20px default**, starting at the minimum). File and chat body text use that size; document headings/code scale proportionally, while toolbar labels, role labels, pane titles, and buttons remain fixed. Drag it or use Up/Down and Home/End. The chosen size is shared across all ten skill slides: every slider, output and accessible value stays synchronized. It survives navigation, view changes, expansion, regeneration, closing/reopening, Exit, and revisits; reloading resets it to the default. No browser-storage layer is involved.

The rail buttons, titlebar/file tabs, and Before/After headings use compact padding to leave more room for content. Both Generate buttons share a cyan border and retain their sparkle in idle, “Generating…”, and replay states.

Each editor titlebar has a **Close editor** X control immediately after maximize/restore, with the same sizing and keyboard focus styling. Closing cancels both conversations, resets Content/file selection and scrolling, hides the editor, and returns focus to Open editor. It preserves the shared text size and maximized preference, and does not advance/exit the presentation or stop music. Mouse, Enter and Space activation work on conversation and screenshot cards, including scaled windows.

Expanded-mode internal safe space follows the actual overlaid control bounds and player scale, including live window resizes. This keeps Restore and Generate clear of the unscaled presentation buttons even in a small 1024×576 window, without exposing any slide background.

Switching Content / Demo preserves the current visit and expansion state. Slide changes clear both sessions, cancel thinking/stream timers, restore Content and close the editor, but **maximized mode is shared across skill cards and preserved when returning to a slide**. Unopened maximized cards leave the title visible; clicking Open editor restores their maximized appearance. Exit/Escape closes and collapses all cards and restores their launchers. While an open editor is maximized, plain **← / →** navigate to the previous/next slide—even when an editor button, file tab, document, or slider has focus. Up/Down still operates the vertical slider/rail tabs, and modified arrows retain local/browser behavior. While collapsed, file-tab arrows and document scrolling stay local to the editor. The outer Next/Previous controls remain available in both modes. Both the launcher and card stay hidden and non-interactive during the existing background transition.

`composition/skill-card.css` and `skill-card.js` provide shared styles and instance-local behavior; authored cards/question/answer templates live in `composition/index.html`. All ten skill slides, 9–18, are populated. Cards can use multiple uniquely identified file panels (seven actual tabs and a six-file fixture are tested), with rendered Markdown or escaped HTML/JS inside static highlighted code blocks. Most document snapshots are inline; the nine documents for screenshot cards are bundled HTML fragments under `composition/assets/skill-documents/`, loaded once by the shared component. These are pre-rendered, escaped assets, not runtime Markdown or original filesystem reads. A failed document load shows a Reload message and clears its busy state. No Markdown/highlighting dependency, live AI, or build step is needed to run the deck. Present still synchronizes slide/reveal positions, **not** card tabs, scrolling, or demo responses; use a single window for the interactive trial.

`skill-card-smoke.mjs` checks manual opening and close controls on all ten slides, centered translucent launchers, shared text sizing and synchronized controls across slides, mouse/keyboard activation and focus, hidden maximized titles, rapid revisit/Exit/reload, the full Soul snapshot, original SVG paths, safe card geometry/Tokyo Night colors, keyboard tabs, a two-card/six-file fixture, inert syntax-highlighted examples, delayed independent/replayable responses, close/departure cancellation, scrolling, scaled iframe clicks, and reduced motion. It runs with `npm test` alongside the existing deck regressions.

## Slide 10 workflow-composition demo

The second card retains “The Setup” header/background and uses the original magenta digit 2. Content displays the complete static `instructions/workflow-composition.md` snapshot. Its independent Before/After demos start with “I need a feature that lets users select themes on the website.” Before jumps to a light/dark implementation; After demonstrates intent clarification, Superpowers brainstorming/spec and plan approvals, tests before implementation, Ponytail review, a regression fix, and final verification.

These are **fictional transcripts**, not real tool calls, test results, or approval prompts. Generate automatically plays all turns, including User replies, using the existing timing and lifecycle. Follow-up User messages reuse the initial question's bubble and bold label. Agent/Status labels are bold, Status/User text is white, and Tool prose is muted. **All inline `<code>` is cyan**, including filenames, commands, skill names, and code within Tool lines; no special class is needed. This applies across all skill cards. GREEN test labels alone use green; RED labels remain red. Code-block syntax strings are cyan, not test green. Each top-level `.skill-answer` child is one playback step; a User bubble is one complete step. Browser coverage checks the rendered colors/bubbles, workflow order, replay/cancellation, original digit, and maximized arrow navigation between the real cards.

## Slide 11 prime-context demo

The third card keeps the “Prime Context” header/background and original magenta digit 3. Content renders all of `commands/prime.md`, including its description front matter. Before contains one continuous paragraph of manually supplied WSL, Linux-path, Docker/host-networking, Chrome CDP, and task-scope constraints; its only reply is “Ok.” After starts with `/prime ~/PROJECT-1-ENV.md`, shows a fictional file read/context-loaded status, summarizes four constraints as bullets, and ends with “I didn't execute any commands. What are we working on in this session?” The environment file and all environment details are hypothetical, not read or executed on this Mac.

For different questions, put a `[data-question]` template inside each `.skill-pane`. Playback prefers the pane's template, falling back to the shared card template used by slides 9/10. Thinking, streaming, replay, cancellation, resizing, and expansion otherwise remain shared and unchanged. These per-pane prompts and lifecycle behavior are covered by the browser checks.

## Slide 12 bro-response demo

The fourth card keeps the Bro header/background and original digit 4. Two keyboard-accessible Content tabs show the complete static `commands/bro.md` and `skills/bro/SKILL.md` snapshots, including front matter, all ten rules, examples, exceptions, and pre-send checks. These are displayed documents, not live instructions or runtime file reads.

Both Demo panes start with “Give me a summary of the comments on my PR.” and the same lengthy PR-review summary. The right pane then automatically adds a matching User bubble containing `/bro` and restates the same feedback plainly: fix the duplicate-order bug, follow four numbered steps, and open the relevant file next. The left stays verbose. No actual PR is accessed, and no work is claimed as completed. Existing thinking/playback timings, independent replay, file-tab reset, cancellation, and scrolling remain unchanged; no JavaScript changes were needed for this slide.

## Slide 13 clarify-intent demo

The fifth card keeps its Clarify Intent header/background and original digit 5. Its two Content tabs show the complete static `commands/clarify-intent.md` and `skills/clarify-intent/SKILL.md`, including front matter, examples, code blocks, and both semantic comparison tables. Table styling is shared by skill documents and uses the existing card colors.

Both panes ask for website theme selection. Before assumes a light/dark toggle with account synchronization and claims completion. After demonstrates `clarify-intent` alone: three product questions, one at a time, clarify personal versus shared appearance, browser-only versus account-wide persistence, and existing versus custom themes. User replies match the initial question bubble. The answer summarizes outcome, invariant, and scope, then explicitly hands off to design without claiming implementation. All tools/statuses are fictional; no real theme feature is built. Existing playback, reset, file tabs, shared expansion, and keyboard navigation are reused unchanged and browser-tested.

## Slide 14 codebase-explanations demo

The sixth card keeps the “Why is the Sky Blue?” header/background and original digit 6. Seven Content tabs show the command, `skills/codebase-explanations/SKILL.md`, and all five templates: `system.md`, `location.md`, `behavior.md`, `difference.md`, and `decision.md`. Each contains the complete static document. The filename bar scrolls horizontally; Left/Right and Home/End select and reveal tabs while collapsed. No original source files are loaded at runtime. Source diagrams and code examples remain inert.

Both Demo panes ask “how does this app work?” about an **imagined** React SPA/Hono/SQLite todo application. Before gives an accurate unstructured prose explanation. After demonstrates the System template in order: Summary, Diagram, How it works (four steps), Key code (five illustrative code anchors), Important details. These subheadings are magenta with a blank-line-sized gap before their content. The multi-line diagram separates the browser's React UI/state/API client from Hono routes, validation, handlers, prepared SQL, and the SQLite file; it labels HTTP requests and JSON responses. A visible note labels the paths/snippets as illustrative, not evidence from an inspected repository. Each top-level section/anchor is one playback step. Code and ASCII diagrams stay inert and scroll horizontally, including at 48px content size. Existing independent playback, replay, cancellation, tab reset, colors, and keyboard controls are unchanged; no JavaScript changes for this slide.

## Slide 16 pr-review demo

Slide 16 keeps “Trust me, it works” and its background, with skill digit 8. Four Content tabs contain the complete static `commands/pr-review.md`, `skills/pr-review/SKILL.md`, `architecture-gate.md`, and `follow-up-reviews.md` snapshots, including metadata, gate diagrams, and examples.

The question asks to review the explicitly fictional `https://github.com/ovi-ispas/todo-app/pull/1`. This is inert text: no link, network access, review publication, or `.git/pr-review` state is created. The fictional PR adds Active/Completed todo filters. Before gives a surface-level approval. After follows intent → compact Change Map (summary, consequences, paired diagram, comparison table) → architecture → correctness and finds exactly one bug: filtered row indexes are passed to a handler indexing the original array, so toggling active B can reopen completed A. It describes the reproduction, stable-ID fix, regression test, and blocking verdict without claiming to fix or test real code.

“Change Map” and “Correctness Issue — filtered checkboxes can update another todo” are magenta subheadings with a gap below, using the shared transcript heading style. Shared card table styling also supports the Change Map table. Existing playback, tabs, replay, departure cancellation, and colors are retained; no JavaScript changes for this slide.

## Screenshot demos on slides 15, 17, and 18

These cards retain their original scene titles/backgrounds and use skill numbers 7, 9, and 10 (the last combines the supplied 1/0 paths). Content uses the same file tabs, scrolling, font slider, and per-visit reset as the conversation cards:

- **15:** `skills/visual-changes/SKILL.md`, `references/tour-and-rendering.md`, and `references/template.html`; Demo uses `assets/skill-demos/guided-tour.png`.
- **17:** `skills/architecture-documentation/SKILL.md`, `documentation.md`, `generation.md`, and `maintenance.md`; Demo uses `assets/skill-demos/architecture-documentation.png`.
- **18:** `commands/save.md` and `skills/save-response/SKILL.md`; Demo uses `assets/skill-demos/saved-response.png`.

In Demo the titlebar says **Screenshot Preview**, and the panel contains only one image with meaningful alt text. Its width/height are 100%, with `object-fit: contain` to preserve the entire screenshot without distortion or cropping. No Before/After panes, Generate buttons, question/answer templates, thinking GIF, or chat timers exist on these cards. Expansion, restored maximization across slides, arrow navigation, Exit, and transition gating stay shared. The font slider changes Content only, not screenshot geometry.

The three PNGs were copied unchanged from the Desktop. All nine source snapshots are complete, rendered offline, and bundled as inert HTML fragments. The large visual-tour HTML template is fully escaped and statically highlighted code, not an iframe or executable document; its complete source hash is checked in the browser tests. Original source links are inert labels with target metadata. No original source instructions run: this task does not create a live tour, architecture docs, or a response export. Browser coverage checks all file loads, error messaging, inertness, image sizing/decode, numeral paths, scaling, tab reset, navigation, and expansion.

## Slide 19 recap

A separate panel below the unchanged header says “The object of your work has changed”. Four numbered HUD rows on the left read “clarify-intent”, “codebase-explanations”, “pr-review”, and “architecture-documentation”. Four unnumbered right panels contain “Focus: engineer your own development environment”, “Mindset: Work on the system that builds the product”, “Principle: Maximize understanding and confidence per unit of attention”, and “Constraint: Your working context is king”. Longer statements wrap inside their frames. Existing white text, blue frames/translucent fill, magenta digits with white glow, and central AI remain consistent. Nine reveals show the top panel, skills 1–4, then statements top-to-bottom; the tenth input advances to slide 20. Shared auto, undo/reset, accessibility, entrance gating and Present synchronization apply. The draft and closing slide are unchanged.

## Speaking AI on slides 2–8 and 19–20

These nine slides share the same centered 100×100 `ai-talking.gif`, 80% opacity, and broad cyan halo. The existing slide-2 title→AI→manual-content sequence is unchanged; the other copies use the same automatic entrance and transition/reduced-motion handling. No reveal clicks are added. Slide 20 retains its existing spacing between “Thank” and “You!”, with both words shifted up 40px; the AI and contact lines stay fixed. Other slides, the original GIF, and the draft remain unchanged.

## Idle background motion

The backgrounds use five moves: push-in, pull-back, left/right drift, and a diagonal drift with a slight push. Each pass takes 14 seconds at constant speed from the start (28 seconds for a full cycle). Motion reverses without resetting position, but direction changes are now immediate rather than eased. Framing uses 2.5–12.5% zoom, with at most 2.5% lateral or 1.5% diagonal displacement; no rotation, blur, overlays, or slide transitions are added.

Only the current slide's direct background-picture image moves; foreground images such as the bell curve stay stationary. Content should be a sibling of the background `picture` inside the slide section, not nested in it. Motion starts with Start and continues during manual holds and on the final slide. Navigation restarts the new slide's move; Exit cancels it. A reduced-motion preference disables these added camera moves, leaving the approved 2× GIF animation untouched.

These camera moves deliberately live in the outer player, separately from HyperFrames' held slide clock, like the continuous music. They are a live presentation treatment, not seek-authored/exportable composition animation. The composition's `data-no-timeline` marker still describes the artwork document; a future video export needs its own authored camera timing.

## Cinematic transitions

- **After slides 1, 2, 3, 8, 9, 17, and 18 — Neon Whip (0.7 seconds):** a fast sideways camera move with horizontal motion smear and chromatic trails; the incoming scene enters from the right (1↔2, 2↔3, 3↔4, 8↔9, 9↔10, 17↔18, 18↔19).
- **Before and after slides 6, 13, and 16 — Neon Plunge (0.9 seconds):** a forward rush with radial zoom streaks and channel separation around the car scenes (5↔6, 6↔7, 12↔13, 13↔14, 15↔16, 16↔17).
- **After slides 10, 11, and 14 — Signal Hijack (0.7 seconds):** horizontal tears, block scrambling, RGB separation, and a fast lock into the next scene (10↔11, 11↔12, 14↔15).
- **After slides 4, 7, and 19 — CRT Blackout (1 second):** the scene collapses into a thin cyan line, briefly goes fully black, then expands into the next scene (4↔5, 7↔8, 19↔20).
- Every adjacent pair now has a transition. Both rain auditions, Liquid Glass, Neon Shutter, Gravity Well, and Neon Fracture have been removed.
- The same effect applies when crossing each of the nineteen configured boundaries backward. Direct jumps and Start/restart still use clean cuts. The one-based placement map is `transitionsAfter` in `deck.js`; `transitionDurations` holds each effect's duration in milliseconds.

Both Next/Previous and autoplay use these placements. Music is uninterrupted. Narration waits for the transition and incoming title/AI entrance. Rapid navigation cancels the previous effect and follows the newest selection; Exit and changes to reduced-motion mode clear an in-flight effect immediately. Reduced-motion mode and browsers without WebGL use simple cuts.

The effects render only while needed, using a single 1280×720 canvas scaled to the slide area. Animated GIFs cannot be frame-grabbed accurately with `drawImage`: the shader therefore uses held keyframes only for the distorted middle of the cut. A native live-image layer carries the outgoing scene into the burst, and the shader fades away over the actual incoming GIF/camera motion for the final landing. Transition imagery stays inside the composition iframe; playback controls remain usable in fullscreen.

These remain background-only transitions: foreground content leaves cleanly rather than being distorted into the shader textures, and incoming content waits for the overlay to clear. No transition sounds or brightness strobing have been added, and none of the existing GIFs were re-rendered.

## Recording filter

All twenty slides use the approved slide-2 treatment: faint evolving grain, occasional horizontal digital tears, and restrained channel/block glitches. No recording HUD, sound effects, brightness flashes, or treatment of future foreground content has been added. The existing camera moves still apply normally.

Each treatment is baked into a separate GIF so its noise continues during manual holds without adding a second rendering engine to the live deck. Each uses 10 fps while retaining the approved 2× source's loop duration: **5.1 seconds for slide 3, 4.8 seconds for slide 16, and 5.4 seconds for the others**. The scene is not sped up again. A reduced-motion preference automatically selects the corresponding untreated 2× GIF instead.

The approved canonical grain/digitalGlitch settings and editable reference live in `treatments/slide-02/`. See `treatments/README.md` for rebuilding the remaining nineteen from the same reference. The approved slide-2 file is retained byte-for-byte. Filtered GIFs are larger than their clean bases, especially the higher-resolution slide 12, and GIF palette quantization remains a limitation. The CLI warns that these GIFs exceed its 2 MiB inline limit: they are separate local assets, so keep the complete `output/` folder together rather than expecting a single bundled HTML file.

The twenty treated backgrounds total **217.3 MiB**, including **45.8 MiB** for slide 12. A short local headless-Chrome test visited every slide and then sampled six seconds on slide 12 at 1920×1080: approximately 59 fps, with one 150 ms frame gap. This is a local spot check, not a venue/projector or long-session guarantee.

## Checks

`npm test` launches a temporary localhost test server and headless Chrome, then shuts both down. It checks all nineteen transition boundaries forward and backward, autoplay, rapid reversal and jump cancellation, WebGL/reduced-motion fallbacks for all four effects, the treated source and clean fallback on all twenty slides, active-only idle motion, immediate travel within 250 ms, visible camera travel within five seconds, coverage at motion endpoints and return, stationary foreground content, music continuity/looping, mute, fullscreen controls, Escape after focusing the artwork, exit and restart. `shader-smoke.mjs` renders the actual whip/CRT shaders against controlled textures to check full-frame endpoints, lateral whip/blur, and the CRT line/full blackout. It uses this Mac's installed HyperFrames Puppeteer and Google Chrome. Current samples in `stills/transition-*.png` cover 1↔2, 2↔3, 3↔4, 4↔5, 6↔7, 7↔8, 8↔9, 9↔10, 10↔11, 11↔12, 17↔18, 18↔19, and 19↔20.

`audience-smoke.mjs` additionally checks the nine real click/keyboard/toolbar reveal steps, focused-button Space behavior, two-window Present synchronization, backward undo, tenth-input navigation, visit/Exit resets, accessible hidden state, original HUD geometry and PNG/GIF bytes, white palette, inset image fit, automatic title→AI→content entrance order, no overlaps or content flares, manual autoplay hold, transition gating, reduced motion, and independent PNG/background/music behavior.

`understanding-smoke.mjs` checks slide 3's four panels, exact two-line text, geometry, palette/glow, real manual reveal/undo/reset behavior, and title/AI gating. Narration tests own automatic progression; the real Present popup checks visual reveal/undo/reset synchronization.

`typography-smoke.mjs` holds the approved display-caption fixture and checks all eighteen interior headings match exactly, use the loaded local Cyberpunk face, fit their unchanged panels, and leave body text in Saira. A rendered-width check verifies that double spaces visibly widen the word gap. Narration checks cover the extra first-play pause, immediate mid-clip Resume, cancellation, and closing completion/Replay/reduced-motion gates. The Present popup also checks closing completion/reset without duplicate audience audio.

`narration-smoke.mjs` verifies all nine approved recordings, loaded Blob hashes, cue boundaries, 600ms pulse geometry/clearance, speech/quiet windows, and the complete auto→manual→Resume→final Replay flow. Regressions cover clock stalls/catch-up, Hold/Resume/manual override, ducking/mute across tracks, navigation/Exit reset, selected versus unselected failures, delayed loading, stale media events/play promises, reduced-motion changes during entrance/completion, SDK controller replacement, detached documents, and invalid optional activity data. Its isolated context uses tiny backgrounds but real audio/foreground/transitions. The visual suite separately loads all 217 MiB of real backgrounds with a 120-second navigation budget; Present tests verify visual synchronization without audience narration. Automated checks do not replace listening to phrase/reveal timing.

`models-smoke.mjs` checks slide 4's six ordered HUD rows, exact labels and original SVG geometry, two-column alignment, palette/glow, text fit and AI clearance, real manual inputs, undo/reset and seventh-input navigation. Shared auto tests also cover all six timed reveals and progression to slide 5; the real Present popup checks slide-4 reveal/undo/reset synchronization.

`ade-smoke.mjs` checks slide 5's separate definition panel and unchanged title, exact tool/feature copy, eleven real-input reveals, undo/reset/twelfth-input advance, accessible hiding, original tool HUD geometry, unnumbered feature panels, styling, fit and AI clearance. Shared auto/Present tests include the complete eleven-step sequence.

`remote-smoke.mjs` checks slide 6's exact three-top/four-bottom text and geometry, single-line fit, matching blue/white styling, title/AI clearance, seven real-input reveals, undo/reset/eighth-input advance and accessible hiding. Shared auto/Present tests cover all seven reveals; legacy navigation tests finish them before crossing slide-6 boundaries.

`editing-smoke.mjs` checks slide 7's three original numbered HUD shapes and two unnumbered bottom panels, exact labels, single-line fit, palette/glow, title/AI clearance, five real-input reveals, undo/reset/sixth-input advance and accessible hiding. Shared auto/Present tests include its five-step sequence.

`frameworks-smoke.mjs` checks slide 8's unchanged portrait image bytes, complete uncropped image loading, four original HUD shapes, exact labels, palette/glow, image/list/AI clearance, five real-input reveals including image clicks, undo/reset/sixth-input advance and accessible hiding. Shared auto/Present tests include its complete sequence.

`recap-smoke.mjs` checks slide 19's exact top/skill/summary text, four original HUD shapes, wrapped text fit, blue/white/magenta styling, column alignment and AI clearance, nine real-input reveals, undo/reset/tenth-input advance and accessible hiding. Shared auto/Present tests cover its complete sequence and progression to the unchanged closing slide; boundary tests finish its nine reveals before testing CRT travel.

`npm run check` runs the installed HyperFrames CLI against the composition. Its runtime/layout audit samples the first scene; `npm test` separately checks visibility and image loading for all twenty. The first scene uses the documented `data-no-timeline` marker because there is no seek-driven artwork animation yet; remove it when authored animation is added. The check's informational `audio_none` applies only to the artwork document: continuous music lives in the outer player and is checked by `npm test`. No export or cloud publishing is involved.

The CLI's later-slide snapshot path currently reports `Composition "slide-02" has no visible time interval`. Slide 2 was instead inspected through live-browser captures across a complete loop; native snapshots of the isolated treatment composition work normally.

Audio balance and the six-minute track's loop seam still need human listening. Suno public-performance/distribution rights have not been verified; see `../audio/README.md` for the source and licensing note.
