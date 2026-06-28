<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton } from 'naive-ui'
import type { SavedRequirement } from '../types'
import { fetchRequirements, deleteRequirement } from '../services/api'
import { FileText, X } from '@lucide/vue'

const emit = defineEmits<{ select: [requirement: SavedRequirement] }>()

const items = ref<SavedRequirement[]>([])
const confirmDeleteId = ref<string | null>(null)

async function load() {
  try {
    items.value = await fetchRequirements()
  } catch {
    items.value = []
  }
}

onMounted(load)

async function confirmDelete(id: string) {
  await deleteRequirement(id)
  confirmDeleteId.value = null
  await load()
}

function formatDate(val: string | number): string {
  return new Date(val).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div class="h-full p-6 overflow-y-auto">

    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-text-muted)">
        Saved Requirements
        <span v-if="items.length" style="color: var(--color-text-muted)"> · {{ items.length }}</span>
      </h2>
      <NButton size="small" @click="load">Refresh</NButton>
    </div>

    <div
      v-if="items.length === 0"
      class="flex flex-col items-center justify-center h-64 select-none"
    >
      <FileText :size="48" class="mb-4 opacity-20" style="color: var(--color-text-secondary);" />
      <p class="text-sm" style="color: var(--color-text-muted)">No saved requirements yet</p>
    </div>

    <div class="space-y-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors"
        style="border: 1px solid var(--color-border); background: var(--color-bg-surface);"
        @click="emit('select', item)"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate" style="color: var(--color-text)">{{ item.title }}</p>
          <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">{{ formatDate(item.createdAt) }}</p>
        </div>

        <div class="flex items-center gap-2 shrink-0" @click.stop>
          <template v-if="confirmDeleteId === item.id">
            <span class="text-xs" style="color: var(--color-text-muted)">Delete?</span>
            <NButton size="tiny" type="error" @click="confirmDelete(item.id)">Yes</NButton>
            <NButton size="tiny" @click="confirmDeleteId = null">No</NButton>
          </template>
          <NButton v-else size="tiny" @click="confirmDeleteId = item.id"><X :size="12" /></NButton>
        </div>

        <span style="color: var(--color-text-muted); font-size: 10px">›</span>
      </div>
    </div>

  </div>
</template>
