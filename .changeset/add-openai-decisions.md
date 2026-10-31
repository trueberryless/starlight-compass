---
"starlight-compass": minor
---

Adds the `openaiDecisions()` provider, which answers questions with the [OpenAI Decisions API](https://developers.openai.com/api/docs/guides/decisions) and GPT-6 Luna, or any other server implementing the API, like LocalAI. It works with the `ask` option too.

```js
import starlightCompass, { openaiDecisions } from "starlight-compass";

starlightCompass({ provider: openaiDecisions() });
```
