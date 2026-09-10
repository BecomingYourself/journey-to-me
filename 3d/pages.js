/* ------------------------------------------------------------------
   The Journey to Me — page painting for the 3D book.

   Every leaf in the scene is a piece of geometry with a picture on it,
   and this file paints those pictures.  Each page is drawn onto its own
   2D canvas, which then becomes a texture.

   Only a handful of pages are ever visible at once, so canvases are kept
   in a small pool and the least-recently-used one is recycled.  Painting
   all 90-odd pages up front would cost a few hundred megabytes.

   The text itself is not written here — it comes from content.js, which
   is transcribed word for word from the client's own PDF.
------------------------------------------------------------------- */

const J = (typeof JOURNAL !== 'undefined') ? JOURNAL : window.JOURNAL;

export const PAGE_W = 900;
export const PAGE_H = 1233;             // 1.370, the straight-on cover's ratio

const INK = '#241206';
const INK_SOFT = '#54341f';
const GOLD = '#96641c';
const GOLD_LIGHT = '#b98c3c';
const RULE = 'rgba(120,84,44,0.46)';

const SERIF = '"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif';
const DISPLAY = '"Didot","Bodoni MT","Playfair Display",Georgia,serif';
const HAND = 'Caveat,"Snell Roundhand","Bradley Hand","Segoe Script","Brush Script MT",cursive';

/* ------------------------------------------------------------------ list */

/* Page 0 is the cover art, which lives on the cover board rather than on a
   leaf.  Everything from index 1 on is a leaf face: leaf j shows page 1+2j on
   its FRONT and page 2+2j on its BACK.  The front of a leaf is the RIGHT page
   of a spread, so ODD page numbers are right-hand pages here.

   The client wants every daily inspiration on the right.  Two things make that
   true and both are arithmetic:

     - each day's block must be an EVEN number of pages, or the parity shifts
       and the inspiration swaps sides every other day.  Four: the inspiration
       and three pages to write on.
     - the first inspiration must start on an odd index.  The front matter is
       four pages (0-3), which would put it on 4 — the left.  One blank page
       after the contents moves every one of the 21 onto an odd page, and a
       blank verso facing the opening page is what a printed book does anyway. */
const FRONT_MATTER = 5;

export function buildPages() {
  const p = [
    { t: 'cover' },
    { t: 'belongs' },
    { t: 'welcome' },
    { t: 'contents' },
    { t: 'blank' }
  ];
  J.days.forEach(d => {
    p.push({ t: 'prompt', day: d });
    for (let i = 1; i <= 3; i++) p.push({ t: 'write', day: d, part: i });
  });
  p.push({ t: 'closing' });
  p.push({ t: 'endpaper', last: true });
  while ((p.length - 1) % 2) p.push({ t: 'endpaper' });   // leaves need two faces
  p.forEach((q, i) => { q.i = i; });
  return p;
}

/* Where a day's prompt sits, for the table of contents. */
export function dayPage(n) { return FRONT_MATTER + (n - 1) * 4; }

/* ------------------------------------------------------------- utilities */

/* Wrapping, but keeping every line's place in the ORIGINAL string.

   The reader has to be able to click into a sentence they wrote earlier and put
   the cursor there, and the only thing that can answer "which character is
   under this point" is the same code that decided where the characters went.
   So each line comes back as {text, start, end}, sliced straight out of the
   source rather than rebuilt from words — a double space someone typed after a
   full stop stays a double space, and offsets line up exactly. */
function wrapMeasured(ctx, text, maxW) {
  const s = String(text);
  const out = [];
  let base = 0;                                  // where this paragraph starts

  for (const para of s.split('\n')) {
    const words = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(para))) words.push({ i: m.index, j: m.index + m[0].length });

    if (!words.length) {                         // an empty line is still a line
      out.push({ text: '', start: base, end: base });
      base += para.length + 1;
      continue;
    }

    let ls = words[0].i, le = words[0].j;
    for (let k = 1; k < words.length; k++) {
      // Measure the candidate line as it would really be drawn, spaces and all.
      if (ctx.measureText(para.slice(ls, words[k].j)).width > maxW) {
        out.push({ text: para.slice(ls, le), start: base + ls, end: base + le });
        ls = words[k].i; le = words[k].j;
      } else {
        le = words[k].j;
      }
    }
    out.push({ text: para.slice(ls, le), start: base + ls, end: base + le });
    base += para.length + 1;                     // + the newline itself
  }
  return out;
}

