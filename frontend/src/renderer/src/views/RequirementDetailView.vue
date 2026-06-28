<script setup lang="ts">
import { ref, nextTick, toRaw, onBeforeUnmount } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx'
import mermaid from 'mermaid'
import type { SavedRequirement, ChatMessage, ExtractionResult, Diagram } from '../types'
import { chatWithRequirement, updateRequirement } from '../services/api'
import MermaidDiagram from '../components/MermaidDiagram.vue'
import { Check, HelpCircle } from '@lucide/vue'

const props = defineProps<{ requirement: SavedRequirement }>()
const emit = defineEmits<{ back: [] }>()

// AI occasionally returns array items as objects instead of plain strings.
// Coerce to string by picking the first recognisable text field or JSON-stringifying.
function toStr(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object') {
    const o = val as Record<string, unknown>
    const v = o.decision ?? o.text ?? o.value ?? o.content ?? o.title ?? o.description
    if (v != null) return String(v)
    return JSON.stringify(val)
  }
  return String(val ?? '')
}

function normalizeExtraction(raw: SavedRequirement['extraction']): SavedRequirement['extraction'] {
  return {
    ...raw,
    requirements: {
      functional: raw.requirements.functional.map(toStr),
      nonFunctional: raw.requirements.nonFunctional.map(toStr)
    },
    features: raw.features.map(f => ({
      ...f,
      dataFlow: f.dataFlow.map(toStr),
      decisions: f.decisions.map(toStr),
      openQuestions: f.openQuestions.map(toStr)
    })),
    decisions: raw.decisions.map(toStr),
    openQuestions: raw.openQuestions.map(toStr)
  }
}

const localReq = ref<SavedRequirement>({
  ...props.requirement,
  extraction: normalizeExtraction(props.requirement.extraction)
})
const localDiagrams = ref<Diagram[]>(props.requirement.diagrams ?? [])

const messages = ref<ChatMessage[]>([])
const input = ref('')
const loading = ref(false)
const applying = ref(false)
const saveMessage = ref('')

const messagesEl = ref<HTMLElement | null>(null)
const splitContainer = ref<HTMLElement | null>(null)
const splitPct = ref(55)

function startDrag(e: MouseEvent) {
  e.preventDefault()
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!splitContainer.value) return
  const rect = splitContainer.value.getBoundingClientRect()
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  splitPct.value = Math.min(80, Math.max(20, pct))
}

function stopDrag() {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''

  const userMsg: ChatMessage = { role: 'user', content: text }
  messages.value.push(userMsg)
  await scrollToBottom()

  loading.value = true
  try {
    const history = messages.value
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }))

    const { reply, updatedExtraction, diagram } = await chatWithRequirement(
      localReq.value.id,
      text,
      history
    )
    if (diagram) localDiagrams.value.push(diagram)
    messages.value.push({ role: 'assistant', content: reply, updatedExtraction: updatedExtraction ? normalizeExtraction(updatedExtraction) : undefined, diagram })
  } catch (err) {
    messages.value.push({
      role: 'assistant',
      content: err instanceof Error ? `Error: ${err.message}` : 'Something went wrong.'
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

async function applyChanges(extraction: ExtractionResult) {
  applying.value = true
  const normalized = normalizeExtraction(extraction)
  try {
    await updateRequirement(localReq.value.id, { extraction: toRaw(normalized) })
    localReq.value = { ...localReq.value, extraction: normalized }
    saveMessage.value = 'Changes applied'
    setTimeout(() => { saveMessage.value = '' }, 3000)
  } catch {
    saveMessage.value = 'Failed to apply'
  } finally {
    applying.value = false
  }
}

function displayContent(msg: ChatMessage): string {
  if (msg.role !== 'assistant') return msg.content
  return msg.content
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/```mermaid[\s\S]*?```/g, '')
    .trim()
}

const exporting = ref(false)

async function mermaidToPng(
  code: string,
  id: string
): Promise<{ data: ArrayBuffer; width: number; height: number } | null> {
  try {
    const { svg } = await mermaid.render(`docx-${id}-${Date.now()}`, code)

    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
    const el = svgDoc.documentElement

    const naturalW = parseFloat(el.getAttribute('width') ?? '0') || 800
    const naturalH = parseFloat(el.getAttribute('height') ?? '0') || 400

    // Always stretch/shrink to fill the Word content column (~450pt)
    const targetW = 450
    const targetH = (naturalH * targetW) / naturalW

    // Render at 2× for crisp output
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = targetW * scale
    canvas.height = targetH * scale
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)

    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => { ctx.drawImage(img, 0, 0, targetW, targetH); resolve() }
      img.onerror = reject
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    })

    const pngDataUrl = canvas.toDataURL('image/png')
    const base64 = pngDataUrl.slice(pngDataUrl.indexOf(',') + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { data: bytes.buffer, width: targetW, height: targetH }
  } catch {
    return null
  }
}

