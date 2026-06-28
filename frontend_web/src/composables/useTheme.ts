import { ref } from 'vue'

const isDark = ref(
  typeof window === 'undefined' ? true : localStorage.getItem('theme') !== 'light'
)

function apply(dark: boolean) {
  const html = document.documentElement
  html.classList.toggle('dark', dark)
  html.classList.toggle('light', !dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

if (typeof window !== 'undefined') {
  apply(isDark.value)
}

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
    apply(isDark.value)
  }

  return { isDark, toggle }
}
