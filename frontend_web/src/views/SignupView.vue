<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { NButton, NInput, NCheckbox } from 'naive-ui'
import { signup, setToken } from '../services/api'

const route = useRoute()

const name = ref('')
const email = ref('')
const password = ref('')
const selectedPlan = ref<'starter' | 'pro' | 'power'>('pro')
const agreedToTerms = ref(false)
const loading = ref(false)
const error = ref('')

const plans = [
  {
    id: 'starter' as const,
    label: 'Starter',
    price: '$9',
    sub: '/month',
    perks: ['5 hrs / month', 'Transcription & extraction', 'AI chat', 'Export to Word']
  },
  {
    id: 'pro' as const,
    label: 'Pro',
    price: '$20',
    sub: '/month',
    perks: ['15 hrs / month', 'Interview Coach', 'Live Assistant', 'Export to Word']
  },
  {
    id: 'power' as const,
    label: 'Power',
    price: '$45',
    sub: '/month',
    perks: ['40 hrs / month', 'Interview Coach', 'Live Assistant', 'Priority support']
  }
]

onMounted(() => {
  const planParam = route.query.plan as string
  if (planParam && ['starter', 'pro', 'power'].includes(planParam)) {
    selectedPlan.value = planParam as 'starter' | 'pro' | 'power'
  }
})

async function handleSignup(e: Event) {
  e.preventDefault()
  if (!name.value.trim() || !email.value.trim() || !password.value || !agreedToTerms.value) return
  loading.value = true
  error.value = ''
  try {
    const { token, checkoutUrl, checkoutError } = await signup(
      name.value.trim(),
      email.value.trim(),
      password.value,
      selectedPlan.value
    )
    setToken(token)
    if (checkoutUrl) {
      window.location.href = checkoutUrl
    } else {
      error.value = checkoutError ?? 'Payment setup failed. Please try again.'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

const canSubmit = () =>
  name.value.trim() && email.value.trim() && password.value.length >= 8 && agreedToTerms.value
</script>

<template>
  <div class="min-h-screen flex flex-col" style="background: var(--color-bg); color: var(--color-text);">

    <!-- Top bar -->
    <div class="px-6 py-5 flex items-center justify-between">
      <RouterLink to="/" class="flex items-center gap-1">
        <span class="text-[#6ee76e] font-bold tracking-tight">Meeting</span>
        <span class="text-white font-bold tracking-tight">Note</span>
      </RouterLink>
      <span class="text-sm text-zinc-500">
        Already have an account?
        <RouterLink to="/login" class="text-[#6ee76e] hover:text-[#86efac] transition-colors ml-1 font-medium">Log in</RouterLink>
      </span>
    </div>

    <!-- Content -->
    <div class="flex-1 flex items-start justify-center px-6 py-8">
      <div class="w-full max-w-lg">

        <!-- Glow -->
        <div class="fixed pointer-events-none inset-0 overflow-hidden">
          <div class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-100
                      bg-[radial-gradient(ellipse,rgba(110,231,110,0.05)_0%,transparent_70%)]" />
        </div>

        <div class="relative">
          <div class="mb-8">
            <h1 class="text-2xl font-bold text-white mb-1.5">Create your account</h1>
            <p class="text-sm text-zinc-500">Get started with MeetingNote in minutes</p>
          </div>

          <form class="space-y-5" @submit="handleSignup">

            <!-- Plan picker -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-2">Choose your plan</label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  v-for="plan in plans"
                  :key="plan.id"
                  type="button"
                  class="relative rounded-xl border p-4 text-left transition-all duration-200"
                  :class="selectedPlan === plan.id
                    ? 'border-[#6ee76e]/50 bg-[#6ee76e]/5'
                    : 'border-white/5 bg-white/2 hover:border-white/10'"
                  @click="selectedPlan = plan.id"
                >
                  <div v-if="selectedPlan === plan.id"
                       class="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#6ee76e] flex items-center justify-center">
                    <span class="text-black text-[9px] font-bold">✓</span>
                  </div>
                  <p class="text-xs text-zinc-500 mb-0.5">{{ plan.label }}</p>
                  <div class="flex items-baseline gap-0.5 mb-2">
                    <span class="text-lg font-bold text-white">{{ plan.price }}</span>
                    <span class="text-xs text-zinc-500">{{ plan.sub }}</span>
                  </div>
                  <ul class="space-y-1">
                    <li v-for="perk in plan.perks" :key="perk" class="text-xs text-zinc-400 flex items-center gap-1.5">
                      <span class="text-[#6ee76e] text-[10px]">✓</span>{{ perk }}
                    </li>
                  </ul>
                </button>
              </div>
            </div>

            <!-- Fields -->
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Full name</label>
              <NInput v-model:value="name" placeholder="Alex Johnson" size="large" :disabled="loading" />
            </div>

            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Work email</label>
              <NInput v-model:value="email" type="text" placeholder="alex@company.com" size="large" :disabled="loading" />
            </div>

            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
              <NInput
                v-model:value="password"
                type="password"
                placeholder="Minimum 8 characters"
                size="large"
                :disabled="loading"
                show-password-on="click"
              />
              <p class="text-xs text-zinc-600 mt-1.5">At least 8 characters</p>
            </div>

            <div class="flex items-start gap-2 pt-1">
              <NCheckbox v-model:checked="agreedToTerms" size="small" class="mt-0.5" />
              <span class="text-xs text-zinc-400 leading-relaxed">
                I agree to the
                <a href="#" class="text-zinc-300 hover:text-white transition-colors">Terms of Service</a>
                and
                <a href="#" class="text-zinc-300 hover:text-white transition-colors">Privacy Policy</a>
              </span>
            </div>

            <div v-if="error" class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p class="text-xs text-red-400">{{ error }}</p>
            </div>

            <NButton
              type="primary"
              size="large"
              class="w-full"
              :loading="loading"
              :disabled="!canSubmit()"
              attr-type="submit"
            >
              {{ selectedPlan === 'starter' ? 'Start Starter — $9/mo' : selectedPlan === 'pro' ? 'Start Pro — $20/mo' : 'Start Power — $45/mo' }}
            </NButton>

          </form>

          <!-- Divider -->
          <div class="relative my-5">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-white/5" />
            </div>
            <div class="relative flex justify-center">
              <span class="px-3 text-xs text-zinc-600" style="background: var(--color-bg)">or continue with</span>
            </div>
          </div>

          <button
            type="button"
            class="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg
                   border border-white/8 bg-white/3 hover:bg-white/6
                   text-sm text-zinc-300 transition-colors"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
