# Sculpting stability verification

The original pointer handler produced different sculptures from the same path. A real 130-pixel drag with 2 versus 60 pointermove events caused RMS displacements of 0.00383 versus 0.01965, a 5.1-fold difference. The two exported meshes differed by RMS 0.01776.

The revised implementation resamples the path by distance. The same browser exercise now produces byte-identical OBJ exports and RMS difference zero. Holding still produces no additional deformation.

`npm test` verifies localized brush behavior, smoothing/flattening, mirrored influence, closed welded topology, finite normals, per-dab displacement bounds, back-facing surface exclusion, and path resampling.

`npm run test:browser` exercises actual pointer drags and exported geometry, exact undo, Escape and pointer cancellation, cached tool switching during an active stroke, right-button orbit, Orbit mode, wheel zoom while in Sculpt mode, and smooth-normal cursor placement under parent transforms. Default-view drags work in desktop and mobile viewports. The suite runs against GraphicsWorkbench commit `29d52d5d3c146954d4ed537cc020047333b0e642`; no JavaScript errors occurred.

The captured examples use direct drag strokes; no canned deformation or rendered-image substitute is involved. `examples/manifest.json` records their operations.

The mesh remains fixed-topology. Local displacement bounds and orientation filtering improve stability but do not replace remeshing, geodesic influence, or global self-intersection detection. The closed Vessel preset is a sculpting blank, not a hollow vessel model.
