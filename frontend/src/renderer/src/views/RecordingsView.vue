<script setup lang="ts">
import { ref, onMounted } from 'vue'

const vFocus = { mounted: (el: HTMLElement) => el.focus() }
import { NButton } from 'naive-ui'
import type { RecordingEntry } from '../types'
import { useSession } from '../composables/useSession'
import AddToCollectionModal from '../components/AddToCollectionModal.vue'
import { Mic, Square, Play, Pencil, X } from '@lucide/vue'

const emit = defineEmits<{ select: [rec: RecordingEntry] }>()

const recordings = ref<RecordingEntry[]>([])
const audioUrls = ref<Record<string, string>>({})
const expandedId = ref<string | null>(null)
const processingId = ref<string | null>(null)
const confirmDeleteId = ref<string | null>(null)
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const collectionTarget = ref<RecordingEntry | null>(null)

const session = useSession()

async function load() {
  recordings.value = (await window.api.listRecordings()) as RecordingEntry[]
}

onMounted(load)

async function togglePlay(recording: RecordingEntry) {
  if (expandedId.value === recording.id) {
    expandedId.value = null
    return
  }
  expandedId.value = recording.id
  if (!audioUrls.value[recording.id]) {
    const buffer = await window.api.readRecording(recording.id)
    const blob = new Blob([buffer], { type: 'audio/webm' })
    audioUrls.value[recording.id] = URL.createObjectURL(blob)
  }
}

async function reprocess(recording: RecordingEntry) {
  processingId.value = recording.id
  try {
    const buffer = await window.api.readRecording(recording.id)
    const blob = new Blob([buffer], { type: 'audio/webm' })
    await session.process(blob, recording.id)
    await load()
  } finally {
    processingId.value = null
  }
}

function startRename(rec: RecordingEntry) {
  renamingId.value = rec.id
  renameValue.value = rec.name ?? formatDate(rec.createdAt)
}

async function commitRename(rec: RecordingEntry) {
  if (renamingId.value !== rec.id) return
  const name = renameValue.value.trim()
  if (name && name !== (rec.name ?? formatDate(rec.createdAt))) {
    await window.api.updateRecording(rec.id, { name })
    rec.name = name
  }
  renamingId.value = null
}

async function confirmDelete(id: string) {
  await window.api.deleteRecording(id)
  if (audioUrls.value[id]) {
    URL.revokeObjectURL(audioUrls.value[id])
    delete audioUrls.value[id]
  }
  confirmDeleteId.value = null
  await load()
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

const statusStyle: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: 'var(--color-text-muted)',  bg: 'var(--color-bg-elevated)',   label: 'Pending' },
  processed: { color: 'var(--color-accent)',       bg: 'var(--color-accent-subtle)', label: 'Processed' },
  error:     { color: 'var(--color-error)',        bg: 'var(--color-error-bg)',      label: 'Error' }
}
</script>

