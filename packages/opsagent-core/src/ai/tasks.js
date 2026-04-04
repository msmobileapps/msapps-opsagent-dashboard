/**
 * AI task contracts — defines the interface for agent tasks.
 * Each client's dashboard uses these contracts to communicate
 * with the MCP scheduled tasks system.
 */

export function buildTaskPrompt(clientName, agentName, context = {}) {
  const contextLines = Object.entries(context)
    .map(([k, v]) => `- **${k}**: ${v}`)
    .join('\n')

  return `Run OpsAgent agent "${agentName}" for client "${clientName}".

**Agent context:**
${contextLines || '_(no additional context)_'}

Execute this agent workflow and save the results.`
}

export function parseTaskOutput(rawOutput) {
  if (!rawOutput) return { sections: [], summary: '' }

  const sections = []
  let currentSection = null

  for (const line of rawOutput.split('\n')) {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (currentSection) sections.push(currentSection)
      currentSection = { title: line.replace(/^#+\s*/, ''), content: [] }
    } else if (currentSection) {
      currentSection.content.push(line)
    }
  }
  if (currentSection) sections.push(currentSection)

  return {
    sections: sections.map(s => ({ ...s, content: s.content.join('\n').trim() })),
    summary: sections[0]?.content?.join('\n')?.trim() || '',
  }
}
