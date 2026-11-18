import MarkdownIt from "markdown-it";
import MarkdownItAttrs from "markdown-it-attrs";
import MarkdownItDiv from "markdown-it-div";
import sanitizeHtml from "sanitize-html";

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});
markdown.use(MarkdownItAttrs);
markdown.use(MarkdownItDiv);

/** Sanitize after parsing so embedded HTML and Markdown attributes share one boundary. */
export function renderMarkdown(source: string): string {
  return sanitizeHtml(markdown.render(source), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["class", "id", "title"],
      a: ["href", "name", "target", "rel", "title"],
      ol: ["start"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    // Inline styles are excluded above; no CSS parsing is needed in either runtime.
    parseStyleAttributes: false,
    transformTags: {
      a: (tagName, attributes) => ({
        tagName,
        attribs:
          attributes.target === "_blank"
            ? { ...attributes, rel: "noopener noreferrer" }
            : attributes,
      }),
    },
  });
}
