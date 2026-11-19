// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/utils/markdown";

describe("sanitized Markdown", () => {
  it("keeps Markdown, embedded formatting, images, and presentation classes", () => {
    const html = renderMarkdown(
      '**Important**{.highlight}\n\n<div class="note" id="details"><em>Embedded HTML</em></div>\n\n![Map](https://example.test/map.png)',
    );
    expect(html).toContain('<strong class="highlight">Important</strong>');
    expect(html).toContain(
      '<div class="note" id="details"><em>Embedded HTML</em></div>',
    );
    expect(html).toContain('src="https://example.test/map.png"');
  });

  it("removes scripts, event handlers, inline styles, and embedded frames", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\n<img src="https://example.test/map.png" onerror="alert(1)" style="position:fixed">\n\n<iframe src="https://example.test"></iframe>\n\n**Text**{onclick=alert(1)}',
    );
    expect(html).not.toMatch(
      /script|onerror|onclick|style=|iframe|alert\(1\)/i,
    );
    expect(html).toContain('src="https://example.test/map.png"');
  });

  it.each([
    "javascript:alert(1)",
    "jAvAsCrIpT:alert(1)",
    "&#106;avascript:alert(1)",
    "data:text/html,test",
  ])("removes unsafe link URL %s", (url) => {
    const html = renderMarkdown(`<a href="${url}">Link</a>`);
    expect(html).not.toContain("href=");
    expect(html).toContain("Link");
  });

  it("preserves normal links and protects links that open another tab", () => {
    const html = renderMarkdown(
      '[Example](https://example.test)\n\n<a href="https://example.test" target="_blank" rel="opener">New tab</a>',
    );
    expect(html).toContain('href="https://example.test"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  });
});
