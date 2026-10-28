const RESULT_TOKEN = /^\[(TESTS-GREEN|NO-TESTS-NEEDED|BLOCKED)\](.*)$/m;

// Facts about an agent run, read from the JSONL event log of `opencode run --format json`.
// The skills listed here were actually loaded, as opposed to what the agent says it used.
export function parseAgentLog(text) {
  const skills = [];
  const tools = {};
  const failedCalls = [];
  const errors = [];
  const texts = [];
  let cost = 0;
  let steps = 0;
  const tokens = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };

  for (const line of text.split('\n')) {
    const event = parseLine(line);
    if (!event) continue;
    const part = event.part ?? {};

    if (event.type === 'tool_use') {
      tools[part.tool] = (tools[part.tool] ?? 0) + 1;
      if (part.state?.status === 'error') failedCalls.push({ tool: part.tool, error: String(part.state.error ?? '').slice(0, 300) });
      else if (part.tool === 'skill' && part.state?.input?.id && !skills.includes(part.state.input.id)) skills.push(part.state.input.id);
    } else if (event.type === 'step_start') {
      steps++;
    } else if (event.type === 'step_finish') {
      cost += part.cost ?? 0;
      tokens.input += part.tokens?.input ?? 0;
      tokens.output += part.tokens?.output ?? 0;
      tokens.reasoning += part.tokens?.reasoning ?? 0;
      tokens.cacheRead += part.tokens?.cache?.read ?? 0;
      tokens.cacheWrite += part.tokens?.cache?.write ?? 0;
    } else if (event.type === 'text' && part.text) {
      texts.push(part.text);
    } else if (event.type === 'error') {
      errors.push(errorMessage(event));
    }
  }

  const finalReply = texts.at(-1)?.trim() ?? null;
  const token = finalReply && RESULT_TOKEN.exec(finalReply);
  return {
    result: token ? token[1] : null,
    blockedReason: token?.[1] === 'BLOCKED' ? token[2].trim() : null,
    skills,
    tools,
    failedCalls,
    errors,
    steps,
    cost: Math.round(cost * 10000) / 10000,
    tokens,
  };
}

function parseLine(line) {
  if (!line.trim().startsWith('{')) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function errorMessage(event) {
  const error = event.error ?? event.part?.error ?? {};
  return String(error.data?.message ?? error.message ?? error.name ?? JSON.stringify(error)).slice(0, 300);
}
