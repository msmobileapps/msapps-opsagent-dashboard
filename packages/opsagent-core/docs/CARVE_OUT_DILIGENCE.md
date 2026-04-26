# Pre-Carve-Out Diligence — JS opsagent-core

**Date:** 2026-04-26
**Author:** opsagents-cto (Michal as principal)
**Scope:** `msapps-opsagent-dashboard/packages/opsagent-core/` — the JS twin of the moat
**Reference:** `/Users/sapirrubin/Documents/Claude/opsagents/CLAUDE.md` — IP-protection plan, decision date 2026-04-26
**Trello card:** `https://trello.com/c/79Y8sq77` (opsagent-core-js wiring)

---

## TL;DR for Michal

The IP plan in `CLAUDE.md` says the JS package has **8 source files** and is a "small carve-out, do first." That's stale. Reality: **22 source files** across `src/`, `src/ai/`, `src/api/`, `src/trainer/`, and `src/image-generation/`. Two new subsystems (`trainer/` and `image-generation/`) and one new file in `ai/` (`providers.js`) landed since the plan was written.

The good news: the package is **architecturally clean for a carve-out**. Almost every leaf module is zero-dep, so the SDK/moat boundary can be drawn with file-level granularity. There are **no circular imports today** and the proposed split introduces **none**, provided one rule: the SDK never imports from the Engine. The opposite direction (Engine imports SDK types/contracts) is fine and expected.

The bad news: the moat in the JS package is **thinner than CLAUDE.md implies**. `matching.js`, `discovery.js`, and `outreach.js` are 18–28 lines of generic logic with no tuned thresholds, no proprietary heuristics, no client-specific weights. They're "moat" only in that they encode the *shape* of the workflow — the actual moat (scoring weights, drug aliases, prospect signals) lives in **`trainer/trainer-config.ilcf.js`** and in callers' criteria objects, not in these files. A reasonable contractor reading `matching.js` would learn nothing from it that they don't already know from any matching tutorial.

This means the SDK/moat tier table in CLAUDE.md needs an update before the surgery starts. Specific recommendations are at the bottom of this document.

---

## A. Symbol inventory — what's SDK, what's moat, and why

Every exported symbol below is tagged **SDK** (framework — source visible to hires, published as `@opsagents/sdk`) or **MOAT** (engine — source closed, published as compiled `@opsagents/core-engine`). The reasoning column is the *why* — not just the verdict, the test that produced it.

### `src/index.js` — barrel re-exports (SPLIT)

This file becomes two files post-carve: `sdk/index.js` and `engine/index.js`. The current `src/index.js` is a re-export-only barrel and can be regenerated mechanically.

### `src/matching.js` — **SDK**, 28 lines

| Symbol | Tier | Reason |
|---|---|---|
| `score(item, criteria)` | **SDK** | Pure weighted-attribute scorer. Generic. The *real* matching IP is in the **`criteria` object** the caller passes — not here. Anyone hired could rewrite this in 20 minutes. |
| `rank(items, criteria, options)` | **SDK** | Sort + filter + slice over `score()`. Same logic. |

**Tier change vs. CLAUDE.md:** plan says "core (scoring weights, ranking heuristics)". **There are no scoring weights or heuristics in this file.** They're parameters supplied by the caller. Move to SDK.

### `src/discovery.js` — **SDK**, 28 lines

| Symbol | Tier | Reason |
|---|---|---|
| `filterByHeat(items, heat)` | **SDK** | One-line `.filter()`. Zero IP. |
| `findStale(items, daysThreshold)` | **SDK** | Date-arithmetic helper. Generic. |
| `prioritize(items)` | **SDK** | Hardcodes the sort order `hot < warm < cold`. That's a labelling convention, not IP. |

**Tier change vs. CLAUDE.md:** plan says "core (prioritization rules)". The only "rule" is "hot before warm before cold." Move to SDK.

