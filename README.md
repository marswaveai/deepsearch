## Configuring deepsearch

- `getOptions` from `src/agent-helper`

  - `tokenBudget = 1000000`: $0.02, maximum of tokens allowed
  - `maxBadAttemps = 2`: how many unsuccessful search/reasoning attempts the
    system will tolerate before giving up.

  - `numReturnedURLs: number = 75` Previously 100, controls how many search
    result URLs to retrieve during the search phase, affecting the breadth of
    information gathered.

  - `noDirectAnswer: boolean = false` - When set to true, this likely instructs
    the system to focus on gathering information without generating a direct
    answer, which might be useful for research-style queries.

- `boostHostnames: string[] = []` - An array of domain names that should be
  given higher priority in search results, allowing users to focus the search on
  trusted or preferred sources.

- `badHostnames: string[] = []` - An array of domain names that should be
  deprioritized or excluded from search results, helping to filter out
  unreliable or unwanted sources.

In `src/utils/schema.ts`:

1. `MAX_URLS_PER_STEP = 4` - This limits the number of URLs that can be
   processed in a single iteration of the deep search loop. This prevents the
   system from attempting to read too many web pages at once, which could
   overwhelm the token budget or make reasoning less focused.

2. `MAX_QUERIES_PER_STEP = 5` - This caps the number of search queries that can
   be generated and executed within a single iteration. This prevents the agent
   from going too broad with its searches before evaluating results.

3. `MAX_REFLECT_PER_STEP = 2` - This limits how many reflection or reasoning
   steps the agent can perform before taking action (such as searching again or
   reading a URL). This encourages the agent to balance thinking with gathering
   new information.

## Releasing a new version

```bash
pnpm changeset
pnpm changeset version

# commit to git

pnpm release
```
