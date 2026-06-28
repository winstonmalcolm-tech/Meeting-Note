// ─── Field matching ───────────────────────────────────────────────────────────

// Order matters — most specific patterns first to avoid false positives
const FACTUAL_MATCHERS = [
  { key: 'email',       pattern: /email/i },
  { key: 'phone',       pattern: /phone|mobile|tel/i },
  { key: 'linkedinUrl', pattern: /linkedin/i },
  { key: 'nameFirst',   pattern: /first.?name|given.?name/i },
  { key: 'nameLast',    pattern: /last.?name|surname|family.?name/i },
  { key: 'nameFull',    pattern: /^name$|full.?name|your.?name/i },
  { key: 'targetRole',  pattern: /\btitle\b|position|^role$|job.?title/i },
]

const SUGGEST_PATTERNS = [
  /cover.?letter|covering|motivation|why.+want|why.+inter/i,
  /experience|background|summary|about\s+you|bio/i,
  /skills|strengths|qualif/i,
  /describe|tell\s+us|explain|highlight|accomplishment|achiev/i,
  /why\s+(do\s+you|are\s+you)|interest/i,
]

function getSignals(el) {
  const signals = []
  if (el.name)        signals.push(el.name)
  if (el.id)          signals.push(el.id)
  if (el.placeholder) signals.push(el.placeholder)
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel)      signals.push(ariaLabel)

  // Associated <label> via htmlFor
  if (el.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (label) signals.push(label.textContent.trim())
    } catch {}
  }

  // Walk up DOM up to 4 levels looking for a <label>
  let node = el.parentElement
  for (let i = 0; i < 4 && node; i++) {
    if (node.tagName === 'LABEL') {
      signals.push(node.textContent.trim())
      break
    }
    // Also check for a sibling or child label
    const sibling = node.querySelector('label')
    if (sibling && sibling !== el) {
      signals.push(sibling.textContent.trim())
      break
    }
    node = node.parentElement
  }

  return signals.filter(Boolean)
}

function matchFactual(el) {
  const signals = getSignals(el)
  for (const { key, pattern } of FACTUAL_MATCHERS) {
    if (signals.some(s => pattern.test(s))) return key
  }
  return null
}

function shouldGetSuggestButton(el) {
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT' && el.type === 'text') {
    const signals = getSignals(el)
    return SUGGEST_PATTERNS.some(p => signals.some(s => p.test(s)))
  }
  return false
}

function resolveFactual(key, profile, user) {
  const parts = (user?.name || '').split(' ')
  const firstName = parts[0] || ''
  const lastName  = parts.slice(1).join(' ')
  switch (key) {
    case 'email':       return user?.email || ''
    case 'phone':       return profile?.phone || ''
    case 'linkedinUrl': return profile?.linkedinUrl || ''
    case 'nameFirst':   return firstName
    case 'nameLast':    return lastName
    case 'nameFull':    return user?.name || ''
    case 'targetRole':  return profile?.targetRole || ''
    default:            return ''
  }
}