### `src/outreach.js` — **SDK**, 18 lines

| Symbol | Tier | Reason |
|---|---|---|
| `buildOutreachRecord(contactId, method, status)` | **SDK** | Object factory with timestamp. |
| `isFollowUpDue(record, daysSinceSent)` | **SDK** | `now - sentAt > N days`. Generic. |

**Tier change vs. CLAUDE.md:** plan says "core (follow-up windows, escalation)". The window is a default parameter (3 days). Move to SDK.

### `src/scheduling.js` — **SDK**, 121 lines

Already in the SDK tier per CLAUDE.md. Confirmed: `parseCron`, `buildSchedule`, `nextRunTime`, `isScheduleActive`, `humanReadableSchedule`, `getNextRuns`. Pure utilities. **Stay SDK.**

### `src/state.js` — **SDK** (with one MOAT seam), 215 lines

| Symbol | Tier | Reason |
|---|---|---|
| `normalizeOpsState`, `mergePersistedOpsState` | **SDK** | Defensive defaults + array merge. Generic. |
| `createLeadRecord`, `updateLeadStatus`, `getLeadsByStage`, `getStaleLeads` | **SDK** | CRUD over the `leads` array. The lead schema *is* the API contract a hire builds against — they need this. |
| `getPipelineStats` | **SDK** | Aggregation. Generic. |
| `createState`, `updateState`, `getState` | **SDK** | Generic state-machine helpers. |
| **`PIPELINE_STAGES` constant** | **SDK** | The stage list IS the contract. Hires need to import this to build pipeline UIs. |

**Note:** the `dealValue`, `nextActionDate`, `gcalEventUrl` etc. fields in `normalizeLead` are part of the public schema that consumers (including `Dashboard.jsx`) already rely on. Locking them in SDK is the right call.

### `src/ai/tasks.js` — **MOAT**, 40 lines

| Symbol | Tier | Reason |
|---|---|---|
| `buildTaskPrompt(clientName, agentName, context)` | **MOAT** | The **prompt template** is the IP. Even a 6-line template encodes the OpsAgent agent-invocation contract. Hires building agents shouldn't read prompts; they should build *against* this function. |
| `parseTaskOutput(rawOutput)` | **SDK** | The reverse direction — parsing markdown sections — is generic. Could even be split: `parseTaskOutput` → SDK, `buildTaskPrompt` → Engine. |

**Tier change vs. CLAUDE.md:** plan says all of `ai/tasks.js` is core. Agreed for `buildTaskPrompt`. `parseTaskOutput` is borderline; recommend splitting the file into `ai/tasks.parser.js` (SDK) and `ai/tasks.prompt.js` (Engine). See Recommendations.

### `src/ai/runtime-client.js` — **SDK**, 54 lines

`RuntimeClient` class is an HTTP wrapper. No secrets, no tuned URLs, no auth scheme beyond an opaque API key header. **Stay SDK** per plan.

### `src/ai/providers.js` — **MOAT** (mostly), 305 lines (NEW since plan)

This is the file the plan didn't know about. Routing logic for "which provider serves which task type" with hardcoded model IDs, fallback cascades, and the explicit policy `"NO paid/metered providers (Groq, Gemini, OpenAI, Anthropic)"`.

| Symbol | Tier | Reason |
|---|---|---|
| `TASK_TYPES` constant | **SDK** | Just the enum of task names. Hires need it to register tasks. |
| `WorkersAIProvider` | **MOAT** | Encodes the binding-vs-HTTP path, the model list (`@cf/meta/llama-3.1-8b-instruct`, `bge-base-en-v1.5`), and the request shape OpsAgent depends on. A copy is a working CF Workers AI client tuned for OpsAgent. |
| `OllamaProvider` | **MOAT** | Same — model list, request shape, the OPSAGENT_AI_LOCAL_ONLY policy. |
| `createCascadingProvider(config)` | **MOAT** | The **routing matrix** — which task type gets which cascade — is the heart of the cost story. Open-source it and the cost-per-agent advantage evaporates. |

