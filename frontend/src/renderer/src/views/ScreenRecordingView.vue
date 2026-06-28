<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NSwitch } from 'naive-ui'
import { useScreenRecorder, type DesktopSource } from '../composables/useScreenRecorder'
import { Monitor } from '@lucide/vue'

const emit = defineEmits<{ saved: [] }>()

const sources = ref<DesktopSource[]>([])
const selectedSource = ref<DesktopSource | null>(null)
const withMic = ref(true)
const loadingError = ref('')
const recordingError = ref('')

const {
  isRecording, isPaused, duration,
  activeSourceName, activeSourceType, activeWithMic,
  startRecording, togglePause, stopRecording
} = useScreenRecorder()

async function loadSources() {
  loadingError.value = ''
  try {
    sources.value = await window.api.getDesktopSources()
    if (sources.value.length > 0 && !selectedSource.value) {
      selectedSource.value = sources.value[0] ?? null
    }
  } catch (err) {
    loadingError.value = 'Could not load sources'
  }
}

onMounted(loadSources)

async function saveBlob(blob: Blob): Promise<void> {
  if (blob.size === 0) return
  const buffer = await blob.arrayBuffer()
  await window.api.saveScreenRecording(buffer, {
    createdAt: Date.now(),
    duration: duration.value,
    size: blob.size,
    sourceName: activeSourceName.value,
    sourceType: activeSourceType.value,
    withMic: activeWithMic.value
  })
  emit('saved')
}

async function start() {
  if (!selectedSource.value) return
  recordingError.value = ''
  try {
    await startRecording(selectedSource.value, withMic.value, saveBlob)
  } catch (err) {
    recordingError.value = err instanceof Error ? err.message : 'Could not start recording'
  }
}

async function stop() {
  const blob = await stopRecording()
  if (!blob) return
  await saveBlob(blob)
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">

    <!-- Recording controls bar (shown while recording) -->
    <div
      v-if="isRecording"
      class="flex items-center gap-4 px-6 py-4 shrink-0"
      style="border-bottom: 1px solid var(--color-border);"
    >
      <span
        class="block w-2 h-2 rounded-full bg-red-500"
        :class="{ 'animate-pulse': !isPaused }"
      />
      <span class="font-mono text-sm tabular-nums" style="color: var(--color-text)">
        {{ formatDuration(duration) }}
      </span>
      <span class="text-sm truncate" style="color: var(--color-text-muted); max-width: 240px">
        {{ activeSourceName }}
      </span>
      <div class="flex items-center gap-2 ml-auto">
        <NButton size="small" round @click="togglePause">
          {{ isPaused ? 'Resume' : 'Pause' }}
        </NButton>
        <NButton type="error" size="small" round @click="stop">Stop & Save</NButton>
      </div>
    </div>

    <!-- Source picker (shown when not recording) -->
    <div v-else class="flex-1 overflow-y-auto p-6">

      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-text-muted)">
          Select a Source
        </h2>
        <NButton size="small" @click="loadSources">Refresh</NButton>
      </div>

      <p v-if="loadingError" class="text-xs mb-4" style="color: var(--color-error)">{{ loadingError }}</p>
      <p v-if="recordingError" class="text-xs mb-4" style="color: var(--color-error)">{{ recordingError }}</p>

      <!-- Source grid -->
      <div class="grid gap-3 mb-6" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))">
        <button
          v-for="source in sources"
          :key="source.id"
          class="rounded-lg overflow-hidden text-left transition-all"
          :style="{
            border: selectedSource?.id === source.id ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
            background: 'var(--color-bg-surface)'
          }"
          @click="selectedSource = source"
        >
          <div class="relative" style="aspect-ratio: 16/9; background: var(--color-bg)">
            <img
              v-if="source.thumbnail"
              :src="source.thumbnail"
              class="w-full h-full object-contain"
              :alt="source.name"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Monitor :size="28" style="color: var(--color-border);" />
            </div>
            <!-- Screen vs Window badge -->
            <span
              class="absolute top-1 left-1 text-xs px-1.5 py-0.5 rounded"
              style="background: rgba(0,0,0,0.7); color: var(--color-text-muted)"
            >
              {{ source.id.startsWith('screen:') ? 'Screen' : 'Window' }}
            </span>
          </div>
          <div class="px-3 py-2">
            <p class="text-xs truncate" style="color: var(--color-text-secondary)">{{ source.name }}</p>
          </div>
        </button>
      </div>

      <!-- Options + start -->
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <NSwitch v-model:value="withMic" size="small" />
          <span class="text-xs" style="color: var(--color-text-muted)">Include microphone</span>
        </div>
        <NButton
          type="primary"
          :disabled="!selectedSource"
          @click="start"
        >
          Start Recording
        </NButton>
      </div>

    </div>

  </div>
</template>