async function exportDocx() {
  exporting.value = true
  try {
    const req = localReq.value
    const { extraction } = req

    const h1 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 } })
    const h2 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } })
    const body = (text: string) => new Paragraph({ children: [new TextRun({ text, size: 22 })] })
    const bullet = (text: string) => new Paragraph({ children: [new TextRun({ text, size: 22 })], bullet: { level: 0 } })
    const gap = () => new Paragraph('')

    const children = [
      new Paragraph({ children: [new TextRun({ text: req.title, bold: true, size: 36 })] }),
      new Paragraph({ children: [new TextRun({ text: `Created: ${new Date(req.createdAt).toLocaleString()}`, color: '888888', size: 18 })] }),
      gap(),

      ...(extraction.summary ? [h1('Summary'), body(extraction.summary), gap()] : []),

      h1('Requirements'),
      ...(extraction.requirements.functional.length
        ? [h2('Functional'), ...extraction.requirements.functional.map(bullet)]
        : []),
      ...(extraction.requirements.nonFunctional.length
        ? [h2('Non-Functional'), ...extraction.requirements.nonFunctional.map(bullet)]
        : []),
      gap(),

      ...(extraction.features.length ? [
        h1('Features'),
        ...extraction.features.flatMap(f => [
          h2(f.title),
          body(f.description),
          ...(f.dataFlow.length ? [new Paragraph({ children: [new TextRun({ text: 'Data Flow:', bold: true, size: 22 })] }), ...f.dataFlow.map((s, i) => new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${s}`, size: 22 })], indent: { left: 360 } }))] : []),
          ...(f.decisions.length ? [new Paragraph({ children: [new TextRun({ text: 'Decisions:', bold: true, size: 22 })] }), ...f.decisions.map(d => bullet(`✓ ${d}`))] : []),
          ...(f.openQuestions.length ? [new Paragraph({ children: [new TextRun({ text: 'Open Questions:', bold: true, size: 22 })] }), ...f.openQuestions.map(q => bullet(`? ${q}`))] : []),
          gap()
        ])
      ] : []),

      ...(extraction.decisions.length ? [h1('Decisions'), ...extraction.decisions.map(d => bullet(`✓ ${d}`)), gap()] : []),
      ...(extraction.openQuestions.length ? [h1('Open Questions'), ...extraction.openQuestions.map(q => bullet(`? ${q}`)), gap()] : []),
    ]

    // Render all diagrams to PNG in parallel using a light theme (neutral = white bg, dark text)
    if (localDiagrams.value.length) {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' })
      const pngs = await Promise.all(localDiagrams.value.map(d => mermaidToPng(d.code, d.id)))
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
      children.push(h1('Diagrams'))
      localDiagrams.value.forEach((d, i) => {
        children.push(h2(d.title))
        const png = pngs[i]
        children.push(png
          ? new Paragraph({ children: [new ImageRun({ type: 'png', data: png.data, transformation: { width: png.width, height: png.height } })] })
          : new Paragraph({ children: [new TextRun({ text: d.code, font: 'Courier New', size: 18 })] })
        )
        children.push(gap())
      })
    }

    const doc = new Document({ sections: [{ children }] })
    const buffer = await Packer.toArrayBuffer(doc)
    const filename = `${req.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}.docx`
    await window.api.saveDocx(buffer, filename)
  } finally {
    exporting.value = false
  }
}

const exportingHtml = ref(false)

function buildHtml(req: SavedRequirement, diagrams: Diagram[]): string {
  const e = req.extraction

  const section = (title: string, content: string) =>
    `<section><h2>${title}</h2>${content}</section>`

  const ul = (items: string[]) =>
    items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : ''

  const featuresHtml = e.features.map(f => `
    <div class="feature">
      <h3>${f.title}</h3>
      <p>${f.description}</p>
      ${f.dataFlow.length ? `<p class="label">Data Flow</p><ol>${f.dataFlow.map(s => `<li>${s}</li>`).join('')}</ol>` : ''}
      ${f.decisions.length ? `<p class="label">Decisions</p>${ul(f.decisions.map(d => `✓ ${d}`))}` : ''}
      ${f.openQuestions.length ? `<p class="label">Open Questions</p>${ul(f.openQuestions.map(q => `? ${q}`))}` : ''}
    </div>`).join('')

  const diagramsHtml = diagrams.map(d => `
    <div class="diagram">
      <p class="label">${d.title}</p>
      <pre class="mermaid">${d.code}</pre>
    </div>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${req.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 860px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 2rem; margin-bottom: 4px; }
    .meta { color: #888; font-size: 0.85rem; margin-bottom: 2rem; }
    h2 { font-size: 1.1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #555; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-top: 2rem; }
    h3 { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
    ul, ol { padding-left: 1.4rem; }
    li { margin-bottom: 4px; }
    section { margin-bottom: 1.5rem; }
    .feature { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 18px; margin-bottom: 12px; }
    .label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin: 10px 0 4px; }
    .diagram { margin-bottom: 1.5rem; }
    pre.mermaid { background: #f5f5f5; border-radius: 8px; padding: 12px; font-size: 0.85rem; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${req.title}</h1>
  <p class="meta">Created: ${new Date(req.createdAt).toLocaleString()}</p>

  ${e.summary ? section('Summary', `<p>${e.summary}</p>`) : ''}
  ${(e.requirements.functional.length || e.requirements.nonFunctional.length) ? section('Requirements',
    (e.requirements.functional.length ? `<p class="label">Functional</p>${ul(e.requirements.functional)}` : '') +
    (e.requirements.nonFunctional.length ? `<p class="label">Non-Functional</p>${ul(e.requirements.nonFunctional)}` : '')
  ) : ''}
  ${e.features.length ? section('Features', featuresHtml) : ''}
  ${e.decisions.length ? section('Decisions', ul(e.decisions.map(d => `✓ ${d}`))) : ''}
  ${e.openQuestions.length ? section('Open Questions', ul(e.openQuestions.map(q => `? ${q}`))) : ''}
  ${diagrams.length ? section('Diagrams', diagramsHtml) : ''}

  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
    mermaid.initialize({ startOnLoad: true, theme: 'neutral' })
  <\/script>
</body>
</html>`
}

async function exportHtml() {
  exportingHtml.value = true
  try {
    const req = localReq.value
    const html = buildHtml(req, localDiagrams.value)
    const slug = req.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
    await window.api.saveHtml(html, `${slug}.html`)
  } catch (err) {
    saveMessage.value = err instanceof Error ? err.message : 'HTML export failed'
    setTimeout(() => { saveMessage.value = '' }, 4000)
  } finally {
    exportingHtml.value = false
  }
}

function formatDate(val: string | number): string {
  return new Date(val).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">

    <!-- Top bar -->
    <div class="flex items-center gap-3 px-5 py-3 shrink-0" style="border-bottom: 1px solid var(--color-border);">
      <NButton size="small" @click="emit('back')">← Back</NButton>
      <span class="text-sm font-semibold truncate" style="color: var(--color-text); flex: 1">{{ localReq.title }}</span>
      <span class="text-xs" style="color: var(--color-text-muted)">{{ formatDate(localReq.createdAt) }}</span>
      <NButton size="small" :loading="exportingHtml" @click="exportHtml">Export .html</NButton>
      <NButton size="small" :loading="exporting" @click="exportDocx">Export .docx</NButton>
    </div>

    <!-- Body: two columns -->
    <div ref="splitContainer" style="flex: 1; display: flex; overflow: hidden;">

      <!-- Left: Requirement details -->
      <div class="p-6 overflow-y-auto space-y-6" :style="{ width: splitPct + '%', flexShrink: 0, borderRight: '1px solid var(--color-border)', overflowY: 'auto' }">

        <section v-if="localReq.extraction.summary">
          <p class="text-xs font-semibold tracking-widest uppercase mb-2" style="color: var(--color-text-muted)">Summary</p>
          <p class="text-sm leading-relaxed" style="color: var(--color-text-secondary)">{{ localReq.extraction.summary }}</p>
        </section>

        <section v-if="localReq.extraction.requirements.functional.length">
          <p class="text-xs font-semibold tracking-widest uppercase mb-2" style="color: var(--color-text-muted)">Action Items & Requirements</p>
          <ul class="space-y-1">
            <li v-for="(r, i) in localReq.extraction.requirements.functional" :key="i" class="flex gap-2 text-sm" style="color: var(--color-text-secondary)">
              <span style="color: var(--color-text-muted)">–</span>{{ r }}
            </li>
          </ul>
        </section>

        <section v-if="localReq.extraction.requirements.nonFunctional.length">
          <p class="text-xs font-semibold tracking-widest uppercase mb-2" style="color: var(--color-text-muted)">Constraints & Considerations</p>
          <ul class="space-y-1">
            <li v-for="(r, i) in localReq.extraction.requirements.nonFunctional" :key="i" class="flex gap-2 text-sm" style="color: var(--color-text-secondary)">
              <span style="color: var(--color-text-muted)">–</span>{{ r }}
            </li>
          </ul>
        </section>

        <section v-if="localReq.extraction.features.length">
          <p class="text-xs font-semibold tracking-widest uppercase mb-2" style="color: var(--color-text-muted)">Features</p>
          <div class="space-y-3">
            <div
              v-for="(f, i) in localReq.extraction.features"
              :key="i"
              class="p-3 rounded"
              style="background: var(--color-bg-surface); border: 1px solid var(--color-border)"
            >
              <p class="text-sm font-semibold mb-1" style="color: var(--color-text)">{{ f.title }}</p>
              <p class="text-xs mb-2" style="color: var(--color-text-secondary)">{{ f.description }}</p>

              <div v-if="f.dataFlow.length" class="mb-2">
                <p class="text-xs font-medium mb-1" style="color: var(--color-text-muted)">Data Flow</p>
                <ol class="space-y-0.5">
                  <li v-for="(s, j) in f.dataFlow" :key="j" class="flex gap-2 text-xs" style="color: var(--color-text-secondary)">
                    <span style="color: var(--color-text-muted); min-width: 1rem">{{ j + 1 }}.</span>{{ s }}
                  </li>
                </ol>
              </div>

              <div v-if="f.decisions.length" class="mb-2">
                <p class="text-xs font-medium mb-1" style="color: var(--color-text-muted)">Decisions</p>
                <ul class="space-y-0.5">
                  <li v-for="(d, j) in f.decisions" :key="j" class="flex items-start gap-1.5 text-xs" style="color: var(--color-text-secondary)"><Check :size="11" class="shrink-0 mt-0.5" style="color: var(--color-accent);" /> {{ d }}</li>
                </ul>
              </div>

              <div v-if="f.openQuestions.length">
                <p class="text-xs font-medium mb-1" style="color: var(--color-text-muted)">Open Questions</p>
                <ul class="space-y-0.5">
                  <li v-for="(q, j) in f.openQuestions" :key="j" class="flex items-start gap-1.5 text-xs" style="color: var(--color-text-secondary)"><HelpCircle :size="11" class="shrink-0 mt-0.5" style="color: var(--color-text-muted);" /> {{ q }}</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section v-if="localReq.extraction.decisions.length">
          <p class="text-xs font-semibold tracking-widest uppercase mb-2" style="color: var(--color-text-muted)">Decisions</p>
          <ul class="space-y-1">
            <li v-for="(d, i) in localReq.extraction.decisions" :key="i" class="flex items-start gap-1.5 text-xs" style="color: var(--color-text-secondary)"><Check :size="11" class="shrink-0 mt-0.5" style="color: var(--color-accent);" /> {{ d }}</li>
          </ul>
        </section>

        <section v-if="localReq.extraction.openQuestions.length">
          <p class="text-xs font-semibold tracking-widest uppercase mb-2" style="color: var(--color-text-muted)">Open Questions</p>
          <ul class="space-y-1">
            <li v-for="(q, i) in localReq.extraction.openQuestions" :key="i" class="flex items-start gap-1.5 text-xs" style="color: var(--color-text-secondary)"><HelpCircle :size="11" class="shrink-0 mt-0.5" style="color: var(--color-text-muted);" /> {{ q }}</li>
          </ul>
        </section>

        <section v-if="localDiagrams.length">
          <p class="text-xs font-semibold tracking-widest uppercase mb-3" style="color: var(--color-text-muted)">Diagrams</p>
          <div class="space-y-4">
            <div
              v-for="d in localDiagrams"
              :key="d.id"
              class="rounded p-3"
              style="background: var(--color-bg-surface); border: 1px solid var(--color-border)"
            >
              <p class="text-xs font-medium mb-2" style="color: var(--color-text-muted)">{{ d.title }}</p>
              <MermaidDiagram :code="d.code" :diagram-id="d.id" />
            </div>
          </div>
        </section>

      </div>

      <!-- Drag handle -->
      <div
        style="width: 4px; flex-shrink: 0; cursor: col-resize; background: var(--color-border); transition: background 0.15s;"
        @mousedown="startDrag"
        @mouseenter="(e) => (e.target as HTMLElement).style.background = 'var(--color-accent)'"
        @mouseleave="(e) => (e.target as HTMLElement).style.background = 'var(--color-border)'"
      />

      <!-- Right: Chat -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0;">

        <!-- Chat header -->
        <div class="flex items-center justify-between px-4 py-2 shrink-0" style="border-bottom: 1px solid var(--color-border);">
          <span class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-text-muted)">AI Assistant</span>
          <span v-if="saveMessage" class="text-xs" :style="{ color: saveMessage.startsWith('F') ? 'var(--color-error)' : 'var(--color-accent)' }">
            {{ saveMessage }}
          </span>
        </div>

        <!-- Messages -->
        <div ref="messagesEl" class="flex-1 overflow-y-auto p-4 space-y-4">

          <div
            v-if="messages.length === 0"
            class="flex items-center justify-center h-full select-none"
          >
            <p class="text-xs text-center" style="color: var(--color-text-muted); max-width: 200px; line-height: 1.6">
              Ask anything about this requirement — search for details, request changes, or add new items.
            </p>
          </div>

          <div v-for="(msg, i) in messages" :key="i">
            <!-- User bubble -->
            <div v-if="msg.role === 'user'" class="flex justify-end">
              <div class="px-3 py-2 rounded-lg text-sm max-w-xs" style="background: var(--color-info-surface); color: var(--color-info-text);">
                {{ msg.content }}
              </div>
            </div>

            <!-- Assistant bubble -->
            <div v-else class="flex flex-col gap-2">
              <div
                v-if="displayContent(msg)"
                class="px-3 py-2 rounded-lg text-sm"
                style="background: var(--color-bg-surface); color: var(--color-text); white-space: pre-wrap; word-break: break-word;"
              >
                {{ displayContent(msg) }}
              </div>
              <div v-if="msg.diagram" class="rounded-lg overflow-hidden p-3" style="background: var(--color-bg-surface); border: 1px solid var(--color-border)">
                <p class="text-xs font-medium mb-2" style="color: var(--color-text-muted)">{{ msg.diagram.title }}</p>
                <MermaidDiagram :code="msg.diagram.code" :diagram-id="msg.diagram.id" />
              </div>
              <div v-if="msg.updatedExtraction" class="flex items-center gap-2">
                <NButton
                  size="tiny"
                  type="primary"
                  :loading="applying"
                  @click="applyChanges(msg.updatedExtraction!)"
                >
                  Apply Changes
                </NButton>
                <span class="text-xs" style="color: var(--color-text-muted)">Updates the requirement in the database</span>
              </div>
            </div>
          </div>

          <!-- Loading indicator -->
          <div v-if="loading" class="flex gap-1 px-1">
            <span class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style="animation-delay: 0ms" />
            <span class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style="animation-delay: 150ms" />
            <span class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style="animation-delay: 300ms" />
          </div>

        </div>

        <!-- Input area -->
        <div class="p-3 shrink-0 flex gap-2" style="border-top: 1px solid var(--color-border);">
          <NInput
            v-model:value="input"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
            placeholder="Ask a question or describe a change…"
            :disabled="loading"
            @keydown.enter.exact.prevent="send"
          />
          <NButton
            type="primary"
            :loading="loading"
            :disabled="!input.trim()"
            style="align-self: flex-end"
            @click="send"
          >
            Send
          </NButton>
        </div>

      </div>
    </div>
  </div>
</template>
