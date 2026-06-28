const API = 'http://localhost:3001/api'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch(err => sendResponse({ error: err.message }))
  return true // keep channel open for async response
})

async function handleMessage(msg) {
  switch (msg.type) {

    case 'LOGIN': {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: msg.email, password: msg.password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      await chrome.storage.local.set({ mn_token: data.token })
      return { ok: true }
    }

    case 'LOGOUT': {
      await chrome.storage.local.remove('mn_token')
      return { ok: true }
    }

    case 'CHECK_AUTH': {
      const { mn_token } = await chrome.storage.local.get('mn_token')
      return { authenticated: !!mn_token }
    }

    case 'GET_USER': {
      const { mn_token } = await chrome.storage.local.get('mn_token')
      if (!mn_token) throw new Error('Not authenticated')
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${mn_token}` }
      })
      if (res.status === 401) {
        await chrome.storage.local.remove('mn_token')
        throw new Error('Session expired — please sign in again')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    }

    case 'GET_PROFILE': {
      const { mn_token } = await chrome.storage.local.get('mn_token')
      if (!mn_token) throw new Error('Not authenticated')
      const res = await fetch(`${API}/profile`, {
        headers: { Authorization: `Bearer ${mn_token}` }
      })
      if (res.status === 401) {
        await chrome.storage.local.remove('mn_token')
        throw new Error('Session expired — please sign in again')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    }

    case 'SUGGEST': {
      const { mn_token } = await chrome.storage.local.get('mn_token')
      if (!mn_token) throw new Error('Not authenticated')
      const res = await fetch(`${API}/career/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mn_token}`,
          'X-Provider': 'gemini'
        },
        body: JSON.stringify({
          fieldLabel:      msg.fieldLabel      || '',
          companyName:     msg.companyName     || '',
          jobTitle:        msg.jobTitle        || '',
          jobDescription:  msg.jobDescription  || '',
          resumeText:      msg.profile?.resumeText      || '',
          skills:          msg.profile?.skills          || '',
          experience:      msg.profile?.experience      || '',
          targetRole:      msg.profile?.targetRole      || '',
          coverLetterText: msg.profile?.coverLetterText || '',
        })
      })
      if (res.status === 401) {
        await chrome.storage.local.remove('mn_token')
        throw new Error('Session expired — please sign in again')
      }
      if (res.status === 429) throw new Error('Rate limit reached — wait a moment and try again')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return res.json()
    }

    case 'TAILOR_RESUME': {
      const { mn_token } = await chrome.storage.local.get('mn_token')
      if (!mn_token) throw new Error('Not authenticated')
      const res = await fetch(`${API}/career/tailor-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mn_token}`,
          'X-Provider': 'gemini'
        },
        body: JSON.stringify({
          resumeText:     msg.profile?.resumeText   || '',
          skills:         msg.profile?.skills        || '',
          experience:     msg.profile?.experience    || '',
          targetRole:     msg.profile?.targetRole    || '',
          jobTitle:       msg.pageContext?.jobTitle       || '',
          companyName:    msg.pageContext?.companyName    || '',
          jobDescription: msg.pageContext?.jobDescription || '',
        })
      })
      if (res.status === 401) {
        await chrome.storage.local.remove('mn_token')
        throw new Error('Session expired — please sign in again')
      }
      if (res.status === 429) throw new Error('Rate limit reached — wait a moment and try again')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return res.json()
    }

    case 'SAVE_TAILORED_PROFILE': {
      const { mn_token } = await chrome.storage.local.get('mn_token')
      if (!mn_token) throw new Error('Not authenticated')
      const res = await fetch(`${API}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mn_token}`,
        },
        body: JSON.stringify(msg.profile)
      })
      if (res.status === 401) {
        await chrome.storage.local.remove('mn_token')
        throw new Error('Session expired — please sign in again')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return { ok: true }
    }

    default:
      throw new Error(`Unknown message type: ${msg.type}`)
  }
}
