<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useTheme } from '../composables/useTheme'

withDefaults(defineProps<{
  sticky?: boolean
  compact?: boolean
  wide?: boolean
}>(), {
  sticky: false,
  compact: false,
  wide: false,
})

const { isDark, toggle } = useTheme()
</script>

<template>
  <nav
    :class="[
      'border-b border-white/5 backdrop-blur-md',
      sticky
        ? 'sticky top-0 z-40 bg-[#050507]/90'
        : 'fixed top-0 inset-x-0 z-50 bg-[#050507]/80',
    ]"
  >
    <div
      :class="[
        wide ? 'max-w-7xl' : 'max-w-6xl',
        compact ? 'h-14' : 'h-16',
        'mx-auto px-6 flex items-center justify-between',
      ]"
    >
      <RouterLink to="/" class="flex items-center gap-1 shrink-0">
        <span :class="compact ? 'text-sm' : 'text-lg'" class="text-[#6ee76e] font-bold tracking-tight">Meeting</span>
        <span :class="compact ? 'text-sm' : 'text-lg'" class="text-white font-bold tracking-tight">Note</span>
      </RouterLink>

      <div class="flex items-center gap-3">
        <slot />

        <button
          class="flex items-center justify-center w-8 h-8 rounded-full transition-colors shrink-0"
          :style="{
            background: isDark ? '#27272A' : '#F4F4F5',
            border: isDark ? '1px solid #3F3F46' : '1px solid #D4D4D8',
            color: isDark ? '#A1A1AA' : '#52525B',
          }"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggle"
        >
          <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        </button>
      </div>
    </div>
  </nav>
</template>