// React/Vue/Angular-compatible field fill
function fillElement(el, value) {
  if (!value) return false
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (nativeSetter) {
    nativeSetter.call(el, value)
  } else {
    el.value = value
  }
  el.dispatchEvent(new Event('input',  { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

// ─── Page context extraction ──────────────────────────────────────────────────

function extractPageContext() {
  // Job title: try og:title, h1, or page <title>
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
  const h1      = document.querySelector('h1')?.textContent?.trim() || ''
  const title   = document.title || ''
  const jobTitle = ogTitle || h1 || title

  // Company name: try og:site_name, common selectors, or domain
  const ogSite      = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
  const companyEl   = document.querySelector('[class*="company"],[data-testid*="company"],[class*="employer"]')
  const companyName = ogSite || companyEl?.textContent?.trim() || ''

  // Job description: largest text block in common containers
  const descSelectors = [
    '[class*="description"]',
    '[class*="job-desc"]',
    '[class*="jobDesc"]',
    '[id*="description"]',
    'article',
    '[class*="posting"]',
    '[class*="details"]',
  ]
  let jobDescription = ''
  for (const sel of descSelectors) {
    const el = document.querySelector(sel)
    if (el && el.textContent.trim().length > 200) {
      jobDescription = el.textContent.trim().slice(0, 1200)
      break
    }
  }

  return { jobTitle, companyName, jobDescription }
}

// ─── Best label text for a field ─────────────────────────────────────────────

function getBestLabel(el) {
  // 1. aria-label
  const aria = el.getAttribute('aria-label')
  if (aria) return aria

  // 2. Associated <label>
  if (el.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (label) return label.textContent.trim()
    } catch {}
  }

  // 3. Walk up DOM
  let node = el.parentElement
  for (let i = 0; i < 4 && node; i++) {
    if (node.tagName === 'LABEL') return node.textContent.replace(el.value, '').trim()
    const label = node.querySelector('label')
    if (label) return label.textContent.trim()
    node = node.parentElement
  }

  // 4. placeholder
  if (el.placeholder) return el.placeholder

  // 5. name/id
  return el.name || el.id || 'this field'
}

// ─── Popover ──────────────────────────────────────────────────────────────────

let activePopover = null
let activeTargetEl = null

function getOrCreatePopover() {
  let el = document.getElementById('mn-suggest-popover')
  if (!el) {
    el = document.createElement('div')
    el.id = 'mn-suggest-popover'
    el.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      padding: 14px;
      width: 420px;
      max-height: 340px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #e4e4e7;
      display: none;
      flex-direction: column;
      gap: 10px;
    `
    document.body.appendChild(el)
  }
  return el
}

function positionPopover(popover, targetEl) {
  const rect = targetEl.getBoundingClientRect()
  const gap = 8
  const ph = 340
  const pw = 420

  // rect coords are viewport-relative; popover is position:fixed so use them directly
  let top = rect.bottom + gap
  if (rect.bottom + gap + ph > window.innerHeight) {
    top = rect.top - gap - ph
  }
  let left = rect.left
  if (left + pw > window.innerWidth - 16) {
    left = window.innerWidth - pw - 16
  }
  popover.style.top  = `${Math.max(8, top)}px`
  popover.style.left = `${Math.max(8, left)}px`
}

function showPopover(targetEl, suggestion, onUse, onRegen) {
  const popover = getOrCreatePopover()
  activeTargetEl = targetEl

  popover.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#444;">
        AI Suggestion
      </span>
      <button id="mn-popover-close" style="background:none;border:none;color:#555;cursor:pointer;font-size:16px;line-height:1;padding:0 2px;">&times;</button>
    </div>
    <div id="mn-popover-text" style="flex:1;overflow-y:auto;max-height:200px;line-height:1.55;color:#ccc;white-space:pre-wrap;font-size:13px;">${escapeHtml(suggestion)}</div>
    <div style="display:flex;gap:8px;margin-top:4px;">
      <button id="mn-popover-use" style="flex:1;padding:7px;background:#6ee76e;border:none;border-radius:6px;color:#050507;font-size:13px;font-weight:600;cursor:pointer;">
        Use this
      </button>
      <button id="mn-popover-regen" style="padding:7px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#888;font-size:13px;cursor:pointer;">
        Regenerate
      </button>
    </div>
  `

  popover.style.display = 'flex'
  positionPopover(popover, targetEl)
  activePopover = popover

  document.getElementById('mn-popover-close').addEventListener('click', hidePopover)
  document.getElementById('mn-popover-use').addEventListener('click', () => { onUse(suggestion); hidePopover() })
  document.getElementById('mn-popover-regen').addEventListener('click', onRegen)
}

function showPopoverLoading(targetEl) {
  const popover = getOrCreatePopover()
  activeTargetEl = targetEl
  popover.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#444;">AI Suggestion</span>
      <button id="mn-popover-close" style="background:none;border:none;color:#555;cursor:pointer;font-size:16px;line-height:1;padding:0 2px;">&times;</button>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:12px 0;color:#555;">
      <div class="mn-spinner"></div>
      <span style="font-size:12px;">Generating suggestion…</span>
    </div>
  `
  popover.style.display = 'flex'
  positionPopover(popover, targetEl)
  activePopover = popover
  document.getElementById('mn-popover-close').addEventListener('click', hidePopover)
}

function showPopoverError(targetEl, message) {
  const popover = getOrCreatePopover()
  popover.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#444;">AI Suggestion</span>
      <button id="mn-popover-close" style="background:none;border:none;color:#555;cursor:pointer;font-size:16px;line-height:1;padding:0 2px;">&times;</button>
    </div>
    <div style="color:#f87171;font-size:12px;padding:4px 0;">${escapeHtml(message)}</div>
  `
  popover.style.display = 'flex'
  positionPopover(popover, targetEl)
  document.getElementById('mn-popover-close').addEventListener('click', hidePopover)
}

function hidePopover() {
  const popover = document.getElementById('mn-suggest-popover')
  if (popover) popover.style.display = 'none'
  activePopover = null
  activeTargetEl = null
}

// Close popover on outside click
document.addEventListener('click', (e) => {
  if (!activePopover) return
  if (activePopover.contains(e.target)) return
  if (activeTargetEl && (activeTargetEl.contains(e.target) || e.target === activeTargetEl)) return
  // Check if it's a suggest button
  if (e.target.closest?.('.mn-suggest-btn')) return
  hidePopover()
}, true)

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Suggest button injection ─────────────────────────────────────────────────

const injectedEls = new WeakSet()

function injectSuggestButtons() {
  injectStyles()
  const candidates = document.querySelectorAll(
    'textarea, input[type="text"], input:not([type])'
  )
  for (const el of candidates) {
    if (injectedEls.has(el)) continue
    if (!shouldGetSuggestButton(el)) continue
    if (el.style.display === 'none' || el.offsetParent === null) continue

    injectedEls.add(el)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mn-suggest-btn'
    btn.title = 'Get an AI-suggested answer'
    btn.innerHTML = '✨ Suggest'

    // Insert after the field
    el.insertAdjacentElement('afterend', btn)

    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      triggerSuggest(el, btn)
    })
  }
}

let cachedProfile = null
let cachedUser    = null

function triggerSuggest(el, btn) {
  const fieldLabel = getBestLabel(el)
  const pageCtx    = extractPageContext()

  btn.disabled = true
  btn.innerHTML = '<div class="mn-spinner" style="display:inline-block;"></div> Generating…'

  showPopoverLoading(el)

  chrome.runtime.sendMessage({
    type:           'SUGGEST',
    fieldLabel,
    companyName:    pageCtx.companyName,
    jobTitle:       pageCtx.jobTitle,
    jobDescription: pageCtx.jobDescription,
    profile:        cachedProfile,
  }, (response) => {
    btn.disabled = false
    btn.innerHTML = '✨ Suggest'

    if (chrome.runtime.lastError || response?.error) {
      const msg = chrome.runtime.lastError?.message || response?.error || 'Failed to generate'
      showPopoverError(el, msg)
      return
    }

    const suggestion = response?.suggestion || ''
    showPopover(
      el,
      suggestion,
      // onUse
      (text) => {
        fillElement(el, text)
      },
      // onRegen
      () => {
        btn.disabled = true
        btn.innerHTML = '<div class="mn-spinner" style="display:inline-block;"></div> Generating…'
        showPopoverLoading(el)
        triggerSuggestRetry(el, btn, fieldLabel, pageCtx)
      }
    )
  })
}

function triggerSuggestRetry(el, btn, fieldLabel, pageCtx) {
  chrome.runtime.sendMessage({
    type:           'SUGGEST',
    fieldLabel,
    companyName:    pageCtx.companyName,
    jobTitle:       pageCtx.jobTitle,
    jobDescription: pageCtx.jobDescription,
    profile:        cachedProfile,
  }, (response) => {
    btn.disabled = false
    btn.innerHTML = '✨ Suggest'

    if (chrome.runtime.lastError || response?.error) {
      const msg = chrome.runtime.lastError?.message || response?.error || 'Failed to generate'
      showPopoverError(el, msg)
      return
    }

    const suggestion = response?.suggestion || ''
    showPopover(
      el,
      suggestion,
      (text) => { fillElement(el, text) },
      () => {
        btn.disabled = true
        btn.innerHTML = '<div class="mn-spinner" style="display:inline-block;"></div> Generating…'
        showPopoverLoading(el)
        triggerSuggestRetry(el, btn, fieldLabel, pageCtx)
      }
    )
  })
}

// ─── MutationObserver for SPA pages ──────────────────────────────────────────

const observer = new MutationObserver(() => {
  injectSuggestButtons()
})
observer.observe(document.body, { childList: true, subtree: true })

// ─── Message listener (from popup) ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'AUTOFILL') {
    cachedProfile = msg.profile
    cachedUser    = msg.user
    const filled  = autofillFactual(msg.profile, msg.user)
    sendResponse({ filled })
    return false
  }
  if (msg.type === 'SET_PROFILE') {
    cachedProfile = msg.profile
    cachedUser    = msg.user
    sendResponse({ ok: true })
    return false
  }
  if (msg.type === 'GET_PAGE_CONTEXT') {
    sendResponse(extractPageContext())
    return false
  }
  if (msg.type === 'SHOW_RESUME_PANEL') {
    injectResumePanel(msg.result, msg.jobContext)
    sendResponse({ ok: true })
    return false
  }
})

