export function formatStars(value: number) {
  const v = Math.max(0, Math.min(5, value));
  const full = Math.floor(v);
  const half = v - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return `${"★".repeat(full)}${half ? "½" : ""}${"☆".repeat(empty)}`;
}

export function ratingOptions(step = 0.5) {
  const opts: number[] = [];
  for (let v = 1; v <= 5 + 1e-9; v += step) opts.push(Math.round(v * 2) / 2);
  return opts;
}



