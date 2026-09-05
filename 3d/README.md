# The Journey to Me — the 3D version

The same journal, in a real three-dimensional scene, and the version the client
chose. Two settings, switched in the top right corner:

- **Candlelight** — the book on a dark walnut table, lit by two real candles.
- **Daylight sky** — the book resting in a light blue sky, on a sea of cloud.

Both are the same scene and the same book; only the lighting, the ground and
the background change. The choice is remembered per device.

**Live:** https://becomingyourself.github.io/journey-to-me/3d/
**Walkthrough:** https://becomingyourself.github.io/journey-to-me/preview.html

Nothing in it is a picture of a book. The boards, the spine, the page block and
every leaf you turn are geometry; the candles are light sources. The shadow
under the book and the shine along the gold are worked out fresh every frame
from wherever the flames happen to be, which is why they move when the flames
flicker.

## What's here

| File | What it does |
|---|---|
| `index.html` | The page shell, the on-screen controls and the handwriting font |
| `scene.js` | The whole scene: table, candles, book, page turning, petals, dust, input |
| `pages.js` | Paints each page onto a 2D canvas, which becomes a texture |
| `cloud.js` | Accounts and cloud storage, over `fetch` — no SDK |
| `config.js` | The two values that switch accounts on. Empty = device only |
| `ACCOUNTS.md` | How to turn accounts on, and the one SQL policy that secures them |
| `lib/` | three.js r169, its orbit controls and the bloom pass, vendored |
| `assets/` | Wood and leather maps, the petals, the handwriting font |
| `../assets/sky.webp`, `clouds-*.webp` | The sky and cloud plates, shared with the storybook version |
| `walkthrough-3d.mp4` | The recorded walkthrough |

The words come from `../content.js` — the same file the illustrated version
uses, transcribed from the client's PDF. Change a prompt there and it changes
in both.

## The page turn

A page is not a card that flips. `shapeLeaf` walks along the page from the
spine to the outer edge in 48 steps, turning the direction of travel a little
further at each one, and drops each vertex wherever that walk lands it. That
accumulating turn is what makes the page bow up off the stack in the middle of
a turn and settle flat at either end, instead of scything through the paper
underneath it.

## The page list

Page 0 is the cover art, which lives on the board. From index 1 on, leaf *j*
shows page `1 + 2j` on its front and `2 + 2j` on its back — and the front of a
leaf is the **right** page of a spread, so **odd page numbers are right-hand
pages**.

The client asked for every daily inspiration on the right. Two things make that
true, and both are arithmetic rather than layout:

- each day's block must be an **even** number of pages, or the parity shifts and
  the inspiration swaps sides every other day. It is four: the inspiration, then
  three pages to write on.
- the first inspiration must land on an **odd** index. The front matter was four
  pages, which put it on 4 — the left. One blank page after the contents moves
  all 21 onto odd pages, and a blank verso facing an opening page is what a
  printed book does anyway.

`dayPage(n)` is the single place that arithmetic lives, and the numbered tabs
read the day off `PAGES` rather than recomputing it, so neither can drift.

## Margins

At least an inch on every side, as the client asked. Taking the printed book as
six inches wide, that is 16.7% of the width and 12.2% of the height — on the
900 x 1233 page canvas both come out at 150px.

A daily inspiration is measured before it is drawn and stepped down in size
until it fits between those margins, then centred in what is left. A fixed
starting `y` used to push the longest days past the foot of the page as soon as
a title wrapped to two lines.

## Things that bit, so they do not bite again

- **ACES tone mapping is applied by the `OutputPass`, to the whole frame.** A
  per-material `toneMapped: false` never reaches it, so the sky cannot opt out —
  and a flat sky blue run through ACES comes back the colour of wet concrete,
  because the camera only ever sees the pale band near the horizon, which is
  exactly what ACES desaturates hardest. The fix is exposure: sit the sky lower
  on the curve (0.86 rather than 1.10) and put the light back with the sun.
- **`MeshStandardMaterial` ignores a texture's alpha unless asked not to.** The
  cloud sea was first given the alpha-cut cloud plate and rendered as a sheet of
  flat near-white: where the alpha was zero the RGB was still the pale shadow
  tint. It has its own opaque, two-way-tiling plate now.
- **Texture scale has to be set against the subject, not the geometry.** At 11
  tiles across a 14m plane the whole visible foreground was a quarter of one
  cloud and read as card. At 48 a cloud top is about two thirds the width of the
  book, which is the scale that reads as a cloud sea.
- **`FogExp2` density is a balance, not a taste.** It fades by
  `1 - exp(-(density*d)^2)`. At 0.95 the cloud sea faded out beautifully and the
  book — only 0.6m away — was 28% hazed. 0.62 leaves the book at 87% of itself.

- **A shadow-casting point light renders a cube map**, and the seam between two
  of its faces fell straight down the open page as a hard vertical line. The
  shadows come from a spot light, which has one map and no seams.
- **A resting page dips into the gutter, and that dip must stay smaller than
  the gap between the page and the block underneath it.** At 7.5mm the page
  sank into the block near the spine and the block's cream top face showed
  through — which read exactly like a shadow bug and was not one.
- **`state.coverOpen === 1` is the wrong test.** An eased animation driven by a
  capped frame delta lands a hair short of its target on a slow machine, and
  exact equality then locks the book shut for good. It compares `> 0.999`.
- **A CSS animation on `opacity` outranks a plain rule**, so the opening hint
  kept breathing away long after it had been told to leave.
- The candles stand back and tall on purpose. Close to the book, the inverse
  square falloff lights the near page and leaves the far one in the dark.

## Recording the walkthrough

`../record3d.py`. Headless WebGL runs on SwiftShader, which manages perhaps six
frames a second — filming that in real time would show the page turn
stuttering, which is a lie about the animation. So the scene's clock is taken
away from it (`__scene.capture(true)`) and advanced by hand, one exact 25th of
a second per screenshot.

## Notes

- Writing is saved on the reader's own device, under its own key
  (`journey-to-me-3d`), separate from the illustrated version. The chosen
  setting is stored under `journey-to-me-3d-mode`.
- Petals never fall over the book. `petalStart()` keeps them clear of its
  footprint with enough margin for the sway the animation adds, so a petal that
  starts outside stays outside all the way down — they used to be allowed to
  land on the open spread.
- The camera orbits the book and cannot wander off into the room: no panning,
  and the azimuth stops at ±1.05 rad either side.
- The service worker deliberately does not cache anything under `/3d/`, so a
  change here reaches everyone on their next visit.
- **Accounts are dormant until `config.js` is filled in.** With it empty there
  is no sign-in screen and the journal behaves exactly as it always has. See
  [ACCOUNTS.md](ACCOUNTS.md).
- three.js is MIT; the Caveat handwriting font is SIL Open Font License. Both
  licences are alongside the files.
