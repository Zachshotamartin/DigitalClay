import test from 'node:test';
import assert from 'node:assert/strict';
import { beginStroke, sampleStroke } from '../src/stroke.js';

test('collinear input event subdivisions produce the same spatial stroke samples', () => {
  const run = count => { const stroke = beginStroke([10, 20], 6.3), samples = []; for (let i = 1; i <= count; i++) samples.push(...sampleStroke(stroke, [10 + 130 * i / count, 20])); return samples; };
  const fast = run(2), slow = run(60); assert.equal(fast.length, slow.length);
  for (let i = 0; i < fast.length; i++) assert.ok(Math.hypot(fast[i][0] - slow[i][0], fast[i][1] - slow[i][1]) < 1e-9);
});

test('stationary events add no dabs and curved paths carry residual spacing across segments', () => {
  const stroke = beginStroke([0, 0], 5);
  assert.deepEqual(sampleStroke(stroke, [0, 0]), []);
  assert.deepEqual(sampleStroke(stroke, [3, 0]), []);
  assert.deepEqual(sampleStroke(stroke, [3, 7]), [[3, 2], [3, 7]]);
  assert.deepEqual(sampleStroke(stroke, [3, 7]), []);
  assert.throws(() => beginStroke([0, 0], 0), RangeError);
});
