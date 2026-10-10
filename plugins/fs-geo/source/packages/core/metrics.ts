export interface Brand {
  name: string;
  aliases: string[];
  domains: string[];
  competitors: string[];
}
export interface AnswerRow {
  answer: string;
  state: string;
  branded: boolean;
  citations: string[];
  citationState: string;
}
export function matchBrands(text: string, brand: Brand) {
  const normalized = text.normalize("NFKC");
  const results: {
    brand: string;
    alias: string;
    position: number;
    snippet: string;
  }[] = [];
  for (const [name, aliases] of [
    [brand.name, [brand.name, ...brand.aliases]],
    ...brand.competitors.map((name) => [name, [name]]),
  ] as [string, string[]][]) {
    let first: (typeof results)[number] | undefined;
    for (const alias of aliases) {
      const escaped = alias
        .normalize("NFKC")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const latin = /^[\p{Script=Latin}\p{N}\s._-]+$/u.test(alias);
      const pattern = new RegExp(
        latin ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped,
        "iu",
      );
      const hit = pattern.exec(normalized);
      if (hit && (!first || hit.index < first.position))
        first = {
          brand: name,
          alias,
          position: hit.index,
          snippet: normalized.slice(
            Math.max(0, hit.index - 30),
            hit.index + alias.length + 50,
          ),
        };
    }
    if (first) results.push(first);
  }
  return results.sort((a, b) => a.position - b.position);
}
function ownDomain(url: string, domains: string[]) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}
export function summarize(rows: AnswerRow[], brand: Brand) {
  const valid = rows.filter(
    (row) => row.state === "SUCCEEDED" && row.answer.trim() && !row.branded,
  );
  const matches = valid.map((row) => matchBrands(row.answer, brand));
  const numerator = matches.filter((items) =>
    items.some((item) => item.brand === brand.name),
  ).length;
  const citationRows = valid.filter((row) => row.citationState === "COMPLETE");
  const citations = citationRows.filter((row) =>
    row.citations.some((url) => ownDomain(url, brand.domains)),
  ).length;
  const totalBrands = matches.reduce((sum, items) => sum + items.length, 0);
  return {
    methodologyVersion: "v1",
    validAnswers: valid.length,
    failedAnswers: rows.filter((row) => row.state !== "SUCCEEDED").length,
    excludedBranded: rows.filter((row) => row.branded).length,
    mentions: numerator,
    mentionRate: valid.length ? numerator / valid.length : null,
    citationAnswers: citations,
    measurableCitationAnswers: citationRows.length,
    citationRate: citationRows.length ? citations / citationRows.length : null,
    shareOfVoice: totalBrands ? numerator / totalBrands : null,
  };
}
export function csvCell(value: string) {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
