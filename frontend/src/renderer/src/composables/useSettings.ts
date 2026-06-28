import { ref } from 'vue'

export type ProviderName = 'openrouter'

const provider = ref<ProviderName>('openrouter')

export function useSettings() {
  return { provider }
}
