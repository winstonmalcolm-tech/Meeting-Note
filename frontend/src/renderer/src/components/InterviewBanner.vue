<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLiveAssistant } from '../composables/useLiveAssistant'

const { isActive, isPaused, stop, togglePause } = useLiveAssistant()

// ── Dragging ───────────────────────────────────────────────────────────────
const pos = ref({ x: 0, y: 18 })
const dragging = ref(false)
let dragOrigin = { mx: 0, my: 0, px: 0, py: 0 }

onMounted(() => {
  pos.value.x = Math.max(0, window.innerWidth / 2 - 270)
})

function onBannerMousedown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  dragging.value = true
  dragOrigin = { mx: e.clientX, my: e.clientY, px: pos.value.x, py: pos.value.y }
  window.addEventListener('mousemove', onMousemove)
  window.addEventListener('mouseup', onMouseup)
}

function onMousemove(e: MouseEvent) {
  if (!dragging.value) return
  pos.value.x = Math.max(0, dragOrigin.px + (e.clientX - dragOrigin.mx))
  pos.value.y = Math.max(0, dragOrigin.py + (e.clientY - dragOrigin.my))
}

function onMouseup() {
  dragging.value = false
  window.removeEventListener('mousemove', onMousemove)
  window.removeEventListener('mouseup', onMouseup)
}

// ── Solve screen ───────────────────────────────────────────────────────────
const solving = ref(false)
const aiOverlayVisible = ref(true)
const screenshotSaved = ref(false)

const solutions = ref<string[]>([])
const solutionIdx = ref(-1)
const canPrev = computed(() => solutions.value.length > 0 && solutionIdx.value > 0)
const canNext = computed(() => solutions.value.length > 0 && solutionIdx.value < solutions.value.length - 1)

function sendToOverlay(event: { type: string; [key: string]: unknown }) {
  window.api.sendAiOverlayEvent(event)
}

async function handleSolveScreen() {
  if (solving.value) return
  solving.value = true
  try {
    const base64 = await window.api.captureScreen()
    if (!base64) throw new Error('Could not capture screen')

    sendToOverlay({ type: 'status', status: 'thinking' })
    sendToOverlay({ type: 'ai_thinking' })
    window.api.showAiOverlay()
    aiOverlayVisible.value = true

    const provider = localStorage.getItem('ai-provider') ?? 'gemini'
    const token = localStorage.getItem('mn_token') ?? ''
    const res = await fetch('http://localhost:3001/api/solve-screen', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-provider': provider,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ imageBase64: base64 })
    })
    if (!res.ok) {
      const body = await res.json() as { error?: string }
      throw new Error(body.error ?? 'Solve screen failed')
    }
    const { answer } = await res.json() as { answer: string }

    solutions.value.push(answer)
    solutionIdx.value = solutions.value.length - 1
    sendToOverlay({ type: 'ai_token', token: answer })
    sendToOverlay({ type: 'ai_done' })
    sendToOverlay({ type: 'status', status: 'idle' })
  } catch (err) {
    sendToOverlay({ type: 'status', status: 'error' })
    console.error('[InterviewBanner] solve-screen:', err instanceof Error ? err.message : err)
  } finally {
    solving.value = false
  }
}

async function handleTakeScreenshot() {
  try {
    const base64 = await window.api.captureScreen()
    if (!base64) return
    screenshotSaved.value = true
    await window.api.saveScreenshot(base64)
    setTimeout(() => { screenshotSaved.value = false }, 1800)
  } catch (err) {
    console.error('[InterviewBanner] screenshot:', err)
  }
}

function handleToggleAiOverlay() {
  if (aiOverlayVisible.value) {
    window.api.hideAiOverlay()
  } else {
    window.api.showAiOverlay()
  }
  aiOverlayVisible.value = !aiOverlayVisible.value
}

function navigateSolution(delta: number) {
  const next = solutionIdx.value + delta
  if (next < 0 || next >= solutions.value.length) return
  solutionIdx.value = next
  sendToOverlay({ type: 'reset' })
  sendToOverlay({ type: 'ai_token', token: solutions.value[solutionIdx.value] })
  sendToOverlay({ type: 'ai_done' })
}
</script>

<template>
  <div
    v-if="isActive"
    class="interview-banner"
    :style="{
      left: pos.x + 'px',
      top: pos.y + 'px',
      cursor: dragging ? 'grabbing' : 'grab',
    }"
    @mousedown="onBannerMousedown"
  >
    <!-- Pause / Resume listening -->
    <button
      class="btn-action"
      :style="{ background: isPaused ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.1)', color: isPaused ? 'var(--color-warn)' : '#ccc' }"
      :title="isPaused ? 'Resume listening' : 'Pause listening'"
      @click="togglePause"
    >
      {{ isPaused ? '▶ Resume' : '⏸ Pause' }}
    </button>

    <!-- Stop session -->
    <button class="btn-stop" @click="stop">⏹ Stop</button>

    <div class="sep" />

    <!-- Take screenshot -->
    <button
      class="btn-action"
      :style="{ background: screenshotSaved ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.1)', color: screenshotSaved ? 'var(--color-accent)' : '#ccc' }"
      @click="handleTakeScreenshot"
    >
      {{ screenshotSaved ? '✓ Saved' : 'Take Screenshot' }}
    </button>

    <!-- Toggle AI overlay (H shortcut label) -->
    <button class="btn-hotkey" title="Toggle AI panel" @click="handleToggleAiOverlay">H</button>

    <!-- Solve screen -->
    <button
      class="btn-solve"
      :class="{ solving }"
      :disabled="solving"
      @click="handleSolveScreen"
    >
      {{ solving ? 'Solving…' : 'Solve Screen' }}
    </button>

    <div class="sep" />

    <!-- Navigate previous solutions -->
    <button class="btn-nav" :disabled="!canPrev" @click="navigateSolution(-1)">&#9664;</button>
    <button class="btn-nav" :disabled="!canNext" @click="navigateSolution(1)">&#9654;</button>
  </div>
</template>

<style scoped>
.interview-banner {
  position: fixed;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: rgba(12, 12, 12, 0.94);
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.7);
  user-select: none;
}

button {
  border: none;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  white-space: nowrap;
  line-height: 1;
  padding: 5px 13px;
  cursor: pointer;
  transition: opacity 0.15s, background 0.2s, color 0.2s;
}
button:hover { opacity: 0.8; }
button:active { opacity: 0.6; }
button:disabled { pointer-events: none; }

.btn-stop {
  background: var(--color-error);
  color: #fff;
  font-weight: 600;
}

.btn-action {
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
}

.btn-hotkey {
  background: rgba(255, 255, 255, 0.07);
  color: #666;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-solve {
  background: rgba(96, 165, 250, 0.14);
  color: var(--color-info-text);
  border: 1px solid rgba(96, 165, 250, 0.18);
}
.btn-solve:hover { background: rgba(96, 165, 250, 0.25); opacity: 1; }
.btn-solve.solving {
  animation: bannerpulse 0.9s ease-in-out infinite;
  cursor: default;
}

.btn-nav {
  background: transparent;
  color: #444;
  padding: 4px 8px;
  font-size: 13px;
}
.btn-nav:not(:disabled) { color: #888; }
.btn-nav:hover:not(:disabled) { opacity: 1; color: #bbb; }

.sep {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

@keyframes bannerpulse {
  0%, 100% { background: rgba(96, 165, 250, 0.14); }
  50%       { background: rgba(96, 165, 250, 0.32); }
}
</style>
