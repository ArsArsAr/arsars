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

  /* --- Signature: the ASCII airframe ------------------------------------ */
  /* A three-dimensional aircraft rendered as a dithered glyph field. Moving
     the cursor orbits the model, so the view pans around the airframe —
     nose-on through broadside to tail — and tilts with vertical movement.

     This is a small software rasteriser, not line art: the mesh is built from
     lofted fuselage rings plus wing/tail solids, transformed and projected per
     frame, filled with a z-buffer, Lambert-shaded, then quantised to a glyph
     ramp with ordered dithering. That dither is what produces the photographic
     grain rather than flat banded fills.

     Canvas 2D rather than WebGL on purpose: the glyphs are the medium, the
     triangle count is tiny, and this keeps the whole thing dependency-free. */

  const initGlyphField = () => {
    const canvas = $("#glyphField");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Dark to bright. Index 0 is never drawn, so empty space stays empty.
    const RAMP = " .'`^\",:;~+=*oaOZ#MW&8%B@";
    // 4x4 ordered dither — breaks the ramp's banding into grain.
    const BAYER = [
      [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
    ].map((r) => r.map((v) => v / 16));

    /* ---- mesh ---------------------------------------------------------- */
    // x: nose is +x. y: up. z: right wing is +z.
    const verts = [];   // flat [x,y,z, ...]
    const tris  = [];   // flat [i0,i1,i2, ...]
    const spin  = [];   // per-triangle: 1 if it belongs to the propeller

    const V = (x, y, z) => { verts.push(x, y, z); return verts.length / 3 - 1; };
    const T = (a, b, c, isSpin) => { tris.push(a, b, c); spin.push(isSpin ? 1 : 0); };
    const quad = (a, b, c, d, s) => { T(a, b, c, s); T(a, c, d, s); };

    // Fuselage: lofted rings. [station x, radius y, radius z]
    const SECTIONS = [
      [-1.30, 0.020, 0.020], [-1.15, 0.055, 0.045], [-0.95, 0.080, 0.065],
      [-0.60, 0.105, 0.090], [-0.20, 0.130, 0.115], [ 0.10, 0.150, 0.130],
      [ 0.35, 0.145, 0.125], [ 0.60, 0.120, 0.105], [ 0.85, 0.085, 0.078],
      [ 1.02, 0.045, 0.042], [ 1.10, 0.018, 0.018],
    ];
    const RING = 12;
    const ringStart = [];
    for (const [x, ry, rz] of SECTIONS) {
      ringStart.push(verts.length / 3);
      for (let i = 0; i < RING; i++) {
        const a = (i / RING) * Math.PI * 2;
        V(x, Math.sin(a) * ry, Math.cos(a) * rz);
      }
    }
    for (let s = 0; s < ringStart.length - 1; s++) {
      for (let i = 0; i < RING; i++) {
        const j = (i + 1) % RING;
        quad(ringStart[s] + i, ringStart[s] + j, ringStart[s + 1] + j, ringStart[s + 1] + i);
      }
    }

    // A solid slab: root/tip chord and thickness, mirrored across an axis.
    const slab = (x0, x1, chordRoot, chordTip, span, thick, axis, sign, dihedral) => {
      const p = [];
      for (const [t, chord, sp] of [[0, chordRoot, 0], [1, chordTip, span]]) {
        const xf = x0 + (x1 - x0) * t;
        const off = sign * sp;
        const lift = dihedral * sp;
        for (const [dx, dy] of [[0, -1], [chord, -1], [chord, 1], [0, 1]]) {
          if (axis === "z") p.push(V(xf - dx, lift + dy * thick, off));
          else              p.push(V(xf - dx, lift + off,        dy * thick));
        }
      }
      const [a, b, c, d, e, f, g, h] = p;
      quad(a, b, c, d); quad(h, g, f, e);           // root / tip caps
      quad(a, e, f, b); quad(b, f, g, c);           // lower, trailing
      quad(c, g, h, d); quad(d, h, e, a);           // upper, leading
    };

    // High wing, both sides, with a little dihedral.
    slab(0.42, 0.34, 0.46, 0.30,  1.55, 0.030, "z",  1, 0.045);
    slab(0.42, 0.34, 0.46, 0.30,  1.55, 0.030, "z", -1, 0.045);
    // Horizontal stabiliser.
    slab(-1.00, -1.05, 0.26, 0.16, 0.52, 0.020, "z",  1, 0.01);
    slab(-1.00, -1.05, 0.26, 0.16, 0.52, 0.020, "z", -1, 0.01);
    // Vertical fin.
    slab(-0.98, -1.16, 0.34, 0.18, 0.42, 0.020, "y",  1, 0);

    // Wing struts, as thin four-sided prisms from lower fuselage to mid-span.
    const strut = (sign) => {
      const p = [];
      for (const [x, y, z] of [[0.30, -0.10, sign * 0.10], [0.34, 0.045, sign * 0.78]]) {
        p.push(V(x - 0.03, y, z - 0.012), V(x + 0.03, y, z - 0.012),
               V(x + 0.03, y, z + 0.012), V(x - 0.03, y, z + 0.012));
      }
      const [a, b, c, d, e, f, g, h] = p;
      quad(a, b, f, e); quad(b, c, g, f); quad(c, d, h, g); quad(d, a, e, h);
    };
    strut(1); strut(-1);

    // Fixed gear: leg plus wheel, both sides.
    const gear = (sign) => {
      const p = [];
      for (const [x, y, z] of [[0.30, -0.13, sign * 0.06], [0.28, -0.42, sign * 0.30]]) {
        p.push(V(x - 0.02, y, z - 0.02), V(x + 0.02, y, z - 0.02),
               V(x + 0.02, y, z + 0.02), V(x - 0.02, y, z + 0.02));
      }
      const [a, b, c, d, e, f, g, h] = p;
      quad(a, b, f, e); quad(b, c, g, f); quad(c, d, h, g); quad(d, a, e, h);
      // wheel
      const wc = verts.length / 3;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        V(0.28 + Math.cos(ang) * 0.075, -0.46 + Math.sin(ang) * 0.075, sign * 0.30 - 0.025);
        V(0.28 + Math.cos(ang) * 0.075, -0.46 + Math.sin(ang) * 0.075, sign * 0.30 + 0.025);
      }
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        quad(wc + i * 2, wc + j * 2, wc + j * 2 + 1, wc + i * 2 + 1);
      }
    };
    gear(1); gear(-1);

    // Propeller: two blades on the spinner, flagged so they spin independently.
    // Record the exact vertex range — deriving it from a fixed offset caught
    // the left wheel in the spin and flung it around the airframe.
    const PROP_VERT_START = verts.length / 3;
    const blade = (dir) => {
      const p = [];
      for (const [r, w] of [[0.06, 0.055], [0.62, 0.030]]) {
        p.push(V(1.12, dir * r, -w), V(1.16, dir * r, -w),
               V(1.16, dir * r,  w), V(1.12, dir * r,  w));
      }
      const [a, b, c, d, e, f, g, h] = p;
      quad(a, b, f, e, 1); quad(b, c, g, f, 1);
      quad(c, d, h, g, 1); quad(d, a, e, h, 1);
    };
    blade(1); blade(-1);

    const VCOUNT = verts.length / 3;
    const src = new Float32Array(verts);
    const world = new Float32Array(verts.length);

    /* ---- render state -------------------------------------------------- */
    const state = { w: 0, h: 0, cell: 7, cols: 0, rows: 0, dpr: 1 };
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let depth = new Float32Array(0), shade = new Float32Array(0), isProp = new Uint8Array(0);
    let scrollNorm = 0, raf = 0, running = false;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      state.dpr = Math.min(devicePixelRatio || 1, 2);
      state.w = r.width; state.h = r.height;
      canvas.width = Math.round(r.width * state.dpr);
      canvas.height = Math.round(r.height * state.dpr);
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      state.cell = r.width > 1500 ? 8 : r.width > 1000 ? 7 : 6;
      state.cols = Math.ceil(r.width / state.cell);
      state.rows = Math.ceil(r.height / (state.cell * 1.06));
      const n = state.cols * state.rows;
      depth = new Float32Array(n);
      shade = new Float32Array(n);
      isProp = new Uint8Array(n);
      ctx.font = `${state.cell + 2}px "DM Mono", ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, state.w, state.h);
      const { cols, rows, cell } = state;
      if (!cols || !rows) return;
      depth.fill(Infinity);
      shade.fill(0);
      isProp.fill(0);

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      const time = t / 1000;
      // Cursor orbits the model: a full pan from one side to the other, plus a
      // slow idle sweep so it is never completely static.
      const yaw   = (pointer.x - 0.5) * 2.6 + Math.sin(time * 0.16) * 0.12 + 0.5;
      const pitch = (pointer.y - 0.5) * 0.95 + Math.cos(time * 0.21) * 0.06 - 0.15;
      const roll  = Math.sin(time * 0.27) * 0.05;
      const propAngle = time * 9.0;

      const cy_ = Math.cos(yaw),   sy_ = Math.sin(yaw);
      const cp  = Math.cos(pitch), sp  = Math.sin(pitch);
      const cr  = Math.cos(roll),  sr  = Math.sin(roll);
      const cpa = Math.cos(propAngle), spa = Math.sin(propAngle);

      for (let i = 0; i < VCOUNT; i++) {
        let x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
        // Spin the propeller about its own hub before the body transform.
        if (i >= PROP_VERT_START) {
          const ny = y * cpa - z * spa, nz = y * spa + z * cpa;
          y = ny; z = nz;
        }
        let ry = y * cr - z * sr, rz = y * sr + z * cr;          // roll  (x axis)
        let rx = x * cp - ry * sp; ry = x * sp + ry * cp;         // pitch (z axis)
        const wx = rx * cy_ + rz * sy_, wz = -rx * sy_ + rz * cy_; // yaw  (y axis)
        world[i * 3] = wx; world[i * 3 + 1] = ry; world[i * 3 + 2] = wz;
      }

      // Perspective projection into cell space. Sits high in the empty band
      // between masthead and meta column so the airframe clears the tiles.
      const scale = Math.min(state.w / cell, state.h / (cell * 1.06)) * 0.56;
      const ox = cols * 0.44, oy = rows * 0.33;
      const CAMZ = 4.2;
      const px = new Float32Array(VCOUNT), py = new Float32Array(VCOUNT), pz = new Float32Array(VCOUNT);
      for (let i = 0; i < VCOUNT; i++) {
        const zc = world[i * 3 + 2] + CAMZ;
        const inv = 1 / (zc || 1e-6);
        px[i] = ox + world[i * 3] * scale * inv * 2.2;
        py[i] = oy - world[i * 3 + 1] * scale * inv * 2.2;
        pz[i] = zc;
      }

      const LX = 0.42, LY = 0.78, LZ = -0.46;   // key light
      for (let tI = 0; tI < tris.length; tI += 3) {
        const a = tris[tI], b = tris[tI + 1], c = tris[tI + 2];
        const ax = px[a], ay = py[a], bx = px[b], by = py[b], cx = px[c], cy2 = py[c];

        /* No winding-based back-face cull. The mirrored parts (left wing,
           left strut, left gear) are emitted with the same quad order as the
           right, so their winding is inverted — culling on it kept the wrong
           faces on that half and the model came apart at steep angles. The
           z-buffer already resolves visibility correctly, so signed area is
           used purely for barycentric coordinates. */
        const area = (bx - ax) * (cy2 - ay) - (by - ay) * (cx - ax);
        if (Math.abs(area) < 1e-9) continue;   // degenerate

        // World-space normal for shading.
        const ux = world[b * 3] - world[a * 3], uy = world[b * 3 + 1] - world[a * 3 + 1], uz = world[b * 3 + 2] - world[a * 3 + 2];
        const vx = world[c * 3] - world[a * 3], vy = world[c * 3 + 1] - world[a * 3 + 1], vz = world[c * 3 + 2] - world[a * 3 + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        // Two-sided shading: +z points away from the camera, so flip any normal
        // facing away before lighting it. Without this, back-wound faces shade
        // to flat black and read as holes punched in the airframe.
        if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
        let lam = nx * LX + ny * LY + nz * LZ;
        // Narrower value range: the old 0.20-1.00 swing put adjacent flat
        // panels at opposite ends of the ramp, which is what made the form
        // read as disfigured rather than shaded.
        lam = 0.34 + Math.max(0, lam) * 0.58;
        const propFace = spin[tI / 3];
        if (propFace) lam = Math.min(1, lam + 0.25);

        const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
        const maxX = Math.min(cols - 1, Math.ceil(Math.max(ax, bx, cx)));
        const minY = Math.max(0, Math.floor(Math.min(ay, by, cy2)));
        const maxY = Math.min(rows - 1, Math.ceil(Math.max(ay, by, cy2)));
        if (minX > maxX || minY > maxY) continue;

        const invArea = 1 / area;
        for (let yq = minY; yq <= maxY; yq++) {
          for (let xq = minX; xq <= maxX; xq++) {
            const sx = xq + 0.5, sy = yq + 0.5;
            const w0 = ((bx - ax) * (sy - ay) - (by - ay) * (sx - ax)) * invArea;
            const w1 = ((sx - ax) * (cy2 - ay) - (sy - ay) * (cx - ax)) * invArea;
            if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
            const w2 = 1 - w0 - w1;
            const zv = pz[a] * w2 + pz[c] * w0 + pz[b] * w1;
            const idx = yq * cols + xq;
            if (zv >= depth[idx]) continue;
            depth[idx] = zv;
            shade[idx] = lam;
            isProp[idx] = propFace;
          }
        }
      }

      // Quantise to glyphs with ordered dithering.
      const chStep = cell * 1.06;
      const last = RAMP.length - 1;
      for (let yq = 0; yq < rows; yq++) {
        for (let xq = 0; xq < cols; xq++) {
          const idx = yq * cols + xq;
          const s = shade[idx];
          if (s <= 0) continue;
          const dith = (BAYER[yq & 3][xq & 3] - 0.5) / last;
          const v = Math.max(0, Math.min(1, s + dith));
          const gi = Math.round(v * last);
          if (gi <= 0) continue;
          // Depth fog, so the far side of the airframe recedes.
          const fog = Math.max(0.35, Math.min(1, 1.5 - (depth[idx] - CAMZ) * 0.55));
          // Accent is reserved for the propeller disc. Keying it off shading
          // instead painted whole wing panels orange, because a flat surface
          // shares one normal and clears any brightness threshold at once.
          ctx.fillStyle = isProp[idx]
            ? `rgba(250, 76, 20, ${0.5 * fog})`
            : `rgba(242, 242, 242, ${(0.10 + s * 0.30) * fog})`;
          ctx.fillText(RAMP[gi], xq * cell + cell / 2, yq * chStep + chStep / 2);
        }
      }
    };

    const frame = (t) => { draw(t); raf = requestAnimationFrame(frame); };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    const stop  = () => { running = false; cancelAnimationFrame(raf); };

    // CSS hides the field on phones; don't lay out or paint into a zero-box
    // canvas, and don't start a loop that would only burn battery.
    const isVisible = () => canvas.offsetParent !== null && canvas.clientWidth > 0;
    if (!isVisible()) {
      addEventListener("resize", () => { if (isVisible()) { resize(); draw(performance.now()); } },
        { once: true });
      return;
    }

    resize();
    // Paint immediately so the field is present on first paint rather than
    // blank until the first animation frame lands.
    draw(performance.now());
    addEventListener("resize", () => { if (isVisible()) { resize(); draw(performance.now()); } });

    if (reduceMotion.matches) return;   // the static frame above is the whole story

    addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      pointer.ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    }, { passive: true });

    addEventListener("scroll", () => {
      scrollNorm = Math.min(1, scrollY / (innerHeight || 1));
    }, { passive: true });

    // Don't burn battery in a background tab or once it's scrolled away.
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        ([entry]) => (entry.isIntersecting && !document.hidden) ? start() : stop(),
        { threshold: 0 }
      ).observe(canvas);
    } else start();
  };

  initGlyphField();

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
      const a = el("a", "cv-choice");
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

    // Mark the stage busy until the page actually decodes. Without this the
    // reader sits blank on a slow connection with no indication anything is
    // happening — the one missing state in an otherwise well-covered flow.
    const stage = pdfImg.parentElement;
    stage.dataset.loading = "true";
    pdfImg.src = pdfSrc(doc, pdfState.page);
    pdfImg.alt = `${doc.title} — page ${pdfState.page} of ${doc.pages}`;
    const clear = () => { stage.dataset.loading = "false"; };
    pdfImg.decode ? pdfImg.decode().then(clear, clear) : pdfImg.addEventListener("load", clear, { once: true });

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
