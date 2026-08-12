/* ==========================================================================
   Arsenij Arsiriy — resume site
   Progressive enhancement only. Every section already exists in index.html;
   this file lifts them into the window overlay, wires the project rail, and
   builds the CV / PDF dialogs. With JS disabled the page stays fully readable.
   ========================================================================== */

(() => {
  "use strict";

  const $  = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  /* --- Sticky header shadow ---------------------------------------------- */

  const header = $(".site-header");
  const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --- Dialog helper ------------------------------------------------------ */
  /* Native <dialog> gives us the top layer, ::backdrop and Esc for free; we
     only add the enter/leave transition on top of it. */

  const makeDialog = (cls) => {
    const dlg = el("dialog", `modal ${cls}`);
    document.body.appendChild(dlg);

    const open = () => {
      if (dlg.open) return;
      dlg.showModal();
      requestAnimationFrame(() => dlg.classList.add("is-open"));
    };

    const close = () => {
      if (!dlg.open) return;
      dlg.classList.remove("is-open");
      const done = () => dlg.open && dlg.close();
      reduceMotion.matches ? done() : setTimeout(done, 200);
    };

    // Esc fires `cancel` before `close`; intercept so the exit transition runs.
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });

    return { dlg, open, close };
  };

  /* --- CV download picker ------------------------------------------------- */

  const CV_FILES = [
    { code: "EN", name: "English version", href: "assets/arsenij-arsiriy-resume-en.pdf", file: "Arsenij_Arsiriy_Resume_ENG.pdf" },
    { code: "PL", name: "Polish version",  href: "assets/arsenij-arsiriy-resume-pl.pdf", file: "Arsenij_Arsiriy_Resume_PL.pdf" }
  ];

  const cv = makeDialog("cv-modal");
  {
    const bar = el("div", "modal-bar");
    const title = el("h2", null, "Download CV");
    const closeBtn = el("button", "btn btn--sm", "Close");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", cv.close);
    bar.append(title, closeBtn);

    const grid = el("div", "cv-grid");
    CV_FILES.forEach((f) => {
      const a = el("a", `cv-choice cv-choice--${f.code.toLowerCase()}`);
      a.href = f.href;
      a.download = f.file;
      a.setAttribute("aria-label", `Download CV — ${f.name}`);
      a.append(el("span", "cv-code", f.code), el("span", "cv-name", f.name));
      a.addEventListener("click", () => setTimeout(cv.close, 120));
      grid.appendChild(a);
    });

    cv.dlg.append(bar, grid);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cv-open]")) { e.preventDefault(); cv.open(); }
  });

  /* --- PDF reader --------------------------------------------------------- */

  const DOCS = {
    ashtea: {
      title: "Product & Market Analysis Project",
      pattern: "assets/ashtea-pages-webp/page-{n}.webp",
      pages: 15,
      source: "assets/ashtea-marketing-project.pdf"
    }
  };

  const pdf = makeDialog("pdf-modal");
  const pdfState = { doc: null, page: 1 };
  const pdfTitle = el("h2", null, "Document");
  const pdfCount = el("span", "pdf-count", "1 / 1");
  const pdfPrev  = el("button", "rail-arrow", null);
  const pdfNext  = el("button", "rail-arrow", null);
  const pdfImg   = el("img");
  {
    const arrow = (btn, d, label) => {
      btn.type = "button";
      btn.setAttribute("aria-label", label);
      btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    };
    arrow(pdfPrev, "M15 5 8 12l7 7", "Previous page");
    arrow(pdfNext, "m9 5 7 7-7 7", "Next page");

    const source = el("a", "btn btn--sm", "Original PDF");
    source.target = "_blank";
    source.rel = "noreferrer";

    const closeBtn = el("button", "btn btn--sm", "Close");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", pdf.close);

    const controls = el("div", "pdf-controls");
    controls.append(pdfPrev, pdfCount, pdfNext, source);

    const bar = el("div", "modal-bar");
    bar.append(pdfTitle, controls, closeBtn);

    const stage = el("div", "pdf-stage");
    pdfImg.alt = "";
    stage.appendChild(pdfImg);

    const panel = el("div", "pdf-panel");
    panel.append(bar, stage);
    pdf.dlg.appendChild(panel);
    pdf._source = source;
  }

  const pdfSrc = (doc, n) => doc.pattern.replace("{n}", String(n).padStart(2, "0"));

  const showPage = (n) => {
    const doc = pdfState.doc;
    if (!doc) return;
    pdfState.page = Math.min(Math.max(n, 1), doc.pages);
    pdfImg.src = pdfSrc(doc, pdfState.page);
    pdfImg.alt = `${doc.title} — page ${pdfState.page} of ${doc.pages}`;
    pdfCount.textContent = `${pdfState.page} / ${doc.pages}`;
    pdfPrev.disabled = pdfState.page <= 1;
    pdfNext.disabled = pdfState.page >= doc.pages;
    // Warm the next page so paging feels instant.
    if (pdfState.page < doc.pages) new Image().src = pdfSrc(doc, pdfState.page + 1);
  };

  pdfPrev.addEventListener("click", () => showPage(pdfState.page - 1));
  pdfNext.addEventListener("click", () => showPage(pdfState.page + 1));
  pdf.dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); showPage(pdfState.page - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); showPage(pdfState.page + 1); }
  });

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-pdf]");
    if (!trigger) return;
    const doc = DOCS[trigger.dataset.pdf];
    if (!doc) return;
    e.preventDefault();
    pdfState.doc = doc;
    pdfTitle.textContent = doc.title;
    pdf._source.href = doc.source;
    showPage(1);
    pdf.open();
  });

  /* --- Project rail ------------------------------------------------------- */

  const initRail = (rail) => {
    const cards = $$(".pcard", rail);
    const dotsBox = $("#railDots");
    if (!cards.length || !dotsBox) return () => {};

    const dots = cards.map((card, i) => {
      const dot = el("button", "rail-dot");
      dot.type = "button";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-selected", String(i === 0));
      dot.setAttribute("aria-label", `Project ${i + 1} of ${cards.length}`);
      dot.addEventListener("click", () => {
        rail.scrollTo({ left: card.offsetLeft - rail.offsetLeft, behavior: reduceMotion.matches ? "auto" : "smooth" });
      });
      dotsBox.appendChild(dot);
      return dot;
    });

    const step = () => {
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
      return cards[0].getBoundingClientRect().width + gap;
    };

    const nearest = () => {
      const x = rail.scrollLeft;
      let best = 0, bestDist = Infinity;
      cards.forEach((card, i) => {
        const d = Math.abs(card.offsetLeft - rail.offsetLeft - x);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    };

    const prevBtn = $('[data-rail="prev"]');
    const nextBtn = $('[data-rail="next"]');

    const sync = () => {
      const i = nearest();
      dots.forEach((d, di) => d.setAttribute("aria-selected", String(di === i)));
      const maxScroll = rail.scrollWidth - rail.clientWidth - 1;
      if (prevBtn) prevBtn.disabled = rail.scrollLeft <= 1;
      if (nextBtn) nextBtn.disabled = rail.scrollLeft >= maxScroll;
    };

    const nudge = (dir) =>
      rail.scrollBy({ left: dir * step(), behavior: reduceMotion.matches ? "auto" : "smooth" });

    prevBtn?.addEventListener("click", () => nudge(-1));
    nextBtn?.addEventListener("click", () => nudge(1));

    rail.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); nudge(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(1); }
    });

    let ticking = false;
    rail.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { sync(); ticking = false; });
    }, { passive: true });

    addEventListener("resize", sync);
    return sync;
  };

  const rail = $("#projectRail");
  const syncRail = rail ? initRail(rail) : () => {};

  /* --- Window overlay ----------------------------------------------------- */

  const stage        = $("#sectionStage");
  const stageWindow  = $(".stage-window", stage);
  const windowBody   = $("#windowContent");
  const windowTitle  = $("#windowTitle");
  const docSource    = $("#content");
  const shell        = $(".desktop-shell");

  const sections = new Map();
  $$(".doc-section", docSource).forEach((section) => {
    const anchor = document.createComment(`section:${section.id}`);
    section.before(anchor);
    sections.set(section.id, { node: section, anchor });
  });

  const FOCUSABLE =
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  let current = null;
  let lastTrigger = null;

  const setBackgroundInert = (on) => {
    [header, shell, docSource].forEach((node) => {
      if (!node) return;
      node.toggleAttribute("inert", on);
      // Safari < 15.5 has no `inert`; aria-hidden at least protects AT users.
      if (on) node.setAttribute("aria-hidden", "true");
      else node.removeAttribute("aria-hidden");
    });
  };

  const openWindow = (id, trigger) => {
    const entry = sections.get(id);
    if (!entry || current === id) return;

    // Return whatever is currently mounted before mounting the next one.
    if (current) sections.get(current).anchor.after(sections.get(current).node);

    lastTrigger = trigger || lastTrigger;
    current = id;

    // Zoom the window out of the tile that was clicked.
    const origin = trigger?.getBoundingClientRect();
    if (origin && !reduceMotion.matches) {
      stageWindow.style.setProperty("--from-x", `${origin.left}px`);
      stageWindow.style.setProperty("--from-y", `${origin.top}px`);
      stageWindow.style.setProperty("--from-w", `${origin.width}px`);
      stageWindow.style.setProperty("--from-h", `${origin.height}px`);
    } else {
      stageWindow.style.removeProperty("--from-x");
      stageWindow.style.removeProperty("--from-y");
      stageWindow.style.removeProperty("--from-w");
      stageWindow.style.removeProperty("--from-h");
    }

    windowTitle.textContent = entry.node.dataset.title || id;
    windowBody.replaceChildren(entry.node);
    windowBody.scrollTop = 0;

    stage.hidden = false;
    document.body.classList.add("is-locked");
    setBackgroundInert(true);

    // Rail state must not depend on the animation frame — the section is
    // measurable as soon as it is mounted and visible.
    if (id === "work") syncRail();

    // One frame so the browser records the origin geometry before it animates.
    requestAnimationFrame(() => {
      stage.classList.add("is-open");
      windowBody.focus({ preventScroll: true });
    });

    $$(".nav-link").forEach((link) =>
      link.setAttribute("aria-current", String(link.hash === `#${id}`))
    );
  };

  const closeWindow = () => {
    if (!current) return;
    const entry = sections.get(current);
    current = null;

    stage.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    setBackgroundInert(false);

    const finish = () => {
      entry.anchor.after(entry.node);   // put the section back in the document
      stage.hidden = true;
    };
    reduceMotion.matches ? finish() : setTimeout(finish, 480);

    lastTrigger?.focus({ preventScroll: true });
    lastTrigger = null;
    $$(".nav-link").forEach((link) => link.setAttribute("aria-current", "false"));
  };

  /* Closing goes through history so Back and the close button agree. If our own
     entry is on the stack we pop it; otherwise (rare) we just drop the hash, so
     a deep-linked visitor is never bounced off the site. */
  const requestClose = () => {
    if (!current) return;
    if (history.state?.win) history.back();
    else {
      history.replaceState(null, "", location.pathname + location.search);
      closeWindow();
    }
  };

  // Focus trap — Tab must not escape the open window.
  stage.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); requestClose(); return; }
    if (e.key !== "Tab") return;

    const items = $$(FOCUSABLE, stageWindow).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    // windowBody has tabindex="-1", so Shift+Tab out of it lands on the toolbar
    // controls naturally; only the true ends of the sequence need wrapping.
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  $$("[data-close-window]").forEach((node) =>
    node.addEventListener("click", requestClose)
  );

  /* Window controls. Close and minimise both return to the overview — with no
     dock to minimise into, that is what minimising means here. Zoom is a real
     full-screen/windowed toggle, so the green control does something distinct
     rather than imitating a button that does nothing. */
  let windowed = false;
  const zoomBtn = $('[data-window-action="zoom"]');

  const setWindowed = (on) => {
    windowed = on;
    stageWindow.classList.toggle("is-windowed", on);
    zoomBtn.dataset.glyph = on ? "⤢" : "⤡";
    const label = on ? "Enter full screen" : "Exit full screen";
    zoomBtn.title = label;
    zoomBtn.setAttribute("aria-label", label);
  };

  $$("[data-window-action]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.dataset.windowAction === "zoom") setWindowed(!windowed);
      else requestClose();
    })
  );

  /* --- Routing ------------------------------------------------------------ */
  /* The hash is the source of truth, so tiles and nav links stay real links,
     deep links work, and the browser Back button closes the window. */

  const routeTo = (id, trigger) => {
    if (sections.has(id)) openWindow(id, trigger);
    else closeWindow();
  };

  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

    const id = link.hash.slice(1);
    if (!sections.has(id)) return;

    e.preventDefault();
    if (location.hash === link.hash) { routeTo(id, link); return; }
    history.pushState({ win: id }, "", link.hash);
    routeTo(id, link);
  });

  addEventListener("popstate", () => routeTo(location.hash.slice(1)));

  /* Deep link on first load. Rewrite the entry as overview-then-window so the
     Back button lands on the overview instead of leaving the site. */
  const initial = location.hash.slice(1);
  if (sections.has(initial)) {
    history.replaceState(null, "", location.pathname + location.search);
    history.pushState({ win: initial }, "", `#${initial}`);
    openWindow(initial, $(`[data-window="${initial}"]`));
  }
})();
