import { beforeEach, describe, expect, it } from "vitest";
import { applyTheme, getSavedTheme, resolveTheme, saveThemePreference, THEME_COLORS, THEME_STORAGE_KEY } from "./theme";

describe("theme preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
    document.head.innerHTML = '<meta name="theme-color" content="#171c5b">';
  });

  it("uses a valid saved preference before the system preference", () => {
    const storage = { getItem: () => "dark" };
    expect(resolveTheme(storage, { matches: false })).toBe("dark");
  });

  it("follows the system when no valid preference is saved", () => {
    expect(resolveTheme({ getItem: () => null }, { matches: true })).toBe("dark");
    expect(resolveTheme({ getItem: () => "unsupported" }, { matches: false })).toBe("light");
  });

  it("falls back safely when storage is unavailable", () => {
    const unavailableStorage = { getItem: () => { throw new Error("blocked"); } };
    expect(getSavedTheme(unavailableStorage)).toBeUndefined();
    expect(resolveTheme(unavailableStorage, { matches: true })).toBe("dark");
    expect(() => saveThemePreference("dark", { setItem: () => { throw new Error("blocked"); } })).not.toThrow();
  });

  it("saves and applies a selected theme", () => {
    saveThemePreference("dark");
    applyTheme("dark");

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", THEME_COLORS.dark);
  });
});
