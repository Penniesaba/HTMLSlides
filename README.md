# md-slides

[中文文档](README_zh.md)

`md-slides` converts standards-compliant Markdown into a self-contained HTML slide deck. The generated file includes the cover, table of contents, section hierarchy, navigation, page numbers, and embedded local images without external assets or a build system.

## What it provides

- A fixed Markdown-to-slides workflow for Claude Code and Codex.
- A single HTML output file that can be shared independently.
- Consistent cover, table of contents, headings, pagination, keyboard controls, click navigation, overview mode, and deep links.
- Local image embedding as `data:image/...;base64,...` data URIs.
- A zero-dependency Node.js validator for Markdown structure and generated HTML.

## Installation

### Claude Code

Install `md-slides` from the marketplace with:

```text
/plugin marketplace add <owner>/<repo>
/plugin install md-slides@md-slides-marketplace
```

For local development, load the plugin directory directly:

```bash
claude --plugin-dir /path/to/plugins/md-slides
```

The plugin can be invoked through natural language or the `/md-slides:build-slides` command.

### Codex

Install the marketplace and plugin with:

```bash
codex plugin marketplace add <owner>/<repo> --ref main
codex plugin add md-slides@md-slides-marketplace
```

For local development, add the repository root as a marketplace and install `md-slides` from `plugins/md-slides/`. The skill can be invoked through natural language, `$build-slides`, or `/build-slides` when supported by the installed Codex version.

## Input requirements

The input must be a Markdown document that follows the project standard defined in [`plugins/md-slides/skills/build-slides/references/markdown-standard.md`](plugins/md-slides/skills/build-slides/references/markdown-standard.md).

- Frontmatter supplies the cover metadata: `title`, `subtitle`, `kicker`, `author`, `date`, and `lang`.
- A line containing only `---` separates pages. Separators inside fenced code blocks are preserved.
- H1, H2, and H3 headings define the section hierarchy. Section numbers are used for validation and table-of-contents matching, then removed from visible titles.
- Lines beginning with `>` are author comments. They are ignored during classification, density checks, image checks, and rendering.
- Local relative image paths are resolved from the Markdown file and embedded into the generated HTML.
- Markdown files must not contain a hand-written cover page; the cover is generated from frontmatter.

## Output behavior

- The output is written next to the source Markdown file using the same base name and an `.html` extension.
- An existing HTML file is overwritten only when it contains the `md-slides` template marker. Otherwise, the generator uses a `.slides.html` suffix and protects the existing file.
- The deck contains the generated cover, one slide for each source page, and an automatically generated table of contents when the source does not provide one.
- The cover counts toward the total page count but hides the page number. Other slides show their current and total page numbers.
- The table of contents uses H1 and H2 headings, does not display section numbers, and supports direct navigation.
- Every generated deck is self-contained. Images are embedded, and no CDN, external font, iframe, or network request is required.

## Page model

- `---` is the only page-break signal. The agent does not split or combine pages based on density.
- A page with only one H1 and a short optional description is rendered as a section divider.
- A page with content uses the heading algorithm defined by the page model: the deepest applicable heading becomes the title, while its H1/H2 ancestors become the breadcrumb.
- A page with multiple H3 headings uses the surrounding H2 as its title. A page with multiple H2 headings uses the surrounding H1 without a breadcrumb.
- A page without a heading continues the preceding page and appends the continuation marker.
- A source table of contents is used when present; otherwise, one is generated from the document headings.

The full page model is documented in [`plugins/md-slides/skills/build-slides/references/page-model.md`](plugins/md-slides/skills/build-slides/references/page-model.md). Style rules are in [`plugins/md-slides/skills/build-slides/references/style-spec.md`](plugins/md-slides/skills/build-slides/references/style-spec.md), and reusable layout patterns are in [`plugins/md-slides/skills/build-slides/references/recipes.md`](plugins/md-slides/skills/build-slides/references/recipes.md).

## Presentation behavior

- White background, dark text, thin dividers, and a dark red accent color.
- System sans-serif and monospace fonts with no external font dependency.
- Arrow keys, Space, Page Up, and Page Down move between slides; Home and End jump to the first and last slide.
- Clicking the left or right side of the viewport moves backward or forward.
- Escape toggles the slide overview.
- Hash links such as `#s3` open a specific slide.
- A fixed progress bar and page number provide navigation context.
- Dense slides are scaled first and become scrollable only when scaling cannot fit the content.

## Validation

Run the validator from the repository root with:

```bash
node plugins/md-slides/scripts/validate.mjs <input.md> <output.html>
```

Exit code `0` means the structure passed; warnings may still be printed. Exit code `1` indicates a structural error such as a missing template marker, incorrect slide count, modified template CSS or JavaScript, external resources, or a non-data-URI image.

The validator and test suite require Node.js 18 or later and have no package dependencies. Run the tests from the plugin directory with:

```bash
node --test scripts/validate.test.mjs
```

When Node.js is unavailable, use the self-check list at the end of [`SKILL.md`](plugins/md-slides/skills/build-slides/SKILL.md).

## Current limits

- The default interface is optimized for Chinese content. English body text is supported through `lang: en`, while interface labels remain Chinese.
- PPTX and PDF export are not provided.
- Multiple themes, a theme editor, and brand customization are outside the current scope.
- The agent does not create images or access the network.
- Dense content produces warnings and uses scaling or scrolling as a fallback.
- Table-of-contents matching is exact after number removal, case folding, and whitespace normalization; abbreviations are not matched heuristically.

## Repository layout

- `plugins/md-slides/.claude-plugin/` and `plugins/md-slides/.codex-plugin/` contain the platform manifests.
- `plugins/md-slides/skills/build-slides/` contains the build workflow and its reference documents.
- `plugins/md-slides/assets/template.html` is the fixed HTML/CSS/JavaScript template.
- `plugins/md-slides/scripts/` contains the validator and its tests.
- `plugins/md-slides/commands/` contains the Claude Code command definition.
