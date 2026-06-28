<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton } from 'naive-ui'
import { useTheme } from '../composables/useTheme'
import { Sun, Moon } from '@lucide/vue'

const { isDark, toggle: toggleTheme } = useTheme()

const isPackaged = ref(false)
const shortcutStatus = ref<'idle' | 'registering' | 'success' | 'error'>('idle')
const shortcutError = ref('')

onMounted(async () => {
  isPackaged.value = await window.api.isPackaged()
})

async function registerShortcut() {
  shortcutStatus.value = 'registering'
  shortcutError.value = ''
  const result = await window.api.registerLaunchShortcut()
  if (result.success) {
    shortcutStatus.value = 'success'
  } else {
    shortcutError.value = result.error ?? 'Unknown error'
    shortcutStatus.value = 'error'
  }
}
</script>

<template>
  <div class="p-8 max-w-2xl">

    <h1 class="text-xs font-semibold tracking-widest uppercase mb-1" style="color: var(--color-text-muted)">Settings</h1>

    <!-- Theme -->
    <h2 class="text-base mb-3 mt-0" style="color: var(--color-text)">Appearance</h2>
    <div class="flex items-center gap-3 mb-8">
      <button
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
        :style="{
          background: isDark ? 'var(--color-bg-surface)' : 'transparent',
          border: `1px solid ${isDark ? 'var(--color-border)' : 'var(--color-border)'}`,
          color: isDark ? 'var(--color-text)' : 'var(--color-text-muted)',
          opacity: isDark ? '1' : '0.6',
        }"
        @click="!isDark && toggleTheme()"
      >
        <Moon :size="14" />
        Dark
      </button>
      <button
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
        :style="{
          background: !isDark ? 'var(--color-bg-surface)' : 'transparent',
          border: `1px solid ${!isDark ? 'var(--color-border)' : 'var(--color-border)'}`,
          color: !isDark ? 'var(--color-text)' : 'var(--color-text-muted)',
          opacity: !isDark ? '1' : '0.6',
        }"
        @click="isDark && toggleTheme()"
      >
        <Sun :size="14" />
        Light
      </button>
    </div>

    <h2 class="text-base mb-6" style="color: var(--color-text)">AI Provider</h2>

    <!-- Active provider card -->
    <div
      class="p-4 rounded-lg"
      style="background: var(--color-accent-subtle); border: 1px solid var(--color-accent)"
    >
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-semibold" style="color: var(--color-text)">OpenRouter</span>
        <span class="text-xs px-1.5 py-0.5 rounded" style="background: var(--color-accent-subtle); color: var(--color-accent)">Active</span>
      </div>
      <div class="space-y-1.5 text-xs mb-3" style="color: var(--color-text-secondary)">
        <div><span style="color: var(--color-text-muted)">Transcription: </span>Deepgram (nova-2)</div>
        <div><span style="color: var(--color-text-muted)">Extraction: </span>Gemini 2.5 Flash</div>
        <div><span style="color: var(--color-text-muted)">Cost: </span>Pay-per-token via OpenRouter</div>
      </div>
      <p class="text-xs" style="color: var(--color-text-muted)">Multi-model routing — swap models without code changes</p>
    </div>

    <p class="text-xs mt-6" style="color: var(--color-text-muted)">
      API keys are set in <code style="color: var(--color-text-secondary)">backend/.env</code> — never stored in the frontend.
    </p>

    <!-- Launch shortcut -->
    <div class="mt-10">
      <h2 class="text-base mb-1" style="color: var(--color-text)">Launch Shortcut</h2>
      <p class="text-xs mb-4" style="color: var(--color-text-muted)">
        Press <kbd class="shortcut-key">Ctrl</kbd> + <kbd class="shortcut-key">Alt</kbd> + <kbd class="shortcut-key">N</kbd> from anywhere to open MeetingNote.
      </p>

      <div v-if="!isPackaged" class="rounded-lg p-3 mb-4 text-xs"
           style="background: var(--color-bg-surface); border: 1px solid var(--color-border); color: var(--color-text-secondary);">
        Shortcut registration works with the packaged app. In dev mode the shortcut still focuses the window if the app is already running.
      </div>

      <div class="flex items-center gap-3">
        <NButton
          :loading="shortcutStatus === 'registering'"
          :disabled="shortcutStatus === 'registering'"
          size="small"
          @click="registerShortcut"
        >
          {{ shortcutStatus === 'success' ? 'Registered ✓' : 'Register shortcut' }}
        </NButton>
        <span v-if="shortcutStatus === 'error'" class="text-xs" style="color: var(--color-error)">{{ shortcutError }}</span>
      </div>

      <p class="text-xs mt-3" style="color: var(--color-text-muted)">
        Adds a Start Menu entry — you only need to do this once.
      </p>
    </div>

  </div>
</template>

<style scoped>
.shortcut-key {
  display: inline-block;
  font-family: monospace;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}
</style>
