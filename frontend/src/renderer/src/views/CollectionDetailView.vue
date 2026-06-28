<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NInput } from 'naive-ui'
import {
  updateCollection, removeFromCollection,
  synthesizeCollection, chatWithCollection,
  fetchScreenRecordingFromDB
} from '../services/api'
import MermaidDiagram from '../components/MermaidDiagram.vue'
import type { Collection, CollectionItem, ExtractionResult, ChatMessage, Diagram } from '../types'
import { Pencil, Mic, Film, X, Check, HelpCircle, ClipboardList, MessageCircle, FolderOpen } from '@lucide/vue'

const vFocus = { mounted: (el: HTMLElement) => el.focus() }

const props = defineProps<{ collection: Collection }>()
const emit = defineEmits<{ back: []; updated: [col: Collection] }>()

// Local mutable copy
const col = ref<Collection>({ ...props.collection, items: [...props.collection.items] })

type Tab = 'recordings' | 'summary' | 'chat'
const activeTab = ref<Tab>('recordings')

// ── Recordings tab ─────────────────────────────────────────────────────────
const confirmRemoveRefId = ref<string | null>(null)
const editingTitle = ref(false)
const titleValue = ref(col.value.title)
const editingDesc = ref(false)
const descValue = ref(col.value.description ?? '')

const audioItems = computed(() => col.value.items.filter((i) => i.type === 'audio'))
const screenItems = computed(() => col.value.items.filter((i) => i.type === 'screen'))

async function commitTitle() {
  const t = titleValue.value.trim()
  if (t && t !== col.value.title) {
    await updateCollection(col.value.id, { title: t })
    col.value.title = t
    emit('updated', col.value)
  }
  editingTitle.value = false
}

async function commitDesc() {
  await updateCollection(col.value.id, { description: descValue.value })
  col.value.description = descValue.value
  editingDesc.value = false
}

async function handleRemove(refId: string) {
  await removeFromCollection(col.value.id, refId)
  col.value.items = col.value.items.filter((i: CollectionItem) => i.refId !== refId)
  confirmRemoveRefId.value = null
  emit('updated', col.value)
}

// ── Summary tab ────────────────────────────────────────────────────────────
const synthesizing = ref(false)
const synthesisError = ref('')

// Gather extractions from all items in this collection
async function gatherExtractions(): Promise<{ title: string; extraction: ExtractionResult }[]> {
  const audioList = (await window.api.listRecordings()) as Array<{
    id: string; name?: string; createdAt: number; extraction?: ExtractionResult
  }>
  const screenList = (await window.api.listScreenRecordings()) as Array<{
    id: string; name?: string; sourceName?: string; extraction?: ExtractionResult
  }>

  const results: { title: string; extraction: ExtractionResult }[] = []

  for (const item of col.value.items) {
    if (item.type === 'audio') {
      const rec = audioList.find((r) => r.id === item.refId)
      const extraction = rec?.extraction
      if (extraction) results.push({ title: item.title, extraction })
    } else {
      // Try local list first, fall back to DB
      const local = screenList.find((r) => r.id === item.refId)
      const extraction = local?.extraction ?? (await fetchScreenRecordingFromDB(item.refId))?.extraction as ExtractionResult | undefined
      if (extraction) results.push({ title: item.title, extraction })
    }
  }

  return results
}

async function handleSynthesize() {
  synthesizing.value = true
  synthesisError.value = ''
  try {
    const items = await gatherExtractions()
    if (items.length === 0) {
      synthesisError.value = 'No processed recordings found in this collection.'
      return
    }
    const summary = await synthesizeCollection(col.value.id, items)
    col.value.summary = summary
    emit('updated', col.value)
    activeTab.value = 'summary'
  } catch (err) {
    synthesisError.value = err instanceof Error ? err.message : 'Synthesis failed'
  } finally {
    synthesizing.value = false
  }
}

// ── Chat tab ───────────────────────────────────────────────────────────────
const chatInput = ref('')
const chatSending = ref(false)
const chatHistory = ref<ChatMessage[]>([])
const chatError = ref('')

onMounted(() => {
  // Sync from prop in case parent already has a summary
  if (props.collection.summary && !col.value.summary) {
    col.value.summary = props.collection.summary
  }
  if (props.collection.diagrams) {
    col.value.diagrams = props.collection.diagrams
  }
})