**Tier change vs. CLAUDE.md:** ADD this file to the moat list. Plan didn't have it.

### `src/api/cors.js` — **SDK**, 60 lines

Generic CORS preflight handler. **SDK.**

### `src/api/ops-store.js` — **SPLIT**, 134 lines

| Symbol | Tier | Reason |
|---|---|---|
| `loadOpsState`, `saveOpsState`, `loadClientsTable`, `saveClientsTable` | **SDK** (interface) + **MOAT** (impl) | The **function signature** is the contract. The **GCS-vs-local fallback logic** is operational moat (which bucket, what the failure mode is, what gets logged). |
| `loadFromGCS` (internal) | **MOAT** | Bucket layout, env-var convention. |
| `loadFromFile` (internal) | **SDK** | Trivial file I/O. |

**Recommendation:** mirror the Python plan's `persistence.py` split — abstract base in SDK (`OpsStore` interface), concrete `GcsOpsStore` and `FileOpsStore` impls in Engine. Currently the file is monolithic; this needs a small refactor *as part of* the carve-out, not as prerequisite.

### `src/api/route-adapter.js` — **SDK**, 128 lines

Express ↔ Web-Request format converter. Pure plumbing. **SDK** — the dashboard's `server/index.js` already imports it as a public API.

### `src/trainer/` — **5 files SDK + 2 MOAT** (NEW since plan)

The trainer is the engine that powers `ilcf-medinfo-demo.netlify.app/trainer.html`. Per `code-portfolio.md` it's owned by `msapps-dev:ilcf-trainer`.

| File | Tier | Reason |
|---|---|---|
| `trainer/index.js` | **SDK** (re-export barrel) | Becomes `sdk/trainer/index.js`. |
| `trainer/streaming-client.js` | **SDK**, 119 lines | Generic Ollama/OpenAI streaming client. Zero-dep. Reusable. |
| `trainer/prompt-builder.js` | **SDK** (skeleton) + **MOAT** (the keyword tables it consumes) | The **functions** (`estimateTokens`, `chooseNumCtx`, `selectRelevantSections`, `buildTrainerPrompt`) are generic. The **section-selection algorithm** including the token-budget cliffs (2800/6500) and coupling rules is moat-adjacent — but it's parameterized through `config`, so the file itself is SDK. |
| `trainer/response-parser.js` | **SDK**, 106 lines | Markdown-fence-stripping JSON extractor. Generic. |
| `trainer/fuzzy-match.js` | **SDK**, 320 lines | Three-strategy fuzzy matcher (exact → whitespace-normalized → line-by-line). Genuinely useful, genuinely generic. |
| `trainer/github-committer.js` | **SDK**, 204 lines | GitHub Contents API wrapper. The token comes from the caller. |
| `trainer/trainer-engine.js` | **SDK**, 225 lines | Orchestration layer — wires the pieces together. The **wiring is the framework**; hires need to read it to extend the trainer. |
| **`trainer/trainer-config.ilcf.js`** | **MOAT**, 120 lines | This is the actual ILCF moat: ~100 Hebrew/English keyword mappings tuned over real usage. `ILCF_SECTION_KEYWORDS` (~80 keywords across 7 sections), `ILCF_BACKEND_KEYWORDS`, `ILCF_EXTRA_RULES`. **Anyone holding this file has the ILCF trainer's brain.** |

**Tier change vs. CLAUDE.md:** ADD `trainer/` to the inventory. The trainer engine itself is SDK; *configs per client* are moat.

### `src/image-generation/` — **all SDK**, ~290 lines (NEW since plan)

