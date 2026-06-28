<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { NButton, NSpin, NInput, NAutoComplete } from 'naive-ui'
import type { JobScanQuota, SavedSearch, SavedJob } from '../services/api'
import {
  fetchJobScanQuota,
  fetchSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  fetchSavedJobs,
  updateSavedJobStatus,
} from '../services/api'
import { RefreshCw, ChevronUp, ChevronDown, Check, X, ExternalLink } from '@lucide/vue'

// ── State ──────────────────────────────────────────────────────────────────────
const activeTab = ref<'searches' | 'new' | 'kept'>('searches')

const quota = ref<JobScanQuota>({ limit: 0, used: 0, remaining: 0 })
const searches = ref<SavedSearch[]>([])
const searchesLoading = ref(true)

const newJobs = ref<SavedJob[]>([])
const keptJobs = ref<SavedJob[]>([])
const jobsLoading = ref(false)

const newCount = computed(() => newJobs.value.length)

// ── Add search form ────────────────────────────────────────────────────────────
const showForm = ref(false)
const formQuery = ref('')
const formLocation = ref('')
const formLoading = ref(false)
const formError = ref('')

const locationSuggestions = ref<string[]>([])
const locationOptions = computed(() =>
  formLocation.value.trim().length < 2
    ? ['Remote', 'Hybrid']
    : ['Remote', 'Hybrid', ...locationSuggestions.value]
)

let locationDebounce: ReturnType<typeof setTimeout> | null = null
watch(formLocation, (q) => {
  if (locationDebounce) clearTimeout(locationDebounce)
  if (q.trim().length < 2) { locationSuggestions.value = []; return }
  locationDebounce = setTimeout(async () => {
    try {
      const params = new URLSearchParams({ q: q.trim() })
      const res = await fetch(`http://localhost:3001/api/geo/locations?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mn_token') ?? ''}` },
      })
      if (res.ok) locationSuggestions.value = await res.json()
    } catch { /* ignore */ }
  }, 300)
})

// ── Load data ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadSearches(), loadJobs()])
})

async function loadSearches() {
  searchesLoading.value = true
  try {
    const [s, q] = await Promise.all([fetchSavedSearches(), fetchJobScanQuota()])
    searches.value = s
    quota.value = q
  } catch { /* ignore */ } finally {
    searchesLoading.value = false
  }
}

async function loadJobs() {
  jobsLoading.value = true
  try {
    const [n, k] = await Promise.all([fetchSavedJobs('new'), fetchSavedJobs('kept')])
    newJobs.value = n
    keptJobs.value = k
  } catch { /* ignore */ } finally {
    jobsLoading.value = false
  }
}

// ── Add search ─────────────────────────────────────────────────────────────────
async function submitSearch() {
  if (!formQuery.value.trim()) { formError.value = 'Enter a job title or keywords.'; return }
  formLoading.value = true
  formError.value = ''
  try {
    const { search, jobs } = await createSavedSearch(formQuery.value.trim(), formLocation.value.trim())
    searches.value.unshift(search)
    quota.value.used += 1
    quota.value.remaining = Math.max(0, quota.value.remaining - 1)
    // New jobs from the initial run land in the "New Jobs" tab
    newJobs.value.unshift(...jobs)
    formQuery.value = ''
    formLocation.value = ''
    showForm.value = false
    // Switch to review tab so user can immediately see results
    activeTab.value = 'new'
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Failed to create search'
  } finally {
    formLoading.value = false
  }
}

// ── Delete search ──────────────────────────────────────────────────────────────
async function removeSearch(id: string) {
  await deleteSavedSearch(id)
  searches.value = searches.value.filter((s) => s.id !== id)
  quota.value.used = Math.max(0, quota.value.used - 1)
  quota.value.remaining += 1
  // Remove associated jobs from local lists
  newJobs.value  = newJobs.value.filter((j) => j.savedSearchId !== id)
  keptJobs.value = keptJobs.value.filter((j) => j.savedSearchId !== id)
}

// ── Job actions ────────────────────────────────────────────────────────────────
async function keepJob(job: SavedJob) {
  const updated = await updateSavedJobStatus(job.id, 'kept')
  newJobs.value = newJobs.value.filter((j) => j.id !== job.id)
  keptJobs.value.unshift(updated)
}

async function dismissJob(job: SavedJob) {
  await updateSavedJobStatus(job.id, 'dismissed')
  newJobs.value = newJobs.value.filter((j) => j.id !== job.id)
}

