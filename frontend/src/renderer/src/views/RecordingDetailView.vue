<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton } from 'naive-ui'
import type { RecordingEntry, ChatMessage, ExtractionResult } from '../types'
import { transcribeAudio, extractRequirements, chatStateless } from '../services/api'
import { useSettings } from '../composables/useSettings'
import MermaidDiagram from '../components/MermaidDiagram.vue'

const props = defineProps<{ recording: RecordingEntry }>()
const emit = defineEmits<{ back: []; updated: [entry: RecordingEntry] }>()

const { provider } = useSettings()

const entry = ref<RecordingEntry>({ ...props.recording })
const audioUrl = ref<string | null>(null)
const audioLoading = ref(true)

const processing = ref(false)
const processError = ref('')

const chatInput = ref('')
const chatSending = ref(false)
const chatHistory = ref<ChatMessage[]>([])

type Tab = 'transcript' | 'summary' | 'chat'
const activeTab = ref<Tab>('transcript')

const isProcessed = computed(() => entry.value.status === 'processed')

const tabs: { key: Tab; label: string }[] = [
  { key: 'transcript', label: 'Transcript' },
  { key: 'summary', label: 'Summary' },
  { key: 'chat', label: 'Chat' }
]

// Load audio immediately
;(async () => {
  try {
    const buffer = await window.api.readRecording(entry.value.id)
    const blob = new Blob([buffer], { type: 'audio/webm' })
    audioUrl.value = URL.createObjectURL(blob)
  } finally {
    audioLoading.value = false
  }
})()

async function processRecording() {
  processing.value = true
  processError.value = ''
  try {
    const buffer = await window.api.readRecording(entry.value.id)
    const blob = new Blob([buffer], { type: 'audio/webm' })

    const transcript = await transcribeAudio(blob)
    const extraction = await extractRequirements(transcript)

    await window.api.updateRecording(entry.value.id, {
      status: 'processed',
      provider: provider.value,
      transcript,
      extraction
    })
    entry.value = { ...entry.value, status: 'processed', transcript, extraction }
    activeTab.value = 'transcript'
    emit('updated', entry.value)
  } catch (err) {
    processError.value = err instanceof Error ? err.message : 'Processing failed'
    await window.api.updateRecording(entry.value.id, {
      status: 'error',
      errorMessage: processError.value
    })
    entry.value = { ...entry.value, status: 'error', errorMessage: processError.value }
  } finally {
    processing.value = false
  }
}

async function sendChat() {
  if (!chatInput.value.trim() || !entry.value.extraction) return
  const message = chatInput.value.trim()
  chatInput.value = ''
  chatSending.value = true

  chatHistory.value.push({ role: 'user', content: message })

  try {
    const { reply, updatedExtraction, diagram } = await chatStateless(
      entry.value.name ?? formatDate(entry.value.createdAt),
      entry.value.extraction,
      chatHistory.value.slice(0, -1).map(({ role, content }) => ({ role, content })),
      message
    )
    chatHistory.value.push({ role: 'assistant', content: reply, updatedExtraction, diagram })
  } catch (err) {
    chatHistory.value.push({
      role: 'assistant',
      content: err instanceof Error ? err.message : 'Chat failed'
    })
  } finally {
    chatSending.value = false
  }
}

