// ROLE: Validate and normalize relative food image paths for the admin config. No fetch or UI.

const ALLOWED_PATH = /^[A-Za-z0-9._/-]+$/;

export const FOOD_IMAGE_PATH_RULE =
  'Use a relative path such as "apple.svg" or "food/apple.svg"; absolute paths, "..", backslashes and URLs are not allowed.';

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Trim accidental whitespace and collapse a leading "./" for display/preview use. */
export function sanitizeFoodImagePath(value: string): string {
  return value.trim().replace(/^(?:\.\/)+/, "");
}

/** Empty means "no image". Everything else must be a plain relative file path. */
export function isSafeFoodImagePath(value: string): boolean {
  if (value === "") return true;
  if (hasControlCharacter(value)) return false;
  if (value.includes("\\") || value.includes("..")) return false;
  if (value.startsWith("/")) return false;
  return ALLOWED_PATH.test(value);
}

export interface FoodImagePathEntry {
  image?: string;
}

/** Returns the first unsafe image path as a user-facing message, or null when all are safe. */
export function validateFoodImagePaths(types: readonly FoodImagePathEntry[]): string | null {
  for (let index = 0; index < types.length; index += 1) {
    const value = types[index]?.image ?? "";
    if (isSafeFoodImagePath(value)) continue;
    return `Food type ${index + 1}: image path ${JSON.stringify(value)} is not allowed. ${FOOD_IMAGE_PATH_RULE}`;
  }
  return null;
}
