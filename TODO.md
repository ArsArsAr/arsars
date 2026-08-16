# TODO

Outstanding work from the design critique of 2026-08-16.

The full report, with every measurement and selector, is at
`.impeccable/critique/2026-08-16T14-04-58Z__index-html.md` — but `.impeccable/` is
gitignored, so that file is local to whoever ran the critique. This list is the durable
copy; everything needed to act on an item is written out here.

Score at the time of writing: **21/36 (58%, Acceptable)**. Heuristic 10 scored `n/a`.
Re-run `/impeccable critique` after fixes to see the number move.

---

## P1 — fix before this is shown to anyone who matters

### ~~The section window is a one-way door~~ — done
The toolbar now carries the five section names as real `<a href="#id">` links
(`#windowNav`, ≥48em — narrower than the header nav's own 64em gate, since the toolbar
has the full window width to itself) plus a second language switch (`.window-lang-switch`,
reusing the header's exact markup and `data-lang-set` wiring, so no new JS was needed to
keep them in sync). `openWindow` now distinguishes a fresh open from a switch between two
already-open sections: a switch skips the retraction/zoom choreography entirely and just
swaps content, moves focus to it, and updates the title.

`#windowTitle` stays mounted for `aria-labelledby` (the dialog's accessible name) and
becomes the visually-hidden one below 48em, where the plain title text is unchanged from
before — the CSS reuses the `.sr-only` clip pattern rather than `display:none`, since the
sr-only element still needs to work as an aria-labelledby target when it isn't display:none.

Fixed the same run:
- **Window title going stale on a language switch** — was set once inside `openWindow`
  and never registered with `onLangChange`, invisible only because the switch was
  unreachable. Now updates live via a shared `sectionTitle(id)` helper.
- **A real regression caught by testing, not assumed away:** switching sections pushed a
  new history entry each time, so `requestClose()` — which the traffic-light close, the
  minimize button and the big Overview button all call — only undid one switch instead of
  actually closing, after two or three section switches. A switch now `replaceState`s the
  current entry instead of pushing, so Close/Esc/Overview/browser-Back all agree on what
  "leave" means regardless of how many sections were visited first.
- Verified: retracting after a switch zooms into the *current* section's tile, not the one
  that originally opened the window; focus order through the new toolbar controls is
  traffic → nav links → lang switch → Overview, all inside the existing Tab trap
  unmodified; no console errors across open → switch → language-switch → close.

### ~~Two of five projects are dead ends~~ — done
Both diagrams are now `DOCS` entries (`pages: 1`) with a "View the diagram" / "Zobacz
diagram" button. The reader hides its arrows and page counter on a single-page document,
and "Original PDF" relabels to "Full-size image" / "Pełny obraz" for the two that are
images rather than PDFs. Verified: every card now has a focusable CTA, the alt text and
title track a language switch made mid-read.

Found and fixed along the way: `.rail-arrow` sets its own `display: grid`, which beats
the `[hidden]` UA rule — setting `.hidden = true` on the PDF reader's arrows did nothing
visually until `.rail-arrow[hidden] { display: none }` was added.

---

## P2

### The instrument marks do not read as instruments
Verified visually in a compositing browser: the Capabilities turbine renders as a
circular grey smudge, the Work propeller as a vertical totem. At 7px glyphs and low alpha
the forms wash into noise. Headless terminal renders were misleading — monospace at full
contrast reads where low-alpha screen glyphs do not.
Options: fewer and larger cells; more contrast inside the mark's own band while keeping
text clear of it; or simpler silhouettes that survive the medium.

### ~~`alt="undefined"`~~ — done; no error path in the PDF reader still open
`pdfImg.alt` now builds from `t(doc.key)` and `t("pageOf", …)`, both already translated,
and updates live if the language changes while a document is open. Still open:
- No `onerror` on any image anywhere; a failed page clears the busy state and shows a
  broken icon.
- No timeout on `stage.dataset.loading`, so a decode that never settles leaves the reader
  dimmed behind "Loading page" forever.
- No `aria-live` on the page counter, so paging is silent to a screen reader.

### The window toolbar clips its own close button on phones
At 375px the toolbar overflows and `.window-close` is cut off — 43px in Polish
("Doświadczenie"), with the `Esc` chip almost entirely gone. Caused by the coarse-pointer
rule growing each traffic light to 44px. `.stage-window` is `overflow: hidden`, so it is
clipped rather than scrollable.
Inside `@media (pointer: coarse) and (max-width: 30em)`: hide `.traffic` and the `Esc`
chip. Touch has no window chrome to imitate, and phones have no Esc key.

---

## Accessibility

- Both `<dialog>`s (CV picker, PDF reader) have no accessible name — no `aria-labelledby`
  pointing at their `<h2>`. `.stage-window` does have one; the pattern was known and not
  applied.
- The CV modal's first focusable control is **Close**. Tab order is Close → EN → PL, so the
  primary action is two tabs past the escape hatch.
- `.traffic-btn` is 13×13 and `.rail-dot` 30×5 at fine pointer — under the WCAG 2.2
  24×24 floor. The 44px floor was only ever applied inside `@media (pointer: coarse)`.
- `#railDots` is `role="tablist"` with `role="tab"` children but no tabpanel, no
  `aria-controls` and no roving tabindex.
- The landing page has exactly one heading, so heading navigation is useless on the shell;
  tile titles are `<span>`.
- Two `navigation` landmarks share the same accessible name (header nav and tile grid).
- Focus entry into the window rides on `requestAnimationFrame`; if rAF is throttled the
  dialog is open and focus-trapped with focus still on `<body>`. Worth a `setTimeout`
  fallback.

## Content and behaviour

- **Ctrl+F on the landing page finds nothing** — `.js .doc-source { display: none }` hides
  the entire resume behind the tiles. Searching "SQL" or "Landstar" from the shell returns
  zero hits.
- **Printing with a section open silently drops that section**, because `@media print`
  hides `.stage` and the open section lives inside it.
- The yellow traffic light is labelled "Minimize to overview" and calls `requestClose()` —
  two of three controls do the same thing and one of them lies about it.
- "Original PDF" opens a **50 MB** file in a new tab with no size, type or warning.
- A `?lang=pl` link persists to `localStorage` with no visible way to reset it.
- The PDF reader has 15 pages behind two arrows and no jump control; on a phone it renders
  a 1400px slide at roughly 23% with no zoom.
- No confirmation that a CV download happened — the modal just closes after 120ms.

## Localisation gaps

- The zoom traffic button ships `title` / `aria-label` as English literals with no
  `data-pl-*`, so it announces in English on a Polish page.
- `content: "Loading page"` is hardcoded in CSS where `t()` cannot reach it.

## Housekeeping

- Dead code: `.pcard-media--glyph` and its `::after`, `data-window-link`, `--gold`,
  `data-number`, `data-kicker` (the last is English-only and duplicates the visible
  `.doc-kicker`).
- Orphan files: `resume-data.js` (referenced only by a comment saying it is unused),
  `assets/mark.svg`, `assets/profile-portrait.svg`.
- ~4.5 MB of superseded PNGs still in the repo beside their WebP replacements:
  `arsenij-photo.png`, `unilife-preview.png`, `ashtea-marketing-preview.png`.
- The CV picker uses a Union Jack for "English version". The CV is written in English; it
  is not a British CV. The "EN" code already says the right thing.
- `.hero-summary` and Profile's first `.body-text` are near-verbatim duplicates in both
  languages.
- Detector flagged `tight-leading` (1.10) on four headings, three of them Polish — the
  longer strings wrap more, so it bites hardest there.
