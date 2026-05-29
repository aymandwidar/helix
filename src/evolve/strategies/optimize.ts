export const optimizeNotes = `
Optimize checklist:
- Pick a category (perf / a11y / SEO / DX / bundle size) and stay focused
- Justify each change with a concrete metric or guideline (e.g. "next/image avoids layout shift", "missing aria-label on icon button")
- Don't introduce new dependencies without measurable payoff
- For perf wins, prefer cheap structural changes (memoize, lazy import, image optimization) over architectural rewrites
`.trim();
