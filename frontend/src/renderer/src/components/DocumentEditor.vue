<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Undo2, Redo2 } from '@lucide/vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editor = useEditor({
  content: props.modelValue,
  extensions: [StarterKit],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  }
})

watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val, false)
  }
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<template>
  <div class="doc-editor rounded-lg overflow-hidden" style="border: 1px solid var(--color-border);">

    <!-- Toolbar -->
    <div class="flex items-center gap-0.5 px-2 py-1.5 flex-wrap" style="background: var(--color-bg-surface); border-bottom: 1px solid var(--color-border);">
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('bold') }"
        title="Bold"
        @mousedown.prevent="editor?.chain().focus().toggleBold().run()"
      >
        <Bold :size="13" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('italic') }"
        title="Italic"
        @mousedown.prevent="editor?.chain().focus().toggleItalic().run()"
      >
        <Italic :size="13" />
      </button>

      <div class="toolbar-divider" />

      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('heading', { level: 1 }) }"
        title="Heading 1"
        @mousedown.prevent="editor?.chain().focus().toggleHeading({ level: 1 }).run()"
      >
        <Heading1 :size="13" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('heading', { level: 2 }) }"
        title="Heading 2"
        @mousedown.prevent="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        <Heading2 :size="13" />
      </button>

      <div class="toolbar-divider" />

      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('bulletList') }"
        title="Bullet list"
        @mousedown.prevent="editor?.chain().focus().toggleBulletList().run()"
      >
        <List :size="13" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('orderedList') }"
        title="Numbered list"
        @mousedown.prevent="editor?.chain().focus().toggleOrderedList().run()"
      >
        <ListOrdered :size="13" />
      </button>

      <div class="toolbar-divider" />

      <button
        class="toolbar-btn"
        :disabled="!editor?.can().undo()"
        title="Undo"
        @mousedown.prevent="editor?.chain().focus().undo().run()"
      >
        <Undo2 :size="13" />
      </button>
      <button
        class="toolbar-btn"
        :disabled="!editor?.can().redo()"
        title="Redo"
        @mousedown.prevent="editor?.chain().focus().redo().run()"
      >
        <Redo2 :size="13" />
      </button>
    </div>

    <!-- Editor area -->
    <EditorContent :editor="editor" class="doc-editor-content" />
  </div>
</template>

<style scoped>
.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.toolbar-btn:hover:not(:disabled) {
  background: var(--color-bg-elevated);
  color: var(--color-text);
}
.toolbar-btn.active {
  background: var(--color-bg-elevated);
  color: var(--color-accent);
}
.toolbar-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--color-border);
  margin: 0 4px;
}

.doc-editor-content :deep(.ProseMirror) {
  min-height: 280px;
  padding: 12px 14px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.8rem;
  line-height: 1.65;
  outline: none;
}
.doc-editor-content :deep(.ProseMirror p) {
  margin: 0.3em 0;
}
.doc-editor-content :deep(.ProseMirror h1) {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0.8em 0 0.2em;
  color: var(--color-text);
}
.doc-editor-content :deep(.ProseMirror h2) {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0.7em 0 0.2em;
  color: var(--color-text);
}
.doc-editor-content :deep(.ProseMirror ul),
.doc-editor-content :deep(.ProseMirror ol) {
  padding-left: 1.4em;
  margin: 0.3em 0;
}
.doc-editor-content :deep(.ProseMirror li) {
  margin: 0.15em 0;
}
.doc-editor-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--color-text-muted);
  pointer-events: none;
  float: left;
  height: 0;
}
</style>