async function sendChat() {
  const message = chatInput.value.trim()
  if (!message || !col.value.summary) return
  chatInput.value = ''
  chatSending.value = true
  chatError.value = ''
  chatHistory.value.push({ role: 'user', content: message })

  try {
    const { reply, updatedSummary, diagram } = await chatWithCollection(
      col.value.id,
      message,
      chatHistory.value.slice(0, -1).map(({ role, content }) => ({ role, content }))
    )
    chatHistory.value.push({ role: 'assistant', content: reply, updatedExtraction: updatedSummary, diagram })
    if (updatedSummary) {
      col.value.summary = updatedSummary
      emit('updated', col.value)
    }
    if (diagram) {
      col.value.diagrams = [...(col.value.diagrams ?? []), diagram]
    }
  } catch (err) {
    chatError.value = err instanceof Error ? err.message : 'Chat failed'
    chatHistory.value.pop()
  } finally {
    chatSending.value = false
  }
}

function applyChanges(updated: ExtractionResult, msgIndex: number) {
  const msg = chatHistory.value[msgIndex]
  if (msg) msg.updatedExtraction = undefined
  col.value.summary = updated
  emit('updated', col.value)
}

function formatDate(val: number | string | Date): string {
  return new Date(val).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'recordings', label: 'Recordings' },
  { key: 'summary', label: 'Summary' },
  { key: 'chat', label: 'Chat' }
]
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">

    <!-- Header -->
    <div class="px-6 pt-5 pb-3 shrink-0" style="border-bottom: 1px solid var(--color-border);">
      <button class="text-xs mb-3 transition-colors" style="color: var(--color-text-muted)" @click="emit('back')">
        ← Collections
      </button>

      <!-- Editable title -->
      <div class="flex items-center gap-2 mb-1">
        <input
          v-if="editingTitle"
          v-model="titleValue"
          v-focus
          class="text-lg font-semibold bg-transparent border-b outline-none flex-1"
          style="color: var(--color-text); border-color: var(--color-border);"
          @keydown.enter="commitTitle"
          @keydown.esc="editingTitle = false"
          @blur="commitTitle"
        />
        <h1 v-else class="text-lg font-semibold flex-1" style="color: var(--color-text)">{{ col.title }}</h1>
        <button v-if="!editingTitle" class="shrink-0 px-1" style="color: var(--color-text-muted)" @click="editingTitle = true"><Pencil :size="14" /></button>
      </div>

      <!-- Editable description -->
      <div v-if="editingDesc" class="flex gap-2 mt-1">
        <NInput
          v-model:value="descValue"
          type="textarea"
          :rows="2"
          placeholder="Add a description…"
          size="small"
          class="flex-1"
          autofocus
        />
        <div class="flex flex-col gap-1">
          <NButton size="tiny" type="primary" @click="commitDesc">Save</NButton>
          <NButton size="tiny" @click="editingDesc = false">Cancel</NButton>
        </div>
      </div>
      <div v-else class="flex items-center gap-2 mt-1">
        <p class="text-xs flex-1" style="color: var(--color-text-muted)">{{ col.description || 'No description' }}</p>
        <button
          class="shrink-0 px-1"
          style="color: var(--color-text-muted)"
          @click="editingDesc = true; descValue = col.description ?? ''"
        ><Pencil :size="14" /></button>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="flex gap-1 px-6 pt-3 pb-0 shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-4 py-1.5 text-xs font-medium transition-colors rounded-t"
        :style="{
          background: activeTab === tab.key ? 'var(--color-bg-surface)' : 'transparent',
          color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
          borderBottom: activeTab === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent'
        }"
        @click="activeTab = tab.key"
      >{{ tab.label }}</button>
    </div>
    <div style="flex: 1; border-top: 1px solid var(--color-border); overflow: hidden; display: flex; flex-direction: column;">

      <!-- ── Recordings tab ───────────────────────────────────────────── -->
      <div v-if="activeTab === 'recordings'" class="flex-1 overflow-y-auto p-6">
        <div v-if="col.items.length === 0" class="flex flex-col items-center justify-center h-48 select-none">
          <FolderOpen :size="48" class="mb-3 opacity-20" style="color: var(--color-text-secondary);" />
          <p class="text-sm" style="color: var(--color-text-muted)">No recordings in this collection</p>
          <p class="text-xs mt-1" style="color: var(--color-text-muted)">Use the + button on any recording to add it here</p>
        </div>

        <template v-else>
          <!-- Synthesize prompt -->
          <div
            class="flex items-center justify-between mb-5 px-4 py-3 rounded-lg"
            style="background: var(--color-bg); border: 1px solid var(--color-border);"
          >
            <div>
              <p class="text-xs font-semibold" style="color: var(--color-text-secondary)">
                {{ col.summary ? 'Collection summary generated' : 'No summary yet' }}
              </p>
              <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">
                {{ col.summary ? 'Re-synthesize to include new recordings.' : 'Synthesize to enable AI chat across all meetings.' }}
              </p>
              <p v-if="synthesisError" class="text-xs mt-1" style="color: var(--color-error)">{{ synthesisError }}</p>
            </div>
            <NButton
              size="small"
              :type="col.summary ? 'default' : 'primary'"
              :loading="synthesizing"
              @click="handleSynthesize"
            >
              {{ col.summary ? 'Re-synthesize' : 'Generate Summary' }}
            </NButton>
          </div>

          <!-- Audio section -->
          <div v-if="audioItems.length" class="mb-6">
            <p class="text-xs font-semibold tracking-widest uppercase mb-3" style="color: var(--color-text-muted)">
              Audio · {{ audioItems.length }}
            </p>
            <div class="space-y-2">
              <div
                v-for="item in audioItems"
                :key="item.refId"
                class="flex items-center gap-3 px-4 py-3 rounded-lg"
                style="border: 1px solid var(--color-border); background: var(--color-bg-surface);"
              >
                <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style="background: var(--color-bg-elevated); color: var(--color-text-muted);"><Mic :size="14" /></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm truncate" style="color: var(--color-text)">{{ item.title }}</p>
                  <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">Added {{ formatDate(item.addedAt) }}</p>
                </div>
                <span class="text-xs px-2 py-0.5 rounded shrink-0" style="background: var(--color-bg-elevated); color: var(--color-text-muted)">Audio</span>
                <div class="flex items-center gap-2 shrink-0">
                  <template v-if="confirmRemoveRefId === item.refId">
                    <span class="text-xs" style="color: var(--color-text-muted)">Remove?</span>
                    <NButton size="tiny" type="error" @click="handleRemove(item.refId)">Yes</NButton>
                    <NButton size="tiny" @click="confirmRemoveRefId = null">No</NButton>
                  </template>
                  <NButton v-else size="tiny" @click="confirmRemoveRefId = item.refId"><X :size="12" /></NButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Screen section -->
          <div v-if="screenItems.length">
            <p class="text-xs font-semibold tracking-widest uppercase mb-3" style="color: var(--color-text-muted)">
              Screen · {{ screenItems.length }}
            </p>
            <div class="space-y-2">
              <div
                v-for="item in screenItems"
                :key="item.refId"
                class="flex items-center gap-3 px-4 py-3 rounded-lg"
                style="border: 1px solid var(--color-border); background: var(--color-bg-surface);"
              >
                <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style="background: var(--color-bg-elevated); color: var(--color-text-muted);"><Film :size="14" /></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm truncate" style="color: var(--color-text)">{{ item.title }}</p>
                  <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">Added {{ formatDate(item.addedAt) }}</p>
                </div>
                <span class="text-xs px-2 py-0.5 rounded shrink-0" style="background: var(--color-bg-elevated); color: var(--color-text-muted)">Screen</span>
                <div class="flex items-center gap-2 shrink-0">
                  <template v-if="confirmRemoveRefId === item.refId">
                    <span class="text-xs" style="color: var(--color-text-muted)">Remove?</span>
                    <NButton size="tiny" type="error" @click="handleRemove(item.refId)">Yes</NButton>
                    <NButton size="tiny" @click="confirmRemoveRefId = null">No</NButton>
                  </template>
                  <NButton v-else size="tiny" @click="confirmRemoveRefId = item.refId"><X :size="12" /></NButton>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ── Summary tab ──────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'summary'" class="flex-1 overflow-y-auto p-6">
        <div v-if="!col.summary" class="flex flex-col items-center justify-center h-64 select-none">
          <ClipboardList :size="48" class="mb-3 opacity-20" style="color: var(--color-text-secondary);" />
          <p class="text-sm" style="color: var(--color-text-muted)">No summary yet</p>
          <p class="text-xs mt-1 mb-4" style="color: var(--color-text-muted)">Go to Recordings and click "Generate Summary"</p>
          <NButton size="small" type="primary" :loading="synthesizing" @click="handleSynthesize">
            Generate Summary
          </NButton>
          <p v-if="synthesisError" class="text-xs mt-2" style="color: var(--color-error)">{{ synthesisError }}</p>
        </div>

        <template v-else>
          <div class="space-y-5">
            <div>
              <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Overall Summary</p>
              <p class="text-sm leading-relaxed" style="color: var(--color-text)">{{ col.summary.summary }}</p>
            </div>
            <div v-if="col.summary.requirements.functional.length">
              <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Action Items & Requirements</p>
              <ul class="space-y-1">
                <li v-for="(r, i) in col.summary.requirements.functional" :key="i" class="text-sm" style="color: var(--color-text-secondary)">• {{ r }}</li>
              </ul>
            </div>
            <div v-if="col.summary.requirements.nonFunctional.length">
              <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Constraints & Considerations</p>
              <ul class="space-y-1">
                <li v-for="(r, i) in col.summary.requirements.nonFunctional" :key="i" class="text-sm" style="color: var(--color-text-secondary)">• {{ r }}</li>
              </ul>
            </div>
            <div v-if="col.summary.features.length">
              <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Topics / Features</p>
              <div v-for="(f, i) in col.summary.features" :key="i" class="mb-4">
                <p class="text-sm font-medium" style="color: var(--color-text)">{{ f.title }}</p>
                <p class="text-xs mt-0.5" style="color: var(--color-text-secondary)">{{ f.description }}</p>
                <ul v-if="f.dataFlow.length" class="mt-1 space-y-0.5">
                  <li v-for="(s, j) in f.dataFlow" :key="j" class="text-xs" style="color: var(--color-text-muted)">{{ j + 1 }}. {{ s }}</li>
                </ul>
              </div>
            </div>
            <div v-if="col.summary.decisions.length">
              <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Decisions</p>
              <ul class="space-y-1">
                <li v-for="(d, i) in col.summary.decisions" :key="i" class="flex items-start gap-1.5 text-sm" style="color: var(--color-text-secondary)"><Check :size="12" class="shrink-0 mt-0.5" style="color: var(--color-accent);" /> {{ d }}</li>
              </ul>
            </div>
            <div v-if="col.summary.openQuestions.length">
              <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-text-muted)">Open Questions</p>
              <ul class="space-y-1">
                <li v-for="(q, i) in col.summary.openQuestions" :key="i" class="flex items-start gap-1.5 text-sm" style="color: var(--color-text-secondary)"><HelpCircle :size="12" class="shrink-0 mt-0.5" style="color: var(--color-text-muted);" /> {{ q }}</li>
              </ul>
            </div>

            <!-- Diagrams -->
            <div v-if="col.diagrams?.length">
              <p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--color-text-muted)">Diagrams</p>
              <div v-for="(d, i) in col.diagrams" :key="i" class="rounded-lg p-3 mb-3" style="background: var(--color-bg-surface); border: 1px solid var(--color-border);">
                <p class="text-xs font-medium mb-2" style="color: var(--color-text-muted)">{{ (d as Diagram).title }}</p>
                <MermaidDiagram :code="(d as Diagram).code" :diagram-id="(d as Diagram).id" />
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ── Chat tab ─────────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'chat'" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">

        <!-- No summary gate -->
        <div v-if="!col.summary" class="flex flex-col items-center justify-center flex-1 gap-3 select-none">
          <MessageCircle :size="48" class="opacity-20" style="color: var(--color-text-secondary);" />
          <p class="text-sm" style="color: var(--color-text-muted)">Generate a summary first</p>
          <p class="text-xs" style="color: var(--color-text-muted)">The chat draws context from the collection summary</p>
          <NButton size="small" type="primary" :loading="synthesizing" @click="handleSynthesize">
            Generate Summary
          </NButton>
          <p v-if="synthesisError" class="text-xs" style="color: var(--color-error)">{{ synthesisError }}</p>
        </div>

        <template v-else>
          <!-- Messages -->
          <div class="flex-1 overflow-y-auto p-4 space-y-3">
            <div v-if="chatHistory.length === 0" class="flex items-center justify-center h-full">
              <p class="text-xs" style="color: var(--color-text-muted)">Ask anything about this collection of meetings</p>
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

          <!-- Input -->
          <div class="shrink-0 p-3" style="border-top: 1px solid var(--color-border);">
            <p v-if="chatError" class="text-xs mb-2" style="color: var(--color-error)">{{ chatError }}</p>
            <div class="flex gap-2">
              <input
                v-model="chatInput"
                class="flex-1 rounded px-3 py-2 text-sm outline-none"
                style="background: var(--color-bg-surface); border: 1px solid var(--color-border); color: var(--color-text);"
                placeholder="Ask about this collection of meetings…"
                :disabled="chatSending"
                @keydown.enter.prevent="sendChat"
              />
              <NButton
                type="primary"
                size="small"
                :loading="chatSending"
                :disabled="!chatInput.trim()"
                @click="sendChat"
              >Send</NButton>
            </div>
          </div>
        </template>
      </div>

    </div>
  </div>
</template>
