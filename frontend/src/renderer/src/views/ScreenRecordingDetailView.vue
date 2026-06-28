<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton } from 'naive-ui'
import type { ScreenRecordingEntry, ChatMessage, ExtractionResult } from '../types'
import { transcribeAudio, extractRequirements, chatStateless, saveScreenRecordingToDB, fetchScreenRecordingFromDB, updateScreenRecordingInDB } from '../services/api'
import MermaidDiagram from '../components/MermaidDiagram.vue'

const props = defineProps<{ recording: ScreenRecordingEntry }>()
const emit = defineEmits<{ back: []; updated: [entry: ScreenRecordingEntry] }>()

type Tab = 'transcript' | 'summary' | 'chat'
const activeTab = ref<Tab>('transcript')

// Local copy of the entry so we can update it without reloading the list
const entry = ref<ScreenRecordingEntry>({ ...props.recording })
const dbId = ref<string | null>(null)

const videoUrl = ref<string | null>(null)
const processing = ref(false)
const processError = ref('')

const chatInput = ref('')
const chatSending = ref(false)
const chatHistory = ref<ChatMessage[]>([])

function videoMimeType(): string {
  const mimes: Record<string, string> = {
    '.webm': 'video/webm', '.mp4': 'video/mp4',
    '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo'
  }
  return mimes[entry.value.fileExt ?? '.webm'] ?? 'video/webm'
}

// Load video and hydrate transcript/extraction from DB if previously processed
;(async () => {
  const [buffer, dbRecord] = await Promise.all([
    window.api.readScreenRecording(entry.value.id),
    fetchScreenRecordingFromDB(entry.value.id)
  ])
  const blob = new Blob([buffer], { type: videoMimeType() })
  videoUrl.value = URL.createObjectURL(blob)

  if (dbRecord) {
    dbId.value = dbRecord.id
    entry.value = {
      ...entry.value,
      status: (dbRecord.status as ScreenRecordingEntry['status']) ?? entry.value.status,
      transcript: dbRecord.transcript ?? entry.value.transcript,
      extraction: dbRecord.extraction ?? entry.value.extraction
    }
  }
})()