<template>
  <div class="h-full p-6 overflow-y-auto">

    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-text-muted)">
        Recordings
        <span v-if="recordings.length" style="color: var(--color-text-muted)"> · {{ recordings.length }}</span>
      </h2>
      <NButton size="small" @click="load">Refresh</NButton>
    </div>

    <!-- Empty state -->
    <div
      v-if="recordings.length === 0"
      class="flex flex-col items-center justify-center h-64 select-none"
    >
      <Mic :size="48" class="mb-4 opacity-20" style="color: var(--color-text-secondary);" />
      <p class="text-sm" style="color: var(--color-text-muted)">No recordings yet</p>
    </div>

    <!-- Recording list -->
    <div class="space-y-3">
      <div
        v-for="rec in recordings"
        :key="rec.id"
        class="rounded-lg overflow-hidden"
        style="border: 1px solid var(--color-border); background: var(--color-bg-surface)"
      >
        <!-- Header row -->
        <div class="group flex items-center gap-3 px-4 py-3">
          <!-- Play toggle -->
          <button
            class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
            :style="{
              background: expandedId === rec.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
              color: expandedId === rec.id ? 'var(--color-accent)' : 'var(--color-text-muted)'
            }"
            :title="expandedId === rec.id ? 'Close player' : 'Play recording'"
            @click.stop="togglePlay(rec)"
          >
            <Square v-if="expandedId === rec.id" :size="12" />
            <Play v-else :size="12" />
          </button>

          <!-- Meta -->
          <div
            class="flex-1 min-w-0 cursor-pointer"
            @click="renamingId === rec.id ? null : emit('select', rec)"
          >
            <input
              v-if="renamingId === rec.id"
              v-model="renameValue"
              class="text-sm w-full bg-transparent border-b outline-none"
              style="color: var(--color-text); border-color: var(--color-border);"
              @keydown.enter="commitRename(rec)"
              @keydown.esc="renamingId = null"
              @blur="commitRename(rec)"
              v-focus
              @click.stop
            />
            <div v-else class="flex items-center gap-1 min-w-0">
              <p class="text-sm truncate" style="color: var(--color-text)">
                {{ rec.name ?? formatDate(rec.createdAt) }}
              </p>
              <button
                class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                style="color: var(--color-text-muted)"
                title="Rename"
                @click.stop="startRename(rec)"
              ><Pencil :size="13" /></button>
            </div>
            <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">
              {{ formatDate(rec.createdAt) }} · {{ formatDuration(rec.duration) }} · {{ formatSize(rec.size) }}
              <span v-if="rec.provider"> · {{ rec.provider }}</span>
            </p>
          </div>

          <!-- Status badge -->
          <span
            class="text-xs px-2 py-0.5 rounded shrink-0"
            :style="{ color: statusStyle[rec.status]?.color, background: statusStyle[rec.status]?.bg }"
          >{{ statusStyle[rec.status]?.label }}</span>

          <!-- Actions -->
          <div class="flex items-center gap-2 shrink-0" @click.stop>
            <NButton size="tiny" title="Add to collection" @click="collectionTarget = rec">+</NButton>
            <NButton
              v-if="rec.status !== 'processed'"
              size="tiny"
              :loading="processingId === rec.id"
              :disabled="processingId !== null"
              @click="reprocess(rec)"
            >Process</NButton>
            <NButton
              v-else
              size="tiny"
              :loading="processingId === rec.id"
              :disabled="processingId !== null"
              @click="reprocess(rec)"
            >Re-run</NButton>
            <template v-if="confirmDeleteId === rec.id">
              <span class="text-xs" style="color: var(--color-text-muted)">Delete?</span>
              <NButton size="tiny" type="error" @click="confirmDelete(rec.id)">Yes</NButton>
              <NButton size="tiny" @click="confirmDeleteId = null">No</NButton>
            </template>
            <NButton v-else size="tiny" @click="confirmDeleteId = rec.id"><X :size="12" /></NButton>
          </div>
        </div>

        <!-- Audio player -->
        <div v-if="expandedId === rec.id" class="px-4 pb-3">
          <audio
            v-if="audioUrls[rec.id]"
            :src="audioUrls[rec.id]"
            controls
            class="w-full"
            style="height: 36px; accent-color: var(--color-accent);"
          />
          <p v-else class="text-xs" style="color: var(--color-text-muted)">Loading audio…</p>
        </div>

        <!-- Error message -->
        <div v-if="rec.status === 'error' && rec.errorMessage" class="px-4 pb-3">
          <p class="text-xs font-mono" style="color: var(--color-error)">{{ rec.errorMessage }}</p>
        </div>
      </div>
    </div>

    <AddToCollectionModal
      v-if="collectionTarget"
      :ref-id="collectionTarget.id"
      type="audio"
      :title="collectionTarget.name ?? formatDate(collectionTarget.createdAt)"
      @close="collectionTarget = null"
    />
  </div>
</template>