/* The PRINTED text keeps the original wrap, which rebuilds each line by joining
   words with a single space.

   It is not the same thing: the day-5 bullets are written '◆  ' with two
   spaces, and this collapses them, so a bullet fits a word more per line than
   the faithful version would. That is how every page of this book has been laid
   out and how the client approved it — measured over all 21 days, swapping in
   the faithful wrap re-flowed her bullet lines. Print stays as printed. */
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

/* Which wrapped line holds character `p`. A cursor sitting in the whitespace
   that got swallowed at a line break belongs to the line before it. */
function lineOf(lines, p) {
  for (let i = 0; i < lines.length; i++) if (p <= lines[i].end) return i;
  return Math.max(0, lines.length - 1);
}

/* The frame from the client's own cover, redrawn: a heavy rule, a hairline
   inside it, and a small diamond at each corner. */
function frame(ctx, inset) {
  const x = inset, y = inset * 1.02, w = PAGE_W - inset * 2, h = PAGE_H - inset * 2.04;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3.2;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(176,133,66,0.55)';
  ctx.lineWidth = 1.1;
  ctx.strokeRect(x + 9, y + 9, w - 18, h - 18);

  ctx.fillStyle = GOLD_LIGHT;
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
}

function flourish(ctx, cx, cy, w) {
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.lineTo(cx - 14, cy);
  ctx.moveTo(cx + 14, cy);
  ctx.lineTo(cx + w / 2, cy);
  ctx.stroke();
  ctx.fillStyle = GOLD_LIGHT;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4.5, -4.5, 9, 9);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx - 9, cy, 2.2, 0, 7);
  ctx.arc(cx + 9, cy, 2.2, 0, 7);
  ctx.fill();
}

