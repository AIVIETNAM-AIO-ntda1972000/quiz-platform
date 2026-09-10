export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "quiz-platform:theme";

export const THEME_COLORS: Record<Theme, string> = {
  light: "#171c5b",
  dark: "#0b1026"
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;
type ThemeMediaQuery = Pick<MediaQueryList, "matches">;

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function browserThemeQuery(): MediaQueryList | undefined {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : undefined;
}

export function getSavedTheme(storage: StorageReader | undefined = browserStorage()): Theme | undefined {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function resolveTheme(
  storage: StorageReader | undefined = browserStorage(),
  mediaQuery: ThemeMediaQuery | undefined = browserThemeQuery()
): Theme {
  return getSavedTheme(storage) ?? (mediaQuery?.matches ? "dark" : "light");
}

export function saveThemePreference(
  theme: Theme,
  storage: StorageWriter | undefined = browserStorage()
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The active theme still works when browser storage is unavailable.
  }
}

export function applyTheme(theme: Theme, documentRoot: Document = document): void {
  documentRoot.documentElement.dataset.theme = theme;
  documentRoot.documentElement.style.colorScheme = theme;
  documentRoot.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function getThemeMediaQuery(): MediaQueryList | undefined {
  return browserThemeQuery();
}