// ─── Autofill factual fields ──────────────────────────────────────────────────

function autofillFactual(profile, user) {
  const candidates = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea'
  )
  let filled = 0
  const seen = new Set()

  for (const el of candidates) {
    const key = matchFactual(el)
    if (!key || seen.has(key)) continue
    const value = resolveFactual(key, profile, user)
    if (!value) continue
    if (fillElement(el, value)) {
      filled++
      seen.add(key)
    }
  }
  return filled
}

// ─── Resume tailoring panel ───────────────────────────────────────────────────

function injectResumePanel(result, jobContext) {
  // Remove any existing panel
  document.getElementById('mn-resume-panel')?.remove()

  const panel = document.createElement('div')
  panel.id = 'mn-resume-panel'
  panel.style.cssText = `
    position: fixed;
    right: 0;
    top: 0;
    height: 100vh;
    width: 400px;
    z-index: 2147483646;
    background: #080808;
    border-left: 1px solid #2a2a2a;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #e4e4e7;
    box-shadow: -8px 0 32px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
  `

  const jobLine = [jobContext?.jobTitle, jobContext?.companyName].filter(Boolean).join(' at ')
  const bullets = Array.isArray(result.experienceBullets) ? result.experienceBullets : []
  const keywords = Array.isArray(result.keywordsMatched) ? result.keywordsMatched : []

  panel.innerHTML = `
    <div style="
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border-bottom: 1px solid #1e1e1e; flex-shrink: 0;
      position: sticky; top: 0; background: #080808; z-index: 1;
    ">
      <div>
        <div style="font-weight:600; font-size:13px; color:#e4e4e7;">Resume Tailored</div>
        ${jobLine ? `<div style="font-size:11px; color:#555; margin-top:2px;">${escapeHtml(jobLine)}</div>` : ''}
      </div>
      <button id="mn-panel-close" style="
        background:none; border:none; color:#555; cursor:pointer;
        font-size:20px; line-height:1; padding:0 4px;
      ">&times;</button>
    </div>

    <div style="padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 18px;">

      ${panelSection('Summary', result.summary || '', 'mn-copy-summary')}
      ${panelSection('Skills', result.skills || '', 'mn-copy-skills')}
      ${panelBullets(bullets)}

      ${keywords.length ? `
        <div>
          <div style="font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#444; margin-bottom:8px;">
            Keywords matched
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:5px;">
            ${keywords.map(k => `
              <span style="
                font-size:10px; padding:2px 8px; border-radius:4px;
                background:#6ee76e1a; color:#6ee76e; border:1px solid #6ee76e33;
              ">${escapeHtml(k)}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}

    </div>

    <div style="
      padding: 14px 16px; border-top: 1px solid #1e1e1e;
      display: flex; gap: 10px; flex-shrink: 0;
      position: sticky; bottom: 0; background: #080808;
    ">
      <button id="mn-panel-save" style="
        flex:1; padding:8px; background:transparent;
        border:1px solid #6ee76e55; border-radius:7px;
        color:#6ee76e; font-size:13px; font-weight:500; cursor:pointer;
      ">Save to Profile</button>
      <button id="mn-panel-close-footer" style="
        padding:8px 14px; background:none; border:1px solid #2a2a2a;
        border-radius:7px; color:#555; font-size:13px; cursor:pointer;
      ">Close</button>
    </div>
  `

  document.body.appendChild(panel)

  // Wire up close buttons
  document.getElementById('mn-panel-close').addEventListener('click', () => panel.remove())
  document.getElementById('mn-panel-close-footer').addEventListener('click', () => panel.remove())

  // Wire up copy buttons
  wireCopyBtn('mn-copy-summary',  result.summary || '')
  wireCopyBtn('mn-copy-skills',   result.skills  || '')
  wireCopyBtn('mn-copy-bullets',  bullets.map(b => `• ${b}`).join('\n'))

  // Save to Profile
  document.getElementById('mn-panel-save').addEventListener('click', () => {
    if (!window.confirm('This will overwrite your current summary, skills, and experience in MeetingNote. Continue?')) return
    saveTailoredToProfile(result)
  })
}

function panelSection(label, text, copyId) {
  return `
    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <div style="font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#444;">${label}</div>
        <button id="${copyId}" class="mn-copy-btn">Copy</button>
      </div>
      <p style="color:#ccc; line-height:1.6; margin:0; font-size:13px;">${escapeHtml(text)}</p>
    </div>
  `
}

function panelBullets(bullets) {
  if (!bullets.length) return ''
  return `
    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <div style="font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#444;">Experience Bullets</div>
        <button id="mn-copy-bullets" class="mn-copy-btn">Copy all</button>
      </div>
      <ul style="margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:6px;">
        ${bullets.map(b => `
          <li style="color:#ccc; font-size:13px; line-height:1.5; padding-left:12px; position:relative;">
            <span style="position:absolute; left:0; color:#6ee76e;">•</span>
            ${escapeHtml(b)}
          </li>
        `).join('')}
      </ul>
    </div>
  `
}

function wireCopyBtn(id, text) {
  const btn = document.getElementById(id)
  if (!btn) return
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text)
      const orig = btn.textContent
      btn.textContent = 'Copied!'
      setTimeout(() => { btn.textContent = orig }, 1500)
    } catch {
      btn.textContent = 'Failed'
    }
  })
}

