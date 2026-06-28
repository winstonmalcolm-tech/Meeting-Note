<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { useLiveAssistant } from '../composables/useLiveAssistant'
import type { DesktopSource } from '../composables/useScreenRecorder'
import { Monitor } from '@lucide/vue'

const { isActive, isPaused, status, liveTranscript, lastResponse, error, start, stop, togglePause, sendMessage } =
  useLiveAssistant()

const customMessage = ref('')

// Source picker state
const sources = ref<DesktopSource[]>([])
const selectedSource = ref<DesktopSource | null>(null)
const sourcesLoading = ref(false)
const sourcesError = ref('')

onMounted(async () => {
  await loadSources()
})

async function loadSources() {
  sourcesLoading.value = true
  sourcesError.value = ''
  try {
    sources.value = await window.api.getDesktopSources()
    if (sources.value.length > 0 && !selectedSource.value) {
      selectedSource.value = sources.value[0] ?? null
    }
  } catch {
    sourcesError.value = 'Could not load sources'
  } finally {
    sourcesLoading.value = false
  }
}

const statusConfig = {
  idle:       { label: 'Ready',        color: 'var(--color-text-muted)',      dot: '' },
  connecting: { label: 'Connecting…',  color: 'var(--color-text-secondary)',  dot: 'animate-pulse' },
  listening:  { label: 'Listening',    color: 'var(--color-accent)',           dot: 'animate-pulse' },
  thinking:   { label: 'AI thinking…', color: 'var(--color-info-text)',        dot: 'animate-pulse' },
  error:      { label: 'Error',        color: 'var(--color-error)',            dot: '' }
}

function toggle() {
  if (isActive.value) {
    stop()
  } else {
    start(true, selectedSource.value ?? undefined)
  }
}

function handleSendMessage() {
  if (!customMessage.value.trim()) return
  sendMessage(customMessage.value.trim())
  customMessage.value = ''
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">

    <!-- Header -->
    <div class="px-6 pt-6 pb-4 shrink-0">
      <p class="text-xs font-semibold tracking-widest uppercase mb-1" style="color: var(--color-text-muted)">Interview Assistant</p>
      <p class="text-xs" style="color: var(--color-text-muted)">
        Listens to the interviewer's questions and streams AI-suggested answers in a floating overlay.
      </p>
    </div>

    <!-- Main card -->
    <div class="mx-6 rounded-xl p-5 shrink-0" style="border: 1px solid var(--color-border); background: var(--color-bg);">

      <!-- Status row -->
      <div class="flex items-center gap-3 mb-5">
        <div
          class="w-2.5 h-2.5 rounded-full shrink-0"
          :class="statusConfig[status]?.dot"
          :style="{ background: statusConfig[status]?.color ?? 'var(--color-text-muted)' }"
        />
        <span class="text-sm" :style="{ color: statusConfig[status]?.color ?? 'var(--color-text-muted)' }">
          {{ statusConfig[status]?.label ?? status }}
        </span>
        <span class="text-xs ml-auto" style="color: var(--color-text-muted)">System audio only</span>
      </div>

      <!-- Audio source picker -->
      <div v-if="!isActive" class="mb-5">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-text-muted)">Audio source</p>
          <button
            class="text-xs px-2 py-0.5 rounded transition-colors"
            style="color: var(--color-text-muted); border: 1px solid var(--color-border);"
            :disabled="sourcesLoading"
            @click="loadSources"
          >{{ sourcesLoading ? '…' : 'Refresh' }}</button>
        </div>
        <p v-if="sourcesError" class="text-xs mb-2" style="color: var(--color-error)">{{ sourcesError }}</p>
        <div class="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
          <button
            v-for="src in sources"
            :key="src.id"
            class="flex items-center gap-2 px-3 py-2 rounded text-left transition-colors w-full"
            :style="{
              background: selectedSource?.id === src.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-surface)',
              border: selectedSource?.id === src.id ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border)',
              color: selectedSource?.id === src.id ? 'var(--color-accent)' : 'var(--color-text-secondary)'
            }"
            @click="selectedSource = src"
          >
            <img
              v-if="src.thumbnail"
              :src="src.thumbnail"
              class="rounded shrink-0"
              style="width: 40px; height: 22px; object-fit: cover; background: var(--color-bg);"
            />
            <Monitor v-else :size="16" class="shrink-0" style="color: var(--color-text-muted);" />
            <span class="text-xs truncate flex-1">{{ src.name }}</span>
            <span class="text-xs shrink-0 px-1.5 py-0.5 rounded" style="background: var(--color-bg-elevated); color: var(--color-text-muted); font-size: 10px;">
              {{ src.id.startsWith('screen:') ? 'Screen' : 'Window' }}
            </span>
          </button>
          <p v-if="!sourcesLoading && sources.length === 0" class="text-xs px-1" style="color: var(--color-text-muted)">No sources found</p>
        </div>
      </div>

      <!-- Start / Stop + Pause -->
      <div class="flex gap-2">
        <NButton
          :type="isActive ? 'error' : 'primary'"
          :loading="status === 'connecting'"
          size="medium"
          class="flex-1"
          @click="toggle"
        >
          {{ isActive ? 'Stop' : 'Start Listening' }}
        </NButton>
        <NButton v-if="isActive" size="medium" @click="togglePause">
          {{ isPaused ? 'Resume' : 'Pause' }}
        </NButton>
      </div>

      <p v-if="error" class="text-xs mt-3" style="color: var(--color-error)">{{ error }}</p>
    </div>

    <!-- Live preview -->
    <div
      class="flex-1 mx-6 mt-4 rounded-xl overflow-hidden flex flex-col min-h-0"
      style="border: 1px solid var(--color-border); background: var(--color-bg);"
    >
      <div v-if="!isActive" class="flex items-center justify-center h-full">
        <p class="text-xs" style="color: var(--color-text-muted)">Start listening to see live output here</p>
      </div>

      <template v-else>
        <!-- Hearing -->
        <div class="px-4 pt-3 pb-2 shrink-0" style="border-bottom: 1px solid var(--color-border);">
          <p class="text-xs font-semibold tracking-widest uppercase mb-1" style="color: var(--color-text-muted)">Interviewer</p>
          <p class="text-xs italic" style="color: var(--color-text-secondary); min-height: 16px;">{{ liveTranscript || 'Listening…' }}</p>
        </div>

        <!-- AI response -->
        <div class="flex-1 px-4 pt-3 pb-2 overflow-y-auto min-h-0">
          <p class="text-xs font-semibold tracking-widest uppercase mb-2" style="color: var(--color-text-muted)">Suggested Response</p>
          <p v-if="lastResponse" class="text-sm leading-relaxed" style="color: var(--color-text); white-space: pre-wrap;">{{ lastResponse }}</p>
          <p v-else class="text-xs" style="color: var(--color-text-muted)">
            {{ status === 'thinking' ? 'Generating response…' : 'Waiting for a question…' }}
          </p>
        </div>

        <!-- Custom message input -->
        <div class="px-4 pb-3 pt-2 shrink-0" style="border-top: 1px solid var(--color-border);">
          <div class="flex gap-2">
            <NInput
              v-model:value="customMessage"
              placeholder="Type a follow-up or custom prompt…"
              size="small"
              @keydown.enter="handleSendMessage"
            />
            <NButton size="small" :disabled="!customMessage.trim()" @click="handleSendMessage">Send</NButton>
          </div>
        </div>
      </template>
    </div>

  </div>
</template>
