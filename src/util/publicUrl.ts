/** Resolve a path under Vite `base` (e.g. `/thomas-verden/` on GitHub Pages). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const clean = path.replace(/^\//, '');
  return `${base}${clean}`;
}