| File | Tier | Reason |
|---|---|---|
| `image-generation/index.js` | **SDK** | Re-export barrel. |
| `image-generation/contracts.js` | **SDK** | `IMAGE_STYLES`, `IMAGE_RESOLUTIONS`, `validateInput`, `applyDefaults`. Public contracts. |
| `image-generation/prompt-builder.js` | **SDK** | Style modifiers ("RAW photo, ultra realistic", "anime artwork"). Borderline — it's a creative IP question, not a technical one. Public defaults are fine; tuned per-client modifiers should live in client extension repos. |
| `image-generation/adapter.js` | **SDK** | Generic HTTP client for `/generate`, `/health`, `/models`. |

**Tier change vs. CLAUDE.md:** ADD `image-generation/` to the SDK tier. No moat content.

---

### Summary of tier changes (vs. CLAUDE.md plan)

| File | Plan says | Reality says |
|---|---|---|
| `matching.js` | core | **SDK** — no weights here, weights are in caller's `criteria` |
| `discovery.js` | core | **SDK** — only "rule" is `hot < warm < cold` |
| `outreach.js` | core | **SDK** — defaults are parameters |
| `ai/tasks.js` | core | **SPLIT** — `buildTaskPrompt` is moat, `parseTaskOutput` is SDK |
| `ai/providers.js` | _not in plan_ | **MOAT** (most of file) — task routing matrix + tuned model lists |
| `api/ops-store.js` | _SDK per plan, but split was intended_ | **SPLIT** — interface SDK, GCS impl moat |
| `trainer/*` (8 files) | _not in plan_ | **SDK except `trainer-config.ilcf.js` (MOAT)** |
| `image-generation/*` (4 files) | _not in plan_ | **SDK** |

**Net moat surface (JS):** `ai/providers.js` (most of it), `ai/tasks.js`'s `buildTaskPrompt`, `api/ops-store.js`'s GCS impl, `trainer/trainer-config.ilcf.js`. Maybe 500 lines total. The "moat" is not the matching algorithm; it's the **wired-up provider routing + the per-client trainer configs**. That's actually defensible — and it generalizes: every future client gets its own `trainer-config.<slug>.js` in the closed-source `client-<slug>` repos.

---

## B. Import graph — who depends on what

### B.1 Internal imports inside the package

The package is overwhelmingly leaf modules — files with **zero internal imports**. Only two clusters have internal edges:

```
trainer/index.js (barrel)
  └─→ trainer/trainer-engine.js
        ├─→ trainer/prompt-builder.js
        ├─→ trainer/streaming-client.js
        ├─→ trainer/response-parser.js
        ├─→ trainer/github-committer.js  ──→  trainer/fuzzy-match.js
        └─→ trainer/fuzzy-match.js

image-generation/index.js (barrel)
  ├─→ image-generation/contracts.js
  ├─→ image-generation/prompt-builder.js
  └─→ image-generation/adapter.js
```

Both clusters are DAGs with the barrel at the top. **No back-edges.** No file outside `trainer/` imports anything inside `trainer/`. Same for `image-generation/`. Same for `ai/`. These subdirs are genuinely independent subsystems.

`src/index.js` itself imports from every leaf via `export {...} from './path.js'` re-exports — these are tree-shakeable in modern bundlers, so consumers using subpath imports (`opsagent-core/state`) don't pay for unused barrels.

### B.2 External consumers (the dashboard)

Only **7 import sites** in the entire dashboard touch the package. That's clean — the surface is small.

| Consumer | Imports | Subpath |
|---|---|---|
| `server/index.js` | `toWebRequest`, `sendWebResponse`, `routeHandler` | `opsagent-core/api/route-adapter` |
| `netlify/functions/_lib/store.js` | `handleCors`, `jsonResponse` | `opsagent-core/api/cors` |
| `netlify/functions/leads.js` | `normalizeOpsState`, `createLeadRecord`, `updateLeadStatus` | `opsagent-core/state` |
| `netlify/functions/ops-state.js` | `normalizeOpsState`, `mergePersistedOpsState` | `opsagent-core/state` |
| `netlify/functions/trainer.js` | `commitModifications`, `applyModifications` | `opsagent-core/trainer` |
| `src/components/Dashboard.jsx` | `getPipelineStats`, `getLeadsByStage`, `getStaleLeads` | `opsagent-core/state` |
| `src/components/TaskDetailView.jsx` | `getPipelineStats`, `getStaleLeads` | `opsagent-core/state` |

