# Visual design plan — three directions

**Gate 3 deliverable.** No rendering code exists yet. Pick one direction (or
tell me what to steal from which) and gate 5 builds it.

Everything below is grounded in the actual situation: a cabinet in a lit room,
two mirrored panels facing each other, people standing 6 feet away with a cup
in one hand, glancing up mid-sentence. Not a bedroom with the lights off.

---

## What's fixed regardless of direction

### Player identity (shared across all three games and all three directions)

Eight identity colours, ordered so the common 2–4 player counts get the most
separable set first. Every colour is backed by **two** secondary cues: a big
numeral and a shape. Drunk and colourblind people read the numeral. The shape
is for silhouettes at distance where the numeral is too small.

| slot | name      | hex       | shape     | notes |
|------|-----------|-----------|-----------|-------|
| P1   | Vermilion | `#FF4D2E` | circle    | |
| P2   | Sky       | `#2EB8FF` | square    | |
| P3   | Yolk      | `#FFD23F` | triangle  | |
| P4   | Violet    | `#9B5CFF` | diamond   | |
| P5   | Mint      | `#19D3A2` | hexagon   | separable from Sky by lightness |
| P6   | Tangerine | `#FF9F1C` | star      | vs Vermilion: numeral does the work |
| P7   | Bubblegum | `#FF4FA3` | heart     | |
| P8   | Ice       | `#D6F0FF` | ring      | near-white; on a light ground gets a heavy keyline |

Deuteranopia check: P1/P5 and P3/P6 are the risky pairs. They are 4 slots
apart on purpose so a 4-player night never puts them together.

### Fuel gauge states (all directions)

| state | look |
|-------|------|
| normal | solid identity colour fill, thick keyline |
| low < 20% | fill pulses between identity colour and its 60% tint at ~2 Hz; keyline unchanged |
| dry | fill gone, keyline only in the direction's *quiet* colour, plus a `DRY` badge in the quiet colour. Same size, same position, no red, no flashing |

### Type scale (logical 1920×1080 px, before letterbox)

| role  | px  | use |
|-------|-----|-----|
| hero  | 260 | rope KNOT, auction item value, `TEAM A WINS` |
| title | 120 | game name, `TOP UP`, callouts |
| big   | 72  | scores, timer digits, player labels on the arena |
| label | 40  | prompts, `READY`, bar captions |
| small | 28  | the floor. Nothing smaller anywhere. |

28 logical px on a 27" panel at 1080p is ~7 mm tall; readable at 6 feet for
someone squinting. If the cabinet panels are smaller than 24", tell me and the
floor goes to 32.

### Layout, per game

Dictated by hardware more than by taste, so shared by all directions. The
outer frame is the 5% no-go zone; everything shown sits inside the central 90%.

**Launcher / registration**

```
┌──────────────────────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░                                                                    ░│
│░   ████████████████████████████████████████████████████████████     ░│
│░   █  TUG OF WAR          Drink to pull. Brace to hold.       █ ◀   ░│
│░   ████████████████████████████████████████████████████████████     ░│
│░                                                                    ░│
│░      AUCTION BLITZ       Every bid is a drink.                     ░│
│░                                                                    ░│
│░      BLOOM               Grow. Eat. Get stuck.                     ░│
│░                                                                    ░│
│░                                                                    ░│
│░   (1)  (2)  (3)  ( )  ( )  ( )  ( )  ( )      PRESS DRINK TO JOIN  ░│
│░   16oz pint 12oz                              ACTION: cup size     ░│
│░                                                                    ░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└──────────────────────────────────────────────────────────────────────┘
```

Games are three full-width bands, not cards. The selected band is the one
bold element. Player slots are a row of cup silhouettes along the bottom;
joining fills one with your colour, `up`/`down` cycles cup size, `action`
locks it. Any joined player pressing `action` on the selected game starts it.

**Tug of War**

```
┌──────────────────────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░                    ●  ●  ○      round 3      ○  ○  ○               ░│
│░                                                                    ░│
│░  ▐▌                                                            ▐▌  ░│
│░  ▐▌      (1)   (3)   (5)                  (2)   (4)   (6)      ▐▌  ░│
│░  ▐▌      /|\   /|\   /|\      ┏━━━━━┓     /|\   /|\   /|\      ▐▌  ░│
│░  ▐▌═════/ \═══/ \═══/ \═══════┃ ▲▲▲ ┃════/ \═══/ \═══/ \═══════▐▌  ░│
│░  ▐▌        ▲                  ┗━━━━━┛                  ▲       ▐▌  ░│
│░  win     threshold             KNOT             threshold    win   ░│
│░                                                                    ░│
│░   1 ████████░░   2 ██████░░░░      4 ███░░░░░░░ pulsing            ░│
│░   3 ██████████   6 ░░░░░░░░░░ DRY  5 █████████░                    ░│
│░                                                                    ░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└──────────────────────────────────────────────────────────────────────┘
```

