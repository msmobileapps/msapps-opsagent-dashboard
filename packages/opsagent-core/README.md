# opsagent-core

Provider-agnostic workflow, matching, and AI task contracts for OpsAgent.

Shared across all OpsAgent client dashboards (SocialJet, MSApps, etc.).

## Installation

```bash
npm install opsagent-core
```

Or as a local dependency:

```json
{
  "dependencies": {
    "opsagent-core": "file:packages/opsagent-core"
  }
}
```

## Usage

```js
import { matchScore, matchRank } from 'opsagent-core'
import { buildSchedule } from 'opsagent-core/scheduling'
import { RuntimeClient } from 'opsagent-core/ai/runtime-client'
```

## Modules

| Module | Description |
|--------|-------------|
| `matching` | Score and rank items against criteria |
| `scheduling` | Cron parsing, schedule formatting |
| `state` | Generic workflow state management |
| `discovery` | Lead/prospect discovery and prioritization |
| `outreach` | Outreach tracking and follow-up detection |
| `ai/tasks` | Agent task prompt building and output parsing |
| `ai/runtime-client` | HTTP client for OpsAgent API |

## License

ISC
