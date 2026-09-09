import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export function createClayGeometry(preset = 'Pebble') {
  // Uniform welded triangles avoid pole fans and duplicated UV seam vertices.
  const base = new THREE.IcosahedronGeometry(1, 31);
  base.deleteAttribute('normal'); base.deleteAttribute('uv');
  const geometry = mergeVertices(base, 1e-5); base.dispose();
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (preset === 'Vessel') {
      const breadth = 0.78 + 0.18 * Math.cos(y * 3.1);
      p.setXYZ(i, x * breadth, y * 1.25, z * breadth);
    } else if (preset === 'Creature') p.setXYZ(i, x * (0.84 + 0.1 * y), y * 1.1, z * (0.84 + 0.12 * Math.cos(y * 4)));
    else p.setXYZ(i, x * 1.15, y * 0.85, z);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function vertexNeighbors(indices, count) {
  const neighbors = Array.from({ length: count }, () => new Set());
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = [indices[i], indices[i + 1], indices[i + 2]];
    for (let j = 0; j < 3; j++) { neighbors[triangle[j]].add(triangle[(j + 1) % 3]); neighbors[triangle[j]].add(triangle[(j + 2) % 3]); }
  }
  return neighbors.map(set => [...set]);
}

/** One immutable brush dab. Distances and strength are in model-space units. */
export function sculptDab({ positions, normals, neighbors, center, normal, radius = 0.25, strength = 0.04, brush = 'Inflate', symmetry = false }) {
  if (positions.length % 3 || normals.length !== positions.length || center.length !== 3 || normal.length !== 3 || !center.every(Number.isFinite) || !normal.every(Number.isFinite) || Math.hypot(...normal) < 1e-8
    || !Number.isFinite(radius) || radius <= 0 || radius > 1.2 || !Number.isFinite(strength) || Math.abs(strength) > 0.2
    || !['Inflate', 'Smooth', 'Flatten', 'Crease'].includes(brush)) throw new RangeError('Invalid sculpt brush or mesh.');
  const output = new Float32Array(positions), r2 = radius * radius;
  const length = Math.hypot(...normal), axis = normal.map(value => value / length);
  const centers = [center], axes = [axis];
  if (symmetry && Math.abs(center[0]) > 1e-8) { centers.push([-center[0], center[1], center[2]]); axes.push([-axis[0], axis[1], axis[2]]); }
  let affected = 0, maxDisplacement = 0;
  for (let i = 0; i < positions.length; i += 3) {
    let d2 = Infinity, chosen = 0;
    centers.forEach((c, k) => { const d = (positions[i] - c[0]) ** 2 + (positions[i + 1] - c[1]) ** 2 + (positions[i + 2] - c[2]) ** 2; if (d < d2) { d2 = d; chosen = k; } });
    if (d2 >= r2) continue;
    const c = centers[chosen], n = axes[chosen];
    const facing = normals[i] * n[0] + normals[i + 1] * n[1] + normals[i + 2] * n[2];
    if (facing <= 0) continue;
    const falloff = (1 - d2 / r2) ** 2 * Math.min(1, facing * 2);
    const amount = strength * falloff, delta = [0, 0, 0];
    if (brush === 'Smooth') {
      const adjacent = neighbors[i / 3];
      if (!adjacent?.length) continue;
      for (const j of adjacent) for (let k = 0; k < 3; k++) delta[k] += positions[j * 3 + k] / adjacent.length;
      for (let k = 0; k < 3; k++) delta[k] = (delta[k] - positions[i + k]) * Math.min(0.7, Math.abs(amount) * 8);
    } else if (brush === 'Flatten') {
      const distance = (positions[i] - c[0]) * n[0] + (positions[i + 1] - c[1]) * n[1] + (positions[i + 2] - c[2]) * n[2];
      for (let k = 0; k < 3; k++) delta[k] = -n[k] * distance * Math.min(0.75, Math.abs(amount) * 8);
    } else if (brush === 'Crease') {
      const distance = (positions[i] - c[0]) * n[0] + (positions[i + 1] - c[1]) * n[1] + (positions[i + 2] - c[2]) * n[2];
      for (let k = 0; k < 3; k++) delta[k] = -n[k] * amount + (c[k] + n[k] * distance - positions[i + k]) * Math.abs(amount) * 1.5;
    } else for (let k = 0; k < 3; k++) delta[k] = normals[i + k] * amount;
    // Bound displacement relative to neighboring edges instead of moving a
    // narrow, high-strength brush through an entire triangle in one dab.
    let edge = Infinity;
    for (const j of neighbors[i / 3] || []) edge = Math.min(edge, Math.hypot(positions[j * 3] - positions[i], positions[j * 3 + 1] - positions[i + 1], positions[j * 3 + 2] - positions[i + 2]));
    const displacement = Math.hypot(...delta), limit = Math.min(radius * .12, edge * .22);
    if (displacement > limit) for (let k = 0; k < 3; k++) delta[k] *= limit / displacement;
    for (let k = 0; k < 3; k++) output[i + k] += delta[k];
    maxDisplacement = Math.max(maxDisplacement, Math.hypot(...delta)); affected++;
  }
  return { positions: output, affected, maxDisplacement };
}