async function processRecording() {
  processing.value = true
  processError.value = ''
  try {
    const buffer = await window.api.extractScreenAudio(entry.value.id)
    const blob = new Blob([buffer], { type: 'audio/webm' })

    const transcript = await transcribeAudio(blob)
    const extraction = await extractRequirements(transcript)

    // Upsert into MongoDB — returns the DB id for future patches
    const savedId = await saveScreenRecordingToDB({
      fileId: entry.value.id,
      sourceName: entry.value.sourceName,
      sourceType: entry.value.sourceType,
      duration: entry.value.duration,
      size: entry.value.size,
      withMic: entry.value.withMic,
      createdAt: entry.value.createdAt,
      status: 'processed',
      transcript,
      extraction
    })
    dbId.value = savedId

    entry.value = { ...entry.value, status: 'processed', transcript, extraction }
    activeTab.value = 'transcript'
    emit('updated', entry.value)
  } catch (err) {
    processError.value = err instanceof Error ? err.message : 'Processing failed'
    entry.value = { ...entry.value, status: 'error', errorMessage: processError.value }
    if (dbId.value) {
      await updateScreenRecordingInDB(dbId.value, { status: 'error' })
    }
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
      entry.value.sourceName,
      entry.value.extraction,
      chatHistory.value.slice(0, -1).map(({ role, content }) => ({ role, content })),
      message,
      entry.value.id
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
  if (dbId.value) {
    await updateScreenRecordingInDB(dbId.value, { extraction: updated })
  }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

const isProcessed = computed(() => entry.value.status === 'processed')
const tabs: { key: Tab; label: string }[] = [
  { key: 'transcript', label: 'Transcript' },
  { key: 'summary', label: 'Summary' },
  { key: 'chat', label: 'Chat' }
]
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">

    <!-- Header -->
    <div class="flex items-center gap-3 px-4 py-3 shrink-0" style="border-bottom: 1px solid var(--color-border);">
      <NButton size="small" @click="emit('back')">← Back</NButton>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate" style="color: var(--color-text)">{{ entry.sourceName }}</p>
        <p class="text-xs" style="color: var(--color-text-muted)">
          {{ formatDate(entry.createdAt) }} · {{ formatDuration(entry.duration) }}
          <span class="ml-1 px-1.5 rounded" style="background: var(--color-bg-elevated); color: var(--color-text-muted)">{{ entry.sourceType }}</span>
        </p>
      </div>
      <NButton
        v-if="!isProcessed"
        type="primary"
        size="small"
        :loading="processing"
        @click="processRecording"
      >
        {{ processing ? 'Processing…' : 'Process Recording' }}
      </NButton>
      <NButton
        v-else
        size="small"
        :loading="processing"
        @click="processRecording"
      >
        Re-process
      </NButton>
    </div>

    <p v-if="processError" class="px-4 py-2 text-xs shrink-0" style="color: var(--color-error)">{{ processError }}</p>

    <!-- Main: video left, panels right -->
    <div style="flex: 1; display: flex; overflow: hidden;">

      <!-- Video player -->
      <div style="width: 55%; border-right: 1px solid var(--color-border); display: flex; flex-direction: column; overflow: hidden;">
        <div style="flex: 1; background: #000; display: flex; align-items: center; justify-content: center;">
          <video
            v-if="videoUrl"
            :src="videoUrl"
            controls
            style="width: 100%; height: 100%; object-fit: contain; accent-color: var(--color-accent)"
            @loadedmetadata="(e) => {
              const v = e.target as HTMLVideoElement
              if (v.duration === Infinity) {
                v.currentTime = Number.MAX_SAFE_INTEGER
                v.ontimeupdate = () => { v.ontimeupdate = null; v.currentTime = 0 }
              }
            }"
          />
          <p v-else class="text-xs" style="color: var(--color-text-muted)">Loading video…</p>
        </div>
      </div>

      <!-- Right panel: tabs -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">

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
          >
            {{ tab.label }}
          </button>
        </div>
        <div style="flex: 1; border-top: 1px solid var(--color-border); overflow: hidden;">

          <!-- Not yet processed -->
          <div
            v-if="!isProcessed && !processing"
            class="flex flex-col items-center justify-center h-full gap-3"
          >
            <p class="text-sm" style="color: var(--color-text-muted)">No transcription yet</p>
            <p class="text-xs" style="color: var(--color-text-muted)">Click "Process Recording" to transcribe and summarize</p>
          </div>

          <div v-else-if="processing" class="flex items-center justify-center h-full">
            <p class="text-sm" style="color: var(--color-text-muted)">Processing… this may take a moment</p>
          </div>

          <!-- Transcript tab -->
          <div v-else-if="activeTab === 'transcript'" class="h-full overflow-y-auto p-4">
            <pre
              v-if="entry.transcript"
              class="text-xs leading-relaxed whitespace-pre-wrap"
              style="color: var(--color-text-secondary); font-family: inherit;"
            >{{ entry.transcript }}</pre>
            <p v-else class="text-xs" style="color: var(--color-text-muted)">No transcript available</p>
          </div>

          <!-- Summary tab -->
          <div v-else-if="activeTab === 'summary'" class="h-full overflow-y-auto p-4 space-y-5">
            <template v-if="entry.extraction">
              <div>
                <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Summary</p>
                <p class="text-sm" style="color: var(--color-text)">{{ entry.extraction.summary }}</p>
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
                <div v-for="(f, i) in entry.extraction.features" :key="i" class="mb-3">
                  <p class="text-sm font-medium" style="color: var(--color-text)">{{ f.title }}</p>
                  <p class="text-xs mt-0.5" style="color: var(--color-text-secondary)">{{ f.description }}</p>
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
          </div>

          <!-- Chat tab -->
          <div v-else-if="activeTab === 'chat'" style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">
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
                  style="max-width: 85%; white-space: pre-wrap; line-height: 1.5"
                  :style="{
                    background: msg.role === 'user' ? 'var(--color-accent-subtle)' : 'var(--color-bg-surface)',
                    color: msg.role === 'user' ? 'var(--color-accent-on)' : 'var(--color-text)',
                    border: '1px solid ' + (msg.role === 'user' ? 'var(--color-accent-border)' : 'var(--color-border)')
                  }"
                >
                  {{ msg.role === 'assistant'
                    ? msg.content.replace(/```json[\s\S]*?```/g, '').replace(/```mermaid[\s\S]*?```/g, '').trim()
                    : msg.content }}
                  <div v-if="msg.updatedExtraction" class="mt-2 pt-2" style="border-top: 1px solid var(--color-border)">
                    <NButton size="tiny" type="primary" @click="applyChanges(msg.updatedExtraction!, i)">
                      Apply Changes
                    </NButton>
                  </div>
                </div>
                <div v-if="msg.diagram" class="rounded-lg p-3" style="background: var(--color-bg-surface); border: 1px solid var(--color-border); max-width: 85%">
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
    </div>
  </div>
</template>
