# Motivo

A car recommendation MVP and an AI engineering practice project. The interface draws on Metricon's generous spacing, rounded controls, bold type and green palette, with original Motivo branding.

## Run locally

Requires Node.js 22.13+; Python 3.11+ is used only to reimport data.

```sh
npm ci
npm run dev
```

Open the local URL printed by the server. On Windows, `start-motivo.cmd` starts the app after dependencies are installed. The app works immediately in **Catalog mode**, a deterministic search baseline. No model or API key is required for that mode.

## Enable AI interpretation

For hosted use, install OpenAI Developers in Codex, create/select a project API key using its API key workflow, then configure `OPENAI_API_KEY` as a private Site environment variable. The API key is not included in this repository or the browser bundle.

For local use, copy `.dev.vars.example` to the ignored `.dev.vars` and set `OPENAI_API_KEY` there. The default `OPENAI_MODEL` is `gpt-6.1-sol`. Restart the development server after configuring it. The app's status changes to **AI + catalog** when a key is present. If the model call fails, the response explicitly identifies the fallback and exposes the interpreted filters. The evaluation script also accepts `.env.local`.

The initial model integration uses the OpenAI Responses API with a strict JSON schema to interpret the complete preference state. Code applies hard filters and ranks matching catalog records. Recommendation facts and reasons are rendered directly from those records; the model cannot supply invented prices, listing IDs or vehicle specifications. This deliberately measurable baseline can be expanded with model-generated comparative explanations once you have an evaluation for them.

## Real dataset

Source: [Karol Jarząbek's Polish car dataset](https://github.com/karoljarzabek0/car_dataset_EDA), collected in March 2025. The author restricts its use to education. This project is an educational prototype; source prices are historical asking prices, seller claims are unverified, and records do not establish current availability.

- Original archive: 219,808 CSV rows, preserved under ignored `data/raw/`.
- Cleaned full data: 211,564 records in ignored `data/processed/cars.sqlite`.
- App catalog: 12,000 real records in `data/catalog.json`, sampled deterministically.
- Provenance and missing-value counts: `data/report.json`.

The importer removes missing/duplicate IDs, prices outside 3,000–1,500,000 PLN and years outside 1990–2025. Those are explicit project scope limits, not a claim that all excluded records are erroneous. Missing numerical fields and invalid optional values remain null. Ranking excludes listings reported damaged; unknown damage and accident history remain unverified. Fields such as reliability, boot space, safety ratings, insurance and maintenance costs are absent; the assistant surfaces this limitation when asked.

```sh
python scripts/prepare-data.py --limit 12000
```

The raw archive's SHA-256 is recorded. Sampling selects one item per make/fuel/body/50,000 PLN price band, then fills by SHA-256 of listing ID. This is a diversity-oriented sample, not a statistically representative estimate of the Polish car market. Preserve the raw archive for exact reruns; an upstream replacement could change its checksum.

Price-quality checks retain original values but flag prices below 30% of the median of at least five non-damaged offers for the same make/model/year. Titles explicitly mentioning lease/deposit terms are flagged too. These records remain in SQLite and the app catalog, but are quarantined from recommendations. These are review heuristics, not verified errors. They can miss anomalous prices for rare vehicles and reject genuine bargains; measure both outcomes before changing the threshold.

## Evaluate and investigate

```sh
node --test --test-isolation=none tests/recommendation.test.mjs
node scripts/evaluate.mjs
node scripts/evaluate.mjs --model
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

The first two commands make no model calls. The last evaluation command runs the same frozen cases through the configured model and incurs API usage. Reports are saved in ignored `evals/runs/`. The Lab view runs the deterministic evaluation inside the app. It is labeled separately from model evaluation.

Every response can expose the model/baseline version, preference state, catalog checksum, candidate count, returned IDs, retrieval latency, total latency, model token usage and fallback state. Use thumbs down to label data quality, missed requirements, ranking or explanation failures. Export sessions from the Lab for analysis. Conversations, saved cars and feedback persist in browser storage; app sessions are not stored in a shared server database. When AI is enabled, the recent conversation and preferences are sent to OpenAI with `store: false`.

## Project map

| Location | Purpose |
| --- | --- |
| `app/ui.tsx`, `app/globals.css` | Responsive chat, saved cars, comparison and Lab |
| `app/api/` | Server endpoints for chat, status and baseline evaluation |
| `lib/model.mjs` | Model adapter, extraction schema and prompt |
| `lib/recommendation.mjs` | Deterministic interpretation, strict filters, ranking, fact-based explanations |
| `lib/service.mjs` | Model selection, explicit fallback and response traces |
| `scripts/prepare-data.py` | Raw ingestion, validation, cleaning, SQLite and sampling |
| `evals/cases.json` | Frozen user scenarios and expected behavior |
| `tests/` | Constraints, real-record provenance and mocked model failure checks |
| `docs/learning-path.md` | Suggested next engineering experiments |

## Current limits

Catalog mode understands a limited vocabulary rather than arbitrary conversation. City filters are exact city names, not distance searches. Ranking is a transparent weighted baseline for age, mileage and asking price; it is not a trained preference model. There is no purchase flow or live inventory integration. The initial production boundary is an owner-private Site, with request size limits and model timeouts. Before opening it to others, add authentication/authorization as needed, rate limits, spending controls, retention policies, managed tracing and an inventory source whose license permits that audience.
