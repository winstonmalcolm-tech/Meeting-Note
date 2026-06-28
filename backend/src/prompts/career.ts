export function buildResumeAnalysisPrompt(resume: string, jobDescription: string, companyName: string, jobTitle: string): string {
  return `You are an expert career coach and resume reviewer. Analyze the candidate's resume against the job description and provide actionable feedback.

## Job
**Company:** ${companyName}
**Role:** ${jobTitle}

## Job Description
${jobDescription}

## Candidate's Resume
${resume}

---

Provide a structured analysis with the following sections. Use markdown formatting.

### Overall Fit
A 1-2 sentence summary and a fit score out of 10 (e.g. **7/10**).

### Keyword Gaps
List keywords, skills, or phrases from the JD that are absent or underrepresented in the resume. Be specific.

### Strengths
What in the resume maps strongly to what the role requires.

### Areas to Strengthen
Specific resume sections or bullet points to improve, with concrete suggestions. Where possible, suggest a rewritten bullet using the STAR or XYZ format.

### Bottom Line
One paragraph on whether to apply and what to prioritise fixing first.`
}

export function buildCoverLetterPrompt(resume: string, jobDescription: string, companyName: string, jobTitle: string): string {
  return `You are an expert cover letter writer. Write a tailored, compelling cover letter for this candidate.

## Job
**Company:** ${companyName}
**Role:** ${jobTitle}

## Job Description
${jobDescription}

## Candidate's Resume
${resume}

---

Write a professional cover letter (3-4 paragraphs, ~300 words). Rules:
- Open with a specific hook — reference something real about the company or role, not a generic opener
- Paragraph 2: connect 2-3 concrete achievements from the resume directly to the role's core needs
- Paragraph 3: demonstrate you understand the company's context (stage, market, challenges)
- Close: confident call to action, no grovelling
- Tone: direct, confident, human — not corporate filler
- Do NOT use phrases like "I am writing to express my interest", "I believe I would be a great fit", or "Please find attached"

Output only the cover letter text, ready to copy.`
}

export function buildJDDecoderPrompt(jobDescription: string, companyName: string, jobTitle: string): string {
  return `You are an experienced hiring manager and recruiter who knows how to read between the lines of job descriptions. Decode what the employer truly wants.

## Job
**Company:** ${companyName}
**Role:** ${jobTitle}

## Job Description
${jobDescription}

---

Provide a structured breakdown with the following sections. Use markdown formatting.

### What They're Really Looking For
Beyond the listed requirements — what problem are they actually trying to solve by hiring this person? What does success look like in this role in the first 90 days?

### Hidden Priorities
3-5 bullet points on what matters most, inferred from language, ordering, and emphasis in the JD. Call out anything that's listed as "nice to have" but is likely actually required.

### Culture Signals
What does the JD reveal about how this team works, what they value, and the management style?

### Red Flags
Anything in the JD that a candidate should ask about or be cautious of (vague scope, unrealistic expectations, churn signals, etc.). If none, say so.

### What to Emphasise in Your Application
3-5 specific things to highlight in your resume and cover letter to stand out for this role.`
}

export function buildJobFitScoringPrompt(resume: string, jobs: { id: string; title: string; company: string; description: string }[]): string {
  const jobList = jobs.map((j, i) =>
    `[${i}] id:${j.id}\nTitle: ${j.title}\nCompany: ${j.company}\nDescription (excerpt): ${j.description.slice(0, 400)}`
  ).join('\n\n')

  return `You are a career coach scoring job fit for a candidate based on their resume.

## Candidate Resume
${resume.slice(0, 3000)}

## Jobs to Score
${jobList}

---

Return ONLY a JSON array — no prose, no markdown fences. One object per job in the same order:
[{ "id": "<id>", "score": <1-10>, "reason": "<one sentence>" }, ...]

Score 1-10 where 10 = near-perfect match. Be realistic and differentiated.`
}

export function buildLinkedInOptimizerPrompt(
  targetRole: string,
  headline: string,
  summary: string,
  skills: string,
  experience: string
): string {
  return `You are a LinkedIn profile coach who helps professionals land more interviews through better positioning.

## Target Role
${targetRole || 'Not specified — give general advice for senior professional profiles'}

## Current Profile

**Headline:** ${headline || '(not provided)'}

**Summary / About:**
${summary || '(not provided)'}

**Skills listed:**
${skills || '(not provided)'}

**Experience summary:**
${experience || '(not provided)'}

---

Provide improvements in the following sections. Use markdown formatting.

### Headline
Rewrite their headline. Make it specific, keyword-rich, and outcome-focused. Provide 2-3 variants to choose from.

### Summary / About
Rewrite their About section (3-4 short paragraphs). Open with a hook, clarify their value proposition, connect to the target role. Aim for ~150-200 words.

### Skills
List 10-15 skills to add or prioritise based on their target role and current profile. Note which ones are most searched by recruiters.

### Quick Wins
3-5 other profile improvements (profile photo note, featured section, activity tips, etc.) that will improve visibility or credibility.`
}
