export function selectWeightedRandomDistinct<T>({
  values,
  count,
  getWeight,
  random = Math.random,
}: {
  values: readonly T[];
  count: number;
  getWeight: (value: T) => number;
  random?: () => number;
}): T[] {
  const normalizedCount = Math.max(0, Math.trunc(count));
  if (values.length < normalizedCount) {
    throw new Error(
      `Impossible de tirer ${normalizedCount} valeurs distinctes parmi ${values.length}.`,
    );
  }

  const remaining = [...values];
  const selected: T[] = [];
  while (selected.length < normalizedCount) {
    const weights = remaining.map((value) => {
      const weight = getWeight(value);
      return Number.isFinite(weight) ? Math.max(0, weight) : 0;
    });
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    const normalizedRandom = Math.min(
      1 - Number.EPSILON,
      Math.max(0, random()),
    );
    let selectedIndex = 0;

    if (totalWeight > 0) {
      let cursor = normalizedRandom * totalWeight;
      selectedIndex = weights.length - 1;
      for (let index = 0; index < weights.length; index += 1) {
        cursor -= weights[index]!;
        if (cursor < 0) {
          selectedIndex = index;
          break;
        }
      }
    } else {
      selectedIndex = Math.floor(normalizedRandom * remaining.length);
    }

    selected.push(remaining[selectedIndex]!);
    remaining.splice(selectedIndex, 1);
  }

  return selected;
}
