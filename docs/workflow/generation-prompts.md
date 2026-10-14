# Diagram generation prompts

## Final accuracy corrections

### Correction for image 1

Edit this educational infographic. Preserve the entire layout, wording, colors, typography and content except for the JSON code block in step 3, which currently ends with malformed closing punctuation. Replace ONLY that code block with exactly the following valid JSON, making both closing braces very clear on their own lines, with NO trailing commas. Keep it legible in the same code panel. Exact JSON:
{
  "intent": "search",
  "preferences": {
    "maxPrice": 110000,
    "minSeats": 7,
    "gearbox": "automatic",
    "fuel": ["diesel"]
  }
}
There are two opening braces and two closing braces. No comma after the fuel array. No comma before either closing brace. Do not alter any other text or graphics. This is a surgical punctuation fix, preserve everything else.

### Correction for image 2

Edit this educational infographic while preserving its layout, typography, colors and all content. Make exactly two accuracy corrections:
1. In lane 3 "Edit preference controls", replace "Set maximum price to 10,000" with EXACTLY "Set maximum price to 110,000". Keep the same font, two-line arrangement and card.
2. In lane 1, the green "Basic rule parser" card on the decision's No branch currently has no outgoing connector. Add one clear green connector from the RIGHT edge of this specific card to the existing green incoming line for the "Shared code pipeline". Route it through available whitespace without crossing text, with an arrow indicating flow into the shared pipeline. BOTH the no-AI parser and error-fallback parser must lead to the shared search pipeline.
Preserve everything else, including the example "10,000 PLN more" in lane 1, which is correct and must stay unchanged. Do not remove or rewrite any content.


Generated using the built-in image generation tool.

## Image 1

Use case: scientific-educational / infographic-diagram.
Create a polished, exceptionally legible educational poster about the user's existing Motivo car-advisor app. This is a finished explanatory image, not a website screenshot. Portrait composition, roughly 3:4, high resolution, generous whitespace, editorial typography, subtle rounded cards, clean line icons. Warm ivory background, dark charcoal text. Purple identifies LLM activity, emerald green identifies JavaScript code, blue identifies catalog data. Clear large arrows and numbered steps. Use plain English for a student learning AI engineering. All text must be sharp, correctly spelled, unclipped. Avoid decorative tiny text and car photos. Use regular hyphens, no em dashes.
Title: "Motivo: from your message to car recommendations"
Subtitle: "The current workflow when an LLM is enabled"
Legend: "Purple = LLM | Green = JavaScript | Blue = Catalog"
Main vertical numbered flow, with aligned side notes:
1. "Your message"
Quote: "We are a family of seven. Diesel, automatic, up to 110,000 PLN."
2. "LLM: interpret the request"
Text: "Reads your message, existing preferences and recent conversation."
Side note: "OpenAI or local Ollama. The LLM receives text and preferences, not the full car catalog."
3. "Structured preferences"
Show exactly this readable JSON snippet in a monospace card:
{
  "intent": "search",
  "preferences": {
    "maxPrice": 110000,
    "minSeats": 7,
    "gearbox": "automatic",
    "fuel": ["diesel"]
  }
}
Label below snippet: "Simplified JSON - other fields omitted"
Side note: "'Family of seven' becomes minSeats: 7. This is meaning extraction, more than matching keywords."
4. "Code: check and normalize"
Text: "Parse JSON, check basic output fields, normalize allowed values."
Side note amber warning: "Valid JSON can still contain the wrong interpretation."
5. "Code: filter the real catalog"
Text: "Keep eligible listings that satisfy every active requirement."
Four clear filter pills: "price <= 110000", "seats >= 7", "gearbox = automatic", "fuel = diesel".
Blue data cylinder connected laterally: "12,000 historical listings" with small label "March 2025 snapshot".
Side note: "Unknown seats do not satisfy a seat requirement. Damaged and flagged listings are excluded."
6. "Code: rank the remaining cars"
Text: "Fixed scoring rules weigh model year, mileage and price."
Side note: "Filtering decides eligibility. Ranking decides order."
7. "Code + interface: present the results"
Text: "Up to 3 different models, recorded facts, reasons and tradeoffs."
Show a small 3-card shortlist icon.
Below: "'View all matches' opens paginated listings."
Side note: "The response text is assembled by code. The LLM does not choose cars or write the final explanation in this version."
Footer takeaway in bold: "The LLM understands the request. Code searches, ranks and explains."
Small footer: "Architecture diagram, not a measured model response. No fine-tuning or vector search in this workflow."
Make everything readable at comfortable zoom, no invented car models, no result counts claimed for this example. Do not show a second LLM after retrieval. Do not imply the LLM queries a database or verifies vehicle facts.

## Image 2

Use case: scientific-educational / infographic-diagram.
Create a second finished educational diagram for the same Motivo car-advisor project. Landscape 3:2, high resolution. Warm ivory background, dark charcoal typography, generous whitespace, clean rounded cards and line icons. Purple = LLM, emerald green = JavaScript, blue = catalog, amber = failure / caution. Student-friendly English. Large readable text, no clipped labels, no em dashes. Title: "When does Motivo use the LLM?"
Subtitle: "Three entry paths, one shared catalog search"
Upper main diagram: three clear parallel horizontal lanes, flowing left to right, each converging on one green shared pipeline at right.
Lane 1 purple accented:
"Type a new message"
-> decision "AI provider enabled?"
Yes -> purple "LLM interprets meaning" -> green "Parse and normalize preferences".
No -> green "Basic rule parser".
A clearly marked amber branch out of the LLM card: "Timeout, connection failure or invalid output" -> green "Basic rule parser + visible warning".
A purple example next to LLM input: "'Actually, I can spend 10,000 PLN more.' Context helps interpret the update."
Lane 2 green accented:
"Click an interview answer"
Example: "'At least 7 seats'"
-> "Validate the offered choice"
-> "Update minSeats directly"
Badge: "No LLM call"
Lane 3 green accented:
"Edit preference controls"
Example: "Set maximum price to 110,000"
-> "Use the supplied filters directly"
Badge: "No LLM call"
All three paths join a large green shared pipeline labelled "Shared code pipeline":
"Filter catalog -> Rank matches -> Build shortlist and explanation"
A blue catalog cylinder supplies only this pipeline: "Real historical listings".
Below it a feedback loop:
"Code chooses unanswered questions from current inventory"
-> "Up to 3 questions per round"
-> "Continue, skip or finish"
Loop arrow back to lane 2, labelled "Answer updates filters and repeats the search".
Add small label: "'What changed' compares old filters and match counts with new ones."
Bottom section is two equal educational callout cards.
Card A title: "Deterministic vs probabilistic"
Text: "Same filters + same catalog = same filtering and ranking."
Text: "LLM interpretation can be wrong, even when its JSON is valid."
Card B amber title: "Why your earlier request failed"
Text: "A car request was classified as intent: offtopic."
Arrow to: "Code hid the results."
Text: "The UI then showed an incorrect interview-complete panel."
Small amber sublabel: "This is the current observed bug, not desired behavior."
Bold takeaway footer: "A successful API call proves the model responded. Evaluation checks whether it understood correctly."
Accuracy constraints: no claim these bugs are already fixed; no claim switching to OpenAI guarantees correctness; no ML-based ranking; no LLM-generated interview questions; rule-based fallback is limited and may misread negation. Ensure branching connectors and convergence are clear, not a confusing web. Use a well-designed educational layout with short, spacious text blocks.
