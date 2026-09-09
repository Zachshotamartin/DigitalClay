import { createClayGeometry, sculptDab, vertexNeighbors } from './sculpt.js';

export const metadata = {
  id: 'digital-clay', title: 'Digital Clay',
  description: 'Shape a continuous mesh with soft, local sculpting brushes. Every stroke moves real vertices.',
  technique: 'Distance-weighted vertex displacement, Laplacian smoothing, and plane projection on a welded triangular mesh.',
  instructions: ['Choose a brush and drag across the clay in Sculpt mode.', 'Switch to Orbit to inspect another side. Radius, strength and mirrored strokes work together.', 'Use Stamp front for a keyboard-friendly brush dab, or undo an entire stroke.'],
  limitations: ['Fixed topology: heavy edits can stretch triangles or self-intersect; there is no remeshing or boolean sculpting.', 'Symmetry mirrors brush positions across the original X plane, not arbitrary edited topology.', 'Undo retains the latest 30 strokes. OBJ exports geometry without material textures.'],
};

export function createExperiment(ctx) {
  const { THREE: T, root, ui, controls, canvas } = ctx;
  let preset = 'Pebble', brush = 'Inflate', radius = 0.27, strength = 0.045, symmetry = true, orbit = false, dragging = false, lastPoint = null;
  let neighbors, undo = [], strokes = 0;
  const mesh = new T.Mesh(createClayGeometry(preset), new T.MeshStandardMaterial({ color: 0xcb9177, roughness: 0.66, metalness: 0.03 }));
  mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  const plinth = new T.Mesh(new T.CylinderGeometry(1.48, 1.55, 0.16, 64), new T.MeshStandardMaterial({ color: ctx.palette.dark, roughness: 0.75 }));
  plinth.position.y = -1.4; plinth.receiveShadow = true; root.add(plinth);
  const ring = new T.Mesh(new T.RingGeometry(0.96, 1, 64), new T.MeshBasicMaterial({ color: 0xf4e9d1, side: T.DoubleSide, depthTest: false, transparent: true, opacity: 0.9 }));
  ring.renderOrder = 4; ring.visible = false; root.add(ring);
  const report = extra => ctx.setStatus(`${mesh.geometry.attributes.position.count.toLocaleString()} vertices · ${strokes} strokes${extra ? ` · ${extra}` : ''}`);
  function refreshed() {
    mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
    plinth.position.y = mesh.geometry.boundingBox.min.y - 0.08; ctx.invalidate();
  }
  function remember() { undo.push(mesh.geometry.attributes.position.array.slice()); if (undo.length > 30) undo.shift(); undoButton.disabled = false; }
  function dab(point, axis) {
    const geometry = mesh.geometry;
    const result = sculptDab({ positions: geometry.attributes.position.array, normals: geometry.attributes.normal.array, neighbors, center: point.toArray(), normal: axis.toArray(), radius, strength, brush, symmetry });
    geometry.attributes.position.array.set(result.positions); refreshed(); return result.affected;
  }
  function hit(event) { return ctx.pick(event, [mesh])[0]; }
  function showBrush(intersection) {
    if (!intersection || orbit) { ring.visible = false; return; }
    ring.visible = true; ring.position.copy(intersection.point).addScaledVector(intersection.face.normal, 0.012); ring.scale.setScalar(radius);
    ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), intersection.face.normal.clone().normalize());
  }
  function reset() {
    mesh.geometry.dispose(); mesh.geometry = createClayGeometry(preset); neighbors = vertexNeighbors(mesh.geometry.index.array, mesh.geometry.attributes.position.count);
    mesh.geometry.computeBoundingBox(); plinth.position.y = mesh.geometry.boundingBox.min.y - 0.08;
    undo = []; strokes = 0; undoButton.disabled = true; report('fresh clay'); ctx.fit(mesh); ctx.invalidate();
  }
  ui.section('Clay & brush');
  ui.select('Starting form', ['Pebble', 'Vessel', 'Creature'], preset, value => { preset = value; reset(); });
  ui.select('Brush', ['Inflate', 'Smooth', 'Flatten', 'Crease'], brush, value => { brush = value; });
  ui.select('Pointer mode', ['Sculpt', 'Orbit'], 'Sculpt', value => { orbit = value === 'Orbit'; controls.enabled = orbit; ring.visible = false; canvas.style.cursor = orbit ? 'grab' : 'crosshair'; ctx.invalidate(); });
  ui.range('Radius', { min: 0.08, max: 0.65, step: 0.01, value: radius, onChange: value => { radius = value; } });
  ui.range('Strength', { min: 0.005, max: 0.09, step: 0.005, value: strength, onChange: value => { strength = value; } });
  ui.toggle('Mirror across X', symmetry, value => { symmetry = value; });
  ui.toggle('Wireframe', false, value => { mesh.material.wireframe = value; ctx.invalidate(); });
  ui.select('Clay finish', [{ label: 'Terracotta', value: '0xcb9177' }, { label: 'Porcelain', value: '0xe7ece1' }, { label: 'Sage', value: '0xb8cd99' }], '0xcb9177', value => { mesh.material.color.setHex(Number(value)); ctx.invalidate(); });
  ui.section('Shape history');
  ui.button('Stamp front', () => {
    const p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal;
    let index = 0; for (let i = 1; i < p.count; i++) if (p.getZ(i) > p.getZ(index)) index = i;
    remember(); const affected = dab(new T.Vector3().fromBufferAttribute(p, index), new T.Vector3().fromBufferAttribute(n, index)); strokes++; report(`${affected} vertices changed`);
  }, { primary: true });
  const undoButton = ui.button('Undo stroke', () => { const previous = undo.pop(); if (!previous) return; mesh.geometry.attributes.position.array.set(previous); strokes = Math.max(0, strokes - 1); refreshed(); undoButton.disabled = !undo.length; report('stroke undone'); });
  ui.button('Reset clay', reset); ui.button('Export sculpture OBJ', () => ctx.exportOBJ(mesh, 'digital-clay.obj'));
  ui.note('Sculpt edits the mesh itself. Use lighter repeated strokes to avoid stretched or intersecting triangles.');
  ctx.listen(canvas, 'pointerdown', event => {
    if (orbit || event.button !== 0) return;
    const intersection = hit(event); if (!intersection) return;
    event.preventDefault(); remember(); dragging = true; lastPoint = intersection.point.clone(); canvas.setPointerCapture(event.pointerId);
    dab(intersection.point, intersection.face.normal); strokes++; report();
  });
  ctx.listen(canvas, 'pointermove', event => {
    const intersection = hit(event); showBrush(intersection);
    if (dragging && intersection && (!lastPoint || lastPoint.distanceTo(intersection.point) > radius * 0.07)) { dab(intersection.point, intersection.face.normal); lastPoint = intersection.point.clone(); }
    ctx.invalidate();
  });
  const release = event => { dragging = false; lastPoint = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
  ctx.listen(canvas, 'pointerup', release); ctx.listen(canvas, 'pointercancel', release);
  ctx.listen(canvas, 'pointerleave', () => { ring.visible = false; ctx.invalidate(); });
  controls.enabled = false; canvas.style.cursor = 'crosshair'; reset();
  return { dispose() { controls.enabled = true; canvas.style.cursor = ''; undo = []; } };
}