async function removeKept(job: SavedJob) {
  await updateSavedJobStatus(job.id, 'dismissed')
  keptJobs.value = keptJobs.value.filter((j) => j.id !== job.id)
}

// ── Utils ──────────────────────────────────────────────────────────────────────
const expandedJob = ref<string | null>(null)
function toggleExpand(id: string) { expandedJob.value = expandedJob.value === id ? null : id }

function openApplyUrl(url: string) { window.api.openExternal(url) }

function formatPosted(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function formatDate(ts: number | null) {
  if (!ts) return 'Never'
  const d = new Date(ts)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function scoreColor(score?: number) {
  if (!score) return 'var(--color-text-muted)'
  if (score >= 8) return 'var(--color-accent)'
  if (score >= 6) return 'var(--color-warn)'
  return 'var(--color-error)'
}

function renderJobDescription(text: string): string {
  if (!text) return ''
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const lines = escaped.split('\n')
  const out: string[] = []
  let inList = false

  for (const raw of lines) {
    const line = raw.trim()
    const isBullet = /^[•\-\*]\s+/.test(line)

    if (isBullet) {
      if (!inList) { out.push('<ul class="jd-list">'); inList = true }
      out.push(`<li>${line.replace(/^[•\-\*]\s+/, '')}</li>`)
    } else {
      if (inList) { out.push('</ul>'); inList = false }
      if (line === '') {
        out.push('<div class="jd-spacer"></div>')
      } else {
        out.push(`<p class="jd-p">${line}</p>`)
      }
    }
  }
  if (inList) out.push('</ul>')
  return out.join('')
}
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">

    <!-- Header -->
    <div class="px-5 pt-4 pb-3 shrink-0 flex items-center justify-between" style="border-bottom: 1px solid var(--color-border);">
      <span class="text-sm font-semibold" style="color: var(--color-text);">Job Search</span>
      <div class="text-xs" style="color: var(--color-text-muted);">
        {{ quota.used }} / {{ quota.limit }} active searches
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 px-5 pt-3 pb-0 shrink-0">
      <button
        v-for="tab in [
          { key: 'searches', label: 'My Searches' },
          { key: 'new',      label: newCount > 0 ? `New Jobs (${newCount})` : 'New Jobs' },
          { key: 'kept',     label: 'Saved' },
        ]"
        :key="tab.key"
        class="px-3 py-1.5 rounded-t text-xs font-medium transition-colors"
        :style="{
          background:   activeTab === tab.key ? 'var(--color-bg-surface)' : 'transparent',
          color:        activeTab === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
          borderBottom: activeTab === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent',
        }"
        @click="activeTab = tab.key as 'searches' | 'new' | 'kept'"
      >{{ tab.label }}</button>
    </div>

    <div style="flex: 1; overflow-y: auto; border-top: 1px solid var(--color-border);">

      <!-- ── My Searches tab ─────────────────────────────────────────────────── -->
      <template v-if="activeTab === 'searches'">
        <div class="px-5 py-4">

          <!-- Add new search form -->
          <template v-if="showForm">
            <div class="mb-3 p-4 rounded-lg" style="background: var(--color-bg-surface); border: 1px solid var(--color-border);">
              <p class="text-xs mb-3" style="color: var(--color-text-muted);">
                MeetingNote will run this search daily and notify you of new results.
              </p>
              <div class="flex gap-2 mb-2">
                <NInput v-model:value="formQuery" size="small" placeholder="Job title or keywords…" @keydown.enter="submitSearch" />
                <div style="width: 160px; flex-shrink: 0;">
                  <NAutoComplete
                    v-model:value="formLocation"
                    :options="locationOptions"
                    size="small"
                    placeholder="Location (optional)"
                  />
                </div>
              </div>
              <p v-if="formError" class="text-xs mb-2" style="color: var(--color-error);">{{ formError }}</p>
              <div class="flex gap-2">
                <NButton
                  size="small"
                  :loading="formLoading"
                  @click="submitSearch"
                >
                  Save &amp; Search
                </NButton>
                <NButton size="small" @click="showForm = false; formError = ''">
                  Cancel
                </NButton>
              </div>
            </div>
          </template>

          <!-- Searches list header -->
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs" style="color: var(--color-text-muted);">
              {{ searches.length }} active search{{ searches.length !== 1 ? 'es' : '' }}
            </span>
            <NButton
              v-if="!showForm"
              size="small"
              :disabled="quota.remaining <= 0"
              @click="showForm = true"
            >
              + New Search
            </NButton>
          </div>

          <p v-if="quota.remaining <= 0 && quota.limit > 0" class="text-xs mb-3" style="color: var(--color-error);">
            Search limit reached ({{ quota.limit }} max). Delete a search to free a slot, or upgrade your plan.
          </p>

          <div v-if="searchesLoading" class="flex justify-center pt-8"><NSpin /></div>

          <template v-else>
            <div
              v-for="s in searches"
              :key="s.id"
              class="flex items-center justify-between px-3 py-3 rounded-lg mb-2"
              style="background: var(--color-bg-surface); border: 1px solid var(--color-border);"
            >
              <div>
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium" style="color: var(--color-text);">{{ s.query }}</p>
                  <span
                    class="text-xs px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-1"
                    style="background: var(--color-accent-subtle); color: var(--color-accent); border: 1px solid var(--color-accent-border);"
                    title="This search runs automatically every day"
                  ><RefreshCw :size="9" /> Daily</span>
                </div>
                <p class="text-xs mt-0.5" style="color: var(--color-text-muted);">
                  {{ s.location || 'Any location' }}
                  · Last checked: {{ formatDate(s.lastRunAt) }}
                </p>
              </div>
              <button
                class="text-xs px-2 py-1 rounded shrink-0 ml-3 transition-colors"
                style="color: var(--color-text-muted);"
                title="Delete this search and its results"
                @click="removeSearch(s.id)"
              >Delete</button>
            </div>

            <p v-if="searches.length === 0" class="text-xs" style="color: var(--color-text-muted);">
              No saved searches yet. Click "+ New Search" to get started.
              <br /><br />
              MeetingNote runs each search daily and saves new listings here for you to review.
            </p>
          </template>
        </div>
      </template>

      <!-- ── New Jobs tab ────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'new'">
        <div class="px-5 py-4">
          <div v-if="jobsLoading" class="flex justify-center pt-8"><NSpin /></div>

          <template v-else>
            <p v-if="newJobs.length > 0" class="text-xs mb-3" style="color: var(--color-text-muted);">
              {{ newJobs.length }} job{{ newJobs.length !== 1 ? 's' : '' }} waiting for review · Keep what looks interesting, dismiss the rest.
            </p>

            <div
              v-for="job in newJobs"
              :key="job.id"
              class="rounded-lg mb-3"
              style="background: var(--color-bg-surface); border: 1px solid var(--color-border);"
            >
              <!-- Job header -->
              <div class="flex items-start justify-between px-3 py-3 cursor-pointer" @click="toggleExpand(job.id)">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-medium" style="color: var(--color-text);">{{ job.title }}</p>
                    <span
                      v-if="job.fitScore"
                      class="text-xs px-1.5 py-0.5 rounded font-semibold"
                      :style="{ background: 'var(--color-bg-elevated)', color: scoreColor(job.fitScore), border: `1px solid ${scoreColor(job.fitScore)}` }"
                    >{{ job.fitScore }}/10</span>
                  </div>
                  <p class="text-xs mt-0.5" style="color: var(--color-text-muted);">
                    {{ job.company }}
                    <span v-if="job.location"> · {{ job.location }}</span>
                    <span v-if="job.salary"> · {{ job.salary }}</span>
                    <span v-if="job.postedAt"> · {{ formatPosted(job.postedAt) }}</span>
                  </p>
                  <p v-if="job.fitReason" class="text-xs mt-1" style="color: var(--color-text-secondary); font-style: italic;">{{ job.fitReason }}</p>
                </div>
                <component :is="expandedJob === job.id ? ChevronUp : ChevronDown" :size="14" class="ml-3 shrink-0" style="color: var(--color-text-muted);" />
              </div>

              <!-- Expanded -->
              <template v-if="expandedJob === job.id">
                <div class="px-3 pb-3" style="border-top: 1px solid var(--color-border);">
                  <div class="jd-body mt-3 mb-3" v-html="renderJobDescription(job.description ?? '')" />
                  <div class="flex gap-2">
                    <NButton size="small" type="primary" @click="keepJob(job)">
                      <span style="display:flex;align-items:center;gap:4px;"><Check :size="12" /> Keep</span>
                    </NButton>
                    <NButton size="small" @click="dismissJob(job)">
                      <span style="display:flex;align-items:center;gap:4px;"><X :size="12" /> Dismiss</span>
                    </NButton>
                    <button
                      class="inline-flex items-center gap-1 text-xs px-3 py-1 rounded cursor-pointer"
                      style="background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text-secondary);"
                      @click="openApplyUrl(job.applyUrl)"
                    >Apply <ExternalLink :size="11" /></button>
                  </div>
                </div>
              </template>

              <!-- Collapsed quick actions -->
              <template v-else>
                <div class="flex gap-2 px-3 pb-3">
                  <button class="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors" style="background: var(--color-accent-subtle); color: var(--color-accent); border: 1px solid var(--color-accent-border);" @click="keepJob(job)"><Check :size="12" /> Keep</button>
                  <button class="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors" style="background: var(--color-bg-elevated); color: var(--color-text-muted); border: 1px solid var(--color-border);" @click="dismissJob(job)"><X :size="12" /> Dismiss</button>
                </div>
              </template>
            </div>

            <p v-if="newJobs.length === 0" class="text-xs" style="color: var(--color-text-muted);">
              No new jobs to review. New results from your saved searches will appear here daily.
            </p>
          </template>
        </div>
      </template>

      <!-- ── Saved / Kept tab ────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'kept'">
        <div class="px-5 py-4">
          <div v-if="jobsLoading" class="flex justify-center pt-8"><NSpin /></div>

          <template v-else>
            <div
              v-for="job in keptJobs"
              :key="job.id"
              class="rounded-lg mb-3"
              style="background: var(--color-bg-surface); border: 1px solid var(--color-border);"
            >
              <div class="flex items-start justify-between px-3 py-3 cursor-pointer" @click="toggleExpand(job.id)">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-medium" style="color: var(--color-text);">{{ job.title }}</p>
                    <span
                      v-if="job.fitScore"
                      class="text-xs px-1.5 py-0.5 rounded font-semibold"
                      :style="{ background: 'var(--color-bg-elevated)', color: scoreColor(job.fitScore), border: `1px solid ${scoreColor(job.fitScore)}` }"
                    >{{ job.fitScore }}/10</span>
                  </div>
                  <p class="text-xs mt-0.5" style="color: var(--color-text-muted);">
                    {{ job.company }}
                    <span v-if="job.location"> · {{ job.location }}</span>
                    <span v-if="job.salary"> · {{ job.salary }}</span>
                  </p>
                  <p v-if="job.fitReason" class="text-xs mt-1" style="color: var(--color-text-secondary); font-style: italic;">{{ job.fitReason }}</p>
                </div>
                <component :is="expandedJob === job.id ? ChevronUp : ChevronDown" :size="14" class="ml-3 shrink-0" style="color: var(--color-text-muted);" />
              </div>

              <template v-if="expandedJob === job.id">
                <div class="px-3 pb-3" style="border-top: 1px solid var(--color-border);">
                  <div class="jd-body mt-3 mb-3" v-html="renderJobDescription(job.description ?? '')" />
                  <div class="flex gap-2">
                    <a
                      :href="job.applyUrl"
                      target="_blank"
                      class="inline-flex items-center text-xs px-3 py-1 rounded"
                      style="background: var(--color-accent); color: var(--color-accent-fg); text-decoration: none; font-weight: 600;"
                    >Apply <ExternalLink :size="11" /></a>
                    <NButton size="small" @click="removeKept(job)">Remove</NButton>
                  </div>
                </div>
              </template>
            </div>

            <p v-if="keptJobs.length === 0" class="text-xs" style="color: var(--color-text-muted);">
              No saved jobs yet. Keep jobs from the New Jobs tab to collect them here.
            </p>
          </template>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.jd-body {
  max-height: 220px;
  overflow-y: auto;
  color: var(--color-text-secondary);
}
.jd-body :deep(.jd-p) {
  font-size: 0.75rem;
  line-height: 1.65;
  margin: 0;
}
.jd-body :deep(.jd-spacer) {
  height: 0.6em;
}
.jd-body :deep(.jd-list) {
  font-size: 0.75rem;
  line-height: 1.65;
  margin: 0.2em 0;
  padding-left: 1.2em;
}
.jd-body :deep(.jd-list li) {
  margin-bottom: 0.15em;
}
</style>
