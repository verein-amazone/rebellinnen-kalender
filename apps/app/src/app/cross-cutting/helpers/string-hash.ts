const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * The app's one string hash: 32-bit FNV-1a over the UTF-16 code units, as an unsigned integer.
 *
 * For stable, deterministic picks and ids - the same input gives the same number on every device
 * and every launch, with nothing stored. Not cryptographic: `crypto.subtle` is the tool for that,
 * and it is async, which none of the callers can be. `seed` continues a previous result, so a long
 * input can be hashed piece by piece (`stringHash(b, stringHash(a))` equals `stringHash(a + b)`),
 * and a different seed gives an independent second hash of the same input.
 */
export function stringHash(input: string, seed: number = FNV_OFFSET_BASIS): number {
  let hash = seed;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), FNV_PRIME);
  }
  return hash >>> 0;
}
