<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import mermaid from 'mermaid'

const props = defineProps<{ code: string; diagramId: string }>()

const container = ref<HTMLDivElement | null>(null)
const error = ref('')

mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })

async function render() {
  if (!container.value) return
  error.value = ''
  try {
    const id = `mermaid-${props.diagramId.replace(/\D/g, '')}`
    const { svg } = await mermaid.render(id, props.code)
    container.value.innerHTML = svg
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to render diagram'
    container.value.innerHTML = ''
  }
}

onMounted(render)
watch(() => props.code, render)
</script>

<template>
  <div>
    <div ref="container" class="mermaid-output" />
    <p v-if="error" class="text-xs mt-1" style="color: var(--color-error)">{{ error }}</p>
  </div>
</template>
