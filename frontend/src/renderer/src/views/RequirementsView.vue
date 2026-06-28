<script setup lang="ts">
import { ref, toRaw } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { useSession } from '../composables/useSession'
import { buildDocxBuffer } from '../services/exportDocx'
import { createRequirement } from '../services/api'
import { ClipboardList, Check, HelpCircle } from '@lucide/vue'

const { extraction, status, transcript } = useSession()

const exporting = ref(false)
const savingTitle = ref<string | null>(null)
const saving = ref(false)
const saveMessage = ref('')

async function exportDocx() {
  if (!extraction.value) return
  exporting.value = true
  try {
    const buffer = await buildDocxBuffer(toRaw(extraction.value))
    const date = new Date().toISOString().slice(0, 10)
    await window.api.saveDocx(buffer, `meeting-requirements-${date}.docx`)
  } finally {
    exporting.value = false
  }
}

async function saveToDb() {
  if (!extraction.value || savingTitle.value === null) return
  saving.value = true
  saveMessage.value = ''
  try {
    await createRequirement({
      title: savingTitle.value.trim() || `Meeting ${new Date().toLocaleDateString()}`,
      transcript: transcript.value || undefined,
      extraction: toRaw(extraction.value)
    })
    savingTitle.value = null
    saveMessage.value = 'Saved'
    setTimeout(() => { saveMessage.value = '' }, 3000)
  } catch (err) {
    saveMessage.value = err instanceof Error ? err.message : 'Save failed'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="h-full p-8 overflow-y-auto">

    <div
      v-if="!extraction"
      class="flex flex-col items-center justify-center h-full select-none"
    >
      <ClipboardList :size="48" class="mb-4 opacity-20" style="color: var(--color-text-secondary);" />
      <p class="text-sm" style="color: var(--color-text-muted)">
        {{ status === 'extracting' ? 'Extracting…' : 'No session processed yet' }}
      </p>
    </div>

    <div v-else class="space-y-8 max-w-2xl">

      <div class="flex items-center gap-2 justify-end flex-wrap">
        <span
          v-if="saveMessage"
          class="text-xs"
          :style="{ color: saveMessage === 'Saved' ? 'var(--color-accent)' : 'var(--color-error)' }"
        >{{ saveMessage }}</span>

        <template v-if="savingTitle !== null">
          <NInput
            v-model:value="savingTitle"
            size="small"
            placeholder="Title…"
            style="width: 180px"
            @keyup.enter="saveToDb"
          />
          <NButton size="small" type="primary" :loading="saving" @click="saveToDb">Save</NButton>
          <NButton size="small" @click="savingTitle = null">Cancel</NButton>
        </template>
        <template v-else>
          <NButton size="small" @click="savingTitle = ''">Save to DB</NButton>
          <NButton size="small" :loading="exporting" @click="exportDocx">Export to Word</NButton>
        </template>
      </div>

      <!-- Summary -->
      <section>
        <h2 class="text-xs font-semibold tracking-widest uppercase mb-3" style="color: var(--color-text-muted)">Summary</h2>
        <p class="text-sm leading-relaxed" style="color: var(--color-text)">{{ extraction.summary }}</p>
      </section>

      <!-- Action Items & Requirements -->
      <section v-if="extraction.requirements.functional.length">
        <h2 class="text-xs font-semibold tracking-widest uppercase mb-3" style="color: var(--color-text-muted)">Action Items & Requirements</h2>
        <ul class="space-y-1.5">
          <li
            v-for="(req, i) in extraction.requirements.functional"
            :key="i"
            class="flex gap-2 text-sm"
            style="color: var(--color-text-secondary)"
          >
            <span style="color: var(--color-text-muted)">–</span>
            {{ req }}
          </li>
        </ul>
      </section>

      <!-- Constraints & Considerations -->
      <section v-if="extraction.requirements.nonFunctional.length">
        <h2 class="text-xs font-semibold tracking-widest uppercase mb-3" style="color: var(--color-text-muted)">Constraints & Considerations</h2>
        <ul class="space-y-1.5">
          <li
            v-for="(req, i) in extraction.requirements.nonFunctional"
            :key="i"
            class="flex gap-2 text-sm"
            style="color: var(--color-text-secondary)"
          >
            <span style="color: var(--color-text-muted)">–</span>
            {{ req }}
          </li>
        </ul>
      </section>

      <!-- Features -->
      <section v-if="extraction.features.length">
        <h2 class="text-xs font-semibold tracking-widest uppercase mb-4" style="color: var(--color-text-muted)">Features</h2>
        <div class="space-y-6">
          <div
            v-for="(feature, i) in extraction.features"
            :key="i"
            class="p-4 rounded-lg"
            style="background: var(--color-bg-surface); border: 1px solid var(--color-border)"
          >
            <h3 class="text-sm font-semibold mb-1" style="color: var(--color-text)">{{ feature.title }}</h3>
            <p class="text-xs mb-3" style="color: var(--color-text-secondary)">{{ feature.description }}</p>

            <div v-if="feature.dataFlow.length" class="mb-3">
              <p class="text-xs font-medium mb-1.5" style="color: var(--color-text-muted)">Data Flow</p>
              <ol class="space-y-1">
                <li
                  v-for="(step, j) in feature.dataFlow"
                  :key="j"
                  class="flex gap-2 text-xs"
                  style="color: var(--color-text-secondary)"
                >
                  <span style="color: var(--color-text-muted); min-width: 1rem">{{ j + 1 }}.</span>
                  {{ step }}
                </li>
              </ol>
            </div>

            <div v-if="feature.decisions.length" class="mb-2">
              <p class="text-xs font-medium mb-1" style="color: var(--color-text-muted)">Decisions</p>
              <ul class="space-y-0.5">
                <li v-for="(d, j) in feature.decisions" :key="j" class="flex items-start gap-1.5 text-xs" style="color: var(--color-text-secondary)"><Check :size="11" class="shrink-0 mt-0.5" style="color: var(--color-accent);" /> {{ d }}</li>
              </ul>
            </div>

            <div v-if="feature.openQuestions.length">
              <p class="text-xs font-medium mb-1" style="color: var(--color-text-muted)">Open Questions</p>
              <ul class="space-y-0.5">
                <li v-for="(q, j) in feature.openQuestions" :key="j" class="flex items-start gap-1.5 text-xs" style="color: var(--color-text-secondary)"><HelpCircle :size="11" class="shrink-0 mt-0.5" style="color: var(--color-text-muted);" /> {{ q }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Decisions -->
      <section v-if="extraction.decisions.length">
        <h2 class="text-xs font-semibold tracking-widest uppercase mb-3" style="color: var(--color-text-muted)">Decisions</h2>
        <ul class="space-y-1.5">
          <li v-for="(d, i) in extraction.decisions" :key="i" class="flex items-start gap-1.5 text-xs" style="color: var(--color-text-secondary)"><Check :size="11" class="shrink-0 mt-0.5" style="color: var(--color-accent);" /> {{ d }}</li>
        </ul>
      </section>

      <!-- Open Questions -->
      <section v-if="extraction.openQuestions.length">
        <h2 class="text-xs font-semibold tracking-widest uppercase mb-3" style="color: var(--color-text-muted)">Open Questions</h2>
        <ul class="space-y-1.5">
          <li v-for="(q, i) in extraction.openQuestions" :key="i" class="flex items-start gap-1.5 text-xs" style="color: var(--color-text-secondary)"><HelpCircle :size="11" class="shrink-0 mt-0.5" style="color: var(--color-text-muted);" /> {{ q }}</li>
        </ul>
      </section>

    </div>
  </div>
</template>
