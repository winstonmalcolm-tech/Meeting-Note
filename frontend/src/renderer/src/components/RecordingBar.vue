<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NSwitch } from 'naive-ui'

const props = defineProps<{
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioLevel: number
  captureSystem: boolean
}>()

const emit = defineEmits<{
  start: []
  stop: []
  pause: []
  'update:captureSystem': [value: boolean]
}>()

const formattedDuration = computed(() => {
  const m = Math.floor(props.duration / 60).toString().padStart(2, '0')
  const s = (props.duration % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

const barFactors = [0.5, 0.9, 0.6, 1.0, 0.7, 0.85, 0.5, 0.95, 0.65, 1.0, 0.75, 0.8, 0.55, 0.9, 0.6, 0.8]
</script>

<template>
  <div
    class="flex items-center gap-4 px-6 py-3 shrink-0"
    style="border-bottom: 1px solid var(--color-border);"
  >
    <NButton
      :type="isRecording ? 'error' : 'primary'"
      round
      @click="isRecording ? emit('stop') : emit('start')"
    >
      {{ isRecording ? 'Stop' : 'Start Recording' }}
    </NButton>

    <template v-if="isRecording">
      <NButton size="small" round @click="emit('pause')">
        {{ isPaused ? 'Resume' : 'Pause' }}
      </NButton>

      <div class="flex items-center gap-2">
        <span
          class="block w-2 h-2 rounded-full bg-red-500"
          :class="{ 'animate-pulse': !isPaused }"
        />
        <span class="font-mono text-sm tabular-nums" style="color: var(--color-text)">
          {{ formattedDuration }}
        </span>
      </div>

      <div class="flex items-end gap-px" style="height: 20px;">
        <div
          v-for="(factor, i) in barFactors"
          :key="i"
          class="w-1 rounded-sm"
          :class="isPaused ? 'bg-gray-600' : 'bg-emerald-500'"
          :style="{
            height: `${Math.max(15, audioLevel * 100 * factor)}%`,
            transition: 'height 80ms ease'
          }"
        />
      </div>
    </template>

    <template v-else>
      <div class="flex items-center gap-2">
        <NSwitch
          :value="captureSystem"
          size="small"
          @update:value="emit('update:captureSystem', $event)"
        />
        <span class="text-xs" style="color: var(--color-text-muted)">System audio</span>
      </div>
      <span class="text-sm" style="color: var(--color-text-muted)">Ready to capture your meeting</span>
    </template>
  </div>
</template>
