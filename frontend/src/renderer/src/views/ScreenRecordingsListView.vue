<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton } from 'naive-ui'
import type { ScreenRecordingEntry } from '../types'
import AddToCollectionModal from '../components/AddToCollectionModal.vue'
import { Film, Play, Pencil, Mic, X } from '@lucide/vue'

const vFocus = { mounted: (el: HTMLElement) => el.focus() }

const emit = defineEmits<{ select: [rec: ScreenRecordingEntry] }>()

const recordings = ref<ScreenRecordingEntry[]>([])
const confirmDeleteId = ref<string | null>(null)
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const collectionTarget = ref<ScreenRecordingEntry | null>(null)

async function load() {
  recordings.value = (await window.api.listScreenRecordings()) as ScreenRecordingEntry[]
}

onMounted(load)

function startRename(rec: ScreenRecordingEntry) {
  renamingId.value = rec.id
  renameValue.value = rec.name ?? rec.sourceName
}

async function commitRename(rec: ScreenRecordingEntry) {
  if (renamingId.value !== rec.id) return
  const name = renameValue.value.trim()
  if (name && name !== (rec.name ?? rec.sourceName)) {
    await window.api.updateScreenRecording(rec.id, { name })
    rec.name = name
  }
  renamingId.value = null
}

async function confirmDelete(id: string) {
  await window.api.deleteScreenRecording(id)
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
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
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
        Screen Recordings
        <span v-if="recordings.length" style="color: var(--color-text-muted)"> · {{ recordings.length }}</span>
      </h2>
      <NButton size="small" @click="load">Refresh</NButton>
    </div>

    <div
      v-if="recordings.length === 0"
      class="flex flex-col items-center justify-center h-64 select-none"
    >
      <Film :size="48" class="mb-4 opacity-20" style="color: var(--color-text-secondary);" />
      <p class="text-sm" style="color: var(--color-text-muted)">No screen recordings yet</p>
    </div>

    <div class="space-y-2">
      <div
        v-for="rec in recordings"
        :key="rec.id"
        class="group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors"
        style="border: 1px solid var(--color-border); background: var(--color-bg-surface);"
        @click="renamingId === rec.id ? null : emit('select', rec)"
      >
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style="background: var(--color-bg-elevated); color: var(--color-text-muted);"
        ><Play :size="11" /></div>

        <div class="flex-1 min-w-0">
          <input
            v-if="renamingId === rec.id"
            v-model="renameValue"
            v-focus
            class="text-sm w-full bg-transparent border-b outline-none"
            style="color: var(--color-text); border-color: var(--color-border);"
            @keydown.enter="commitRename(rec)"
            @keydown.esc="renamingId = null"
            @blur="commitRename(rec)"
            @click.stop
          />
          <div v-else class="flex items-center gap-1 min-w-0">
            <p class="text-sm font-medium truncate" style="color: var(--color-text)">
              {{ rec.name ?? rec.sourceName }}
            </p>
            <button
              class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-1"
              style="color: var(--color-text-muted)"
              title="Rename"
              @click.stop="startRename(rec)"
            ><Pencil :size="13" /></button>
          </div>
          <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">
            {{ formatDate(rec.createdAt) }}
            · {{ formatDuration(rec.duration) }}
            · {{ formatSize(rec.size) }}
            <span class="ml-1 px-1.5 py-0.5 rounded"
                  style="background: var(--color-bg-elevated); color: var(--color-text-muted)">{{ rec.sourceType }}</span>
            <Mic v-if="rec.withMic" :size="11" class="ml-1 inline" style="color: var(--color-text-muted);" />
          </p>
        </div>

        <span
          v-if="rec.status"
          class="text-xs px-2 py-0.5 rounded shrink-0"
          :style="{ color: statusStyle[rec.status]?.color, background: statusStyle[rec.status]?.bg }"
        >{{ statusStyle[rec.status]?.label }}</span>

        <div class="flex items-center gap-2 shrink-0" @click.stop>
          <NButton size="tiny" title="Add to collection" @click="collectionTarget = rec">+</NButton>
          <template v-if="confirmDeleteId === rec.id">
            <span class="text-xs" style="color: var(--color-text-muted)">Delete?</span>
            <NButton size="tiny" type="error" @click="confirmDelete(rec.id)">Yes</NButton>
            <NButton size="tiny" @click="confirmDeleteId = null">No</NButton>
          </template>
          <NButton v-else size="tiny" @click="confirmDeleteId = rec.id"><X :size="12" /></NButton>
        </div>
      </div>
    </div>

    <AddToCollectionModal
      v-if="collectionTarget"
      :ref-id="collectionTarget.id"
      type="screen"
      :title="collectionTarget.name ?? collectionTarget.sourceName"
      @close="collectionTarget = null"
    />
  </div>
</template>
