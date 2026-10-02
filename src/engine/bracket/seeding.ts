export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Standard single-elimination seed order: 1v8, 4v5, 2v7, 3v6 for eight entrants.
 *
 * Built by repeated mirroring, so the top seeds meet as late as possible and the
 * byes that pad a short field land on the strongest players.
 */
export function standardSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const round = order.length * 2;
    const mirrored: number[] = [];
    for (const seed of order) {
      mirrored.push(seed, round + 1 - seed);
    }
    order = mirrored;
  }
  return order;
}