**Subpath usage tally:**

```
opsagent-core/trainer            ×8  (mostly trainer/* sub-subpaths inside the package itself)
opsagent-core/state              ×5  ← the workhorse
opsagent-core/api/cors           ×2
opsagent-core/trainer/config-ilcf ×2
opsagent-core/api/route-adapter  ×1
opsagent-core/api/ops-store      ×1
opsagent-core/scheduling         ×1
opsagent-core/trainer/streaming-client ×1
```

**Observations:**

1. **No consumer imports from the moat surface.** Nothing in the dashboard imports `ai/tasks.js`, `ai/providers.js`, `ai/runtime-client.js`, `matching.js`, `discovery.js`, `outreach.js`, or `trainer/trainer-config.ilcf.js` directly. The moat is *referenced through SDK-tier glue* (e.g. `trainer/index.js` re-exports `commitModifications` which the dashboard uses; `commitModifications` lives in `github-committer.js` which is SDK; the actual tuned ILCF config is loaded by `netlify/functions/trainer.js` from `opsagent-core/trainer/config-ilcf` which IS moat — so there's one moat consumer site, not zero).

2. **Only one import site touches the moat:** `netlify/functions/trainer.js` reads from `opsagent-core/trainer/config-ilcf`. After the carve-out, this consumer either:
   - Stays in the *closed-source* dashboard (Michal's repo) and imports the moat package directly — fine.
   - OR — better — the ILCF config moves to a `client-ilcf` repo and the dashboard imports from there, leaving `trainer/` (Engine) to host only the engine, not the configs.

3. **`state.js` is the most-loaded SDK module.** Five import sites. The schema it normalizes is the single most-important contract in the system. **Locking this schema before David starts is the most important pre-hire action.** If `state.js` changes shape after David starts building the recruiter, every UI he touches breaks.

### B.3 Visualization

```
                ┌──────────────────────────────┐
                │  msapps-opsagent-dashboard   │
                │  (closed source)             │
                └──────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   netlify/functions/*   src/components/*    server/index.js
        │                     │                     │
        │ via subpath imports │                     │
        ▼                     ▼                     ▼
  ┌────────────────────────────────────────────────────┐
  │  @opsagents/sdk   (NEW — open to hires)            │
  │  ├── state.js                                      │
  │  ├── scheduling.js                                 │
  │  ├── matching.js, discovery.js, outreach.js        │
  │  ├── ai/runtime-client.js                          │
  │  ├── ai/tasks.js (parser only)                     │
  │  ├── ai/TASK_TYPES                                 │
  │  ├── api/cors.js, api/route-adapter.js             │
  │  ├── api/ops-store.js (interface)                  │
  │  ├── trainer/* (engine + helpers, NO configs)      │
  │  └── image-generation/*                            │
  └────────────────────────────────────────────────────┘
                              │ (depends on, optionally)
                              ▼
  ┌────────────────────────────────────────────────────┐
  │  @opsagents/core-engine   (NEW — closed)           │
  │  ├── ai/providers.js (cascading router + models)   │
  │  ├── ai/tasks.prompt.js (buildTaskPrompt)          │
  │  ├── api/ops-store.gcs.js (GCS concrete impl)      │
  │  └── client-configs/                               │
  │        └── trainer-config.ilcf.js                  │
  └────────────────────────────────────────────────────┘
```

The Engine **depends on** the SDK (it implements SDK interfaces). The SDK has **no knowledge** that the Engine exists.

---

## C. Circular-import risk after the split

**Verdict: zero today, zero after the split — provided one rule.**

### C.1 Today

Ran a manual import-graph walk over all 22 source files. Every file's `import` lines were checked against every other file's path. Result:

- **8 leaf files** (zero imports): `matching.js`, `discovery.js`, `outreach.js`, `state.js`, `scheduling.js`, `ai/tasks.js`, `ai/runtime-client.js`, `ai/providers.js`, `api/cors.js`, `api/ops-store.js`, `api/route-adapter.js`, `trainer/streaming-client.js`, `trainer/prompt-builder.js`, `trainer/response-parser.js`, `trainer/fuzzy-match.js`, `image-generation/contracts.js`, `image-generation/prompt-builder.js`, `image-generation/adapter.js`.
- **2 internal hubs:** `trainer/trainer-engine.js` (5 sibling imports), `trainer/github-committer.js` (1 sibling import — `fuzzy-match`).
- **2 barrels:** `trainer/index.js`, `image-generation/index.js`.
- **1 root barrel:** `src/index.js` (re-exports only — no logic).

There is no path from any file back to itself. Confirmed.

### C.2 After the split — the only risk pattern

The split creates a 2-package world. The only way to introduce a cycle is:

```
SDK package  ──imports──→  Engine package
   ▲                           │
   └─────────imports───────────┘   ❌ FORBIDDEN
```

**The rule that prevents it:** SDK code never `import`s from `@opsagents/core-engine`. Engine code freely imports from `@opsagents/sdk` (it implements SDK interfaces).

This is the npm equivalent of the Python "abstract base class in `interfaces`, concrete impl in `core`" pattern. It's enforceable mechanically.

### C.3 The three places where a hire could accidentally introduce a cycle

These are the only files where the boundary is non-obvious. Document them in the SDK's `CONTRIBUTING.md`:

1. **`api/ops-store.js`** — when a hire wants to add a new persistence backend (say, S3). Right pattern: declare the interface in SDK, put the S3 impl in *their own* repo or in Engine. Wrong pattern: edit the SDK file to inline an S3 client. The latter pulls AWS SDK as an SDK dep and forces the SDK to know about every backend forever.

2. **`trainer/trainer-engine.js`** — when a hire wants to add a new client trainer (say, Mama Sally). Right pattern: write `trainer-config.<slug>.js` in `client-<slug>`, pass it to `createTrainerEngine`. Wrong pattern: hardcode a switch on `config.appName === 'mama-sally'` inside the engine.

3. **`ai/providers.js`** — Engine-only file. SDK code asking the Engine "which provider should run this task" would be a cycle. Right pattern: SDK exposes `RuntimeClient` (HTTP wrapper), Engine routes internally; SDK never calls Engine for routing decisions, it just makes HTTP requests to the runtime.

### C.4 Mechanical enforcement

Three guardrails that make accidental cycles fail loudly:

1. **`package.json` `"private": true`** on the engine, so a hire's `npm install` must use a token. Already present on the SDK; needs to remain on Engine.

2. **ESLint rule `import/no-restricted-paths`** in the SDK package: forbid imports from `@opsagents/core-engine`. (Don't bother adding it on the Engine side — Engine *should* import SDK.)

3. **CI check** (cheap, ~5 lines of bash): post-build, grep the SDK's compiled output for the string `@opsagents/core-engine`. Fail the build if any match. This catches typos, dynamic `await import()`, and copy-paste accidents that ESLint misses.

### C.5 Existing exports map this cleanly

The current `package.json` `exports` map has one entry per leaf file (28 entries). After the split:

- **SDK `exports`:** 25 entries — drop `./ai/providers`, drop `./trainer/config-ilcf`, drop `./api/ops-store` (or split it into `./api/ops-store/interface` SDK + `./api/ops-store/gcs` Engine).
- **Engine `exports`:** 4 entries — `./ai/providers`, `./ai/tasks/prompt`, `./api/ops-store/gcs`, `./client-configs/ilcf`.

The fact that the export map already separates concerns at this granularity means the carve-out is **mostly a `mv` operation**, not a refactor. That's the low-risk path.

---

## Recommendations

In priority order, what to do next.

1. **Update `CLAUDE.md` tier table** to reflect the 22-file reality before any code moves. The current table (8 files, all "core") is misleading.

2. **Decide on `state.js` schema freeze.** Lock the lead record shape (and `PIPELINE_STAGES`) before David starts. Treat schema changes as breaking changes requiring an SDK semver major.

3. **Carve out `trainer-config.ilcf.js` first.** It's 120 lines, zero internal imports, and has *one* consumer (`netlify/functions/trainer.js`). Move it to a new `client-ilcf` repo, update the import in the dashboard. This proves the pattern with the smallest possible blast radius.

4. **Then carve out `ai/providers.js`.** Same shape — single file, no internal imports beyond the `TASK_TYPES` constant which is SDK. After move, expose only `createCascadingProvider` and `TASK_TYPES` as the public Engine API.

5. **Split `ai/tasks.js`.** Move `buildTaskPrompt` to Engine, keep `parseTaskOutput` in SDK. ~30 lines of code, mechanical.

6. **Refactor `api/ops-store.js`** into interface (SDK) + impls (Engine). This one is a *small* refactor (~50 lines) — defer to after #3–#5 land cleanly.

7. **Add the three guardrails** (`"private": true`, ESLint, CI grep) before publishing the first version of `@opsagents/core-engine`.

8. **Then** repeat the surgery on the Python `opsagent-core` (the 48-file core). The JS package will have proven the pattern; the Python carve-out becomes mechanical.

---

## Appendix — file inventory at-a-glance

| File | Lines | Tier | Internal imports |
|---|---|---|---|
| `index.js` | 75 | SDK (regenerated post-split) | re-exports only |
| `matching.js` | 28 | **SDK** ⚠️ (was core) | none |
| `discovery.js` | 28 | **SDK** ⚠️ (was core) | none |
| `outreach.js` | 18 | **SDK** ⚠️ (was core) | none |
| `scheduling.js` | 121 | SDK | none |
| `state.js` | 215 | SDK | none |
| `ai/tasks.js` | 40 | **SPLIT** ⚠️ | none |
| `ai/runtime-client.js` | 54 | SDK | none |
| `ai/providers.js` | 305 | **MOAT** ⚠️ (new) | none |
| `api/cors.js` | 60 | SDK | none |
| `api/ops-store.js` | 134 | **SPLIT** ⚠️ | none |
| `api/route-adapter.js` | 128 | SDK | none |
| `trainer/index.js` | 36 | SDK | trainer/* (4) |
| `trainer/trainer-engine.js` | 225 | SDK | trainer/* (5) |
| `trainer/streaming-client.js` | 119 | SDK | none |
| `trainer/prompt-builder.js` | 174 | SDK | none |
| `trainer/response-parser.js` | 106 | SDK | none |
| `trainer/fuzzy-match.js` | 320 | SDK | none |
| `trainer/github-committer.js` | 204 | SDK | trainer/fuzzy-match.js |
| `trainer/trainer-config.ilcf.js` | 120 | **MOAT** ⚠️ (new) | none |
| `image-generation/index.js` | 8 | SDK | image-generation/* (3) |
| `image-generation/contracts.js` | 93 | SDK | none |
| `image-generation/prompt-builder.js` | 106 | SDK | none |
| `image-generation/adapter.js` | 84 | SDK | none |

**Total:** 22 files, ~2,800 lines. Moat surface: ~500 lines (~18%). SDK surface: ~2,300 lines (~82%).

---

*End of diligence pass. Next CTO action: review with Michal, lock decisions, then `opsagent-core-dev` skill executes the moves in numbered order above.*
