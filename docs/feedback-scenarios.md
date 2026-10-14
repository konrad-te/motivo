# Feedback refinement checks

After a search, click **Not satisfied with the results?** beside **View all matches** to focus the main chat input. Its placeholder changes to invite feedback. Use this same input to answer the advisor’s follow-up questions. Suggested questions are available through the optional **Help me decide** shortcut above the input. The **Start over** shortcut beside the active filters asks for confirmation before clearing the filters and starting a new chat; previous conversations and their results remain saved.

| Customer feedback | Expected behavior |
| --- | --- |
| These are too old. | Ask the oldest acceptable model year; keep all existing requirements. |
| 2018 | When answering the year question, add a 2018 minimum without changing budget, fuel or transmission. |
| I prefer lower mileage. | Change the ranking preference; do not invent a mileage cap. |
| The mileage is too high. | Ask for a maximum mileage. |
| 2018 or newer, under 100,000 km. | Apply both explicit limits and explain the changed result count. |
| These are too expensive. | Ask for a comfortable maximum price; do not guess a budget. |
| I need more boot space. | Explain that boot space is unavailable; ask which recorded requirement the customer wants to change. |
| I don't like these. | Ask what feels wrong instead of guessing unrelated filters. |
| An unrelated request | Show the appropriate response without a no-results or interview-complete panel. |

The automated tests cover application behavior with controlled model responses and catalog-mode fallbacks. They do not establish a live model's language accuracy. Use these same cases with your configured model and inspect **Search details**: intent, clarification, updated fields and resulting preferences.

The rules fallback supports a narrower range of feedback. When it cannot interpret a change, it asks for clarification and keeps the current requirements.