The rope and its knot are the whole screen. Players are chunky leaning
figures *on* the rope, in their colour with their numeral on the torso; a
bracing player plants both feet and the figure squats (squash). A dry player's
figure sits down on the rope with heels dug in. Gauges are segments stacked
under each side — the team's fuel, readable as one block. Score pips top
centre. Win threshold marks are physical posts, not HUD lines.

**Auction Blitz**

```
┌──────────────────────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░  P1 12  P2 31  P3 8  P4 19        ╭───────────╮      round 4 / 7   ░│
│░                                   │    +25    │                    ░│
│░                                   │  GOLDEN   │  ◔ 2.8              ░│
│░                                   │   TAP     │                    ░│
│░                                   ╰───────────╯                    ░│
│░                                                                    ░│
│░           ▓▓                                                       ░│
│░           ▓▓          ▓▓                                           ░│
│░     ▓▓    ▓▓    ▓▓    ▓▓          ▓▓                               ░│
│░     ▓▓    ▓▓    ▓▓    ▓▓    ▓▓    ▓▓                               ░│
│░    ─────────────────────────────────────                           ░│
│░     (1)   (2)   (3)   (4)   (5)   (6)                              ░│
│░    ████  ██░░  █░░░  ░░░░  ████  ██░░      ← cup gauge, bar        ░│
│░    fold  bid   bid   DRY   bid   VETO✕                             ░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└──────────────────────────────────────────────────────────────────────┘
```

Bid bars own the lower two-thirds of the frame and grow *up* from a shared
floor — they are the centrepiece. Item card top centre with the value as the
biggest thing on it; the timer is a ring around the item that fills clockwise
and goes to the direction's alert colour for the last three seconds, with the
whole card growing 10% and the tick sound climbing. A fold drops a coaster on
your bar. A veto is a full-width banner that slams down over the winner's bar.

**Bloom**

```
┌──────────────────────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░ 1:12   ①42s ②38s ③55s ④—                                          ░│
│░ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ░│
│░ ▓                        ▓      ▓                              ▓  ░│
│░ ▓         ╭──╮           ▓      ▓ ▓▓▓▓▓▓▓▓▓▓   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓  ░│
│░ ▓        (  1 )          ▓▓▓▓▓▓▓▓ ▓         ▓  ▓             ▓ ▓  ░│
│░ ▓         ╰──╯                    ▓  (3)    ▓  ▓   ╭╮        ▓ ▓  ░│
│░ ▓                       ▓▓▓▓▓▓▓▓▓▓▓         ▓  ▓   ╰╯        ▓ ▓  ░│
│░ ▓    ▓▓▓▓▓▓▓            ▓          ▓▓▓  ▓▓▓▓▓  ▓▓▓  ▓▓▓▓▓▓▓▓▓▓ ▓  ░│
│░ ▓    ▓     ▓  ╭────╮    ▓            ▓  ▓            ▓         ▓  ░│
│░ ▓    ▓  ⊙  ▓ (  2   )   ▓            ▓  ▓   ⊙        ▓    (4)  ▓  ░│
│░ ▓    ▓▓▓▓▓▓▓  ╰────╯    ▓            ▓▓▓▓            ▓▓▓▓▓▓▓▓▓▓▓  ░│
│░ ▓                       ▓                                       ▓  ░│
│░ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└──────────────────────────────────────────────────────────────────────┘
```

Arena fills the safe area. Walls are thick, solid, keylined; gaps are
deliberately sized in radius units (small, medium, never large). Each player
is a disc with the numeral, the fuel ring around it. The one bold element is
the *arena itself* — everything else (timer, survival times) is a single quiet
strip along the top. Hand-authored; the left pocket is the "small-and-dry"
home, the right structure is a bigger loop with two mid-size gaps that a
mid-size-and-dry player can just barely still use.

**TOP UP**

