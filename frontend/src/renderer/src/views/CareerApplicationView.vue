<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NSpin } from 'naive-ui'
import type { JobApplication } from '../services/api'
import { fetchJobApplication, runResumeAnalysis, runCoverLetter, runJDDecoder } from '../services/api'

const props = defineProps<{ applicationId: string }>()
const emit = defineEmits<{ back: [] }>()

const app = ref<JobApplication | null>(null)
const loading = ref(true)
const activeTab = ref<'resume' | 'cover' | 'jd'>('resume')
const running = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    app.value = await fetchJobApplication(props.applicationId)
  } catch {
    error.value = 'Failed to load application'
  } finally {
    loading.value = false
  }
})

async function runTool(tool: 'resume' | 'cover' | 'jd') {
  if (!app.value || running.value) return
  running.value = true
  error.value = ''
  try {
    if (tool === 'resume') {
      app.value.resumeAnalysis = await runResumeAnalysis(app.value.id)
    } else if (tool === 'cover') {
      app.value.coverLetter = await runCoverLetter(app.value.id)
    } else {
      app.value.decodedJD = await runJDDecoder(app.value.id)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    running.value = false
  }
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[^]*?<\/li>(\n<li>[^]*?<\/li>)*)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p class="md-p">')
}
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">
    <!-- Header -->
    <div class="px-5 pt-4 pb-3 shrink-0" style="border-bottom: 1px solid var(--color-border);">
      <button
        class="text-xs mb-2 transition-colors"
        style="color: var(--color-text-muted);"
        @click="emit('back')"
      >← Back to Applications</button>
      <div v-if="app">
        <h1 class="text-base font-semibold" style="color: var(--color-text);">{{ app.jobTitle }}</h1>
        <p class="text-xs mt-0.5" style="color: var(--color-text-muted);">{{ app.companyName }} · Added {{ formatDate(app.createdAt) }}</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center flex-1">
      <NSpin />
    </div>

    <template v-else-if="app">
      <!-- Tab bar -->
      <div class="flex gap-1 px-5 pt-3 pb-0 shrink-0">
        <button
          v-for="tab in [
            { key: 'resume', label: 'Resume Analysis' },
            { key: 'cover',  label: 'Cover Letter' },
            { key: 'jd',     label: 'JD Decoder' },
          ]"
          :key="tab.key"
          class="px-3 py-1.5 rounded-t text-xs font-medium transition-colors"
          :style="{
            background: activeTab === tab.key ? 'var(--color-bg-surface)' : 'transparent',
            color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
            borderBottom: activeTab === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent',
          }"
          @click="activeTab = tab.key as 'resume' | 'cover' | 'jd'"
        >{{ tab.label }}</button>
      </div>

      <div style="flex: 1; overflow-y: auto; border-top: 1px solid var(--color-border);" class="px-5 py-4">

        <!-- Resume Analysis -->
        <template v-if="activeTab === 'resume'">
          <div class="flex items-center justify-between mb-4">
            <p class="text-xs" style="color: var(--color-text-muted);">Compares your resume against the job description.</p>
            <NButton size="small" :loading="running" type="primary" @click="runTool('resume')">
              {{ app.resumeAnalysis ? 'Re-run' : 'Analyze' }}
            </NButton>
          </div>
          <div v-if="error" class="text-xs mb-3" style="color: var(--color-error);">{{ error }}</div>
          <div v-if="app.resumeAnalysis" class="prose-result" v-html="renderMarkdown(app.resumeAnalysis)" />
          <p v-else-if="!running" class="text-xs" style="color: var(--color-text-secondary);">Click Analyze to compare your resume against this job.</p>
          <NSpin v-if="running" class="mt-4" />
        </template>

        <!-- Cover Letter -->
        <template v-else-if="activeTab === 'cover'">
          <div class="flex items-center justify-between mb-4">
            <p class="text-xs" style="color: var(--color-text-muted);">Tailored cover letter from your resume and this JD.</p>
            <div class="flex gap-2">
              <NButton v-if="app.coverLetter" size="small" @click="copyToClipboard(app.coverLetter!)">
                Copy
              </NButton>
              <NButton size="small" :loading="running" type="primary" @click="runTool('cover')">
                {{ app.coverLetter ? 'Re-generate' : 'Generate' }}
              </NButton>
            </div>
          </div>
          <div v-if="error" class="text-xs mb-3" style="color: var(--color-error);">{{ error }}</div>
          <pre v-if="app.coverLetter" class="cover-letter-pre">{{ app.coverLetter }}</pre>
          <p v-else-if="!running" class="text-xs" style="color: var(--color-text-secondary);">Click Generate to write a tailored cover letter.</p>
          <NSpin v-if="running" class="mt-4" />
        </template>

        <!-- JD Decoder -->
        <template v-else-if="activeTab === 'jd'">
          <div class="flex items-center justify-between mb-4">
            <p class="text-xs" style="color: var(--color-text-muted);">What the employer truly prioritises beyond the bullet points.</p>
            <NButton size="small" :loading="running" type="primary" @click="runTool('jd')">
              {{ app.decodedJD ? 'Re-run' : 'Decode' }}
            </NButton>
          </div>
          <div v-if="error" class="text-xs mb-3" style="color: var(--color-error);">{{ error }}</div>
          <div v-if="app.decodedJD" class="prose-result" v-html="renderMarkdown(app.decodedJD)" />
          <p v-else-if="!running" class="text-xs" style="color: var(--color-text-secondary);">Click Decode to understand what this employer is really looking for.</p>
          <NSpin v-if="running" class="mt-4" />
        </template>

      </div>
    </template>

    <div v-else class="flex items-center justify-center flex-1 text-sm" style="color: var(--color-text-muted);">
      {{ error || 'Application not found.' }}
    </div>
  </div>
</template>

<style scoped>
.prose-result :deep(.md-h1) { font-size: 1rem; font-weight: 700; color: var(--color-text); margin: 1.2rem 0 0.4rem; }
.prose-result :deep(.md-h2) { font-size: 0.9rem; font-weight: 700; color: var(--color-text); margin: 1rem 0 0.3rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.2rem; }
.prose-result :deep(.md-h3) { font-size: 0.82rem; font-weight: 600; color: var(--color-text-secondary); margin: 0.8rem 0 0.25rem; }
.prose-result :deep(.md-p) { font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.6; margin: 0.3rem 0; }
.prose-result :deep(ul) { padding-left: 1.2rem; margin: 0.3rem 0; }
.prose-result :deep(li) { font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.6; }
.prose-result :deep(strong) { color: var(--color-text); font-weight: 600; }

.cover-letter-pre {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1rem;
}
</style>
