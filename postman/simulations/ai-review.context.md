# AI review simulation

## Purpose
Exercise the real Python evidence agent and HTTP transport against Groq, OpenAI and Anthropic wire fixtures. No provider credentials or paid calls are used.

## Execution
Run `postman simulation run postman/simulations/ai-review.sim.yaml --port 4901 --no-history --output ndjson`, then `python scripts/test_ai_provider_simulation.py http://127.0.0.1:4901` in another terminal. Stop the server after testing.

## Assumptions
Official contracts: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Claude tool results](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls), [Groq](https://console.groq.com/docs/openai).
Orbit supplied endpoint/auth details but its examples lacked tool schemas; the official references supplied the missing tool-use contract. No signed-in owner-mock search was performed. Fixtures validate the used request subset, not the providers' entire API. Model access, live credentials, model quality and real billing are unverified.
The test temporarily patches endpoint constants in its own Python process; production endpoints remain fixed. Only fixture keys and local evidence are sent.

## Observations
<!-- begin -->
- 2026-10-26: All three members received two successful POSTs and one HTTP 429. The real agent completed evidence reads/final JSON, accounted for 400 fixture tokens, retained the failed-call reservation and did not retry or echo the error body. No member was silent.
<!-- end -->
