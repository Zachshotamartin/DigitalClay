import test from 'node:test';
import assert from 'node:assert/strict';
import { createClayGeometry, vertexNeighbors, sculptDab } from '../src/sculpt.js';

function fixture() {
  const g = createClayGeometry();
  return { g, positions: g.attributes.position.array, normals: g.attributes.normal.array, neighbors: vertexNeighbors(g.index.array, g.attributes.position.count), center: [0, 0, 1], normal: [0, 0, 1], radius: 0.4, strength: 0.05 };
}
test('inflation changes only the brush neighborhood and leaves the input and topology intact', () => {
  const f = fixture(), before = f.positions.slice(), result = sculptDab(f);
  assert.ok(result.affected > 2); assert.ok(result.affected < f.positions.length / 6);
  assert.deepEqual(f.positions, before); assert.ok(result.maxDisplacement > 0 && result.maxDisplacement <= 0.051);
  for (let i = 0; i < before.length; i += 3) if (Math.hypot(before[i], before[i + 1], before[i + 2] - 1) >= f.radius) assert.deepEqual(result.positions.slice(i, i + 3), before.slice(i, i + 3));
  assert.equal(result.positions.length, before.length); f.g.dispose();
});
test('flattening reduces distance to a plane and smoothing reduces a spike', () => {
  const f = fixture(); const flat = sculptDab({ ...f, brush: 'Flatten' });
  let a = 0, b = 0;
  for (let i = 0; i < f.positions.length; i += 3) if (Math.hypot(f.positions[i], f.positions[i + 1], f.positions[i + 2] - 1) < f.radius) { a += (f.positions[i + 2] - 1) ** 2; b += (flat.positions[i + 2] - 1) ** 2; }
  assert.ok(b < a);
  const modified = f.positions.slice(); modified[2] += 0.15;
  const smooth = sculptDab({ ...f, positions: modified, center: [...modified.slice(0, 3)], brush: 'Smooth' });
  assert.ok(Math.abs(smooth.positions[2] - f.positions[2]) < Math.abs(modified[2] - f.positions[2])); f.g.dispose();
});
test('mirrored dabs reach both sides, crease differs from inflation, invalid radius is rejected', () => {
  const f = fixture(), center = [0.5, 0, 0.88];
  const result = sculptDab({ ...f, center, symmetry: true });
  let left = 0, right = 0;
  for (let i = 0; i < f.positions.length; i += 3) if (result.positions[i + 2] !== f.positions[i + 2]) { if (f.positions[i] < 0) left++; else right++; }
  assert.ok(left > 0 && right > 0); assert.notDeepEqual(sculptDab({ ...f, brush: 'Crease' }).positions, sculptDab(f).positions);
  assert.throws(() => sculptDab({ ...f, radius: 0 }), RangeError); f.g.dispose();
});

test('the higher-resolution mesh is welded and closed without duplicate seams or pole fans', () => {
  for (const preset of ['Pebble', 'Vessel', 'Creature']) {
    const g = createClayGeometry(preset), p = g.attributes.position, index = g.index.array, edges = new Map(), unique = new Set();
    assert.equal(p.count, 10242);
    for (let i = 0; i < p.count; i++) unique.add([p.getX(i), p.getY(i), p.getZ(i)].map(x => Math.round(x * 1e6)).join(','));
    assert.equal(unique.size, p.count);
    for (let i = 0; i < index.length; i += 3) for (let k = 0; k < 3; k++) { const a = index[i + k], b = index[i + (k + 1) % 3], key = a < b ? a + ':' + b : b + ':' + a; edges.set(key, (edges.get(key) || 0) + 1); }
    assert.ok([...edges.values()].every(count => count === 2));
    assert.ok(vertexNeighbors(index, p.count).every(list => list.length >= 5 && list.length <= 6));
    assert.ok([...g.attributes.normal.array].every(Number.isFinite)); g.dispose();
  }
});

test('brushes leave oppositely facing nearby surfaces alone and bound high-strength dabs', () => {
  const f = fixture(), normals = new Float32Array(f.normals.length); for (let i = 2; i < normals.length; i += 3) normals[i] = -1;
  const back = sculptDab({ ...f, normals }); assert.equal(back.affected, 0); assert.deepEqual(back.positions, f.positions);
  const strong = sculptDab({ ...f, radius: .1, strength: .2 }); assert.ok(strong.maxDisplacement <= .1 * .12 + 1e-8);
  const normalized = sculptDab({ ...f, normal: [0, 0, 9] }); assert.deepEqual(normalized.positions, sculptDab(f).positions); f.g.dispose();
});
