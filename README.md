# Digital Clay

A browser sculpture workbench using a welded icosphere mesh. Inflate moves vertices along their surface normals; Smooth uses local Laplacian averaging; Flatten projects toward the picked tangent plane; Crease combines inward displacement with tangential pinching. Brush influence falls off smoothly with squared model-space distance. Mirrored strokes choose the nearest of the two brush centers instead of applying twice across the symmetry plane.

Drag the form in Sculpt mode, or switch to Orbit to inspect another side. Stamp front provides a button alternative. Each stroke saves one undo checkpoint, up to 30. The preset selector rebuilds the actual base geometry; subsequent edits remain arbitrary vertex edits. OBJ and PNG exports are available.

## Limits

Fixed topology; no dynamic remeshing, boolean subtraction, pressure-sensitive stylus support, UV painting, or self-intersection prevention. Strong edits can stretch triangles. Brush radius is Euclidean, not geodesic, so a brush can influence nearby folds. Undo is local to this session. The vessel preset is a closed sculpting blank, not a hollow container.

## Development

`npm test`, `npm run dev`, and `npm run build`. Three.js 0.180 is the geometry and rendering dependency. The shared Graphics Workbench supplies the camera, lighting, accessible controls, lifecycle management, and exports. Both the standalone tool and portfolio import `createExperiment` from the same module.

## Run and explore

[Open the portfolio demo](https://zachsm.com/experiments/digital-clay). This repository runs independently and exports the same implementation used by the portfolio.

Requires Node.js 22 or later.

```sh
npm ci
npm test
npm run dev
```

`npm run build` produces a static site in `dist`. Editing, uploaded files, and exports stay in the browser. No account, server processing, or GitHub Actions is required.

## Captured examples

![Terracotta clay mesh with an inflated front surface on a dark round plinth](examples/01.png)

Inflating a terracotta form.

![Sage-colored clay sculpture shaped with short creases and an inflated front](examples/02.png)

Crease and inflate on a new blank.

Exact reproduction steps are recorded in [the example manifest](examples/manifest.json).
