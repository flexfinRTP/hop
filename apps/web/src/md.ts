export const ARTICLES: { slug: string; file: string; k: string; group: string }[] = [
  { slug: "overview", file: "README.md", k: "Overview", group: "Start" },
  { slug: "agents", file: "agents.md", k: "Agents", group: "Start" },
  { slug: "hedera-x402", file: "hedera-x402.md", k: "Hedera x402", group: "Rails" },
  { slug: "architecture", file: "architecture.md", k: "Architecture", group: "Rails" },
  { slug: "the-graph", file: "the-graph.md", k: "The Graph", group: "Rails" },
  { slug: "chainlink-cre", file: "chainlink-cre.md", k: "Chainlink CRE", group: "Rails" },
  { slug: "evidence", file: "evidence.md", k: "Evidence", group: "Rails" },
  { slug: "hedera-ats", file: "hedera-ats.md", k: "Hedera ATS", group: "Extra" },
  { slug: "liquidation", file: "chainlink-liquidation.md", k: "Liquidation", group: "Extra" },
  { slug: "operator", file: "operator.md", k: "Operator", group: "Extra" },
];

const ARTICLE_BY_FILE: Record<string, string> = Object.fromEntries(
  ARTICLES.map((article) => [article.file, article.slug]),
);

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rewriteHref(href: string): string {
  const clean = href.trim();
  const file = clean.split("/").pop() ?? "";
  if (file === "openapi.yaml") return "/docs/api";
  if (file === "SKILL.md") return "/docs/skill";
  if (file === "llms.txt") return "/docs/llms";
  if (file === "README.md" && clean.includes("documentation")) return "/docs/overview";
  const slug = ARTICLE_BY_FILE[file];
  if (slug) return `/docs/${slug}`;
  return clean;
}

function inline(value: string): string {
  let out = escapeHtml(value);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    const target = rewriteHref(href);
    const ext = /^https?:/i.test(target);
    return `<a href="${escapeHtml(target)}"${ext ? ' target="_blank" rel="noreferrer"' : ""}>${label}</a>`;
  });
  return out;
}

function renderTable(block: string): string {
  const rows = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));
  if (rows.length < 2) return `<p>${inline(block)}</p>`;
  const cells = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  return `<table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body
    .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function renderList(block: string, ordered: boolean): string {
  const items = block.split("\n").map((line) => line.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ""));
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`;
}

export function renderMarkdown(src: string): string {
  const stripped = src.replace(/^---\n[\s\S]*?\n---\n/, "");
  const fences: string[] = [];
  const prepared = stripped.replace(/\r\n/g, "\n").replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const i = fences.length;
    fences.push(
      `<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`,
    );
    return `\n\n%%FENCE${i}%%\n\n`;
  });

  return prepared
    .split(/\n{2,}/)
    .map((block) => {
      const text = block.trim();
      if (!text) return "";
      const fence = text.match(/^%%FENCE(\d+)%%$/);
      if (fence) return fences[Number(fence[1])] ?? "";
      if (text.startsWith("# ")) return `<h1>${inline(text.slice(2))}</h1>`;
      if (text.startsWith("## ")) return `<h2>${inline(text.slice(3))}</h2>`;
      if (text.startsWith("### ")) return `<h3>${inline(text.slice(4))}</h3>`;
      if (text.includes("\n|") || text.startsWith("|")) return renderTable(text);
      if (/^[-*] /.test(text)) return renderList(text, false);
      if (/^\d+\. /.test(text)) return renderList(text, true);
      return `<p>${inline(text.replace(/\n/g, " "))}</p>`;
    })
    .join("\n");
}
