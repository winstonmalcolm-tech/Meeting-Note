<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { NButton, NSpin, NInput } from 'naive-ui'
import type { Interview } from '../services/api'
import { fetchInterviews, createInterview, updateInterview, deleteInterview } from '../services/api'

const interviews = ref<Interview[]>([])
const loading = ref(true)
const error = ref('')

const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')

const fCompany = ref('')
const fTitle = ref('')
const fDate = ref('')
const fTime = ref('')
const fNotes = ref('')

onMounted(loadInterviews)

async function loadInterviews() {
  loading.value = true
  error.value = ''
  try {
    interviews.value = await fetchInterviews()
  } catch {
    error.value = 'Failed to load interviews'
  } finally {
    loading.value = false
  }
}

const upcoming = computed(() =>
  interviews.value.filter((i) => new Date(i.scheduledAt) >= new Date()).sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  )
)

const past = computed(() =>
  interviews.value.filter((i) => new Date(i.scheduledAt) < new Date()).sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
  )
)

function openCreate() {
  editingId.value = null
  fCompany.value = ''
  fTitle.value = ''
  fDate.value = ''
  fTime.value = ''
  fNotes.value = ''
  formError.value = ''
  showForm.value = true
}

function openEdit(i: Interview) {
  editingId.value = i.id
  fCompany.value = i.companyName
  fTitle.value = i.jobTitle
  const d = new Date(i.scheduledAt)
  fDate.value = d.toISOString().slice(0, 10)
  fTime.value = d.toTimeString().slice(0, 5)
  fNotes.value = i.notes ?? ''
  formError.value = ''
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
}

