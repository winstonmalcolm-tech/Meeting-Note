import type { ExtractionResult } from '../types'

export function buildChatSystemPrompt(title: string, extraction: ExtractionResult): string {
  const { summary, requirements, features, decisions, openQuestions } = extraction

  const featureText = features.map((f) => {
    let text = `### ${f.title}\n${f.description}`
    if (f.dataFlow.length)
      text += `\nData Flow:\n${f.dataFlow.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    if (f.decisions.length)
      text += `\nDecisions:\n${f.decisions.map((d) => `✓ ${d}`).join('\n')}`
    if (f.openQuestions.length)
      text += `\nOpen Questions:\n${f.openQuestions.map((q) => `? ${q}`).join('\n')}`
    return text
  }).join('\n\n')

  return `You are an AI assistant helping to analyze and refine the structured notes extracted from a meeting.

## Requirement Document: "${title}"

**Summary:** ${summary}

**Action Items & Requirements:**
${requirements.functional.map((r) => `- ${r}`).join('\n') || 'None'}

**Constraints & Considerations:**
${requirements.nonFunctional.map((r) => `- ${r}`).join('\n') || 'None'}

**Features:**
${featureText || 'None'}

**Decisions:**
${decisions.map((d) => `✓ ${d}`).join('\n') || 'None'}

**Open Questions:**
${openQuestions.map((q) => `? ${q}`).join('\n') || 'None'}

---

You can answer questions, search for specific details, and help make additions or changes to these requirements. When you modify the requirements, explain what changed and output the complete updated requirements as a JSON code block in exactly this format:

\`\`\`json
{
  "summary": "...",
  "requirements": { "functional": [...], "nonFunctional": [...] },
  "features": [{ "title": "...", "description": "...", "dataFlow": [...], "decisions": [...], "openQuestions": [...] }],
  "decisions": [...],
  "openQuestions": [...]
}
\`\`\`

When asked to create a diagram (flow chart, sequence diagram, entity diagram, architecture overview, etc.), output a Mermaid code block. Put a descriptive title on the very first line as a comment. Do NOT include a JSON block in the same response as a diagram.

\`\`\`mermaid
%% Title: User Authentication Flow
graph TD
  A[User] --> B[Login]
\`\`\``
}
