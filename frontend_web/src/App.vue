<script setup lang="ts">
import { computed } from 'vue'
import { darkTheme, NConfigProvider } from 'naive-ui'
import { useTheme } from './composables/useTheme'

const { isDark } = useTheme()
const naiveTheme = computed(() => isDark.value ? darkTheme : null)
</script>

<template>
  <NConfigProvider :theme="naiveTheme">
    <RouterView />
  </NConfigProvider>
</template>
