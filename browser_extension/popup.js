// Promisified wrapper for chrome.runtime.sendMessage
function bg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
      if (res?.error) return reject(new Error(res.error))
      resolve(res)
    })
  })
}

// ─── View switching ───────────────────────────────────────────────────────────

const views = {
  loading: document.getElementById('view-loading'),
  login:   document.getElementById('view-login'),
  main:    document.getElementById('view-main'),
}

function show(name) {
  Object.values(views).forEach(v => v.classList.add('hidden'))
  views[name].classList.remove('hidden')
}

// ─── State ────────────────────────────────────────────────────────────────────

let cachedUser    = null
let cachedProfile = null

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  show('loading')
  try {
    const { authenticated } = await bg({ type: 'CHECK_AUTH' })
    if (!authenticated) { show('login'); return }
    await loadMain()
  } catch {
    show('login')
  }
}

async function loadMain() {
  show('loading')
  try {
    const [user, profile] = await Promise.all([
      bg({ type: 'GET_USER' }),
      bg({ type: 'GET_PROFILE' }),
    ])
    cachedUser    = user
    cachedProfile = profile

    // Push profile to active tab so suggest buttons work immediately
    pushProfileToTab(profile, user).catch(() => {})

    renderMain(user, profile)
    show('main')
  } catch (err) {
    // Session expired or backend down — go back to login
    show('login')
    if (err.message?.includes('expired') || err.message?.includes('authenticated')) {
      document.getElementById('login-error').textContent = err.message
      document.getElementById('login-error').classList.remove('hidden')
    }
  }
}

async function pushProfileToTab(profile, user) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  await chrome.tabs.sendMessage(tab.id, { type: 'SET_PROFILE', profile, user }).catch(() => {})
}

// ─── Render main view ─────────────────────────────────────────────────────────

function renderMain(user, profile) {
  // Name
  document.getElementById('user-name').textContent = user.name || user.email || 'Account'

  // Plan badge
  const badge = document.getElementById('plan-badge')
  const plan  = user.plan || 'none'
  const LABELS = { starter: 'Starter', pro: 'Pro', power: 'Power', none: 'No plan' }
  badge.textContent = LABELS[plan] ?? plan
  badge.className   = `plan-badge plan-${plan}`

  // Profile status
  document.getElementById('status-role').textContent = profile.targetRole || '—'
  setCheck('status-resume', !!profile.resumeText)
  setCheck('status-cover',  !!profile.coverLetterText)

  // Clear previous state
  document.getElementById('fill-result').classList.add('hidden')
  document.getElementById('main-error').classList.add('hidden')
}

function setCheck(id, ok) {
  const el = document.getElementById(id)
  el.textContent = ok ? '✓' : '✗'
  el.className   = 'check ' + (ok ? 'check-yes' : 'check-no')
}

// ─── Login ────────────────────────────────────────────────────────────────────

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const email    = document.getElementById('input-email').value.trim()
  const password = document.getElementById('input-password').value
  const errEl    = document.getElementById('login-error')
  const btn      = document.getElementById('btn-login')

  errEl.classList.add('hidden')
  btn.disabled    = true
  btn.textContent = 'Signing in…'

  try {
    await bg({ type: 'LOGIN', email, password })
    await loadMain()
  } catch (err) {
    errEl.textContent = err.message
    errEl.classList.remove('hidden')
  } finally {
    btn.disabled    = false
    btn.textContent = 'Sign In'
  }
})

// ─── Sign out ─────────────────────────────────────────────────────────────────

document.getElementById('btn-signout').addEventListener('click', async () => {
  await bg({ type: 'LOGOUT' }).catch(() => {})
  cachedUser    = null
  cachedProfile = null
  document.getElementById('login-error').classList.add('hidden')
  show('login')
})

// ─── Refresh profile ──────────────────────────────────────────────────────────

document.getElementById('btn-refresh').addEventListener('click', async () => {
  const errEl = document.getElementById('main-error')
  errEl.classList.add('hidden')
  try {
    const profile = await bg({ type: 'GET_PROFILE' })
    cachedProfile = profile
    renderMain(cachedUser, profile)
    pushProfileToTab(profile, cachedUser).catch(() => {})
  } catch (err) {
    errEl.textContent = err.message
    errEl.classList.remove('hidden')
  }
})

// ─── Auto-fill factual fields ─────────────────────────────────────────────────

document.getElementById('btn-autofill').addEventListener('click', async () => {
  const btn    = document.getElementById('btn-autofill')
  const result = document.getElementById('fill-result')
  const errEl  = document.getElementById('main-error')

  result.classList.add('hidden')
  errEl.classList.add('hidden')
  btn.disabled    = true
  btn.textContent = 'Filling…'

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error('No active tab found')

    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { type: 'AUTOFILL', profile: cachedProfile, user: cachedUser },
        (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
          resolve(res)
        }
      )
    })

    const n = response?.filled ?? 0
    result.textContent = n > 0
      ? `Filled ${n} field${n !== 1 ? 's' : ''} on this page`
      : 'No matching fields found on this page'
    result.classList.remove('hidden')
  } catch (err) {
    errEl.textContent = err.message.includes('Could not establish')
      ? 'Cannot reach this page. Try refreshing it.'
      : err.message
    errEl.classList.remove('hidden')
  } finally {
    btn.disabled    = false
    btn.textContent = 'Auto-fill This Page'
  }
})

// ─── Optimize Resume ──────────────────────────────────────────────────────────

document.getElementById('btn-tailor').addEventListener('click', async () => {
  const btn      = document.getElementById('btn-tailor')
  const statusEl = document.getElementById('tailor-status')
  const errEl    = document.getElementById('main-error')

  errEl.classList.add('hidden')
  statusEl.className = 'tailor-status'
  statusEl.textContent = 'Analyzing job…'
  statusEl.classList.remove('hidden')
  btn.disabled    = true
  btn.textContent = 'Analyzing…'

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error('No active tab found')

    // 1. Get page context from content script
    const pageContext = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
        resolve(res)
      })
    })

    // 2. Call backend via background
    statusEl.textContent = 'Rewriting resume sections…'
    const result = await bg({ type: 'TAILOR_RESUME', profile: cachedProfile, pageContext })

    // 3. Inject side panel into page
    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_RESUME_PANEL', result, jobContext: pageContext }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
        resolve(res)
      })
    })

    statusEl.textContent = 'Done — see panel on page'
    statusEl.className = 'tailor-status done'
  } catch (err) {
    statusEl.textContent = err.message.includes('Could not establish')
      ? 'Refresh the page then try again'
      : err.message
    statusEl.className = 'tailor-status err'
  } finally {
    btn.disabled    = false
    btn.textContent = 'Optimize Resume for This Job'
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

init()
