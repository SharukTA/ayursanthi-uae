// Utility for parsing and serializing Terms & Conditions sections.
// Allows storing structured sections as markdown in Page.body while giving the user
// an Amazon-style section builder experience in the admin and sticky TOC on the frontend.

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parses a markdown body into an array of structured section objects.
 * Format expected:
 * ## 1. Section Title
 * Paragraph 1 text...
 * 
 * ## 2. Next Section Title
 * Paragraph 2 text...
 */
export function parseTermsSections(body = "") {
  if (!body || typeof body !== "string") return [];

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let currentSection = null;
  let introLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      // Save previous section if present
      if (currentSection) {
        currentSection.body = currentSection.bodyLines.join("\n").trim();
        sections.push(currentSection);
      } else if (introLines.length > 0) {
        // Content before the first ## heading
        const introText = introLines.join("\n").trim();
        if (introText) {
          sections.push({
            id: "section-overview",
            number: "0",
            title: "Overview",
            cleanTitle: "Overview",
            body: introText,
            slug: "overview",
          });
        }
      }

      const rawTitle = trimmed.slice(3).trim();
      // Match leading number like "1. Acceptance of Terms" or "Section 1 - Terms"
      const numMatch = rawTitle.match(/^(\d+[\.\)]?|Section\s+\d+[:\.]?)\s*(.*)/i);
      const number = numMatch ? numMatch[1].replace(/[\.\)]/, "") : String(sections.length + 1);
      const title = numMatch && numMatch[2] ? numMatch[2] : rawTitle;
      const slug = slugify(rawTitle) || `section-${sections.length + 1}`;

      currentSection = {
        id: `section-${slug}`,
        number,
        title: rawTitle,
        cleanTitle: title,
        bodyLines: [],
        slug,
      };
    } else {
      if (currentSection) {
        currentSection.bodyLines.push(line);
      } else {
        introLines.push(line);
      }
    }
  }

  if (currentSection) {
    currentSection.body = currentSection.bodyLines.join("\n").trim();
    sections.push(currentSection);
  } else if (introLines.length > 0 && sections.length === 0) {
    const introText = introLines.join("\n").trim();
    if (introText) {
      sections.push({
        id: "section-general",
        number: "1",
        title: "General Terms",
        cleanTitle: "General Terms",
        body: introText,
        slug: "general-terms",
      });
    }
  }

  return sections;
}

/**
 * Serializes an array of section objects back into formatted markdown text for database storage.
 * @param {Array<{title: string, body: string}>} sections 
 */
export function serializeTermsSections(sections = []) {
  if (!Array.isArray(sections) || sections.length === 0) return "";

  return sections
    .map((sec) => {
      const title = (sec.title || "").trim();
      const body = (sec.body || "").trim();
      if (!title) return body;
      return `## ${title}\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
