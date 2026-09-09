import { createClayGeometry, sculptDab, vertexNeighbors } from './sculpt.js';
import { beginStroke, sampleStroke } from './stroke.js';

export const metadata = {
  id: 'digital-clay', title: 'Digital Clay',
  description: 'Shape a continuous mesh with soft, local sculpting brushes. Every stroke moves real vertices.',
  technique: 'Spatially resampled brush strokes, welded triangular geometry, surface-normal filtering, and bounded vertex displacement.',
  instructions: ['Drag directly on the clay to sculpt. Brush size controls the area; strength controls each pass.', 'Right-drag or Alt-drag to orbit. Scroll to zoom, or select Orbit mode. Mirror across X edits both sides.', 'Undo reverses a complete stroke. Escape cancels the current stroke. Stamp front is a keyboard alternative.'],
  limitations: ['Fixed topology: sustained heavy edits can still stretch or self-intersect. This is not a remeshing or boolean sculptor.', 'Brushes use local distance and surface orientation, not geodesic distance. Nearby folds can still influence one another.', 'Undo retains the latest 30 completed strokes. The vessel starts as a closed blank. OBJ exports geometry without textures.'],
};

export function createExperiment(ctx) {
  const { THREE: T, root, ui, controls, canvas } = ctx;
  let preset = 'Pebble', brush = 'Inflate', radius = .27, strength = .045, symmetry = true, orbit = false;
  let neighbors, undo = [], strokes = 0, activeStroke = null;
  const previousControls = { enabled: controls.enabled, damping: controls.enableDamping, right: controls.mouseButtons.RIGHT };
  controls.enabled = true; controls.enableDamping = false; controls.mouseButtons.RIGHT = T.MOUSE.ROTATE;
  const mesh = new T.Mesh(createClayGeometry(preset), new T.MeshStandardMaterial({ color: 0xcb9177, roughness: .66, metalness: .03 }));
  mesh.name = 'Sculpted clay'; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  const plinth = new T.Mesh(new T.CylinderGeometry(1.48, 1.55, .16, 64), new T.MeshStandardMaterial({ color: ctx.palette.dark, roughness: .75 }));
  plinth.receiveShadow = true; root.add(plinth);
  const preview = new T.Group(); ctx.scene.add(preview);
  const ringGeometry = new T.RingGeometry(.97, 1, 64);
  const rings = [1, .45].map(opacity => {
    const ring = new T.Mesh(ringGeometry, new T.MeshBasicMaterial({ color: 0xf4e9d1, side: T.DoubleSide, depthTest: false, transparent: true, opacity }));
    ring.renderOrder = 4; ring.visible = false; preview.add(ring); return ring;
  });
  const report = extra => ctx.setStatus(`${mesh.geometry.attributes.position.count.toLocaleString()} vertices · ${strokes} strokes${extra ? ` · ${extra}` : ''}`);
  const hideBrush = () => rings.forEach(ring => { ring.visible = false; });
  const modeCursor = () => { canvas.style.cursor = orbit ? 'grab' : 'crosshair'; };
  function refreshed() {
    const g = mesh.geometry; g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
    plinth.position.y = g.boundingBox.min.y - .08; ctx.invalidate();
  }
  function pushUndo(snapshot) { undo.push(snapshot); if (undo.length > 30) undo.shift(); undoButton.disabled = false; }
  function intersectionAt(x, y) { return ctx.pick({ clientX: x, clientY: y }, [mesh])[0]; }
  function brushHit(hit) {
    return { point: mesh.worldToLocal(hit.point.clone()), normal: (hit.normal || hit.face.normal).clone().normalize() };
  }
  function dab(hit, settings) {
    const { point, normal } = brushHit(hit), g = mesh.geometry;
    const result = sculptDab({ positions: g.attributes.position.array, normals: g.attributes.normal.array, neighbors, center: point.toArray(), normal: normal.toArray(), ...settings });
    if (!result.affected || result.maxDisplacement < 1e-10) return false;
    g.attributes.position.array.set(result.positions); refreshed(); return true;
  }
  function settings() { return { brush, radius, strength: Math.min(strength, radius * .2) * .25, symmetry }; }
  function showBrush(hit) {
    hideBrush(); if (!hit || orbit) return;
    const { point, normal } = brushHit(hit), matrix = new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const worldScale = mesh.getWorldScale(new T.Vector3());
    rings.forEach((ring, index) => {
      if (index && (!symmetry || Math.abs(point.x) < radius * .04)) return;
      const p = point.clone(), n = normal.clone(); if (index) { p.x *= -1; n.x *= -1; }
      mesh.localToWorld(p); n.applyMatrix3(matrix).normalize();
      ring.position.copy(p).addScaledVector(n, .004); ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n);
      ring.scale.setScalar(radius * Math.max(worldScale.x, worldScale.y, worldScale.z)); ring.visible = true;
    });
  }
  function pixelSpacing(hit) {
    const worldRadius = radius * mesh.getWorldScale(new T.Vector3()).length() / Math.sqrt(3);
    const right = new T.Vector3(1, 0, 0).applyQuaternion(ctx.camera.quaternion);
    const a = hit.point.clone().project(ctx.camera), b = hit.point.clone().addScaledVector(right, worldRadius).project(ctx.camera);
    const pixels = Math.hypot((b.x - a.x) * canvas.clientWidth / 2, (b.y - a.y) * canvas.clientHeight / 2);
    return T.MathUtils.clamp(pixels * .18, 2, 12);
  }
  function stopStroke(commit = true) {
    const stroke = activeStroke; if (!stroke) return;
    activeStroke = null;
    if (canvas.hasPointerCapture(stroke.pointerId)) canvas.releasePointerCapture(stroke.pointerId);
    if (!commit) { mesh.geometry.attributes.position.array.set(stroke.before); refreshed(); }
    else if (stroke.changed) { pushUndo(stroke.before); strokes++; }
    report(commit ? undefined : 'stroke canceled'); modeCursor(); hideBrush(); ctx.invalidate();
  }
  function reset() {
    stopStroke(false); mesh.geometry.dispose(); mesh.geometry = createClayGeometry(preset);
    neighbors = vertexNeighbors(mesh.geometry.index.array, mesh.geometry.attributes.position.count);
    refreshed(); undo = []; strokes = 0; undoButton.disabled = true; hideBrush(); report('fresh clay'); ctx.fit(mesh);
  }
  ui.section('Clay & brush');
  ui.select('Starting form', ['Pebble', 'Vessel', 'Creature'], preset, value => { preset = value; reset(); });
  ui.select('Brush', ['Inflate', 'Smooth', 'Flatten', 'Crease'], brush, value => { stopStroke(); brush = value; });
  ui.select('Pointer mode', ['Sculpt', 'Orbit'], 'Sculpt', value => { stopStroke(); orbit = value === 'Orbit'; hideBrush(); modeCursor(); ctx.invalidate(); });
  ui.range('Radius', { min: .1, max: .65, step: .01, value: radius, onChange: value => { radius = value; hideBrush(); ctx.invalidate(); } });
  ui.range('Strength', { min: .005, max: .09, step: .005, value: strength, onChange: value => { strength = value; } });
  ui.toggle('Mirror across X', symmetry, value => { symmetry = value; hideBrush(); ctx.invalidate(); });
  ui.toggle('Wireframe', false, value => { mesh.material.wireframe = value; ctx.invalidate(); });
  ui.select('Clay finish', [{ label: 'Terracotta', value: '0xcb9177' }, { label: 'Porcelain', value: '0xe7ece1' }, { label: 'Sage', value: '0xb8cd99' }], '0xcb9177', value => { mesh.material.color.setHex(Number(value)); ctx.invalidate(); });
  ui.section('Shape history');
  ui.button('Stamp front', () => {
    stopStroke(); const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal;
    let index = 0; for (let i = 1; i < p.count; i++) if (p.getZ(i) > p.getZ(index)) index = i;
    const before = p.array.slice(); mesh.updateWorldMatrix(true, false);
    if (dab({ point: mesh.localToWorld(new T.Vector3().fromBufferAttribute(p, index)), normal: new T.Vector3().fromBufferAttribute(n, index) }, settings())) { pushUndo(before); strokes++; report(); }
  });
  const undoButton = ui.button('Undo stroke', () => { stopStroke(false); const previous = undo.pop(); if (!previous) return; mesh.geometry.attributes.position.array.set(previous); strokes = Math.max(0, strokes - 1); refreshed(); undoButton.disabled = !undo.length; hideBrush(); report('stroke undone'); });
  ui.button('Reset clay', reset); ui.button('Export sculpture OBJ', () => { stopStroke(); ctx.exportOBJ(mesh, 'digital-clay.obj'); });
  ui.note('Drag on the surface. Right-drag to orbit; scroll to zoom. Strokes are spaced by distance, so moving slowly or holding still does not dig deeper.');
  // Capture phase gives sculpting ownership before OrbitControls starts a drag.
  ctx.listen(canvas, 'pointerdown', event => {
    if (activeStroke) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (orbit || event.button !== 0 || event.altKey) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const hit = intersectionAt(event.clientX, event.clientY); if (!hit) return;
    canvas.focus({ preventScroll: true });
    activeStroke = { pointerId: event.pointerId, before: mesh.geometry.attributes.position.array.slice(), sampler: beginStroke([event.clientX, event.clientY], pixelSpacing(hit)), settings: settings(), changed: false };
    canvas.setPointerCapture(event.pointerId); activeStroke.changed = dab(hit, activeStroke.settings); showBrush(intersectionAt(event.clientX, event.clientY));
  }, { capture: true });
  function moveStroke(event) {
    if (!activeStroke || activeStroke.pointerId !== event.pointerId) return;
    const events = event.getCoalescedEvents?.();
    for (const sample of events?.length ? events : [event]) for (const [x, y] of sampleStroke(activeStroke.sampler, [sample.clientX, sample.clientY])) {
      const hit = intersectionAt(x, y); if (hit) activeStroke.changed = dab(hit, activeStroke.settings) || activeStroke.changed;
    }
  }
  ctx.listen(canvas, 'pointermove', event => {
    if (activeStroke && activeStroke.pointerId !== event.pointerId) return;
    moveStroke(event);
    if (event.buttons && !activeStroke) hideBrush(); else showBrush(intersectionAt(event.clientX, event.clientY));
    ctx.invalidate();
  });
  ctx.listen(canvas, 'pointerup', event => { if (activeStroke?.pointerId === event.pointerId) { moveStroke(event); stopStroke(); } });
  ctx.listen(canvas, 'pointercancel', event => { if (activeStroke?.pointerId === event.pointerId) stopStroke(false); });
  ctx.listen(canvas, 'lostpointercapture', event => { if (activeStroke?.pointerId === event.pointerId) stopStroke(false); });
  ctx.listen(canvas, 'pointerleave', () => { hideBrush(); ctx.invalidate(); });
  ctx.listen(canvas, 'wheel', event => { if (activeStroke) { event.preventDefault(); event.stopImmediatePropagation(); } hideBrush(); }, { capture: true, passive: false });
  ctx.listen(canvas, 'keydown', event => { if (event.key === 'Escape') { stopStroke(false); event.preventDefault(); } });
  ctx.listen(window, 'blur', () => stopStroke(false));
  ctx.listen(document, 'visibilitychange', () => { if (document.hidden) stopStroke(false); });
  modeCursor(); reset();
  return {
    deactivate() { stopStroke(false); hideBrush(); },
    activate() { modeCursor(); hideBrush(); },
    dispose() { stopStroke(false); controls.enabled = previousControls.enabled; controls.enableDamping = previousControls.damping; controls.mouseButtons.RIGHT = previousControls.right; canvas.style.cursor = ''; undo = []; preview.removeFromParent(); ringGeometry.dispose(); rings.forEach(ring => ring.material.dispose()); },
  };
}