```
┌──────────────────────────────────────────────────────────────────────┐
│░                           TOP UP                                   ░│
│░                                                                    ░│
│░     ┌───┐    ┌───┐    ┌───┐    ┌───┐    ┌───┐    ┌───┐             ░│
│░     │▓▓▓│    │   │    │▓▓▓│    │   │    │▓▓▓│    │▓  │             ░│
│░     │▓▓▓│    │   │    │▓▓▓│    │   │    │▓▓▓│    │▓  │             ░│
│░     │▓▓▓│    │▓  │    │▓▓▓│    │   │    │▓▓▓│    │▓  │             ░│
│░     └─1─┘    └─2─┘    └─3─┘    └─4─┘    └─5─┘    └─6─┘             ░│
│░      READY            READY    READY    READY                      ░│
│░                                                                    ░│
│░     tap ACTION = ready as you are      hold ACTION = refill        ░│
│░                                                                    ░│
│░     P5 · 1.4 L tonight. Water round? It'd be a good one.           ░│
└──────────────────────────────────────────────────────────────────────┘
```

Six cups, same size, same weight. Player 4 confirmed ready with an empty cup:
it just says READY like everyone else's. Refilling animates the cup filling
with a glug. The water line is one sentence in the small size, in the quiet
colour, and only for players who crossed the threshold. No icon, no colour.

---

## Direction A — Enamel Sign  (recommended)

**In one sentence:** it looks like the game was screen-printed onto the tin
sign behind the bar — cream ground, black keylines, flat inks, nothing glows.

The default arcade look is dark with glowing accents. This is the opposite:
a **light ground**. Two bright mirrored panels in a lit room light up the
faces around them, which is what you want at a party. Black keylines on cream
give the highest-contrast silhouettes available at 6 feet, and the flat-ink
look matches the actual subject (bottle labels, pub signage, coasters).

### Palette

| name    | hex       | role |
|---------|-----------|------|
| Cream   | `#F4E9D2` | ground |
| Ink     | `#1A1614` | every keyline, all type |
| Bottle  | `#1F5E45` | rope, arena walls, structural panels |
| Brass   | `#D9A441` | timer, winner, the one accent per screen |
| Slate   | `#6B7680` | quiet UI, dry outlines, DRY badge, water line |
| Foam    | `#FFFFFF` | highlight edge on gauge fills, cup rims |

Player colours get a 6px Ink keyline everywhere so Yolk and Ice hold on cream.

### Typography

- **Display:** `Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif` — heavy condensed caps. Web-safe on Windows and macOS. Numbers are fat and read at distance.
- **Body / labels:** `"Arial Black", "Helvetica Neue", Arial, sans-serif` at weight 900 for labels, weight 700 for the small size.
- Display type gets a 4px Ink stroke *outside* the fill, so Brass or a player colour still reads on Cream.
- Optional upgrade: embed one OFL slab as base64 in `src/font.css` (Alfa Slab One is the obvious candidate) for a proper label feel. Zero CDN, one file. I'd want your OK on the ~60 KB.

### Tug of War in this direction

```
 cream ground
 ══════ rope: Bottle green, 28px thick, Ink keyline, twisted-strand stripe pattern
 KNOT: Brass, Ink keyline, hero size numeral-less block with three ▲ chevrons
 players: flat-ink figures, identity colour torso, Ink outline, numeral in Cream on the torso
 win posts: Ink verticals with a Brass flag
 gauges: Cream well, Ink keyline, identity-colour fill, Foam top edge
 shake: the whole sign rattles, including a 2px Ink "shadow" that lags one frame
```

### What's bold, what's quiet

Bold: the flat-ink shapes at huge scale — the rope, the bars, the discs. Quiet:
everything typographic sits in Ink or Slate, no colour in text except the
winner banner in Brass.

### Risk

A light ground shows every frame-rate hitch as a smear and forgives no jitter.
That's fine at 60fps and is a good discipline. It also glows in a dark room;
if your cabinet lives somewhere lights-off, pick B or C.

---

## Direction B — Taproom Chalkboard

**In one sentence:** the specials board above the bar came alive — dark green
slate, chalk lettering, coloured chalk for players, an oak frame in the
margin you can't use anyway.

Dark, but not black, and no glow. Chalk on slate is a texture people already
read across a bar, and the oak frame is the only design in this project that
*uses* the 5% dead zone instead of hiding from it.

### Palette

| name       | hex       | role |
|------------|-----------|------|
| Slate      | `#16241D` | ground |
| Chalk      | `#F2EFE6` | type, keylines, rope |
| Dust       | `#6E7A72` | quiet UI, dry outlines, DRY badge |
| Copper     | `#D08A4B` | accent: timer, winner, tap handles on the launcher |
| Oak        | `#4A2E1B` | the frame, drawn in the outer 5% only |
| Cream Ale  | `#F5D98A` | callout banners |

