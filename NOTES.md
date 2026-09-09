# Verification

- `npm test`: 3 tests pass. They cover brush locality, immutable input, flattening error, smoothing a spike, mirror symmetry, and distinct crease displacement.
- `npm run build`: passes. The standalone includes Three.js and the shared viewer; the portfolio can lazy-load this tool.
- Chromium: sculpted with pointer strokes and front stamps, undid a stroke, changed presets and materials, exported OBJ with faces, and reset to a clean mesh. No JavaScript errors.
- At 390 × 844, the document has no horizontal overflow.

## Recorded examples

`examples/01.png` and `examples/02.png` are screenshots of actual edited geometry in the interactive viewport. `examples/manifest.json` records the brush operations, captions, and alternative text.

The tool uses fixed topology. Tight, strong creases will expose faceting, and sustained heavy edits can produce stretched or intersecting triangles. This is described in the interface and README. No static image stands in for the editable geometry.