function paper(ctx, tex) {
  /* The same parchment the storybook version uses (--paper-tint), not a pale
     cream. Under daylight the paler mix came out looking like copier paper —
     the client put the two side by side and the difference is obvious. */
  ctx.fillStyle = '#e9d2a8';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  if (tex && tex.complete && tex.naturalWidth) {
    ctx.globalAlpha = 0.82;
    ctx.drawImage(tex, 0, 0, PAGE_W, PAGE_H);
    ctx.globalAlpha = 1;
  }
  // A little age in the corners, so the flat cream does not read as plastic.
  const g = ctx.createRadialGradient(
    PAGE_W * 0.5, PAGE_H * 0.45, PAGE_W * 0.18,
    PAGE_W * 0.5, PAGE_H * 0.5, PAGE_W * 0.85);
  g.addColorStop(0, 'rgba(255,246,222,0.30)');
  g.addColorStop(1, 'rgba(122,80,36,0.20)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
}

/* --------------------------------------------------------- ruled writing */

/* At least an inch of margin on every side, as the client asked. Taking the
   printed book as six inches wide, an inch is 16.7% of the width and 12.2% of
   the height — on this 900 x 1233 canvas both come out at 150px. */
const MARGIN = 150, MARGIN_Y = 150;
const LINE_TOP = 268, LINE_GAP = 62;
const LINE_W = PAGE_W - MARGIN * 2;
const TEXT_TOP = MARGIN_Y, TEXT_BOT = PAGE_H - MARGIN_Y;

function rules(ctx, from) {
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1.4;
  for (let y = from; y < TEXT_BOT; y += LINE_GAP) {
    ctx.beginPath();
    ctx.moveTo(MARGIN, y);
    ctx.lineTo(PAGE_W - MARGIN, y);
    ctx.stroke();
  }
}

function nLines(from) { return Math.floor((TEXT_BOT - from) / LINE_GAP); }

/* The client's handwriting, laid along the ruled lines.  Returns how many
   characters were consumed, so a long answer can run onto the next page. */
function handwrite(ctx, text, from, caret, pos) {
  ctx.font = `46px ${HAND}`;
  ctx.fillStyle = '#2f3a52';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const s = text || '';
  const lines = wrapMeasured(ctx, s, LINE_W - 12);
  const max = nLines(from);
  const shown = Math.min(lines.length, max);
  for (let i = 0; i < shown; i++) {
    ctx.fillText(lines[i].text, MARGIN + 2, from + i * LINE_GAP - 12);
  }
  if (caret) {
    /* The cursor is drawn wherever it actually IS, not parked at the end of the
       text. It used to be pinned to the last character, which made it look like
       clicking back into a sentence had done nothing even once it had. */
    const p = Math.max(0, Math.min(s.length, pos == null ? s.length : pos));
    const li = Math.min(lineOf(lines, p), Math.max(0, shown - 1));
    const ln = lines[li] || { text: '', start: 0 };
    const col = Math.max(0, Math.min(ln.text.length, p - ln.start));
    const x = MARGIN + 2 + ctx.measureText(ln.text.slice(0, col)).width;
    const y = from + li * LINE_GAP - 12;
    ctx.fillStyle = 'rgba(47,58,82,0.85)';
    ctx.fillRect(x + 3, y - 32, 3, 40);
  }
  return { overflow: Math.max(0, lines.length - max) };
}

/* Turn a point on the page into a position in the text.

   The click arrives as a place on a picture; this is the only thing that knows
   the picture was made of characters. Used for both a fresh click onto a page
   and for clicking back into something written earlier. */
export function caretIndexAt(ctx, page, entry, px, py) {
  const s = entry || '';

  if (page.t === 'belongs') {
    // One centred line, so the column is all there is to work out.
    ctx.font = `52px ${HAND}`;
    const w = ctx.measureText(s).width;
    return columnAt(ctx, s, px - (PAGE_W / 2 - w / 2));
  }

  if (page.t !== 'write') return null;

  ctx.font = `46px ${HAND}`;
  const lines = wrapMeasured(ctx, s, LINE_W - 12);
  const max = nLines(LINE_TOP);
  const shown = Math.max(1, Math.min(lines.length, max));

  /* Each ruled line owns the band ABOVE its rule, which is where its letters
     sit. Clicking below the last line of writing lands at the end, the way a
     tap under a paragraph does in any text field. */
  let li = Math.floor((py - (LINE_TOP - LINE_GAP)) / LINE_GAP);
  li = Math.max(0, Math.min(shown - 1, li));
  const ln = lines[li];
  if (!ln) return s.length;
  return ln.start + columnAt(ctx, ln.text, px - (MARGIN + 2));
}

/* How many characters of `text` fit before x, rounded to the nearer gap — so
   clicking the right half of a letter puts the cursor after it. */
function columnAt(ctx, text, x) {
  if (x <= 0) return 0;
  let prev = 0;
  for (let i = 1; i <= text.length; i++) {
    const w = ctx.measureText(text.slice(0, i)).width;
    if (w >= x) return (x - prev < w - x) ? i - 1 : i;
    prev = w;
  }
  return text.length;
}

/* ------------------------------------------------------------- the pages */

export function paintPage(ctx, page, ctxState) {
  const { paperImg, coverImg, entries, caretOn, focus, caret } = ctxState;
  ctx.clearRect(0, 0, PAGE_W, PAGE_H);

  if (page.t === 'cover') {
    if (coverImg && coverImg.complete && coverImg.naturalWidth) {
      ctx.drawImage(coverImg, 0, 0, PAGE_W, PAGE_H);
    } else {
      ctx.fillStyle = '#4a1220';
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    }
    return;
  }

  paper(ctx, paperImg);

  // The blank verso that puts every inspiration on a right-hand page. It gets
  // the frame so it does not read as a page that failed to load.
  if (page.t === 'blank') {
    frame(ctx, 46);
    return;
  }

  if (page.t === 'endpaper') {
    frame(ctx, 54);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(176,133,66,0.75)';
    ctx.font = `italic 38px ${DISPLAY}`;
    ctx.fillText('The Journey to Me', PAGE_W / 2, PAGE_H / 2 - 6);
    flourish(ctx, PAGE_W / 2, PAGE_H / 2 + 34, 210);
    return;
  }

  frame(ctx, 46);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(150,100,28,0.75)';
  ctx.font = `19px ${SERIF}`;
  ctx.fillText(String(page.i), PAGE_W / 2, PAGE_H - 62);
  ctx.textAlign = 'center';

  if (page.t === 'belongs') {
    ctx.fillStyle = GOLD;
    ctx.font = `54px ${DISPLAY}`;
    const mid = (TEXT_TOP + TEXT_BOT) / 2;
    ctx.fillText(J.belongs.heading, PAGE_W / 2, mid - 120);
    flourish(ctx, PAGE_W / 2, mid - 70, 260);
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(MARGIN, mid + 80);
    ctx.lineTo(PAGE_W - MARGIN, mid + 80);
    ctx.stroke();
    const name = entries[page.i] || '';
    ctx.font = `52px ${HAND}`;
    ctx.fillStyle = '#2f3a52';
    ctx.fillText(name, PAGE_W / 2, mid + 66);
    if (focus === page.i && caretOn) {
      const w = ctx.measureText(name).width;
      const p = Math.max(0, Math.min(name.length, caret == null ? name.length : caret));
      const x = PAGE_W / 2 - w / 2 + ctx.measureText(name.slice(0, p)).width;
      ctx.fillRect(x + 5, mid + 32, 3, 40);
    }
    return;
  }

  if (page.t === 'welcome') {
    ctx.fillStyle = GOLD;
    ctx.font = `40px ${DISPLAY}`;
    ctx.fillText(J.welcome.title, PAGE_W / 2, TEXT_TOP + 34);
    ctx.font = `50px ${DISPLAY}`;
    ctx.fillText(J.welcome.title2, PAGE_W / 2, TEXT_TOP + 92);
    flourish(ctx, PAGE_W / 2, TEXT_TOP + 134, 240);
    body(ctx, J.welcome.body, TEXT_TOP + 196);
    return;
  }

  /* Contents, centred. Each line is one unit — a gold day number and the title
     — measured together and then placed about the middle of the page, so the
     column reads as centred rather than as a left-aligned list that happens to
     sit in the middle. */
  if (page.t === 'contents') {
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = `50px ${DISPLAY}`;
    ctx.fillText(J.contents.title, PAGE_W / 2, TEXT_TOP + 44);
    flourish(ctx, PAGE_W / 2, TEXT_TOP + 84, 240);

    const rows = J.days.map(d => ({
      num: String(d.n).padStart(2, '0'),
      title: d.title.length > 36 ? d.title.slice(0, 35) + '…' : d.title
    }));

    const top = TEXT_TOP + 132;
    const gap = Math.min(40.5, (TEXT_BOT - top) / rows.length);
    ctx.textAlign = 'left';
    ctx.font = `23px ${SERIF}`;
    const GAP_NUM = 16;

    rows.forEach((r, i) => {
      const y = top + i * gap;
      const wn = ctx.measureText(r.num).width;
      const wt = ctx.measureText(r.title).width;
      let x = (PAGE_W - (wn + GAP_NUM + wt)) / 2;
      ctx.fillStyle = GOLD;
      ctx.fillText(r.num, x, y);
      ctx.fillStyle = INK;
      ctx.fillText(r.title, x + wn + GAP_NUM, y);
    });
    return;
  }

  /* The daily inspiration. Centred, and balanced between the margins rather
     than pinned to a fixed y — a two-line title used to push a long day's text
     down past the foot of the page. The block is measured first, shrunk if it
     still will not fit, and only then drawn. */
  if (page.t === 'prompt') {
    const d = page.day;
    const AVAIL = TEXT_BOT - TEXT_TOP - 44;   // room, less the "answer" line

    for (let scale = 1; ; scale -= 0.06) {
      const titleSize = 44 * scale, titleGap = 52 * scale;
      const bodySize = 29 * scale, bodyGap = 40 * scale, paraGap = 18 * scale;

      ctx.font = `${titleSize}px ${DISPLAY}`;
      const tl = wrap(ctx, d.title, LINE_W);
      ctx.font = `${bodySize}px ${SERIF}`;
      const bl = d.body.map(p => wrap(ctx, p, LINE_W));

      /* The bullet questions and the italic aside are part of the client's own
         wording and have to be on the page. Only two of the twenty-one days
         carry them, which is exactly why they went unnoticed here for so long —
         the storybook version has always drawn them. */
      const bullets = (d.bullets || []).map(t => wrap(ctx, '◆  ' + t, LINE_W));
      ctx.font = `italic ${bodySize * 0.86}px ${SERIF}`;
      const noteLines = d.note ? wrap(ctx, d.note, LINE_W) : [];

      const h = 40 * scale                                   // DAY NN
              + tl.length * titleGap
              + 60 * scale                                   // flourish
              + bl.reduce((s, ls) => s + ls.length * bodyGap + paraGap, 0)
              + bullets.reduce((s, ls) => s + ls.length * bodyGap + paraGap * 0.6, 0)
              + (noteLines.length ? noteLines.length * bodyGap * 0.9 + paraGap : 0);

      if (h > AVAIL && scale > 0.62) continue;

      let y = TEXT_TOP + Math.max(0, (AVAIL - h) / 2) + 30 * scale;

      ctx.textAlign = 'center';
      ctx.fillStyle = GOLD;
      ctx.font = `600 ${26 * scale}px ${SERIF}`;
      ctx.letterSpacing = `${6 * scale}px`;
      ctx.fillText('DAY ' + String(d.n).padStart(2, '0'), PAGE_W / 2, y);
      ctx.letterSpacing = '0px';
      y += 40 * scale;

      ctx.font = `${titleSize}px ${DISPLAY}`;
      ctx.fillStyle = '#7d1f33';
      tl.forEach(l => { y += titleGap; ctx.fillText(l, PAGE_W / 2, y); });

      flourish(ctx, PAGE_W / 2, y + 26 * scale, 230 * scale);
      y += 60 * scale;

      ctx.font = `${bodySize}px ${SERIF}`;
      ctx.fillStyle = INK;
      bl.forEach(ls => {
        ls.forEach(l => { y += bodyGap; ctx.fillText(l, PAGE_W / 2, y); });
        y += paraGap;
      });

      bullets.forEach(ls => {
        ls.forEach(l => { y += bodyGap; ctx.fillText(l, PAGE_W / 2, y); });
        y += paraGap * 0.6;
      });

      if (noteLines.length) {
        ctx.font = `italic ${bodySize * 0.86}px ${SERIF}`;
        ctx.fillStyle = INK_SOFT;
        y += paraGap;
        noteLines.forEach(l => { y += bodyGap * 0.9; ctx.fillText(l, PAGE_W / 2, y); });
      }
      break;
    }

    ctx.font = `italic 24px ${SERIF}`;
    ctx.fillStyle = INK_SOFT;
    ctx.textAlign = 'center';
    ctx.fillText(J.strings.answerHere, PAGE_W / 2, TEXT_BOT - 4);
    return;
  }

  if (page.t === 'write') {
    const d = page.day;
    ctx.fillStyle = GOLD;
    ctx.font = `600 22px ${SERIF}`;
    ctx.letterSpacing = '5px';
    ctx.fillText('DAY ' + String(d.n).padStart(2, '0') +
      (page.part > 1 ? '  ·  ' + J.strings.continued.toUpperCase() : ''), PAGE_W / 2, TEXT_TOP + 22);
    ctx.letterSpacing = '0px';
    flourish(ctx, PAGE_W / 2, TEXT_TOP + 58, 200);
    rules(ctx, LINE_TOP);
    handwrite(ctx, entries[page.i] || '', LINE_TOP, focus === page.i && caretOn, caret);
    if (!entries[page.i] && focus !== page.i) {
      ctx.textAlign = 'left';
      ctx.font = `italic 28px ${SERIF}`;
      ctx.fillStyle = 'rgba(107,75,54,0.45)';
      ctx.fillText(J.strings.writeHere, MARGIN + 4, LINE_TOP - 14);
    }
    return;
  }

  if (page.t === 'closing') {
    ctx.fillStyle = GOLD;
    ctx.font = `44px ${DISPLAY}`;
    const tl = wrap(ctx, J.closing.title, LINE_W);
    let y = TEXT_TOP + 46;
    tl.forEach(l => { ctx.fillText(l, PAGE_W / 2, y); y += 52; });
    flourish(ctx, PAGE_W / 2, y + 6, 230);
    body(ctx, J.closing.body, y + 66);
    drawButton(ctx, J.closing.backToCover || 'Return to the cover');
  }
}

/* ------------------------------------------------- the last page's button

   There is no DOM here — the page is a picture painted onto a piece of
   geometry — so the button is painted too, and the click is worked out from
   where on the page the ray landed. CLOSING_BUTTON is that rectangle as
   fractions of the page, which is exactly what a UV coordinate is. */
export const CLOSING_BUTTON = { x0: 0.24, x1: 0.76, y0: 0.855, y1: 0.925 };

function drawButton(ctx, label) {
  const x = CLOSING_BUTTON.x0 * PAGE_W;
  const w = (CLOSING_BUTTON.x1 - CLOSING_BUTTON.x0) * PAGE_W;
  const y = CLOSING_BUTTON.y0 * PAGE_H;
  const h = (CLOSING_BUTTON.y1 - CLOSING_BUTTON.y0) * PAGE_H;
  const r = h / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,247,228,0.92)');
  g.addColorStop(1, 'rgba(236,215,175,0.92)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#5a3a12';
  ctx.font = `600 26px ${SERIF}`;
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, PAGE_W / 2, y + h / 2 + 1);
  ctx.letterSpacing = '0px';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function body(ctx, paras, y) {
  ctx.textAlign = 'left';
  ctx.font = `29px ${SERIF}`;
  ctx.fillStyle = INK;
  for (const p of paras) {
    for (const line of wrap(ctx, p, LINE_W)) {
      ctx.fillText(line, MARGIN, y);
      y += 40;
    }
    y += 18;
  }
  return y;
}

export function isWritable(page) {
  return page.t === 'write' || page.t === 'belongs';
}