Player colours are used as *chalk*: 85% opacity fills with a 1px lighter
inner edge, so they look drawn on rather than lit up.

### Typography

- **Display:** `Impact` again for the numerals (there is no web-safe chalk face), rendered with a two-pass jitter: draw once, then again at 60% alpha offset by 1.5px, which reads as chalk edge without a texture asset.
- **Labels:** `"Trebuchet MS", Verdana, sans-serif` bold — rounder, friendlier than Arial, fits hand-lettering.
- Optional embed: Permanent Marker or Cabin Sketch (OFL) for labels. Same base64 deal.

### Tug of War in this direction

```
 slate ground, oak frame outside the safe area
 ══════ rope: Chalk, dashed strand marks, drawn slightly wobbly (fixed noise, not animated)
 KNOT: Copper, chalk-white "X" through it
 players: chalk stick figures — literally — in identity chalk colour, numeral over the head
 win posts: chalk verticals with "WIN" hand-lettered
 gauges: chalk-outlined jars, identity chalk fill with a hatched pattern
 shake: chalk dust particles fall off the board, the frame stays still
```

### What's bold, what's quiet

Bold: the chalk figures and the hand-drawn wobble. Quiet: everything is Chalk
or Dust; Copper appears exactly once per screen.

### Risk

"Hand-drawn" costs legibility if pushed. I'd keep wobble amplitude at 2px and
never on type. Chalk stick figures are less readable as silhouettes than A's
flat blocks — worth a mock before committing.

---

## Direction C — Broadcast

**In one sentence:** the cabinet is covering a sporting event — hard white
slabs, colour fields, lower-third bars and a scorebug, and the crowd around it
are the commentators.

The framing is that these games are a *sport* people watch, and TV sports
graphics are the best-tested vocabulary in the world for "read the state in
half a second from across a room". Dark ground, but flat and solid, no neon.

### Palette

| name     | hex       | role |
|----------|-----------|------|
| Pitch    | `#0F1A2B` | ground |
| Signal   | `#F7F7F2` | slabs, type |
| Steel    | `#3A4A60` | panels, quiet UI, dry outlines |
| Lime     | `#C6FF00` | the alert accent: timer last 3s, veto, winner |
| Chyron   | `#06090F` | the bar the score lives in |
| Fog      | `#8E9AAD` | small text, water line |

Player colours are used as solid fields — a player's bar is a full-bleed block
of their colour with a Signal numeral punched out of it.

### Typography

- **Display:** `Impact` for numerals, set *very* tight, on Signal slabs (the scorebug look: dark numerals on white blocks).
- **Labels:** `"Arial Narrow", "Helvetica Neue Condensed", Arial, sans-serif` bold, all caps, tracked normal — the one place caps-everywhere is idiomatic rather than lazy.
- Optional embed: Barlow Condensed or Oswald (OFL).

### Tug of War in this direction

```
 pitch ground
 ══════ rope: Signal white, 24px, hard Chyron shadow below (not soft, a solid offset)
 KNOT: Lime slab with Chyron numeral of the current offset in %
 players: solid colour rectangles (jerseys) with Signal numerals, leaning by shear transform
 win posts: Signal verticals with a Lime cap
 gauges: Signal-outlined bars in the lower third, Chyron background strip across the full width
 shake: hard, short, and the scorebug does a 1-frame Lime flash
```

### What's bold, what's quiet

Bold: the lower-third — a full-width Chyron strip with every player's gauge
as a colour field. Quiet: the arena above it is nearly monochrome so the strip
owns the eye.

### Risk

It's the closest of the three to "a game UI", and the full-width strip eats
vertical space in Bloom, where the arena wants every pixel. Bloom would move
its strip to a thin top scorebug.

---

## Recommendation

**A, Enamel Sign.** It's the one that is unmistakably not the default, it has
the best raw legibility of the three (Ink keylines on Cream), it's the
cheapest to render at 60fps (flat fills, no texture passes, no glow blur), and
it's the only one that makes the room brighter rather than darker, which is
what a party cabinet should do.

If you want dark: **C** over B. B is the most charming but is the one most
likely to lose readability under drink.

Tell me A / B / C, or a mix, and whether you want the embedded font. Then
gate 4 starts (shared systems + Tug of War, placeholder visuals) and gate 5
applies whatever you picked.