function saveTailoredToProfile(result) {
  const updatedProfile = {
    ...(cachedProfile || {}),
    experience: Array.isArray(result.experienceBullets)
      ? result.experienceBullets.join('\n')
      : (cachedProfile?.experience || ''),
    skills:  result.skills   || cachedProfile?.skills   || '',
  }

  const saveBtn = document.getElementById('mn-panel-save')
  if (saveBtn) { saveBtn.textContent = 'Saving…'; saveBtn.disabled = true }

  chrome.runtime.sendMessage({ type: 'SAVE_TAILORED_PROFILE', profile: updatedProfile }, (res) => {
    if (!saveBtn) return
    if (chrome.runtime.lastError || res?.error) {
      saveBtn.textContent = 'Error — try again'
      saveBtn.disabled = false
      return
    }
    cachedProfile = updatedProfile
    saveBtn.textContent = 'Saved!'
    saveBtn.style.color = '#6ee76e'
    saveBtn.style.borderColor = '#6ee76e'
  })
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('mn-styles')) return
  const style = document.createElement('style')
  style.id = 'mn-styles'
  style.textContent = `
    .mn-suggest-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background: #0d0d0d;
      border: 1px solid #2a2a2a;
      border-radius: 4px;
      color: #6ee76e;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
      white-space: nowrap;
      transition: border-color 0.15s, opacity 0.15s;
      margin-top: 4px;
    }
    .mn-suggest-btn:hover { border-color: #6ee76e55; }
    .mn-suggest-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .mn-copy-btn {
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 4px;
      color: #555;
      font-size: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 2px 8px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .mn-copy-btn:hover { color: #aaa; border-color: #444; }
    .mn-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #1e1e1e;
      border-top-color: #6ee76e;
      border-radius: 50%;
      animation: mn-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes mn-spin { to { transform: rotate(360deg); } }
  `
  document.head.appendChild(style)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

injectSuggestButtons()
