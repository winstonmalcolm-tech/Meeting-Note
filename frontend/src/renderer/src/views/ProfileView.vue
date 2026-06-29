<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton } from 'naive-ui'
import { fetchProfile, saveProfile, fetchUserInfo, parseResumeFile, type UserProfile, type UserInfo } from '../services/api'
import { exportResumeDocx } from '../services/exportResumeDocx'
import { ExternalLink, Check, FileText, FileDown } from '@lucide/vue'
import DocumentEditor from '../components/DocumentEditor.vue'

const profile = ref<UserProfile>({ targetRole: '', skills: '', experience: '' })
const userInfo = ref<UserInfo | null>(null)
const saving = ref(false)
const saved = ref(false)

const resumeHtml = ref('')
const coverLetterHtml = ref('')
const resumeFileName = ref('')
const resumeUploading = ref(false)
const coverLetterFileName = ref('')
const coverLetterUploading = ref(false)
const exportingResume = ref<'docx' | 'pdf' | null>(null)
const exportingCover = ref<'docx' | 'pdf' | null>(null)
const uploadError = ref('')

function plainTextToHtml(text: string): string {
  if (!text.trim()) return ''
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function stripHtml(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.innerText
}

function buildPrintHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body{font-family:Georgia,serif;font-size:11pt;line-height:1.6;margin:0;padding:2cm 2.5cm;color:#000}
  h1{font-size:16pt;margin:0.8em 0 0.3em}
  h2{font-size:13pt;margin:0.7em 0 0.2em}
  h3{font-size:11pt;margin:0.6em 0 0.2em}
  p{margin:0.35em 0}
  ul,ol{margin:0.35em 0;padding-left:1.5em}
  li{margin:0.2em 0}
</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

onMounted(async () => {
  const [p, u] = await Promise.all([fetchProfile(), fetchUserInfo()])
  profile.value = { resumeText: '', coverLetterText: '', phone: '', linkedinUrl: '', ...p }
  userInfo.value = u
  resumeHtml.value = p.resumeHtml || plainTextToHtml(p.resumeText ?? '')
  coverLetterHtml.value = p.coverLetterHtml || plainTextToHtml(p.coverLetterText ?? '')
})

async function handleSave() {
  saving.value = true
  await saveProfile({
    ...profile.value,
    resumeText: stripHtml(resumeHtml.value),
    resumeHtml: resumeHtml.value,
    coverLetterText: stripHtml(coverLetterHtml.value),
    coverLetterHtml: coverLetterHtml.value,
  })
  saving.value = false
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

async function handleResumeUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  resumeUploading.value = true
  uploadError.value = ''
  try {
    const text = await parseResumeFile(file)
    resumeHtml.value = plainTextToHtml(text)
    resumeFileName.value = file.name
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Failed to parse file. Is the backend running?'
  } finally {
    resumeUploading.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function handleCoverLetterUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  coverLetterUploading.value = true
  uploadError.value = ''
  try {
    const text = await parseResumeFile(file)
    coverLetterHtml.value = plainTextToHtml(text)
    coverLetterFileName.value = file.name
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Failed to parse file. Is the backend running?'
  } finally {
    coverLetterUploading.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function handleExportResumeDocx() {
  exportingResume.value = 'docx'
  try { await exportResumeDocx(resumeHtml.value, 'resume.docx') }
  finally { exportingResume.value = null }
}

async function handleExportResumePdf() {
  exportingResume.value = 'pdf'
  try { await window.api.savePdf(buildPrintHtml(resumeHtml.value), 'resume.pdf') }
  finally { exportingResume.value = null }
}

async function handleExportCoverDocx() {
  exportingCover.value = 'docx'
  try { await exportResumeDocx(coverLetterHtml.value, 'cover-letter.docx') }
  finally { exportingCover.value = null }
}

async function handleExportCoverPdf() {
  exportingCover.value = 'pdf'
  try { await window.api.savePdf(buildPrintHtml(coverLetterHtml.value), 'cover-letter.pdf') }
  finally { exportingCover.value = null }
}

function openDashboard() {
  const webUrl = import.meta.env.VITE_WEB_URL ?? 'http://localhost:5173'
  window.api.openExternal(`${webUrl}/dashboard`)
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  power: 'Power'
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'var(--color-text-muted)',
  pro: 'var(--color-accent)',
  power: 'var(--color-info-text)'
}
</script>

<template>
  <div class="h-full flex flex-col overflow-y-auto">
    <div class="px-6 pt-6 pb-4 shrink-0">
      <p class="text-xs font-semibold tracking-widest uppercase mb-1" style="color: var(--color-text-muted)">Profile</p>
      <p class="text-xs" style="color: var(--color-text-muted)">Manage your account and documents.</p>
    </div>

    <div class="px-6 pb-8 flex flex-col gap-4">

      <!-- Account info -->
      <div class="rounded-xl p-4" style="border: 1px solid var(--color-border); background: var(--color-bg-surface);">
        <p class="text-xs font-semibold tracking-widest uppercase mb-3" style="color: var(--color-text-muted)">Account</p>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-xs" style="color: var(--color-text-muted)">Email</span>
            <span class="text-xs font-medium" style="color: var(--color-text)">{{ userInfo?.email ?? '—' }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs" style="color: var(--color-text-muted)">Plan</span>
            <span
              class="text-xs font-semibold px-2 py-0.5 rounded"
              :style="{
                background: 'var(--color-bg-elevated)',
                color: userInfo?.plan ? PLAN_COLORS[userInfo.plan] : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)'
              }"
            >
              {{ userInfo?.plan ? PLAN_LABELS[userInfo.plan] ?? userInfo.plan : 'No active plan' }}
            </span>
          </div>
          <div v-if="userInfo?.cancelAtPeriodEnd" class="flex items-center justify-between">
            <span class="text-xs" style="color: var(--color-text-muted)">Status</span>
            <span class="text-xs" style="color: var(--color-warn)">Cancels at period end</span>
          </div>
        </div>
        <NButton size="small" class="mt-4 w-full" @click="openDashboard">
          <span style="display:flex;align-items:center;gap:6px;">Open Dashboard <ExternalLink :size="12" /></span>
        </NButton>
      </div>

      <!-- Resume editor -->
      <div class="rounded-xl p-4 flex flex-col gap-3" style="border: 1px solid var(--color-border); background: var(--color-bg-surface);">
        <!-- Header row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <FileText :size="14" style="color: var(--color-accent)" />
            <p class="text-xs font-semibold" style="color: var(--color-text)">Resume</p>
            <span v-if="resumeFileName" class="text-xs truncate max-w-32" style="color: var(--color-text-muted)">· {{ resumeFileName }}</span>
          </div>
          <label class="shrink-0 cursor-pointer">
            <input type="file" accept=".pdf,.docx,.doc,.txt" class="hidden" @change="handleResumeUpload" />
            <span
              class="text-xs px-2 py-1 rounded cursor-pointer transition-colors"
              style="background: var(--color-bg-elevated); color: var(--color-text-secondary); border: 1px solid var(--color-border);"
            >
              {{ resumeUploading ? 'Parsing…' : 'Upload' }}
            </span>
          </label>
        </div>

        <!-- Editor -->
        <DocumentEditor v-model="resumeHtml" />

        <!-- Export row -->
        <div class="flex items-center gap-2">
          <NButton
            size="tiny"
            :loading="exportingResume === 'docx'"
            :disabled="!resumeHtml || exportingResume !== null"
            @click="handleExportResumeDocx"
          >
            <span style="display:flex;align-items:center;gap:4px;"><FileDown :size="11" /> Export .docx</span>
          </NButton>
          <NButton
            size="tiny"
            :loading="exportingResume === 'pdf'"
            :disabled="!resumeHtml || exportingResume !== null"
            @click="handleExportResumePdf"
          >
            <span style="display:flex;align-items:center;gap:4px;"><FileDown :size="11" /> Export .pdf</span>
          </NButton>
        </div>
      </div>

      <!-- Cover Letter editor -->
      <div class="rounded-xl p-4 flex flex-col gap-3" style="border: 1px solid var(--color-border); background: var(--color-bg-surface);">
        <!-- Header row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <FileText :size="14" style="color: var(--color-accent)" />
            <p class="text-xs font-semibold" style="color: var(--color-text)">Cover Letter</p>
            <span v-if="coverLetterFileName" class="text-xs truncate max-w-32" style="color: var(--color-text-muted)">· {{ coverLetterFileName }}</span>
          </div>
          <label class="shrink-0 cursor-pointer">
            <input type="file" accept=".pdf,.docx,.doc,.txt" class="hidden" @change="handleCoverLetterUpload" />
            <span
              class="text-xs px-2 py-1 rounded cursor-pointer transition-colors"
              style="background: var(--color-bg-elevated); color: var(--color-text-secondary); border: 1px solid var(--color-border);"
            >
              {{ coverLetterUploading ? 'Parsing…' : 'Upload' }}
            </span>
          </label>
        </div>

        <!-- Editor -->
        <DocumentEditor v-model="coverLetterHtml" />

        <!-- Export row -->
        <div class="flex items-center gap-2">
          <NButton
            size="tiny"
            :loading="exportingCover === 'docx'"
            :disabled="!coverLetterHtml || exportingCover !== null"
            @click="handleExportCoverDocx"
          >
            <span style="display:flex;align-items:center;gap:4px;"><FileDown :size="11" /> Export .docx</span>
          </NButton>
          <NButton
            size="tiny"
            :loading="exportingCover === 'pdf'"
            :disabled="!coverLetterHtml || exportingCover !== null"
            @click="handleExportCoverPdf"
          >
            <span style="display:flex;align-items:center;gap:4px;"><FileDown :size="11" /> Export .pdf</span>
          </NButton>
        </div>
      </div>

      <!-- Upload error -->
      <div v-if="uploadError" class="rounded-lg px-3 py-2 text-xs" style="background: var(--color-error-bg); border: 1px solid var(--color-error-border); color: var(--color-error);">
        {{ uploadError }}
      </div>

      <!-- Save -->
      <NButton :loading="saving" type="primary" @click="handleSave">
        <span style="display:flex;align-items:center;gap:4px;"><Check v-if="saved" :size="14" />{{ saved ? 'Saved' : 'Save Profile' }}</span>
      </NButton>

    </div>
  </div>
</template>
