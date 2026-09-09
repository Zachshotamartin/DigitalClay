/** Spatial samples, independent of event frequency or time spent holding still. */
export function beginStroke(point, spacing) {
  if (!point.every(Number.isFinite) || !(spacing > 0) || !Number.isFinite(spacing)) throw new RangeError('Invalid stroke sample.');
  return { previous: [...point], remaining: spacing, spacing };
}

export function sampleStroke(stroke, point) {
  if (!point.every(Number.isFinite)) throw new RangeError('Invalid stroke sample.');
  const from = stroke.previous, dx = point[0] - from[0], dy = point[1] - from[1], length = Math.hypot(dx, dy), samples = [];
  let distance = stroke.remaining;
  while (distance <= length + 1e-8) {
    const t = Math.min(1, distance / length);
    if (length > 0) samples.push([from[0] + dx * t, from[1] + dy * t]);
    distance += stroke.spacing;
  }
  stroke.remaining = Math.max(1e-8, distance - length); stroke.previous = [...point];
  return samples;
}
