<script setup lang="ts">
import { ref } from 'vue'
import type { RecordingEntry, ScreenRecordingEntry } from '../types'
import { transcribeAudio, extractRequirements } from '../services/api'

const emit = defineEmits<{
  saved: [entry: RecordingEntry]
  videoSaved: [entry: ScreenRecordingEntry]
}>()

type State = 'idle' | 'preview' | 'preparing' | 'transcribing' | 'extracting' | 'error'

interface SelectedFile {
  filePath: string
  filename: string
  fileExt: string
  isVideo: boolean
  size: number
}

const state = ref<State>('idle')
const errorMsg = ref('')
const isDragOver = ref(false)
const selectedFile = ref<SelectedFile | null>(null)

const steps = [
  { key: 'preparing', label: 'Preparing audio' },
  { key: 'transcribing', label: 'Transcribing' },
  { key: 'extracting', label: 'Extracting insights' },
] as const

const stepOrder: State[] = ['preparing', 'transcribing', 'extracting']

function stepStatus(key: string): 'done' | 'active' | 'pending' {
  const currentIdx = stepOrder.indexOf(state.value as typeof stepOrder[number])
  const stepIdx = stepOrder.indexOf(key as typeof stepOrder[number])
  if (currentIdx < 0) return 'pending'
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

async function processAudio(buffer: ArrayBuffer, filename: string, filePath: string) {
  try {
    state.value = 'transcribing'
    const transcript = await transcribeAudio(new Blob([buffer], { type: 'audio/webm' }))

    state.value = 'extracting'
    const extraction = await extractRequirements(transcript)

    const createdAt = Date.now()
    const provider = localStorage.getItem('ai-provider') ?? 'openai'
    const meta = {
      createdAt, duration: 0, size: buffer.byteLength,
      status: 'processed', source: 'upload',
      originalFilename: filename, originalFilePath: filePath,
      transcript, extraction, provider,
    }
    const id = await window.api.saveRecording(buffer, meta)
    emit('saved', { id, createdAt, duration: 0, size: buffer.byteLength, status: 'processed', transcript, extraction, provider, name: filename })
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'An error occurred'
    state.value = 'error'
  }
}

async function processVideo(audioBuffer: ArrayBuffer, filePath: string, filename: string, fileExt: string) {
  try {
    state.value = 'transcribing'
    const transcript = await transcribeAudio(new Blob([audioBuffer], { type: 'audio/webm' }))

    state.value = 'extracting'
    const extraction = await extractRequirements(transcript)

    const createdAt = Date.now()
    const { id, size } = await window.api.importVideoFile(filePath, {
      createdAt, duration: 0, sourceName: filename,
      sourceType: 'upload', withMic: false,
      status: 'processed', transcript, extraction,
    })
    emit('videoSaved', { id, createdAt, duration: 0, size, sourceName: filename, sourceType: 'upload', withMic: false, fileExt, status: 'processed', transcript, extraction })
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'An error occurred'
    state.value = 'error'
  }
}

async function browse() {
  try {
    const result = await window.api.pickFile()
    if ('canceled' in result) return
    selectedFile.value = result
    state.value = 'preview'
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to pick file'
    state.value = 'error'
  }
}

async function confirm() {
  if (!selectedFile.value) return
  const { filePath, filename, fileExt, isVideo } = selectedFile.value
  state.value = 'preparing'
  try {
    const buffer = await window.api.prepareUpload(filePath)
    if (isVideo) {
      await processVideo(buffer, filePath, filename, fileExt)
    } else {
      await processAudio(buffer, filename, filePath)
    }
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to prepare file'
    state.value = 'error'
  }
}

function cancel() {
  selectedFile.value = null
  state.value = 'idle'
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  e.preventDefault()
  browse()
}
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; overflow: hidden;">

    <!-- Idle: drop zone -->
    <template v-if="state === 'idle'">
      <div
        class="upload-zone"
        :class="{ 'drag-over': isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave="isDragOver = false"
        @drop="onDrop"
        @click="browse"
      >
        <div class="upload-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p class="upload-title">Upload audio or video</p>
        <p class="upload-sub">Click to browse, or drag a file here</p>
        <div class="format-tags">
          <span v-for="ext in ['mp3','wav','m4a','ogg','flac','webm','mp4','mov','mkv','avi']" :key="ext" class="format-tag">
            {{ ext }}
          </span>
        </div>
      </div>
    </template>

    <!-- Preview: confirm before processing -->
    <template v-else-if="state === 'preview' && selectedFile">
      <div class="preview-card">
        <div class="preview-icon">
          <!-- Video icon -->
          <template v-if="selectedFile.isVideo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="14" height="12" rx="2"/>
              <path d="M16 10l5-3v10l-5-3V10z"/>
            </svg>
          </template>
          <!-- Audio icon -->
          <template v-else>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </template>
        </div>
        <p class="preview-filename">{{ selectedFile.filename }}</p>
        <p class="preview-meta">
          <span>{{ formatSize(selectedFile.size) }}</span>
          <span class="preview-dot">·</span>
          <span class="preview-ext">{{ selectedFile.fileExt.slice(1) }}</span>
          <span class="preview-dot">·</span>
          <span>{{ selectedFile.isVideo ? 'Video' : 'Audio' }}</span>
        </p>
        <div class="preview-actions">
          <button class="preview-cancel-btn" @click="cancel">Cancel</button>
          <button class="preview-confirm-btn" @click="confirm">Process file</button>
        </div>
      </div>
    </template>

    <!-- Processing: step list -->
    <template v-else-if="state !== 'error'">
      <div class="processing-card">
        <p class="processing-title">Processing file…</p>
        <div class="steps-list">
          <div
            v-for="step in steps"
            :key="step.key"
            class="step-row"
            :class="stepStatus(step.key)"
          >
            <span class="step-icon">
              <template v-if="stepStatus(step.key) === 'done'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="'var(--color-accent)'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </template>
              <template v-else-if="stepStatus(step.key) === 'active'">
                <span class="spinner" />
              </template>
              <template v-else>
                <span class="dot" />
              </template>
            </span>
            <span class="step-label">{{ step.label }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Error -->
    <template v-else>
      <div class="error-card">
        <p class="error-title">Something went wrong</p>
        <p class="error-msg">{{ errorMsg }}</p>
        <button class="retry-btn" @click="state = 'idle'">Try another file</button>
      </div>
    </template>

  </div>
</template>

<style scoped>
.upload-zone {
  width: 100%;
  max-width: 420px;
  border: 1.5px dashed var(--color-border);
  border-radius: 12px;
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  background: transparent;
}
.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
}
.upload-icon {
  color: var(--color-bg-elevated);
  margin-bottom: 4px;
  transition: color 0.15s;
}
.upload-zone:hover .upload-icon,
.upload-zone.drag-over .upload-icon {
  color: var(--color-accent);
}
.upload-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}
.upload-sub {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
}
.format-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 8px;
}
.format-tag {
  font-size: 10px;
  font-family: monospace;
  color: var(--color-text-secondary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 2px 6px;
}

.preview-card {
  width: 100%;
  max-width: 380px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-surface);
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.preview-icon {
  color: var(--color-bg-elevated);
  margin-bottom: 4px;
}
.preview-filename {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  word-break: break-all;
  text-align: center;
}
.preview-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.preview-dot {
  color: var(--color-text-muted);
}
.preview-ext {
  font-family: monospace;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--color-text-secondary);
}
.preview-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.preview-cancel-btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.preview-cancel-btn:hover {
  background: var(--color-border);
  color: var(--color-text);
}
.preview-confirm-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-accent);
  color: var(--color-accent-fg);
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.preview-confirm-btn:hover {
  background: var(--color-accent-on);
}

.processing-card {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.processing-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
  text-align: center;
}
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.step-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.step-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.step-label {
  font-size: 13px;
  color: var(--color-text-muted);
  transition: color 0.2s;
}
.step-row.active .step-label {
  color: var(--color-text);
}
.step-row.done .step-label {
  color: var(--color-text-muted);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border);
  display: block;
  margin: auto;
}
.spinner {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  display: block;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-card {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.error-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-error);
  margin: 0;
}
.error-msg {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
  word-break: break-word;
}
.retry-btn {
  margin-top: 8px;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.retry-btn:hover {
  background: var(--color-border);
  color: var(--color-text);
}
</style>
