<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { fetchCollections, createCollection, updateCollection, deleteCollection } from '../services/api'
import type { Collection } from '../types'
import { FolderOpen, Pencil, X } from '@lucide/vue'

const vFocus = { mounted: (el: HTMLElement) => el.focus() }

const emit = defineEmits<{ select: [col: Collection] }>()

const collections = ref<Collection[]>([])
const creating = ref(false)
const newTitle = ref('')
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const confirmDeleteId = ref<string | null>(null)

onMounted(load)

async function load() {
  collections.value = await fetchCollections()
}

async function handleCreate() {
  const t = newTitle.value.trim()
  if (!t) return
  await createCollection({ title: t })
  newTitle.value = ''
  creating.value = false
  await load()
}

function startRename(col: Collection) {
  renamingId.value = col.id
  renameValue.value = col.title
}

async function commitRename(col: Collection) {
  if (renamingId.value !== col.id) return
  const t = renameValue.value.trim()
  if (t && t !== col.title) {
    await updateCollection(col.id, { title: t })
    col.title = t
  }
  renamingId.value = null
}

async function handleDelete(id: string) {
  await deleteCollection(id)
  confirmDeleteId.value = null
  await load()
}

function formatDate(val: number | string | Date): string {
  return new Date(val).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}
</script>

<template>
  <div class="h-full p-6 overflow-y-auto">

    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-text-muted)">
        Collections
        <span v-if="collections.length" style="color: var(--color-text-muted)"> · {{ collections.length }}</span>
      </h2>
      <NButton size="small" @click="creating = !creating">+ New</NButton>
    </div>

    <div v-if="creating" class="mb-4 flex gap-2">
      <NInput
        v-model:value="newTitle"
        placeholder="Collection name…"
        size="small"
        autofocus
        class="flex-1"
        @keydown.enter="handleCreate"
        @keydown.esc="creating = false"
      />
      <NButton size="small" type="primary" @click="handleCreate">Create</NButton>
      <NButton size="small" @click="creating = false">Cancel</NButton>
    </div>

    <div
      v-if="collections.length === 0"
      class="flex flex-col items-center justify-center h-64 select-none"
    >
      <FolderOpen :size="48" class="mb-4 opacity-20" style="color: var(--color-text-secondary);" />
      <p class="text-sm" style="color: var(--color-text-muted)">No collections yet</p>
      <p class="text-xs mt-1" style="color: var(--color-text-muted)">Create one and add recordings from any list view</p>
    </div>

    <div class="space-y-2">
      <div
        v-for="col in collections"
        :key="col.id"
        class="group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors"
        style="border: 1px solid var(--color-border); background: var(--color-bg-surface);"
        @click="renamingId === col.id ? null : emit('select', col)"
      >
        <div
          class="w-8 h-8 rounded flex items-center justify-center shrink-0"
          style="background: var(--color-accent-subtle); color: var(--color-accent);"
        ><FolderOpen :size="16" /></div>

        <div class="flex-1 min-w-0">
          <input
            v-if="renamingId === col.id"
            v-model="renameValue"
            v-focus
            class="text-sm w-full bg-transparent border-b outline-none"
            style="color: var(--color-text); border-color: var(--color-border);"
            @keydown.enter="commitRename(col)"
            @keydown.esc="renamingId = null"
            @blur="commitRename(col)"
            @click.stop
          />
          <div v-else class="flex items-center gap-1 min-w-0">
            <p class="text-sm font-medium truncate" style="color: var(--color-text)">{{ col.title }}</p>
            <button
              class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-1"
              style="color: var(--color-text-muted)"
              title="Rename"
              @click.stop="startRename(col)"
            ><Pencil :size="13" /></button>
          </div>
          <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">
            {{ col.items.length }} {{ col.items.length === 1 ? 'recording' : 'recordings' }}
            · {{ formatDate(col.createdAt) }}
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0" @click.stop>
          <template v-if="confirmDeleteId === col.id">
            <span class="text-xs" style="color: var(--color-text-muted)">Delete?</span>
            <NButton size="tiny" type="error" @click="handleDelete(col.id)">Yes</NButton>
            <NButton size="tiny" @click="confirmDeleteId = null">No</NButton>
          </template>
          <NButton v-else size="tiny" @click="confirmDeleteId = col.id"><X :size="12" /></NButton>
        </div>
      </div>
    </div>

  </div>
</template>
