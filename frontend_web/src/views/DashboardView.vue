<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NButton, NTag } from 'naive-ui'
import { fetchMe, createCheckout, logout, type MeResponse } from '../services/api'
import BillingModal from '../components/BillingModal.vue'
import TheNavbar from '../components/TheNavbar.vue'

const billingOpen = ref(false)

const router = useRouter()
const route = useRoute()

const me = ref<MeResponse | null>(null)
const loading = ref(true)
const activatingPlan = ref(false)
const checkoutSuccessBanner = ref(false)
onMounted(async () => {
  if (route.query.checkout === 'success') {
    checkoutSuccessBanner.value = true
  }
  try {
    me.value = await fetchMe()
  } catch {
    router.push('/login')
  } finally {
    loading.value = false
  }
})

const usageHours = computed(() => me.value ? (me.value.usageSeconds / 3600).toFixed(1) : '0')
const limitHours = computed(() => me.value ? (me.value.usageLimitSeconds / 3600).toFixed(0) : '0')
const remainingHours = computed(() => me.value ? (me.value.remainingSeconds / 3600).toFixed(1) : '0')
const usagePct = computed(() => {
  if (!me.value || me.value.usageLimitSeconds === 0) return 0
  return Math.min((me.value.usageSeconds / me.value.usageLimitSeconds) * 100, 100)
})
const ringColor = computed(() => usagePct.value >= 90 ? '#f87171' : usagePct.value >= 70 ? '#fbbf24' : '#6ee76e')

const RADIUS = 54
const CIRC = 2 * Math.PI * RADIUS
const ringDash = computed(() => (usagePct.value / 100) * CIRC)

const planLabel = computed(() => {
  if (!me.value?.plan) return 'No plan'
  return me.value.plan.charAt(0).toUpperCase() + me.value.plan.slice(1)
})

const PRICES: Record<string, string> = { starter: '$9', pro: '$20', power: '$45' }
const planPrice = computed(() => (me.value?.plan ? PRICES[me.value.plan] : '') ?? '')

