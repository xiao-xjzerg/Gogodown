(() => {
  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function boxesOverlap(a, b) {
    return (
      a.min.x <= b.max.x &&
      a.max.x >= b.min.x &&
      a.min.y <= b.max.y &&
      a.max.y >= b.min.y &&
      a.min.z <= b.max.z &&
      a.max.z >= b.min.z
    );
  }

  function pickWeighted(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let cursor = Math.random() * total;

    for (const [key, weight] of entries) {
      cursor -= weight;
      if (cursor <= 0) {
        return key;
      }
    }

    return entries[entries.length - 1][0];
  }

  window.GogoUtils = Object.freeze({
    randomRange,
    randomInt,
    clamp,
    lerp,
    boxesOverlap,
    pickWeighted
  });
})();
