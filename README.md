# AI, understood

**An interactive handbook for learning AI, from first principles to practical applications.**

Explore machine learning, deep learning, generative AI, retrieval-augmented generation (RAG), and agents through clear explanations, diagrams, worked examples, and hands-on experiments.

All **42 chapters across 10 parts** are available, including an evaluated movie-assistant capstone. The handbook combines a concise reading path with optional deeper notes, exercises, and downloadable Python workbooks.

[Getting started](#getting-started) · [Learning path](#learning-path) · [Project structure](#project-structure) · [Development](#development)

## What’s inside

- **Connected lessons** — concepts build progressively, from Python and mathematics to complete AI systems.
- **Visual explanations** — accessible SVG diagrams, mathematical notation, and worked calculations.
- **Interactive labs** — change inputs, inspect intermediate steps, and compare outcomes in the browser.
- **Practice and revision** — exercises with revealable solutions, quizzes with explanations, and reference glossaries.
- **Python workbooks** — downloadable code and teaching datasets for practicing beyond the browser.
- **Reading tools** — chapter search, section navigation, bookmarks, and completion tracking with JSON export/import.
- **Flexible reading** — responsive layouts, light and dark themes, reduced-motion support, and PDF editions of every chapter.

Progress is stored locally in your browser. It does not sync between devices; use export/import to move it.

## Learning path

| Part | Chapters | Topics |
| --- | --- | --- |
| 01 · Understanding the AI landscape | 1–3 | AI, ML, deep learning, generative AI, and how models learn |
| 02 · Programming and mathematics | 4–8 | Python, APIs, data, linear algebra, probability, calculus, and optimization |
| 03 · Your first LLM application | 9–11 | Prompting, context design, Python applications, and a recommendation project |
| 04 · Data and classical ML | 12–15 | Data preparation, regression, classification, clustering, and model evaluation |
| 05 · Search, embeddings, and RAG | 16–19 | Information retrieval, vector search, RAG pipelines, and retrieval evaluation |
| 06 · Deep learning and LLM internals | 20–26 | Neural networks, training, NLP, transformers, generation, and efficient inference |
| 07 · Adaptation and multimodal AI | 27–30 | Choosing an approach, fine-tuning, preference learning, and multimodal systems |
| 08 · Tools, workflows, and agents | 31–33 | Tool calling, explicit workflows, agent loops, MCP, and multi-agent systems |
| 09 · Evaluation, security, and production | 34–36 | System evaluation, responsible use, security, deployment, and operations |
| 10 · Broader AI and the capstone | 37–42 | Symbolic AI, reinforcement learning, applications, graphs, causality, research, and a capstone |

For individual chapter titles and routes, see the [curriculum source](src/data/curriculum.ts) or open `/curriculum/` in the running app.

### A suggested study routine

1. Read the core explanation and trace one worked example yourself.
2. Try the interactive lab, then complete the exercises before revealing solutions.
3. Run the Python workbook where provided, take the quiz, and revisit deeper notes as needed.

The current edition uses fictional movie scenarios as a recurring example, alongside other teaching datasets. Experiments distinguish real calculations from simulations, recorded traces, and model-backed extensions.

## Getting started

### Requirements

- **Node.js 22.12.0 or later** and npm.
- **Python 3.10 or later** for the downloadable workbooks; Python is not needed to run the website. Check each workbook’s README for additional requirements.

> **Cloning onto another computer?** The repository’s [`.npmrc`](.npmrc) contains a workspace-specific npm cache path. Remove or update its `cache` entry before installing dependencies.

Run these commands from the project root, the folder containing `package.json`:

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:4321](http://127.0.0.1:4321). Keep the terminal running while reading; press **Ctrl+C** to stop the server. If that port is already in use, stop the earlier server or use the URL reported by the terminal.

### Build and preview

```sh
npm run build
npm run preview
```

The production build is written to `dist/`. The included development and preview commands bind to your local computer.

<details>
<summary>Windows launcher</summary>

From the project root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-handbook.ps1
```

The launcher installs dependencies if needed, builds the site if `dist/index.html` is missing, and serves the built files locally. After editing source files, run `npm run build` to refresh this version, or use `npm run dev` while making changes.

</details>

## Python workbooks and PDFs

Use the download links within each chapter, or browse [`public/downloads/`](public/downloads/).

Each workbook includes its own instructions. For example, the final capstone runs locally with the Python standard library:

```sh
cd public/downloads/chapter-42-capstone
python assistant.py
python assistant.py --case C1
python -m unittest -v test_assistant.py
```

The capstone provides a deterministic movie assistant with retrieval, hard constraints, a tool fixture, source references, and eight public development cases. See its [workbook README](public/downloads/chapter-42-capstone/README.md) for expected results and extension ideas.

Chapter PDFs include expanded optional notes, solutions, explained quiz answers, and static versions of interactive material. Generated editions live in `output/pdf/`; the website serves copies from `public/downloads/`.

The website does not require API keys or call model APIs. Some downloadable workbooks offer optional model adapters; their READMEs explain the setup and any credentials, local models, or usage costs involved.

## Tech stack

| Technology | Role |
| --- | --- |
| Astro and MDX | Static pages and chapter content with embedded components |
| React and TypeScript | Interactive learning components |
| CSS and Tailwind CSS | Layout, themes, responsive styles, and print presentation |
| KaTeX, remark-math, and rehype-katex | Mathematical notation |
| Python | Downloadable workbooks and verification scripts |
| Node.js tests and Playwright | Calculation checks and browser verification |

Dependency versions are recorded in [`package.json`](package.json) and locked in `package-lock.json`.

## Project structure

```text
ai-handbook/
├── src/
│   ├── content/        # Chapter MDX files
│   ├── components/     # Diagrams, labs, quizzes, and shared UI
│   ├── data/           # Curriculum, quiz data, and recorded traces
│   ├── layouts/        # Shared handbook layout
│   ├── lib/            # Calculation and experiment logic
│   ├── pages/          # Home, curriculum, and chapter routes
│   ├── scripts/        # Browser-side reading tools
│   └── styles/         # Theme, component, and print styles
├── public/downloads/   # Published PDFs, workbooks, datasets, and ZIPs
├── scripts/            # Verification, PDF export, and local serving
├── tests/              # JavaScript calculation and behavior tests
├── output/pdf/         # Generated PDF editions
├── reference/          # Archived editorial material
├── start-handbook.ps1  # Windows launcher
└── package.json        # Dependencies and npm commands
```

`dist/`, `.astro/`, and `tmp/` hold build output or working files and are ignored by Git. Archived material in `reference/` is not published by the website.

## Development

Run commands in this section from the project root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run check` | Check Astro and TypeScript source |
| `npm test` | Run JavaScript tests for calculations and experiment behavior |
| `npm run build` | Generate the static website |
| `npm run preview` | Preview the production build locally |

### Editing a chapter

Edit its MDX file in `src/content/`. Related diagrams and labs live in `src/components/`, calculation logic in `src/lib/`, and quiz data in `src/data/`. Page metadata and navigation connect these through `src/pages/chapters/` and the shared layout.

Keep the core explanation concise, define new terms, and move additional detail into optional sections. Label fictional data and simulations clearly, distinguish measured results from illustrations, and cite primary sources near the claims they support.

When an experiment changes, update its workbook, tests, and downloadable ZIP as appropriate. Run the relevant checks, inspect the browser layout, and regenerate the PDF after changing published chapter content.

<details>
<summary>Chapter checks and PDF export</summary>

Chapter-specific scripts in `scripts/` verify workbooks, browser interactions, and print output. For Chapter 42:

```sh
python scripts/check-capstone42.py
node scripts/check-chapter42.cjs
```

Browser checks require a running site at `http://127.0.0.1:4321`, Playwright, and an installed Chrome browser. Playwright is an optional verification dependency, resolved from a local `playwright` installation or `PLAYWRIGHT_MODULE_PATH`.

To refresh a PDF, first build the latest site and serve it locally. Then run:

```sh
node scripts/export-pdf.cjs 42
```

The export script accepts chapter numbers **1–42** and updates the generated PDF and its download copies. PDF review uses `scripts/review-pdf.py`, Python’s `pdfplumber` and Pillow packages, and page images rendered with Poppler. Visually inspect the rendered pages as well as checking their extracted text.

To disable Astro telemetry during local work, set `ASTRO_TELEMETRY_DISABLED=1`. The Windows launcher already sets this variable.

</details>