async function applyChanges(updated: ExtractionResult, msgIndex: number) {
  const msg = chatHistory.value[msgIndex]
  if (msg) msg.updatedExtraction = undefined
  entry.value = { ...entry.value, extraction: updated }
  emit('updated', entry.value)
  await window.api.updateRecording(entry.value.id, { extraction: updated })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">

    <!-- Header -->
    <div class="flex items-center gap-3 px-4 py-3 shrink-0" style="border-bottom: 1px solid var(--color-border);">
      <NButton size="small" @click="emit('back')">← Back</NButton>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate" style="color: var(--color-text)">
          {{ entry.name ?? formatDate(entry.createdAt) }}
        </p>
        <p class="text-xs" style="color: var(--color-text-muted)">
          {{ formatDate(entry.createdAt) }} · {{ formatDuration(entry.duration) }} · {{ formatSize(entry.size) }}
          <span v-if="entry.provider" class="ml-1">· {{ entry.provider }}</span>
        </p>
      </div>
      <NButton
        :type="isProcessed ? 'default' : 'primary'"
        size="small"
        :loading="processing"
        @click="processRecording"
      >
        {{ processing ? 'Processing…' : isProcessed ? 'Re-process' : 'Process Recording' }}
      </NButton>
    </div>

    <p v-if="processError" class="px-4 py-2 text-xs shrink-0" style="color: var(--color-error)">{{ processError }}</p>

    <!-- Audio player -->
    <div class="px-4 py-3 shrink-0" style="border-bottom: 1px solid var(--color-border); background: var(--color-bg);">
      <audio
        v-if="audioUrl"
        :src="audioUrl"
        controls
        class="w-full"
        style="height: 36px; accent-color: var(--color-accent);"
      />
      <p v-else-if="audioLoading" class="text-xs" style="color: var(--color-text-muted)">Loading audio…</p>
    </div>

    <!-- Tab bar -->
    <div class="flex gap-1 px-3 pt-2 pb-0 shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-3 py-1.5 text-xs font-medium transition-colors rounded-t"
        :style="{
          background: activeTab === tab.key ? 'var(--color-bg-surface)' : 'transparent',
          color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
          borderBottom: activeTab === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent'
        }"
        @click="activeTab = tab.key"
      >{{ tab.label }}</button>
    </div>

    <div style="flex: 1; border-top: 1px solid var(--color-border); overflow: hidden; display: flex; flex-direction: column;">

      <!-- Not yet processed -->
      <div
        v-if="!isProcessed && !processing"
        class="flex flex-col items-center justify-center flex-1 gap-3"
      >
        <p class="text-sm" style="color: var(--color-text-muted)">Not yet processed</p>
        <p class="text-xs" style="color: var(--color-text-muted)">Click "Process Recording" to transcribe and extract notes</p>
      </div>

      <div v-else-if="processing" class="flex items-center justify-center flex-1">
        <p class="text-sm" style="color: var(--color-text-muted)">Processing… this may take a moment</p>
      </div>

      <!-- Transcript -->
      <div v-else-if="activeTab === 'transcript'" class="flex-1 overflow-y-auto p-4">
        <pre
          v-if="entry.transcript"
          class="text-xs leading-relaxed whitespace-pre-wrap"
          style="color: var(--color-text-secondary); font-family: inherit;"
        >{{ entry.transcript }}</pre>
        <p v-else class="text-xs" style="color: var(--color-text-muted)">No transcript available</p>
      </div>

      <!-- Summary -->
      <div v-else-if="activeTab === 'summary'" class="flex-1 overflow-y-auto p-4 space-y-5">
        <template v-if="entry.extraction">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Summary</p>
            <p class="text-sm leading-relaxed" style="color: var(--color-text)">{{ entry.extraction.summary }}</p>
          </div>
          <div v-if="entry.extraction.requirements.functional.length">
            <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Action Items & Requirements</p>
            <ul class="space-y-1">
              <li v-for="(r, i) in entry.extraction.requirements.functional" :key="i" class="text-sm" style="color: var(--color-text-secondary)">• {{ r }}</li>
            </ul>
          </div>
          <div v-if="entry.extraction.requirements.nonFunctional.length">
            <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Constraints & Considerations</p>
            <ul class="space-y-1">
              <li v-for="(r, i) in entry.extraction.requirements.nonFunctional" :key="i" class="text-sm" style="color: var(--color-text-secondary)">• {{ r }}</li>
            </ul>
          </div>
          <div v-if="entry.extraction.features.length">
            <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Topics / Features</p>
            <div v-for="(f, i) in entry.extraction.features" :key="i" class="mb-4">
              <p class="text-sm font-medium" style="color: var(--color-text)">{{ f.title }}</p>
              <p class="text-xs mt-0.5" style="color: var(--color-text-secondary)">{{ f.description }}</p>
              <ul v-if="f.dataFlow.length" class="mt-1 space-y-0.5">
                <li v-for="(s, j) in f.dataFlow" :key="j" class="text-xs" style="color: var(--color-text-muted)">{{ j + 1 }}. {{ s }}</li>
              </ul>
            </div>
          </div>
          <div v-if="entry.extraction.decisions.length">
            <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Decisions</p>
            <ul class="space-y-1">
              <li v-for="(d, i) in entry.extraction.decisions" :key="i" class="text-sm" style="color: var(--color-text-secondary)">✓ {{ d }}</li>
            </ul>
          </div>
          <div v-if="entry.extraction.openQuestions.length">
            <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Open Questions</p>
            <ul class="space-y-1">
              <li v-for="(q, i) in entry.extraction.openQuestions" :key="i" class="text-sm" style="color: var(--color-text-secondary)">? {{ q }}</li>
            </ul>
          </div>
        </template>
        <p v-else class="text-xs" style="color: var(--color-text-muted)">No summary available</p>
      </div>

      <!-- Chat -->
      <div v-else-if="activeTab === 'chat'" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div v-if="chatHistory.length === 0" class="flex items-center justify-center h-full">
            <p class="text-xs" style="color: var(--color-text-muted)">Ask anything about this recording</p>
          </div>
          <div
            v-for="(msg, i) in chatHistory"
            :key="i"
            :class="msg.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-2'"
          >
            <div
              class="text-sm rounded-lg px-3 py-2"
              style="max-width: 85%; white-space: pre-wrap; line-height: 1.5;"
              :style="{
                background: msg.role === 'user' ? 'var(--color-accent-subtle)' : 'var(--color-bg-surface)',
                color: msg.role === 'user' ? 'var(--color-accent-on)' : 'var(--color-text)',
                border: '1px solid ' + (msg.role === 'user' ? 'var(--color-accent-border)' : 'var(--color-border)')
              }"
            >
              {{ msg.role === 'assistant'
                ? msg.content.replace(/```json[\s\S]*?```/g, '').replace(/```mermaid[\s\S]*?```/g, '').trim()
                : msg.content }}
              <div v-if="msg.updatedExtraction" class="mt-2 pt-2" style="border-top: 1px solid var(--color-border);">
                <NButton size="tiny" type="primary" @click="applyChanges(msg.updatedExtraction!, i)">
                  Apply Changes
                </NButton>
              </div>
            </div>
            <div
              v-if="msg.diagram"
              class="rounded-lg p-3"
              style="background: var(--color-bg-surface); border: 1px solid var(--color-border); max-width: 85%;"
            >
              <p class="text-xs font-medium mb-2" style="color: var(--color-text-muted)">{{ msg.diagram.title }}</p>
              <MermaidDiagram :code="msg.diagram.code" :diagram-id="msg.diagram.id" />
            </div>
          </div>
        </div>
        <div class="shrink-0 p-3" style="border-top: 1px solid var(--color-border);">
          <div class="flex gap-2">
            <input
              v-model="chatInput"
              class="flex-1 rounded px-3 py-2 text-sm outline-none"
              style="background: var(--color-bg-surface); border: 1px solid var(--color-border); color: var(--color-text);"
              placeholder="Ask about this recording…"
              :disabled="chatSending || !isProcessed"
              @keydown.enter.prevent="sendChat"
            />
            <NButton
              type="primary"
              size="small"
              :loading="chatSending"
              :disabled="!chatInput.trim() || !isProcessed"
              @click="sendChat"
            >Send</NButton>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
