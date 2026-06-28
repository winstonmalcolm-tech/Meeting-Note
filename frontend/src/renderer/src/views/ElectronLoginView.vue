<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { loginToBackend } from '../services/api'

const emit = defineEmits<{ (e: 'authenticated'): void }>()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin(e: Event) {
  e.preventDefault()
  if (!email.value.trim() || !password.value) return
  loading.value = true
  error.value = ''
  try {
    await loginToBackend(email.value.trim(), password.value)
    emit('authenticated')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="flex items-center justify-center"
    style="height: 100vh; background: var(--color-bg);"
  >
    <div style="width: 320px;">
      <div class="mb-6 text-center">
        <div class="flex items-center justify-center gap-1 mb-2">
          <span style="color: var(--color-accent); font-weight: 700; font-size: 18px;">Meeting</span>
          <span style="color: var(--color-text); font-weight: 700; font-size: 18px;">Note</span>
        </div>
        <p style="color: var(--color-text-muted); font-size: 13px;">Sign in to continue</p>
      </div>

      <form @submit="handleLogin" style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="display: block; font-size: 11px; color: var(--color-text-muted); margin-bottom: 6px;">Email</label>
          <NInput
            v-model:value="email"
            type="text"
            placeholder="you@company.com"
            :disabled="loading"
          />
        </div>

        <div>
          <label style="display: block; font-size: 11px; color: var(--color-text-muted); margin-bottom: 6px;">Password</label>
          <NInput
            v-model:value="password"
            type="password"
            placeholder="••••••••"
            show-password-on="click"
            :disabled="loading"
          />
        </div>

        <div
          v-if="error"
          style="background: var(--color-error-bg); border: 1px solid var(--color-error-border);
                 border-radius: 6px; padding: 10px 12px;"
        >
          <p style="font-size: 11px; color: var(--color-error); margin: 0;">{{ error }}</p>
        </div>

        <NButton
          type="primary"
          attr-type="submit"
          :loading="loading"
          :disabled="!email.trim() || !password"
          style="margin-top: 4px;"
        >
          Sign in
        </NButton>
      </form>

      <p style="text-align: center; font-size: 11px; color: var(--color-text-muted); margin-top: 16px;">
        Don't have an account? Sign up at meetingnote.app
      </p>
    </div>
  </div>
</template>
