<script setup lang="ts">
import RecordingBar from '../components/RecordingBar.vue'
import TranscriptPanel from '../components/TranscriptPanel.vue'
import { useAudioRecorder } from '../composables/useAudioRecorder'
import { useSession } from '../composables/useSession'

const { isRecording, isPaused, duration, audioLevel, captureSystem, startRecording, stopRecording, togglePause } = useAudioRecorder()
const { status, transcript, error, process } = useSession()

async function handleStop() {
  const blob = await stopRecording()
  if (!blob || blob.size === 0) return

  // Save to disk first — processing can then be retried if it fails
  const buffer = await blob.arrayBuffer()
  const id = await window.api.saveRecording(buffer, {
    createdAt: Date.now(),
    duration: duration.value,
    size: blob.size,
    status: 'pending'
  })

  await process(blob, id)
}
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">
    <RecordingBar
      :is-recording="isRecording"
      :is-paused="isPaused"
      :duration="duration"
      :audio-level="audioLevel"
      v-model:capture-system="captureSystem"
      @start="startRecording"
      @stop="handleStop"
      @pause="togglePause"
    />
    <TranscriptPanel
      :is-recording="isRecording"
      :status="status"
      :transcript="transcript"
      :error="error"
      style="flex: 1; min-height: 0;"
    />
  </div>
</template>
