<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NButton, NInput, NCheckbox } from 'naive-ui'
import { login, setToken } from '../services/api'

const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const remember = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin(e: Event) {
  e.preventDefault()
  if (!email.value.trim() || !password.value) return
  loading.value = true
  error.value = ''
  try {
    const { token } = await login(email.value.trim(), password.value)
    setToken(token)
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Invalid email or password.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col" style="background: var(--color-bg); color: var(--color-text);">

    <!-- Top bar -->
    <div class="px-6 py-5 flex items-center justify-between">
      <RouterLink to="/" class="flex items-center gap-1 group">
        <span class="text-[#6ee76e] font-bold tracking-tight">Meeting</span>
        <span class="text-white font-bold tracking-tight">Note</span>
      </RouterLink>
      <span class="text-sm text-zinc-500">
        Don't have an account?
        <RouterLink to="/signup" class="text-[#6ee76e] hover:text-[#86efac] transition-colors ml-1 font-medium">Sign up</RouterLink>
      </span>
    </div>

    <!-- Card -->
    <div class="flex-1 flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-sm">

        <!-- Glow -->
        <div class="absolute pointer-events-none inset-0 overflow-hidden">
          <div class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-100
                      bg-[radial-gradient(ellipse,rgba(110,231,110,0.05)_0%,transparent_70%)]" />
        </div>

        <div class="relative">
          <!-- Heading -->
          <div class="mb-8">
            <h1 class="text-2xl font-bold text-white mb-1.5">Welcome back</h1>
            <p class="text-sm text-zinc-500">Sign in to your MeetingNote account</p>
          </div>

          <!-- Form -->
          <form class="space-y-4" @submit="handleLogin">
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
              <NInput
                v-model:value="email"
                type="text"
                placeholder="you@company.com"
                size="large"
                :disabled="loading"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-medium text-zinc-400">Password</label>
                <a href="#" class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Forgot password?</a>
              </div>
              <NInput
                v-model:value="password"
                type="password"
                placeholder="••••••••"
                size="large"
                :disabled="loading"
                show-password-on="click"
              />
            </div>

            <div class="flex items-center gap-2 pt-1">
              <NCheckbox v-model:checked="remember" size="small">
                <span class="text-xs text-zinc-400">Remember me for 30 days</span>
              </NCheckbox>
            </div>

            <div v-if="error" class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p class="text-xs text-red-400">{{ error }}</p>
            </div>

            <NButton
              type="primary"
              size="large"
              class="w-full"
              :loading="loading"
              :disabled="!email.trim() || !password"
              attr-type="submit"
            >
              Sign in
            </NButton>
          </form>

          <!-- Divider -->
          <div class="relative my-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-white/5" />
            </div>
            <div class="relative flex justify-center">
              <span class="px-3 text-xs text-zinc-600" style="background: var(--color-bg)">or continue with</span>
            </div>
          </div>

          <!-- OAuth placeholder -->
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

          <p class="text-center text-xs text-zinc-600 mt-6">
            By signing in you agree to our
            <a href="#" class="text-zinc-500 hover:text-zinc-300 transition-colors">Terms</a>
            and
            <a href="#" class="text-zinc-500 hover:text-zinc-300 transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
