import type { ExtractionResult } from '../types'

export function buildCollectionChatSystemPrompt(title: string, summary: ExtractionResult): string {
  const { summary: overallSummary, requirements, features, decisions, openQuestions } = summary

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

  return `You are an AI assistant helping to analyze and refine the synthesized notes from a collection of meetings on a shared topic.

## Collection: "${title}"

**Overall Summary:** ${overallSummary}

**Action Items & Requirements (across all meetings):**
${requirements.functional.map((r) => `- ${r}`).join('\n') || 'None'}

**Constraints & Considerations:**
${requirements.nonFunctional.map((r) => `- ${r}`).join('\n') || 'None'}

**Topics / Features:**
${featureText || 'None'}

**Decisions Made:**
${decisions.map((d) => `✓ ${d}`).join('\n') || 'None'}

**Open Questions:**
${openQuestions.map((q) => `? ${q}`).join('\n') || 'None'}

---

You can answer questions, search for specific details across meetings, and help make additions or changes to this collection summary. When you modify the summary, explain what changed and output the complete updated summary as a JSON code block in exactly this format:

\`\`\`json
{
  "summary": "...",
  "requirements": { "functional": [...], "nonFunctional": [...] },
  "features": [{ "title": "...", "description": "...", "dataFlow": [...], "decisions": [...], "openQuestions": [...] }],
  "decisions": [...],
  "openQuestions": [...]
}
\`\`\`

When asked to create a diagram (flow chart, sequence diagram, entity diagram, architecture overview, etc.), output a Mermaid code block with a descriptive title on the first line. Do NOT include a JSON block in the same response as a diagram.

\`\`\`mermaid
%% Title: Architecture Overview
graph TD
  A[Example] --> B[Example]
\`\`\``
}

export function buildSynthesisSystemPrompt(): string {
  return `You are an AI assistant that synthesizes structured notes from multiple meetings into a single coherent summary.

You will receive notes from several meetings. Your job is to merge them into one unified structured document that captures the full picture across all meetings — consolidating common themes, combining requirements, merging features, and listing all open questions and decisions.

Output ONLY a JSON code block in exactly this format, with no other text:

\`\`\`json
{
  "summary": "A concise paragraph summarizing the overall topic and key outcomes across all meetings",
  "requirements": {
    "functional": ["Combined and deduplicated list of all functional requirements and action items"],
    "nonFunctional": ["Combined and deduplicated list of all constraints and non-functional requirements"]
  },
  "features": [
    {
      "title": "Feature or topic title",
      "description": "Merged description",
      "dataFlow": [],
      "decisions": [],
      "openQuestions": []
    }
  ],
  "decisions": ["All decisions made across meetings, deduplicated"],
  "openQuestions": ["All open questions across meetings, deduplicated"]
}
\`\`\``
}

export function buildSynthesisUserMessage(
  items: { title: string; extraction: ExtractionResult }[]
): string {
  const sections = items.map(({ title, extraction }) => {
    const { summary, requirements, features, decisions, openQuestions } = extraction
    return `### Meeting: "${title}"
Summary: ${summary}
Requirements: ${requirements.functional.join('; ') || 'None'}
Constraints: ${requirements.nonFunctional.join('; ') || 'None'}
Features: ${features.map((f) => `${f.title} — ${f.description}`).join('; ') || 'None'}
Decisions: ${decisions.join('; ') || 'None'}
Open Questions: ${openQuestions.join('; ') || 'None'}`
  })

  return `Please synthesize the following ${items.length} meeting note${items.length === 1 ? '' : 's'} into a single unified summary:\n\n${sections.join('\n\n')}`
}
