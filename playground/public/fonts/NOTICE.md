# redux-xvr.ttf

A subset of **DejaVu Sans** (Book), generated with `pyftsubset` from
`/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`.

## Why this file exists

`troika-three-text` — which backs drei's `<Text>` — defaults to a Roboto subset fetched from a CDN.
That subset contains **no mathematical operators**, so `∨`, `∧`, `¬`, `⊆`, `→` and friends render as
*nothing at all* — silently, with no error. For a project whose subject is formal CS notation that is
a hard blocker, and the CDN fetch is also a network dependency we do not want at runtime or in a
headless screenshot.

Self-hosting a subset fixes both. 757 KB → 20 KB by keeping only ASCII plus the logic, set-theory,
arrow, and comparison ranges we actually use, and the geometric-shapes block for UI
glyphs.

**A missing glyph drops the entire text run**, not just that character — a `▾` outside the subset
blanked a whole button label. Any new symbol used anywhere in the scene must be added here.

Regenerate with:

```bash
pyftsubset /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf \
  --output-file=playground/public/fonts/redux-xvr.ttf \
  --unicodes="U+0020-007E,U+00AC,U+00B7,U+00D7,U+2032,U+2190-2193,U+2200-2209,U+2227-222A,U+2260-2264,U+2282-2287,U+22C0-22C3,U+2205,U+03A6,U+03C6,U+2026,U+25A0-25FF,U+2022,U+00B0" \
  --layout-features='*' --no-hinting --desubroutinize
```

## License

DejaVu fonts are released under a permissive license derived from the Bitstream Vera Fonts License —
free to use, redistribute, and modify, including in derivative (subset) form. Bitstream Vera is
Copyright © 2003 Bitstream, Inc.; DejaVu changes are in the public domain.

Full text: <https://dejavu-fonts.github.io/License.html>
