# Instruqt Assignment Markdown Reference

Reference for special markdown features available in Instruqt `assignment.md` files. Based on [the official docs](https://docs.instruqt.com/tracks/challenges/using-markdown-editor).

---

## YAML Frontmatter

Every assignment file starts with a YAML frontmatter block defining metadata and tabs.

```yaml
---
slug: my-challenge
id: ""
type: challenge
title: "Challenge Title"
teaser: "Short description shown in the track overview."
tabs:
- type: terminal
  title: Worker
  hostname: workstation
  working_directory: /root/project
- type: terminal
  title: Terminal
  hostname: workstation
  working_directory: /root/project
- type: code
  title: Code Editor
  hostname: workstation
  path: /root/project
- type: service
  title: Web UI
  hostname: workstation
  port: 8080
difficulty: basic
timelimit: 4800
---
```

### Tab Types

| Type | Description | Key Fields |
|---|---|---|
| `terminal` | Opens a terminal on a host | `hostname`, `working_directory` |
| `code` | Opens a code editor to a path on a host | `hostname`, `path` |
| `service` | Points to a web service running in the sandbox | `hostname`, `port`, optional `path` |
| `website` | Points to an external website URL | `url` |
| `virtual_browser` | Displays a URL in a virtual browser (requires website service host) | `hostname` |

Tabs are zero-indexed for linking purposes (the first tab is `tab-0`).

---

## Alerts / Callouts

GitHub-style alert syntax with three severity levels:

```markdown
> [!NOTE]
> Informational callout. Use for tips and supplementary context.

> [!IMPORTANT]
> Key information the learner must not miss.

> [!WARNING]
> Dangerous or destructive action. Proceed with caution.
```

---

## Buttons

Inline link syntax with a `button` keyword and optional styling attributes.

```markdown
[button label="Read more"](https://example.com)
```

### Variants

```markdown
[button label="Primary"](https://example.com)
[button label="Success" variant="success"](https://example.com)
[button label="Danger" variant="danger"](https://example.com)
```

### Custom Colors

```markdown
[button label="Blue" background="blue" color="white"](https://example.com)
[button label="Custom" background="#ffc814" color="#000000"](https://example.com)
```

### Full-Width (Block) Buttons

```markdown
[button label="Sign in" block](https://example.com)
[button label="Sign in" block variant="danger"](https://example.com)
[button label="Sign in" block background="#6c5ce7" color="#fff"](https://example.com)
```

---

## Switch Tab Links

Guide users to a specific tab using `tab-{index}` as the link target (zero-indexed).

```markdown
Go to the [terminal](tab-0) to run the command.

Or use a button: [button label="Open Editor" variant="success"](tab-2)

Go back with [button label="Back" background="#6c5ce7"](tab-0)
```

---

## Scroll to Section

Link to a specific `# Heading` within the assignment using `section-{section-id}`.

The section ID is derived from the heading: lowercased, special characters removed, spaces replaced with dashes. Same rules as GitHub anchor links, but prefixed with `section-`.

```markdown
Jump to [Step 2](section-step-2)

Or as a button: [button label="Go to Step 2" variant="success"](section-step-2)

[button label="Back to top" background="#6c5ce7"](section-introduction)
```

---

## Sections (Collapsible / Expandable)

Top-level `#` headings in the assignment body are rendered as expandable/collapsible sections in the lab UI. This is automatic - any `# Heading` creates a section.

```markdown
# Step 1

Click "Explorer" > "NPM Scripts" to open the corresponding panel.
Run the "test" task from it.

# Step 2

Update the function in src/sum.ts to correctly return the sum.

# Check

To complete this track, press **Check**.
```

Each `# Heading` becomes a collapsible accordion section in the rendered assignment.

---

## Code Blocks

Standard fenced code blocks with language identifiers, plus Instruqt-specific options appended after the language (comma-separated).

### Basic

````markdown
```bash
git checkout main
```
````

### Hide Copy Button (`nocopy`)

````markdown
```bash,nocopy
mkdir instruqt
```
````

### Show Line Numbers (`line-numbers`)

````markdown
```bash,line-numbers
mkdir instruqt
cd instruqt
ls
```
````

### Run in Terminal (`run`)

Adds a "Run" button that executes the code in the active terminal tab.

````markdown
```bash,run
mkdir instruqt
```
````

### Wrap Long Lines (`wrap`)

````markdown
```bash,wrap
echo "This is a very long line that will wrap instead of scrolling horizontally."
```
````

### Combining Options

Options are comma-separated after the language identifier:

````markdown
```python,line-numbers,nocopy
def hello():
    print("Hello, world!")
```
````

---

## Standard Markdown

Instruqt supports GitHub Flavored Markdown (GFM) including:

- **Bold**, *italic*, ~~strikethrough~~
- Headings (`#`, `##`, `###`)
- Ordered and unordered lists
- Tables
- Inline code and fenced code blocks
- Images (can be uploaded via the web editor)
- Links
- Horizontal rules (`---`)

---

## Quick Reference

| Feature | Syntax |
|---|---|
| Note callout | `> [!NOTE]` |
| Important callout | `> [!IMPORTANT]` |
| Warning callout | `> [!WARNING]` |
| Button | `[button label="Text"](url)` |
| Button variant | `[button label="Text" variant="success"](url)` |
| Button custom color | `[button label="Text" background="#hex" color="#hex"](url)` |
| Block button | `[button label="Text" block](url)` |
| Switch tab link | `[link text](tab-0)` |
| Switch tab button | `[button label="Text"](tab-2)` |
| Scroll to section | `[link text](section-my-heading)` |
| Code block no copy | `` ```bash,nocopy `` |
| Code block line numbers | `` ```python,line-numbers `` |
| Code block run | `` ```bash,run `` |
| Code block wrap | `` ```bash,wrap `` |
