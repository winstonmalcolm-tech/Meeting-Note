<script setup lang="ts">
import type { SessionStatus } from '../types'

defineProps<{
  isRecording: boolean
  status: SessionStatus
  transcript: string
  error: string
}>()
</script>

<template>
  <div class="h-full p-8 overflow-y-auto">

    <!-- Empty / ready state -->
    <div
      v-if="!isRecording && status === 'idle'"
      class="flex flex-col items-center justify-center h-full select-none"
    >
      <div class="text-5xl mb-5 opacity-10">🎙</div>
      <p class="text-base" style="color: var(--color-text-secondary)">
        Press <strong style="color: var(--color-text)">Start Recording</strong> to begin your session
      </p>
      <p class="text-sm mt-2" style="color: var(--color-text-muted)">Mic + system audio will be captured</p>
    </div>

    <!-- Active recording -->
    <div v-else-if="isRecording">
      <div class="flex items-center gap-2 text-xs mb-6" style="color: var(--color-text-muted)">
        <span class="block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Listening...
      </div>
      <p class="text-sm italic" style="color: var(--color-text-muted)">
        Transcript will appear once you stop the recording.
      </p>
    </div>

    <!-- Processing states -->
    <div v-else-if="status === 'transcribing' || status === 'extracting'">
      <div class="flex items-center gap-3 mb-6">
        <span class="block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span class="text-sm" style="color: var(--color-text-secondary)">
          {{ status === 'transcribing' ? 'Transcribing audio…' : 'Extracting requirements…' }}
        </span>
      </div>
      <div class="space-y-2">
        <div class="h-3 rounded animate-pulse" style="background: var(--color-bg-elevated); width: 90%" />
        <div class="h-3 rounded animate-pulse" style="background: var(--color-bg-elevated); width: 75%" />
        <div class="h-3 rounded animate-pulse" style="background: var(--color-bg-elevated); width: 82%" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="space-y-3">
      <p class="text-sm font-medium" style="color: var(--color-error)">Processing failed</p>
      <p class="text-xs font-mono p-3 rounded" style="color: var(--color-text-secondary); background: var(--color-bg-surface)">{{ error }}</p>
      <p class="text-xs" style="color: var(--color-text-muted)">
        Make sure the backend is running on port 3001 and OPENAI_API_KEY is set.
      </p>
    </div>

    <!-- Done — show transcript -->
    <div v-else-if="status === 'done'" class="space-y-4">
      <p class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-text-muted)">Transcript</p>
      <p class="text-sm leading-relaxed whitespace-pre-wrap" style="color: var(--color-text)">{{ transcript }}</p>
      <p class="text-xs pt-4" style="color: var(--color-text-muted)">
        → See <strong style="color: var(--color-text-secondary)">Requirements</strong> in the sidebar for extracted data.
      </p>
    </div>

  </div>
</template>
