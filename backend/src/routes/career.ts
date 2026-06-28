import { Router } from 'express'
import { getProvider } from '../provider-registry'
import { chatRateLimiter } from '../utils/rate-limiter'
import { authMiddleware } from '../middleware/auth'
import type { ChatMessage } from '../providers/interface'

const router = Router()

router.post('/career/suggest', authMiddleware, chatRateLimiter, async (req, res) => {
  try {
    const {
      fieldLabel = '',
      companyName = '',
      jobTitle = '',
      jobDescription = '',
      resumeText = '',
      skills = '',
      experience = '',
      targetRole = '',
      coverLetterText = '',
    } = req.body as Record<string, string>

    const providerName = (req.headers['x-provider'] as string) || 'openrouter'
    const provider = getProvider(providerName)

    const roleContext = jobTitle || targetRole || 'the role'
    const companyContext = companyName ? ` at ${companyName}` : ''

    const systemPrompt = `You help someone fill out job applications. Write their answer in their voice — first person, natural and direct, like a real person typed it. No fluff, no filler phrases, no corporate buzzwords.

Rules:
- Sound human. Avoid phrases like "I am deeply passionate", "I thrive in", "leverage my expertise", "I am excited to", "dynamic environment", "proven track record". Write the way people actually talk.
- Match the length to the field. A short label (e.g. "Years of experience", "Notice period") gets one sentence or a number. A longer field (e.g. "Cover letter", "Tell us about yourself") gets 2–4 short paragraphs max.
- Be specific. Use concrete details from the profile — actual skills, real experience — not generic claims.
- Do not start with "I" if you can avoid it. Vary the opening.
- Output only the answer text. No preamble, no label, no quotation marks around the answer.

About the applicant:
${targetRole ? `- Applying for: ${targetRole}` : ''}
${skills ? `- Skills: ${skills}` : ''}
${experience ? `- Background: ${experience}` : ''}
${resumeText ? `- Resume (excerpt): ${resumeText.slice(0, 800)}` : ''}
${coverLetterText ? `- Cover letter draft (for tone reference): ${coverLetterText.slice(0, 400)}` : ''}

Job context:
${(jobTitle || targetRole) ? `- Role: ${jobTitle || targetRole}${companyContext}` : ''}
${jobDescription ? `- JD excerpt: ${jobDescription.slice(0, 600)}` : ''}`

    const history: ChatMessage[] = []
    const userMessage = `Fill in this field: "${fieldLabel}"`

    const suggestion = await provider.chat([...history, { role: 'user', content: userMessage }], systemPrompt)

    res.json({ suggestion })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate suggestion'
    res.status(500).json({ error: message })
  }
})

router.post('/career/tailor-resume', authMiddleware, chatRateLimiter, async (req, res) => {
  try {
    const {
      resumeText = '',
      skills = '',
      experience = '',
      targetRole = '',
      jobTitle = '',
      companyName = '',
      jobDescription = '',
    } = req.body as Record<string, string>

    const providerName = (req.headers['x-provider'] as string) || 'openrouter'
    const provider = getProvider(providerName)

    const hasResume   = resumeText.trim().length > 0
    const hasProfile  = (skills + experience + targetRole).trim().length > 0
    const roleLabel   = jobTitle || targetRole || 'this role'
    const companyLabel = companyName ? ` at ${companyName}` : ''

    const mode = hasResume ? 'tailor' : hasProfile ? 'generate' : 'minimal'

    const modeInstruction =
      mode === 'tailor'
        ? `The applicant has provided their full resume below. Rewrite the three sections to align tightly with the job posting while keeping their real experience intact.`
        : mode === 'generate'
        ? `The applicant has not uploaded a full resume but has filled in their profile. Generate resume sections that accurately represent what they've told you — do not invent specifics they haven't provided.`
        : `No resume or profile was provided. Generate reasonable placeholder resume sections for someone applying to ${roleLabel}${companyLabel}. Use the job description as the only context. Make it clear but generic — the user will personalise it.`

    const systemPrompt = `You are writing resume content for a job application. Return ONLY valid JSON — no markdown fences, no explanation, no text outside the JSON object.

${modeInstruction}

Rules:
- Sound like a real person wrote it. No "passionate", "leverage", "synergy", "results-driven", "dynamic", "proven track record".
- summary: 2–3 sentences, first person, specific to this role.
- skills: comma-separated, most relevant to the JD first.
- experienceBullets: 4–6 bullet strings (no leading dash or bullet char), start each with a strong past-tense action verb, include a measurable outcome where the profile supports it.
- keywordsMatched: array of important terms from the JD you wove into the content.
- Do not invent job titles, company names, dates, or metrics the applicant didn't provide.

Applicant profile:
${targetRole  ? `Target role: ${targetRole}`         : ''}
${skills      ? `Skills: ${skills}`                  : ''}
${experience  ? `Background: ${experience}`          : ''}
${hasResume   ? `Resume:\n${resumeText.slice(0, 2000)}` : ''}

Job posting:
Role: ${roleLabel}${companyLabel}
${jobDescription ? `Description:\n${jobDescription.slice(0, 1200)}` : ''}

Return this exact JSON shape:
{
  "summary": "...",
  "skills": "...",
  "experienceBullets": ["...", "..."],
  "keywordsMatched": ["...", "..."]
}`

    const raw = await provider.chat(
      [{ role: 'user', content: 'Generate the tailored resume sections now.' }],
      systemPrompt
    )

    // Strip optional markdown fences the model may add despite instructions
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    let parsed: { summary: string; skills: string; experienceBullets: string[]; keywordsMatched: string[] }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      res.status(500).json({ error: 'AI returned malformed JSON — please try again' })
      return
    }

    res.json({
      summary:           parsed.summary           ?? '',
      skills:            parsed.skills             ?? '',
      experienceBullets: Array.isArray(parsed.experienceBullets) ? parsed.experienceBullets : [],
      keywordsMatched:   Array.isArray(parsed.keywordsMatched)   ? parsed.keywordsMatched   : [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to tailor resume'
    res.status(500).json({ error: message })
  }
})

export default router
