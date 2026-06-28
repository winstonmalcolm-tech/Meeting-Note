<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { fetchCollections, createCollection, addToCollection, removeFromCollection } from '../services/api'
import type { Collection } from '../types'
import { X, Check } from '@lucide/vue'

const props = defineProps<{
  refId: string
  type: 'audio' | 'screen'
  title: string
}>()

const emit = defineEmits<{ close: [] }>()

const collections = ref<Collection[]>([])
const loading = ref(true)
const saving = ref<string | null>(null)

// New collection creation
const creating = ref(false)
const newTitle = ref('')
const createError = ref('')

onMounted(async () => {
  collections.value = await fetchCollections()
  loading.value = false
})

function isMember(col: Collection): boolean {
  return col.items.some((i) => i.refId === props.refId)
}

async function toggle(col: Collection) {
  saving.value = col.id
  try {
    if (isMember(col)) {
      await removeFromCollection(col.id, props.refId)
      col.items = col.items.filter((i) => i.refId !== props.refId)
    } else {
      await addToCollection(col.id, { type: props.type, refId: props.refId, title: props.title })
      col.items = [...col.items, { type: props.type, refId: props.refId, title: props.title, addedAt: Date.now() }]
    }
  } finally {
    saving.value = null
  }
}

async function handleCreate() {
  const t = newTitle.value.trim()
  if (!t) return
  createError.value = ''
  try {
    const id = await createCollection({ title: t })
    await addToCollection(id, { type: props.type, refId: props.refId, title: props.title })
    collections.value = await fetchCollections()
    newTitle.value = ''
    creating.value = false
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to create'
  }
}
</script>

<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    style="background: rgba(0,0,0,0.7);"
    @click.self="emit('close')"
  >
    <div
      class="w-130 rounded-xl p-6 flex flex-col gap-5"
      style="background: var(--color-bg-surface); border: 1px solid var(--color-border);"
    >
      <!-- Header -->
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-text-muted)">Add to Collection</p>
        <button style="color: var(--color-text-muted)" @click="emit('close')"><X :size="14" /></button>
      </div>

      <p class="text-xs truncate" style="color: var(--color-text-secondary)">{{ title }}</p>

      <!-- Collections list -->
      <div class="flex flex-col gap-1 max-h-72 overflow-y-auto">
        <p v-if="loading" class="text-xs" style="color: var(--color-text-muted)">Loading…</p>
        <p v-else-if="collections.length === 0 && !creating" class="text-xs" style="color: var(--color-text-muted)">
          No collections yet — create one below.
        </p>
        <button
          v-for="col in collections"
          :key="col.id"
          class="flex items-center gap-3 px-3 py-2 rounded text-left transition-colors w-full"
          :style="{
            background: isMember(col) ? 'var(--color-accent-subtle)' : 'var(--color-bg)',
            border: isMember(col) ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border)',
            opacity: saving === col.id ? 0.5 : 1
          }"
          :disabled="saving !== null"
          @click="toggle(col)"
        >
          <span
            class="w-4 h-4 rounded flex items-center justify-center shrink-0 text-xs"
            :style="{
              background: isMember(col) ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
              color: isMember(col) ? 'var(--color-accent)' : 'var(--color-text-muted)',
              border: isMember(col) ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border)'
            }"
          ><Check v-if="isMember(col)" :size="10" /></span>
          <span class="text-xs flex-1 truncate" :style="{ color: isMember(col) ? 'var(--color-accent)' : 'var(--color-text-secondary)' }">
            {{ col.title }}
          </span>
          <span class="text-xs shrink-0" style="color: var(--color-text-muted)">{{ col.items.length }}</span>
        </button>
      </div>

      <!-- Create new collection -->
      <div v-if="creating" class="flex flex-col gap-2">
        <NInput
          v-model:value="newTitle"
          placeholder="Collection name…"
          size="small"
          autofocus
          @keydown.enter="handleCreate"
          @keydown.esc="creating = false"
        />
        <p v-if="createError" class="text-xs" style="color: var(--color-error)">{{ createError }}</p>
        <div class="flex gap-2">
          <NButton size="small" type="primary" class="flex-1" @click="handleCreate">Create & Add</NButton>
          <NButton size="small" @click="creating = false">Cancel</NButton>
        </div>
      </div>
      <NButton v-else size="small" @click="creating = true">+ New Collection</NButton>
    </div>
  </div>
</template>
