# Practice plan

## 1. Audit the real data

Read the import report. Inspect missing fuel, seats, mileage and accident-history values in the cleaned SQLite database. Compare duplicates before deletion: does keeping the first occurrence discard meaningful differences? Document why a field is missing and distinguish seller omissions from parsing errors. Add field-level provenance before enriching records from another source.

## 2. Establish independent evaluation

Review the frozen 20 scenarios before changing a prompt. Add your own conversations with manually checked expectations, then keep a separate set unseen during development. Evaluate hard constraint violations, preference extraction, supported facts and useful follow-up questions independently. Human relevance judgments are needed to assess whether ranking is actually helpful; today's checks do not establish that.

## 3. Analyse failures

Pick five genuine failed conversations. For each, save the original input, catalog version, parsed preferences, candidate set, returned IDs and outcome. Label its cause: source data, extraction, retrieval, ranking or explanation. Correct one cause and rerun the same benchmark plus held-out cases. Keep failures in the dataset even after fixing them.

## 4. Compare models and prompts

Run `node scripts/evaluate.mjs --model` with two models using the same cases. Compare extraction accuracy, hard constraint errors, latency and token usage. Make one prompt change at a time. Add conversations that change or remove requirements, express exclusions, mix PLN and foreign currencies, and ask for facts that aren't present. Do not evaluate a model solely with judgments from that same model.

## 5. Improve retrieval and ranking

Build an independent SQL filtering baseline against the full cleaned catalog. Compare it with the app's sample: which genuine matches are lost? Introduce verified descriptive text and try keyword, vector and hybrid retrieval for soft preferences. Keep hard numeric filters outside similarity search. Collect human relevance labels, then evaluate precision/recall and ranking quality against the simpler baseline.

## 6. Exercise production behavior

Test expired keys, timeouts, rate limits, malformed data, empty results and a changing catalog schema. Add server-side request tracing, privacy-aware retention and spend alerts. Version prompts, catalog snapshots and ranking parameters. Deploy a canary, replay an evaluation set, and define when to roll back. Keep actual customer data out of public evaluation artifacts.
