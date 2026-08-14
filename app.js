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

  /* --- The glyph medium --------------------------------------------------- */
  /* Solid geometry rendered as a dithered field of characters. Moving the
     cursor orbits the model, so the view pans around it and tilts with
     vertical movement.

     This is a small software rasteriser, not line art: a mesh is transformed
     and projected per frame, filled with a z-buffer, Lambert-shaded, then
     quantised to a glyph ramp with ordered dithering. That dither is what
     produces the photographic grain rather than flat banded fills.

     Canvas 2D rather than WebGL on purpose: the glyphs are the medium, the
     triangle count is tiny, and this keeps the whole thing dependency-free.

     The ramp, the dither and the light live here once. The shell's airframe
     and the marks behind the document headers have to read as the same hand,
     and two copies of this would drift apart inside a week. */

  // Dark to bright. Index 0 is never drawn, so empty space stays empty.
  const RAMP = " .'`^\",:;~+=*oaOZ#MW&8%B@";
  // 4x4 ordered dither — breaks the ramp's banding into grain.
  const BAYER = [
    [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
  ].map((r) => r.map((v) => v / 16));
  const TAU = Math.PI * 2;

  // flags mark triangles the renderer treats specially — inked in the accent,
  // and spun about the model axis where a spin rate is set. The airframe's
  // propeller and the altimeter's needles use them.
  const mesh = () => {
    const m = { verts: [], tris: [], flags: [], spinFrom: Infinity };
    m.V = (x, y, z) => { m.verts.push(x, y, z); return m.verts.length / 3 - 1; };
    m.T = (a, b, c, f) => { m.tris.push(a, b, c); m.flags.push(f ? 1 : 0); };
    m.quad = (a, b, c, d, f) => { m.T(a, b, c, f); m.T(a, c, d, f); };
    return m;
  };

  /* --- Signature: the ASCII airframe ------------------------------------ */
  /* Lofted fuselage rings plus wing, tail, strut and gear solids.
     x: nose is +x. y: up. z: right wing is +z. */

  const buildAirframe = () => {
    const m = mesh();
    const { verts } = m;
    const V = m.V, quad = m.quad;

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

    m.spinFrom = PROP_VERT_START;
    return m;
  };

  /* --- Renderer ----------------------------------------------------------- */

  const makeGlyphField = (canvas, build, tune = {}) => {
    if (!canvas) return null;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;

    const o = {
      yaw: 2.6, yawBias: 0.5,          // cursor pan, in radians across the field
      pitch: 0.95, pitchBias: -0.15,
      idle: 0,                          // autonomous sweep; 0 = still until the cursor moves
      spin: 0,                          // rate for flagged geometry
      fit: 0.56, ox: 0.44, oy: 0.33,    // framing, in fractions of the cell grid
      camz: 4.2, lens: 2.2,
      cell: 0,                          // glyph size; 0 follows the canvas width
      ink: 1,                           // overall strength of the field
      track: "self",                    // pointer frame: the canvas box, or the viewport
      /* Ambient floor and the swing above it. The airframe is a thing of thin
         panels and a hard key light suits it; a round solid under the same
         light splits into a lit cap and a dead underside, so the marks lift
         the floor and narrow the swing until the whole form carries value. */
      amb: 0.34, range: 0.58,
      /* Depth falloff. The bias sets where the near face clips to full ink, so
         lowering it is what lets a large flat plate gradient across its own
         depth instead of sitting at one value. */
      fogBias: 1.5, fogRate: 0.55, fogFloor: 0.35,
      ...tune,
    };

    const m = build();
    const { tris, flags } = m;
    const VCOUNT = m.verts.length / 3;
    const SPIN_FROM = m.spinFrom;
    const src = new Float32Array(m.verts);
    const world = new Float32Array(m.verts.length);

    /* ---- render state -------------------------------------------------- */
    const state = { w: 0, h: 0, cell: 7, cols: 0, rows: 0, dpr: 1 };
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let depth = new Float32Array(0), shade = new Float32Array(0), isProp = new Uint8Array(0);
    let raf = 0, running = false, live = false, sized = false;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      state.dpr = Math.min(devicePixelRatio || 1, 2);
      state.w = r.width; state.h = r.height;
      canvas.width = Math.round(r.width * state.dpr);
      canvas.height = Math.round(r.height * state.dpr);
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      state.cell = o.cell || (r.width > 1500 ? 8 : r.width > 1000 ? 7 : 6);
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
      /* Cursor orbits the model: a full pan from one side to the other. The
         shell's airframe adds a slow idle sweep on top so the signature is
         never completely static; the document marks set idle to 0 and hold
         still until the cursor asks them to move. */
      const yaw   = (pointer.x - 0.5) * o.yaw + Math.sin(time * 0.16) * 0.12 * o.idle + o.yawBias;
      const pitch = (pointer.y - 0.5) * o.pitch + Math.cos(time * 0.21) * 0.06 * o.idle + o.pitchBias;
      const roll  = Math.sin(time * 0.27) * 0.05 * o.idle;
      const propAngle = time * o.spin;

      const cy_ = Math.cos(yaw),   sy_ = Math.sin(yaw);
      const cp  = Math.cos(pitch), sp  = Math.sin(pitch);
      const cr  = Math.cos(roll),  sr  = Math.sin(roll);
      const cpa = Math.cos(propAngle), spa = Math.sin(propAngle);

      for (let i = 0; i < VCOUNT; i++) {
        let x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
        // Spin the propeller about its own hub before the body transform.
        if (i >= SPIN_FROM) {
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
      const scale = Math.min(state.w / cell, state.h / (cell * 1.06)) * o.fit;
      const ox = cols * o.ox, oy = rows * o.oy;
      const CAMZ = o.camz;
      const px = new Float32Array(VCOUNT), py = new Float32Array(VCOUNT), pz = new Float32Array(VCOUNT);
      for (let i = 0; i < VCOUNT; i++) {
        const zc = world[i * 3 + 2] + CAMZ;
        const inv = 1 / (zc || 1e-6);
        px[i] = ox + world[i * 3] * scale * inv * o.lens;
        py[i] = oy - world[i * 3 + 1] * scale * inv * o.lens;
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
        lam = o.amb + Math.max(0, lam) * o.range;
        const propFace = flags[tI / 3];
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
          // Depth fog, so the far side of the form recedes.
          const fog = Math.max(o.fogFloor, Math.min(1, o.fogBias - (depth[idx] - CAMZ) * o.fogRate));
          // Accent is reserved for the propeller disc. Keying it off shading
          // instead painted whole wing panels orange, because a flat surface
          // shares one normal and clears any brightness threshold at once.
          ctx.fillStyle = isProp[idx]
            ? `rgba(250, 76, 20, ${0.5 * fog * o.ink})`
            : `rgba(242, 242, 242, ${(0.10 + s * 0.30) * fog * o.ink})`;
          ctx.fillText(RAMP[gi], xq * cell + cell / 2, yq * chStep + chStep / 2);
        }
      }
    };

    /* A field with no idle sweep has nothing to say once the view has caught
       up with the cursor, so the loop parks itself rather than repainting an
       identical frame forever. Five marks that each hold still cost nothing;
       five marks each running a rasteriser at 60fps would be indefensible. */
    const settled = () =>
      Math.abs(pointer.tx - pointer.x) < 4e-4 && Math.abs(pointer.ty - pointer.y) < 4e-4;

    const frame = (t) => {
      draw(t);
      if (o.idle || !settled()) raf = requestAnimationFrame(frame);
      else running = false;
    };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    /* CSS hides these on phones, and a section is only laid out once it has
       been lifted into the window — so never paint into a zero-box canvas. */
    const isVisible = () => canvas.offsetParent !== null && canvas.clientWidth > 0;
    const ensure = () => {
      if (!isVisible()) return false;
      if (!sized) { resize(); sized = true; }
      return true;
    };
    const wake = () => {
      if (running || !live || !ensure()) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    // Paint immediately on becoming visible, rather than staying blank until
    // the first animation frame lands.
    const show = () => { if (ensure()) draw(performance.now()); };

    /* Measure the canvas itself, every time its box changes — not once on
       first sight. The window a section opens into animates from tile size to
       full width over 480ms, so a mark at the top of the band gets its first
       look while the canvas is still a couple of hundred pixels wide. Sizing
       once there fixes the whole field at that width: the glyph grid stays
       tiny and the form never recovers, which is the difference between a
       readable solid and a smudge. (Profile's mark sits low enough that it is
       only observed after the animation ends, which is why it escaped.) */
    const remeasure = () => {
      if (!isVisible()) return;
      sized = false;
      ensure();
      draw(performance.now());
    };
    if (typeof ResizeObserver === "function") new ResizeObserver(remeasure).observe(canvas);
    else addEventListener("resize", remeasure);

    if (reduceMotion.matches) {
      // One still frame is the whole story: no pointer tracking, no loop.
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(([e]) => { if (e.isIntersecting) show(); }, { threshold: 0 })
          .observe(canvas);
      } else show();
      return { show };
    }

    addEventListener("pointermove", (e) => {
      /* The document marks read the whole viewport. Mapping to their own box
         would peg them at an extreme the moment the cursor crossed into the
         text column, which is most of the time — the mark would sit frozen at
         full deflection instead of tracking the hand. */
      const r = o.track === "viewport"
        ? { left: 0, top: 0, width: innerWidth, height: innerHeight }
        : canvas.getBoundingClientRect();
      pointer.tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      pointer.ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      wake();
    }, { passive: true });

    // Don't burn battery in a background tab or once it's scrolled away.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop(); else wake();
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        live = entry.isIntersecting && !document.hidden;
        if (live) { show(); wake(); } else stop();
      }, { threshold: 0 }).observe(canvas);
    } else { live = true; show(); wake(); }

    return { show };
  };

  /* --- Document solids ---------------------------------------------------- */
  /* One abstract solid per section, cut from the same medium as the airframe.
     Five silhouettes that stay apart at a glance — round, gridded, spiralling,
     crossed, looped — so the set reads as a family rather than as one effect
     pasted five times. They sit in the empty half of the header band, where
     the 22ch lead leaves real space, and hold still until the cursor moves. */

  // A quad grid over a parametric patch. Closed forms simply repeat their seam
  // ring, which costs a few vertices and saves a wrap-around special case.
  const patch = (m, uN, vN, fn) => {
    const base = m.verts.length / 3;
    for (let i = 0; i <= uN; i++)
      for (let j = 0; j <= vN; j++) { const p = fn(i / uN, j / vN); m.V(p[0], p[1], p[2]); }
    const at = (i, j) => base + i * (vN + 1) + j;
    for (let i = 0; i < uN; i++)
      for (let j = 0; j < vN; j++) m.quad(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
  };

  /* Revolve a [radius, height] outline around the Y axis. Instrument bodies
     are almost all lathe work — cases, bezels, hubs, spinners, dishes — so
     this one primitive carries most of the set. */
  const revolve = (m, outline, seg = 28) => {
    const last = outline.length - 1;
    patch(m, seg, last, (u, v) => {
      const a = u * TAU, t = v * last;
      const i = Math.min(last - 1, Math.floor(t)), f = t - i;
      const r = outline[i][0] + (outline[i + 1][0] - outline[i][0]) * f;
      const y = outline[i][1] + (outline[i + 1][1] - outline[i][1]) * f;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    });
  };

  /* Emit geometry, then move it. Lets the primitives stay axis-aligned and
     simple while blades and needles get placed at real angles. */
  const placed = (m, emit, at) => {
    const from = m.verts.length;
    emit();
    for (let i = from; i < m.verts.length; i += 3) {
      const p = at(m.verts[i], m.verts[i + 1], m.verts[i + 2]);
      m.verts[i] = p[0]; m.verts[i + 1] = p[1]; m.verts[i + 2] = p[2];
    }
  };

  // Spin about Y, for anything arranged around a hub.
  const aboutY = (a) => (x, y, z) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [x * c - z * s, y, x * s + z * c];
  };
  // Twist about X, for the pitch built into a blade.
  const aboutX = (a) => (x, y, z) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [x, y * c - z * s, y * s + z * c];
  };
  const chain = (...fns) => (x, y, z) => fns.reduce((p, f) => f(p[0], p[1], p[2]), [x, y, z]);

  // Axis-aligned box. Corner index bits are x=4, y=2, z=1, set meaning +.
  // The trailing flag paints the part in the accent, which is the only way a
  // small feature reads against the body it sits on.
  const box = (m, cx, cy, cz, hx, hy, hz, flag) => {
    const b = m.verts.length / 3;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
      m.V(cx + sx * hx, cy + sy * hy, cz + sz * hz);
    const q = (a, c, d, e) => m.quad(b + a, b + c, b + d, b + e, flag);
    q(0, 1, 3, 2); q(4, 6, 7, 5);      // -x, +x
    q(0, 4, 5, 1); q(2, 3, 7, 6);      // -y, +y
    q(0, 2, 6, 4); q(1, 5, 7, 3);      // -z, +z
  };

  /* Instruments off the panel, one per section, all of them lathe work with
     blades or needles set on top. Everything here is sized against one hard
     limit learned the hard way: a feature thinner than a glyph cell renders
     as loose dashes, not as an edge. At the size these run, that floor is
     around 0.06 model units — so rims are thick, needles are wedges, and
     blade counts stay low enough that each one owns a couple of cells. */
  const SOLIDS = {
    // Profile — attitude indicator: the gyro ball slung in two gimbals.
    gyro: () => {
      const m = mesh();
      patch(m, 22, 13, (u, v) => {
        const a = u * TAU, p = v * Math.PI, r = 0.60;
        return [Math.sin(p) * Math.cos(a) * r, Math.cos(p) * r, Math.sin(p) * Math.sin(a) * r];
      });
      const gimbal = (R, at) => placed(m, () => patch(m, 32, 6, (u, v) => {
        const a = u * TAU, t = v * TAU, rr = R + Math.cos(t) * 0.075;
        return [Math.cos(a) * rr, Math.sin(t) * 0.075, Math.sin(a) * rr];
      }), at);
      gimbal(0.82, (x, y, z) => [x, y, z]);
      gimbal(0.98, (x, y, z) => [x, -z, y]);   // second ring, stood on edge
      return m;
    },

    // Capabilities — turbine: hub, blades, casing. Tools, and how they mesh.
    turbine: () => {
      const m = mesh();
      revolve(m, [[0, -0.30], [0.32, -0.30], [0.32, 0.30], [0, 0.30]], 20);
      const N = 9;
      for (let i = 0; i < N; i++) {
        placed(m, () => box(m, 0.66, 0, 0, 0.34, 0.028, 0.16),
          chain(aboutX(0.62), aboutY((i / N) * TAU)));   // pitch, then round the hub
      }
      patch(m, 34, 6, (u, v) => {                        // casing
        const a = u * TAU, t = v * TAU, rr = 1.10 + Math.cos(t) * 0.085;
        return [Math.cos(a) * rr, Math.sin(t) * 0.085, Math.sin(a) * rr];
      });
      return m;
    },

    /* Experience — altimeter: hours on the clock. The face is sunk well below
       the bezel so the dial has real depth, and the needles are accent-painted
       wedges standing clear of it. Flush grey needles on a flat face share the
       face's normal, so they shade identically and disappear. */
    altimeter: () => {
      const m = mesh();
      revolve(m, [[0, -0.34], [0.90, -0.34], [0.90, 0.30],
                  [0.72, 0.30], [0.72, -0.02], [0, -0.02]], 30);
      placed(m, () => box(m, 0.30, 0, 0, 0.32, 0.055, 0.085, 1),
        (x, y, z) => [x, y + 0.14, z]);
      placed(m, () => box(m, 0.17, 0, 0, 0.20, 0.055, 0.105, 1),
        chain(aboutY(2.15), (x, y, z) => [x, y + 0.15, z]));
      revolve(m, [[0.14, 0.10], [0.14, 0.22], [0, 0.22]], 12);   // hub cap
      return m;
    },

    // Work — propeller and spinner. The shell's signature, brought in close.
    prop: () => {
      const m = mesh();
      // A long nose cone: it is the part that says "propeller" before the
      // blades do, and a stubby hub read as a bolt head.
      revolve(m, [[0, 0.86], [0.15, 0.52], [0.23, 0.14], [0.25, -0.16], [0, -0.16]], 22);
      const N = 3;
      for (let i = 0; i < N; i++) {
        // Broad paddle blades, not spokes: three thin arms leave the disc
        // mostly empty, and empty is what made this read as scaffolding.
        placed(m, () => box(m, 0.66, 0, 0, 0.58, 0.042, 0.30),
          chain(aboutX(0.40), aboutY((i / N) * TAU)));
      }
      return m;
    },

    // Contact — dish and feed horn: pointed out, waiting on an answer.
    dish: () => {
      const m = mesh();
      patch(m, 30, 9, (u, v) => {              // paraboloid, opening upward
        const a = u * TAU, r = v * 0.98;
        return [Math.cos(a) * r, r * r * 0.62 - 0.24, Math.sin(a) * r];
      });
      revolve(m, [[0.115, -0.20], [0.115, 0.46], [0, 0.46]], 12);   // mast to the focus
      box(m, 0, 0.54, 0, 0.11, 0.11, 0.11);                         // feed horn
      revolve(m, [[0, -0.92], [0.34, -0.92], [0.24, -0.44], [0, -0.44]], 16);   // pedestal
      return m;
    },
  };

  /* Where each form rests before the cursor touches it. A torus seen edge-on
     and three plates seen square-on both collapse to flat pattern, so each
     solid gets the standing angle that shows what it is. */
  /* Every instrument here is built about the Y axis, and pitch tips that axis
     toward the camera — so these angles are what turn a face-on disc into an
     instrument you can read the depth of. */
  const SOLID_VIEW = {
    gyro:      { pitchBias: -0.20 },                   // a ball; no axis to aim
    turbine:   { pitchBias: 1.21, yawBias: -1.95 },    // looking into the intake
    altimeter: { pitchBias: 1.05, yawBias: -2.05 },    // dial tipped toward the reader
    prop:      { pitchBias: 1.21, yawBias: -2.02 },   // enough turn to show the cone
    dish:      { pitchBias: 0.75, yawBias: -2.20 },    // mouth of the dish, from above
  };

  makeGlyphField($("#glyphField"), buildAirframe, { idle: 1, spin: 9.0 });

  $$("[data-solid]").forEach((canvas) => {
    const name = canvas.dataset.solid;
    const build = SOLIDS[name];
    if (!build) return;
    makeGlyphField(canvas, build, {
      /* Framed like the airframe, not like an icon. The first pass squeezed
         these into the gap beside the lead, which capped them at ~20 cells of
         7px type at partial ink — at that size the glyph shapes stop being
         readable as glyphs and the whole thing turns to smear. A form needs
         both real cells across it and cells you can actually see, so the band
         was widened to give it room and the mark now runs at the shell's own
         cell size and full ink. */
      ox: 0.5, oy: 0.52, fit: 0.60, camz: 3.6, lens: 2.0,
      yaw: 3.4, yawBias: 0.6, pitch: 1.2, pitchBias: -0.1,
      cell: 7,
      amb: 0.40, range: 0.46,
      fogBias: 1.02, fogRate: 0.42, fogFloor: 0.30,
      track: "viewport",
      ...SOLID_VIEW[name],
    });
  });

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

    /* One dot per scroll position the rail can actually rest at, not one per
       card. Three cards are visible at desktop width, so the last two can
       never become the leading card — a dot each would leave two of them
       permanently dead. Stops are measured, not assumed, so the count follows
       the viewport. */
    let stops = [];

    const measure = () => {
      const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      /* scroll-padding-inline holds the leading card off the scroller's edge,
         so the scrollLeft that snaps a card to "start" is its offset minus
         that padding — not the offset itself. Without this every stop sits a
         padding-width past where the snap engine parks the rail, and each
         smooth scroll ends with a corrective jump. */
      const cs = getComputedStyle(rail);
      const pad = parseFloat(cs.scrollPaddingInlineStart) || parseFloat(cs.scrollPaddingLeft) || 0;
      const out = [];
      cards.forEach((card) => {
        /* Clamped to the end of the track: the last cards can never lead, so
           the ones that clamp to the same place are one stop, not several. */
        const left = Math.round(Math.min(Math.max(0, card.offsetLeft - rail.offsetLeft - pad), max));
        if (!out.length || left - out[out.length - 1] > 1) out.push(left);
      });
      return out.length ? out : [0];
    };

    /* Where a smooth scroll is headed, so a second arrow click steps on from
       the destination instead of from wherever the animation happens to be
       mid-flight — otherwise clicking through the rail quickly loses stops. */
    let target = null;

    const scrollToStop = (i) => {
      target = i;
      rail.scrollTo({ left: stops[i], behavior: reduceMotion.matches ? "auto" : "smooth" });
    };

    const buildDots = () => {
      const next = measure();
      const same = next.length === stops.length &&
                   next.every((v, i) => Math.abs(v - stops[i]) < 1);
      stops = next;
      if (same) return;

      /* Add or drop only the difference. The rail is remeasured on every frame
         of the window's open animation, and wiping the row each time would
         flash the dots and drop the selected one. */
      while (dotsBox.children.length > stops.length) dotsBox.lastElementChild.remove();
      while (dotsBox.children.length < stops.length) {
        const dot = el("button", "rail-dot");
        dot.type = "button";
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-selected", "false");
        // Index read at click time — a dot's target moves as the rail resizes.
        dot.addEventListener("click", () => scrollToStop([...dotsBox.children].indexOf(dot)));
        dotsBox.appendChild(dot);
      }
      [...dotsBox.children].forEach((d, i) =>
        d.setAttribute("aria-label", `Projects, view ${i + 1} of ${stops.length}`));
    };

    const nearest = () => {
      const x = rail.scrollLeft;
      let best = 0, bestDist = Infinity;
      stops.forEach((left, i) => {
        const d = Math.abs(left - x);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    };

    const prevBtn = $('[data-rail="prev"]');
    const nextBtn = $('[data-rail="next"]');

    const sync = () => {
      const i = nearest();
      [...dotsBox.children].forEach((d, di) => d.setAttribute("aria-selected", String(di === i)));
      if (prevBtn) prevBtn.disabled = i === 0;
      if (nextBtn) nextBtn.disabled = i === stops.length - 1;
    };

    /* Aim at the neighbouring stop rather than nudging by a card width. A card
       width isn't the distance between two stops at the end of the track, and
       landing off a snap point makes the browser finish the smooth scroll and
       then yank the rail into place — the stutter this used to have. */
    const nudge = (dir) => {
      const from = target != null && target < stops.length ? target : nearest();
      scrollToStop(Math.max(0, Math.min(stops.length - 1, from + dir)));
    };

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

    /* The rail has come to rest, so the queued destination is spent — whether
       the smooth scroll finished it or the reader dragged somewhere else.
       Safari has no scrollend yet, so fall back to arriving at the stop. */
    if ("onscrollend" in rail) rail.addEventListener("scrollend", () => { target = null; });
    else rail.addEventListener("scroll", () => {
      if (target != null && Math.abs(rail.scrollLeft - stops[target]) < 2) target = null;
    }, { passive: true });

    const remeasure = () => { target = null; buildDots(); sync(); };

    /* Watch the rail itself, not the viewport. The section has no layout while
       it is parked in the hidden document source, and the window it opens into
       animates from tile size to full width over 480ms — measured once at open
       time the rail is still tile-narrow, so every card looks like a reachable
       stop and the row grows dots the rail can never scroll to. The observer
       also covers the windowed/maximised toggle, which resize never fires. */
    if (typeof ResizeObserver === "function") new ResizeObserver(remeasure).observe(rail);
    else addEventListener("resize", remeasure);
    return remeasure;
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
