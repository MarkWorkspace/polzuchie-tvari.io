// ROLE: Regression tests for the food image path allowlist.
import { describe, expect, it } from "vitest";
import {
  isSafeFoodImagePath,
  sanitizeFoodImagePath,
  validateFoodImagePaths,
} from "./foodImagePath";

describe("isSafeFoodImagePath", () => {
  it("accepts empty values and relative file paths", () => {
    for (const value of ["", "apple.svg", "food/apple.svg", "./apple.svg", "a-b_c.1.svg"]) {
      expect(isSafeFoodImagePath(value), value).toBe(true);
    }
  });

  it("rejects absolute paths, traversal, backslashes, URLs and control characters", () => {
    for (const value of [
      "../x",
      "food/../x",
      "/abs",
      "//evil.example/x.svg",
      "http://evil.example/x.svg",
      "https://evil.example/x.svg",
      "a\\b",
      "C:/x.svg",
      "food apple.svg",
      "apple.svg\n",
    ]) {
      expect(isSafeFoodImagePath(value), value).toBe(false);
    }
  });
});

describe("sanitizeFoodImagePath", () => {
  it("trims whitespace and a leading dot-slash", () => {
    expect(sanitizeFoodImagePath("  food/apple.svg  ")).toBe("food/apple.svg");
    expect(sanitizeFoodImagePath("./apple.svg")).toBe("apple.svg");
  });

  it("does not turn an unsafe traversal path into a safe one", () => {
    expect(sanitizeFoodImagePath("../x")).toBe("../x");
  });
});

describe("validateFoodImagePaths", () => {
  it("returns null when every image is empty or relative", () => {
    expect(validateFoodImagePaths([{ image: "apple.svg" }, {}, { image: "" }])).toBeNull();
  });

  it("returns the first unsafe image with its food type index", () => {
    const message = validateFoodImagePaths([
      { image: "apple.svg" },
      { image: "../secret.svg" },
      { image: "http://evil.example/x.svg" },
    ]);

    expect(message).toContain("Food type 2");
    expect(message).toContain("../secret.svg");
    expect(message).toContain("not allowed");
  });
});