const renewsAt = computed(() => {
  if (!me.value?.usagePeriodStart) return ''
  const d = new Date(me.value.usagePeriodStart)
  d.setDate(d.getDate() + 30)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

async function activatePlan() {
  if (!me.value?.plan) return
  activatingPlan.value = true
  try {
    const { checkoutUrl } = await createCheckout(me.value.plan)
    window.location.href = checkoutUrl
  } catch (err) {
    console.error(err)
    activatingPlan.value = false
  }
}

function handleLogout() {
  logout()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen" style="background: var(--color-bg); color: var(--color-text);">

    <!-- Top nav -->
    <TheNavbar sticky compact wide>
      <span class="text-xs text-zinc-500 hidden sm:block">{{ me?.email }}</span>
      <div class="w-7 h-7 rounded-full bg-[#6ee76e]/15 border border-[#6ee76e]/30
                  flex items-center justify-center text-xs font-semibold text-[#6ee76e]">
        {{ me?.name?.charAt(0) ?? '?' }}
      </div>
      <NButton size="tiny" quaternary @click="handleLogout">Log out</NButton>
    </TheNavbar>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="w-6 h-6 rounded-full border-2 border-[#6ee76e]/30 border-t-[#6ee76e] animate-spin" />
    </div>

    <div v-else class="max-w-7xl mx-auto px-6 py-8">

      <!-- Checkout success banner -->
      <div v-if="checkoutSuccessBanner"
           class="mb-6 rounded-xl border border-[#6ee76e]/20 bg-[#6ee76e]/5 px-5 py-3.5 flex items-center gap-3">
        <span class="text-[#6ee76e] text-lg">✓</span>
        <div>
          <p class="text-sm font-medium text-white">Payment successful!</p>
          <p class="text-xs text-zinc-400 mt-0.5">Your plan is now active. Start recording meetings.</p>
        </div>
        <button class="ml-auto text-zinc-600 hover:text-zinc-400" @click="checkoutSuccessBanner = false">✕</button>
      </div>

      <!-- Activate plan banner (pending status) -->
      <div v-if="me?.planStatus === 'pending'"
           class="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3.5 flex items-center gap-3">
        <span class="text-amber-400 text-lg">⚡</span>
        <div class="flex-1">
          <p class="text-sm font-medium text-white">Activate your plan to start recording</p>
          <p class="text-xs text-zinc-400 mt-0.5">Complete payment to unlock transcription and AI features.</p>
        </div>
        <NButton size="small" type="primary" :loading="activatingPlan" @click="activatePlan">
          Activate Plan
        </NButton>
      </div>

      <!-- Page header -->
      <div class="mb-8">
        <h1 class="text-xl font-bold text-white">Dashboard</h1>
        <p class="text-sm text-zinc-500 mt-0.5">Welcome back, {{ me?.name?.split(' ')[0] }}</p>
      </div>

      <!-- Top row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        <!-- Usage ring card -->
        <div class="lg:col-span-1 rounded-2xl border border-white/5 bg-white/2 p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <p class="text-xs font-semibold tracking-widest uppercase text-zinc-500">Monthly Usage</p>
              <p class="text-xs text-zinc-600 mt-0.5">Resets {{ renewsAt }}</p>
            </div>
            <NTag :type="me?.planStatus === 'active' ? 'success' : 'warning'" :bordered="false" size="small">
              {{ planLabel }}
            </NTag>
          </div>

          <!-- SVG Ring -->
          <div class="flex flex-col items-center py-4">
            <div class="relative">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="10" />
                <circle
                  cx="70" cy="70" r="54" fill="none"
                  :stroke="ringColor"
                  stroke-width="10"
                  stroke-linecap="round"
                  :stroke-dasharray="`${ringDash} ${CIRC}`"
                  stroke-dashoffset="0"
                  transform="rotate(-90 70 70)"
                  style="transition: stroke-dasharray 0.8s ease, stroke 0.4s ease"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-2xl font-bold text-white">{{ usageHours }}</span>
                <span class="text-xs text-zinc-500">of {{ limitHours }}h</span>
              </div>
            </div>

            <div class="mt-4 text-center">
              <p class="text-sm font-semibold" :style="{ color: ringColor }">
                {{ remainingHours }}h remaining
              </p>
              <p class="text-xs text-zinc-600 mt-0.5">{{ usagePct.toFixed(0) }}% of monthly cap used</p>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="lg:col-span-2 flex flex-col gap-4">

          <!-- Plan card -->
          <div class="rounded-2xl border border-[#6ee76e]/15 bg-[#6ee76e]/3 p-5">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <p class="text-sm font-semibold text-white">{{ planLabel }} Plan</p>
                  <NTag :type="me?.planStatus === 'active' ? 'success' : 'warning'" :bordered="false" size="small">
                    {{ me?.planStatus === 'active' ? 'Active' : 'Pending' }}
                  </NTag>
                </div>
                <p class="text-xs text-zinc-500">
                  {{ planPrice }} / month
                  <span v-if="me?.planStatus === 'active'"> · Renews {{ renewsAt }}</span>
                </p>
              </div>
              <NButton v-if="me?.planStatus === 'active'" size="small" quaternary @click="billingOpen = true">Manage billing</NButton>
              <NButton v-else size="small" type="primary" :loading="activatingPlan" @click="activatePlan">
                Activate
              </NButton>
            </div>
          </div>

          <!-- Stats grid -->
          <div class="grid grid-cols-3 gap-4 flex-1">
            <div class="rounded-2xl border border-white/5 bg-white/2 p-5 flex flex-col justify-between">
              <p class="text-xs font-semibold tracking-widest uppercase text-zinc-500">Hours Used</p>
              <div>
                <p class="text-3xl font-bold text-white">{{ usageHours }}</p>
                <p class="text-xs text-zinc-600 mt-1">of {{ limitHours }}h cap</p>
              </div>
            </div>
            <div class="rounded-2xl border border-white/5 bg-white/2 p-5 flex flex-col justify-between">
              <p class="text-xs font-semibold tracking-widest uppercase text-zinc-500">Remaining</p>
              <div>
                <p class="text-3xl font-bold" :style="{ color: ringColor }">{{ remainingHours }}h</p>
                <p class="text-xs text-zinc-600 mt-1">this period</p>
              </div>
            </div>
            <div class="rounded-2xl border border-white/5 bg-white/2 p-5 flex flex-col justify-between">
              <p class="text-xs font-semibold tracking-widest uppercase text-zinc-500">Usage</p>
              <div>
                <p class="text-3xl font-bold text-white">{{ usagePct.toFixed(0) }}%</p>
                <p class="text-xs text-zinc-600 mt-1">of cap used</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Account info -->
      <div class="rounded-2xl border border-white/5 bg-white/2 p-6">
        <p class="text-xs font-semibold tracking-widest uppercase text-zinc-500 mb-4">Account</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-zinc-600 mb-1">Name</p>
            <p class="text-sm text-white">{{ me?.name }}</p>
          </div>
          <div>
            <p class="text-xs text-zinc-600 mb-1">Email</p>
            <p class="text-sm text-white">{{ me?.email }}</p>
          </div>
          <div>
            <p class="text-xs text-zinc-600 mb-1">Plan</p>
            <p class="text-sm text-white">{{ planLabel }}</p>
          </div>
          <div>
            <p class="text-xs text-zinc-600 mb-1">Member since</p>
            <p class="text-sm text-white">
              {{ me?.createdAt ? new Date(me.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—' }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Billing modal -->
  <BillingModal
    v-if="billingOpen && me"
    :me="me"
    @close="billingOpen = false"
    @updated="(patch) => { if (me) Object.assign(me, patch) }"
  />
</template>