async function submitForm() {
  if (!fCompany.value.trim() || !fTitle.value.trim() || !fDate.value || !fTime.value) {
    formError.value = 'Company, job title, date and time are required.'
    return
  }
  const scheduledAt = new Date(`${fDate.value}T${fTime.value}`).toISOString()
  saving.value = true
  formError.value = ''
  try {
    if (editingId.value) {
      const updated = await updateInterview(editingId.value, {
        companyName: fCompany.value.trim(),
        jobTitle: fTitle.value.trim(),
        scheduledAt,
        notes: fNotes.value,
      })
      const idx = interviews.value.findIndex((i) => i.id === editingId.value)
      if (idx !== -1) interviews.value[idx] = updated
    } else {
      const created = await createInterview({
        companyName: fCompany.value.trim(),
        jobTitle: fTitle.value.trim(),
        scheduledAt,
        notes: fNotes.value,
      })
      interviews.value.push(created)
    }
    cancelForm()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  await deleteInterview(id)
  interviews.value = interviews.value.filter((i) => i.id !== id)
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function daysUntil(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
}

function urgencyColor(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (diff <= 1) return 'var(--color-error)'
  if (diff <= 3) return 'var(--color-warn)'
  return 'var(--color-accent)'
}
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">

    <!-- Form modal overlay -->
    <div
      v-if="showForm"
      class="fixed inset-0 flex items-center justify-center z-50"
      style="background: rgba(0,0,0,0.6);"
      @click.self="cancelForm"
    >
      <div class="rounded-xl p-6 w-full max-w-md" style="background: var(--color-bg-surface); border: 1px solid var(--color-border);">
        <h2 class="text-sm font-semibold mb-4" style="color: var(--color-text);">
          {{ editingId ? 'Edit Interview' : 'Schedule Interview' }}
        </h2>

        <div class="flex gap-3 mb-3">
          <div class="flex-1">
            <label class="block text-xs mb-1" style="color: var(--color-text-muted);">Company *</label>
            <NInput v-model:value="fCompany" size="small" placeholder="Acme Corp" />
          </div>
          <div class="flex-1">
            <label class="block text-xs mb-1" style="color: var(--color-text-muted);">Job Title *</label>
            <NInput v-model:value="fTitle" size="small" placeholder="Senior Engineer" />
          </div>
        </div>

        <div class="flex gap-3 mb-3">
          <div class="flex-1">
            <label class="block text-xs mb-1" style="color: var(--color-text-muted);">Date *</label>
            <input
              v-model="fDate"
              type="date"
              class="w-full rounded px-2 py-1 text-xs"
              style="background: var(--color-bg-input); border: 1px solid var(--color-border); color: var(--color-text); outline: none;"
            />
          </div>
          <div style="width: 120px;">
            <label class="block text-xs mb-1" style="color: var(--color-text-muted);">Time *</label>
            <input
              v-model="fTime"
              type="time"
              class="w-full rounded px-2 py-1 text-xs"
              style="background: var(--color-bg-input); border: 1px solid var(--color-border); color: var(--color-text); outline: none;"
            />
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs mb-1" style="color: var(--color-text-muted);">Notes (optional)</label>
          <NInput
            v-model:value="fNotes"
            type="textarea"
            size="small"
            placeholder="Interview format, contact name, prep notes…"
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
        </div>

        <p v-if="formError" class="text-xs mb-3" style="color: var(--color-error);">{{ formError }}</p>

        <div class="flex gap-2">
          <NButton size="small" :loading="saving" type="primary" @click="submitForm">
            {{ editingId ? 'Save Changes' : 'Schedule' }}
          </NButton>
          <NButton size="small" @click="cancelForm">Cancel</NButton>
        </div>
      </div>
    </div>

    <!-- Header -->
    <div class="px-5 pt-4 pb-3 shrink-0 flex items-center justify-between" style="border-bottom: 1px solid var(--color-border);">
      <span class="text-sm font-semibold" style="color: var(--color-text);">Interview Calendar</span>
      <NButton size="small" type="primary" @click="openCreate">
        + Schedule Interview
      </NButton>
    </div>

    <div style="flex: 1; overflow-y: auto;" class="px-5 py-4">
      <div v-if="loading" class="flex justify-center pt-8"><NSpin /></div>
      <p v-else-if="error" class="text-xs" style="color: var(--color-error);">{{ error }}</p>

      <template v-else>
        <!-- Upcoming -->
        <div v-if="upcoming.length > 0" class="mb-6">
          <p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--color-text-muted);">Upcoming</p>
          <div
            v-for="i in upcoming"
            :key="i.id"
            class="rounded-lg px-4 py-3 mb-2"
            style="background: var(--color-bg-surface); border: 1px solid var(--color-border);"
          >
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium" style="color: var(--color-text);">{{ i.jobTitle }}</p>
                  <span
                    class="text-xs px-1.5 py-0.5 rounded font-semibold"
                    :style="{ color: urgencyColor(i.scheduledAt), border: `1px solid ${urgencyColor(i.scheduledAt)}`, background: 'var(--color-bg-elevated)' }"
                  >{{ daysUntil(i.scheduledAt) }}</span>
                </div>
                <p class="text-xs mt-0.5" style="color: var(--color-text-muted);">{{ i.companyName }}</p>
                <p class="text-xs mt-1" style="color: var(--color-text-secondary);">{{ formatDateTime(i.scheduledAt) }}</p>
                <p v-if="i.notes" class="text-xs mt-1" style="color: var(--color-text-muted);">{{ i.notes }}</p>
              </div>
              <div class="flex gap-2 ml-3 shrink-0">
                <button class="text-xs" style="color: var(--color-text-muted);" @click="openEdit(i)">Edit</button>
                <button class="text-xs" style="color: var(--color-text-secondary);" @click="remove(i.id)">Delete</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Past -->
        <div v-if="past.length > 0">
          <p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--color-text-secondary);">Past</p>
          <div
            v-for="i in past"
            :key="i.id"
            class="rounded-lg px-4 py-3 mb-2"
            style="background: var(--color-bg); border: 1px solid var(--color-border-subtle);"
          >
            <div class="flex items-start justify-between">
              <div>
                <p class="text-sm font-medium" style="color: var(--color-text-muted);">{{ i.jobTitle }}</p>
                <p class="text-xs mt-0.5" style="color: var(--color-text-secondary);">{{ i.companyName }}</p>
                <p class="text-xs mt-1" style="color: var(--color-text-muted);">{{ formatDateTime(i.scheduledAt) }}</p>
              </div>
              <button class="text-xs ml-3 shrink-0" style="color: var(--color-text-muted);" @click="remove(i.id)">Delete</button>
            </div>
          </div>
        </div>

        <p v-if="interviews.length === 0" class="text-xs" style="color: var(--color-text-muted);">
          No interviews scheduled. Click "+ Schedule Interview" to add one.
        </p>
      </template>
    </div>
  </div>
</template>
