# The Journey to Me — 21 Day Self-Transformation Journal

A web version of the journal that people can write in, keep, and install on a
phone, tablet, MacBook or laptop like an app.

**Live:** https://becomingyourself.github.io/journey-to-me/

This folder is the version the client chose: the book seen straight on,
resting in a light blue sky of drifting clouds, glowing stars and falling
petals.

- **3D** — [`3d/`](3d/) is the other direction that was tried, a real
  three-dimensional scene on a candlelit walnut table. Kept for reference and
  untouched. [Live](https://becomingyourself.github.io/journey-to-me/3d/).

Both are on the [walkthrough page](https://becomingyourself.github.io/journey-to-me/preview.html),
with a video of each.

## What's here

| File | What it does |
|---|---|
| `content.js` | **Every word in the journal.** Edit this to change any wording |
| `index.html` | The page shell |
| `styles.css` | The whole look — sky, clouds, paper, leather, gold, ornate border, 3-D flip |
| `journal.js` | Page turning, writing and saving, tabs, the petal/stardust engine, install |
| `sw.js` | Offline cache, so the journal works with no internet after the first visit |
| `manifest.webmanifest` | Makes it installable, with the gold book as its icon |
| `assets/` | Paper texture, ornate border, the cover, the sky and cloud plates, petals |

No frameworks and no libraries. Drop the folder on any web host and it runs.

## The book

- Cover → This Book Belongs to → Welcome → Table of Contents
- Then, for each of the 21 days: the daily inspiration, followed by **three**
  writing pages, so nobody runs out of room part-way through a thought
- A Personal Message to You at the end, with a way back to the cover

90 pages in all. The page numbering, the Table of Contents, the numbered tabs
and the thickness of the book are all worked out from `content.js` at load
time — add or remove a day and everything follows.

**Four pages a day is not padding.** Page 0 is the front of the first leaf, so
even-numbered pages fall on the right of a spread and odd ones on the left. The
front matter ends on page 3, which puts the first inspiration on page 4 — and
only an even-sized day block keeps every later one there too. At three pages a
day the inspiration swapped sides every other day.

## Changing the text

```js
{
  n: 1,
  title: 'The Day of Introduction',
  body: [ 'First paragraph.', 'Second paragraph.' ],
  bullets: [ 'an optional bulleted question' ],   // optional
  note: '(an optional italic aside)'              // optional
}
```

## Where the artwork came from

The paper texture and the ornate page border were cut out of the client's own
PDF (`extract_assets.py` in the parent folder). The cover is her straight-on
photograph of the printed book, with the front board measured off 4x crops of
its four corners (`make_cover_straight.py`) — the earlier angled photograph
needed a quad warp to square up, this one needed none.

The sky and both cloud layers are generated, not photographed
(`make_sky.py`). A photograph of clouds carries its own sun, and the moment the
book's shadow disagrees with that sun the whole thing reads as a cut-out. Both
cloud textures are built on a lattice indexed modulo its own width, so they
tile exactly left-to-right and can drift on a plain `background-position`
animation with no seam.

The pressed flowers that used to run down the gutter of each inspiration page
are gone at the client's request — they were cut from a photograph of the
printed book and never stopped looking trimmed at the edges.

## Notes

- Writing is saved on the reader's own device (localStorage) and comes back
  when they return. It is private to them, and it survives being offline.
  Syncing one person's writing across two devices would need a small backend.
- `✦ Magic` cycles the petals and stardust: On / Soft / Off. Readers who ask
  their device for reduced motion get Soft automatically.
- Petals are never drawn over the book — they are dropped once their *edge*
  reaches the paper, not their centre — and a page turn throws them from the
  outer edge of the book rather than from the spine, where they would be
  invisible.
- Every page carries at least an inch of margin (16.7% of the width, 12.2% of
  the height, taking the printed book as six inches wide). Anything tagged
  `.fit` is stepped down in size until it fits inside those margins, so a long
  day never spills and never hands the reader a scrollbar.
- Installing: Chrome, Edge and Android show an Install button; on iPhone and
  iPad it's Share → Add to Home Screen. Either way it then opens full screen
  with no browser bars and works with no internet.
- **When you change anything in `assets/`, bump `CACHE` in `sw.js`** or already
  installed copies will keep serving the old files forever.
