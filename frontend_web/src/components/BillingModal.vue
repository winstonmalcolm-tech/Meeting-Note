<script setup lang="ts">
import { ref, computed } from 'vue'
import { cancelPlan, resumePlan, getCustomerPortalUrl, type MeResponse } from '../services/api'

const props = defineProps<{
  me: MeResponse
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', patch: Partial<MeResponse>): void
}>()

type View = 'overview' | 'cancel-confirm' | 'resume-confirm'
const view = ref<View>('overview')
const busy = ref(false)
const err = ref('')

const planLabel = computed(() => {
  if (!props.me.plan) return 'No plan'
  return props.me.plan.charAt(0).toUpperCase() + props.me.plan.slice(1)
})

const planPrice = computed(() =>
  ({ starter: '$9', pro: '$20', power: '$45' }[props.me.plan ?? ''] ?? '')
)

const planPerks = computed(() => ({
  starter: ['5 hrs / month', 'Transcription & extraction', 'AI chat'],
  pro: ['15 hrs / month', 'Interview Coach', 'Live Assistant', 'AI chat'],
  power: ['40 hrs / month', 'Interview Coach', 'Live Assistant', 'Priority support'],
}[props.me.plan ?? ''] ?? []))

const renewsAt = computed(() => {
  const d = new Date(props.me.usagePeriodStart)
  d.setDate(d.getDate() + 30)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
})

const endsAt = computed(() => {
  if (!props.me.subscriptionEndsAt) return renewsAt.value
  return new Date(props.me.subscriptionEndsAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })
})

function back() {
  view.value = 'overview'
  err.value = ''
}

async function handleCancel() {
  busy.value = true
  err.value = ''
  try {
    const { endsAt: end } = await cancelPlan()
    emit('updated', { cancelAtPeriodEnd: true, subscriptionEndsAt: end })
    view.value = 'overview'
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    busy.value = false
  }
}

async function handleResume() {
  busy.value = true
  err.value = ''
  try {
    await resumePlan()
    emit('updated', { cancelAtPeriodEnd: false, subscriptionEndsAt: null })
    view.value = 'overview'
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    busy.value = false
  }
}

async function openPortal() {
  busy.value = true
  err.value = ''
  try {
    const url = await getCustomerPortalUrl()
    window.open(url, '_blank')
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Failed to open billing portal'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: rgba(0,0,0,0.7); backdrop-filter: blur(6px);"
      @click.self="emit('close')"
    >
      <!-- Panel -->
      <div
        class="w-full relative"
        style="max-width: 420px; background: #0d0d10; border: 1px solid rgba(255,255,255,0.08);
               border-radius: 20px; overflow: hidden;
               box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;"
      >

        <!-- ── OVERVIEW ────────────────────────────────────────────────── -->
        <div v-if="view === 'overview'">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 pt-6 pb-5"
               style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div>
              <p class="text-white font-semibold text-sm tracking-tight">Billing</p>
              <p class="text-xs mt-0.5" style="color: #52525b;">Manage your subscription</p>
            </div>
            <button
              class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style="color: #52525b; background: rgba(255,255,255,0.04);"
              @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'"
              @click="emit('close')"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Plan summary -->
          <div class="px-6 py-5" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2.5">
                <!-- Pulsing dot -->
                <span class="relative flex h-2 w-2">
                  <span class="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                        style="background: #6ee76e;"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2"
                        style="background: #6ee76e;"></span>
                </span>
                <div>
                  <p class="text-sm font-semibold text-white">{{ planLabel }} Plan</p>
                  <p class="text-xs mt-0.5" style="color: #52525b;">
                    {{ me.cancelAtPeriodEnd ? 'Cancels' : 'Renews' }} {{ me.cancelAtPeriodEnd ? endsAt : renewsAt }}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-lg font-bold text-white">{{ planPrice }}</p>
                <p class="text-xs" style="color: #52525b;">/ month</p>
              </div>
            </div>

            <!-- Cancellation notice -->
            <div v-if="me.cancelAtPeriodEnd"
                 class="rounded-xl px-3.5 py-3 text-xs"
                 style="background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.15);">
              <p style="color: #fbbf24;" class="font-medium mb-0.5">Cancellation scheduled</p>
              <p style="color: #78716c;">Your access ends on {{ endsAt }}. Resume anytime before then.</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="px-6 py-4 space-y-2">

            <!-- Update payment -->
            <button
              class="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all text-left group"
              style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"
              :disabled="busy"
              @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'"
              @click="openPortal"
            >
              <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                   style="background: rgba(110,231,110,0.1); color: #6ee76e;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M1 6h12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  <rect x="3" y="8.5" width="3" height="1.5" rx="0.5" fill="currentColor"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white">Update payment method</p>
                <p class="text-xs mt-0.5" style="color: #52525b;">Change your card or billing info</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color: #3f3f46;"
                   class="group-hover:translate-x-0.5 transition-transform shrink-0">
                <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <!-- Resume plan -->
            <button
              v-if="me.cancelAtPeriodEnd"
              class="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all text-left group"
              style="background: rgba(110,231,110,0.05); border: 1px solid rgba(110,231,110,0.15);"
              :disabled="busy"
              @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(110,231,110,0.1)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(110,231,110,0.05)'"
              @click="view = 'resume-confirm'"
            >
              <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                   style="background: rgba(110,231,110,0.12); color: #6ee76e;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2a5 5 0 100 10A5 5 0 007 2z" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M5.5 5l3 2-3 2V5z" fill="currentColor"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium" style="color: #6ee76e;">Resume subscription</p>
                <p class="text-xs mt-0.5" style="color: #52525b;">Keep your plan active past {{ endsAt }}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color: #6ee76e;"
                   class="group-hover:translate-x-0.5 transition-transform shrink-0">
                <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <!-- Cancel plan -->
            <button
              v-else
              class="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all text-left group"
              style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);"
              :disabled="busy"
              @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'"
              @click="view = 'cancel-confirm'"
            >
              <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                   style="background: rgba(255,255,255,0.05); color: #71717a;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M5 5l4 4M9 5L5 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium" style="color: #a1a1aa;">Cancel plan</p>
                <p class="text-xs mt-0.5" style="color: #52525b;">Access continues until {{ renewsAt }}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color: #3f3f46;"
                   class="group-hover:translate-x-0.5 transition-transform shrink-0">
                <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <!-- Error -->
          <div v-if="err" class="mx-6 mb-4 rounded-xl px-4 py-3"
               style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15);">
            <p class="text-xs" style="color: #f87171;">{{ err }}</p>
          </div>

          <div class="px-6 pb-5 pt-1">
            <p class="text-xs text-center" style="color: #3f3f46;">
              Questions? <a href="mailto:support@meetingnote.app" style="color: #52525b;" class="hover:text-white transition-colors">Contact support</a>
            </p>
          </div>
        </div>

        <!-- ── CANCEL CONFIRM ─────────────────────────────────────────── -->
        <div v-else-if="view === 'cancel-confirm'">

          <!-- Header -->
          <div class="flex items-center gap-3 px-6 pt-6 pb-5"
               style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <button
              class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style="color: #71717a; background: rgba(255,255,255,0.04);"
              @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'"
              @click="back"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 1L3 6l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div>
              <p class="text-white font-semibold text-sm">Cancel subscription</p>
            </div>
            <button
              class="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style="color: #52525b; background: rgba(255,255,255,0.04);"
              @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'"
              @click="emit('close')"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="px-6 py-5">

            <!-- Access-until box -->
            <div class="rounded-xl px-4 py-3.5 mb-5"
                 style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);">
              <p class="text-xs font-medium mb-0.5" style="color: #71717a; letter-spacing: 0.06em; text-transform: uppercase;">Access continues until</p>
              <p class="text-base font-semibold text-white">{{ renewsAt }}</p>
            </div>

            <!-- What pauses -->
            <p class="text-xs mb-3" style="color: #52525b;">After that date, these features will be paused:</p>
            <ul class="space-y-2 mb-6">
              <li
                v-for="perk in planPerks"
                :key="perk"
                class="flex items-center gap-2.5 text-sm"
                style="color: #71717a;"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color: #3f3f46; shrink: 0;">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.1"/>
                  <path d="M5 7l1.5 1.5L9 5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ perk }}
              </li>
            </ul>

            <!-- Error -->
            <div v-if="err" class="rounded-xl px-4 py-3 mb-4"
                 style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15);">
              <p class="text-xs" style="color: #f87171;">{{ err }}</p>
            </div>

            <!-- Buttons -->
            <div class="flex gap-2.5">
              <button
                class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style="background: rgba(255,255,255,0.06); color: #e4e4e7; border: 1px solid rgba(255,255,255,0.08);"
                @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'"
                @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'"
                :disabled="busy"
                @click="back"
              >
                Keep plan
              </button>
              <button
                class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style="background: rgba(251,191,36,0.08); color: #fbbf24; border: 1px solid rgba(251,191,36,0.15);"
                @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.14)'"
                @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.08)'"
                :disabled="busy"
                @click="handleCancel"
              >
                <span v-if="busy" class="inline-block w-3.5 h-3.5 border border-[#fbbf24]/30 border-t-[#fbbf24] rounded-full animate-spin mr-1.5 align-middle" />
                {{ busy ? 'Cancelling…' : 'Cancel at period end' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── RESUME CONFIRM ──────────────────────────────────────────── -->
        <div v-else-if="view === 'resume-confirm'">

          <!-- Header -->
          <div class="flex items-center gap-3 px-6 pt-6 pb-5"
               style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <button
              class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style="color: #71717a; background: rgba(255,255,255,0.04);"
              @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'"
              @click="back"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 1L3 6l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <p class="text-white font-semibold text-sm">Resume subscription</p>
            <button
              class="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style="color: #52525b; background: rgba(255,255,255,0.04);"
              @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'"
              @click="emit('close')"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="px-6 py-5">

            <!-- Confirmation box -->
            <div class="rounded-xl px-4 py-5 mb-5 text-center"
                 style="background: rgba(110,231,110,0.05); border: 1px solid rgba(110,231,110,0.15);">
              <div class="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                   style="background: rgba(110,231,110,0.12);">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="color: #6ee76e;">
                  <path d="M4 9l3.5 3.5L14 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <p class="text-sm font-semibold text-white mb-1">Your plan will stay active</p>
              <p class="text-xs" style="color: #71717a;">Billing continues on {{ renewsAt }} — nothing changes.</p>
            </div>

            <!-- What stays -->
            <p class="text-xs mb-3" style="color: #52525b;">You'll keep access to:</p>
            <ul class="space-y-2 mb-6">
              <li
                v-for="perk in planPerks"
                :key="perk"
                class="flex items-center gap-2.5 text-sm"
                style="color: #a1a1aa;"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color: #6ee76e;">
                  <path d="M3 7l2.5 2.5L11 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ perk }}
              </li>
            </ul>

            <!-- Error -->
            <div v-if="err" class="rounded-xl px-4 py-3 mb-4"
                 style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15);">
              <p class="text-xs" style="color: #f87171;">{{ err }}</p>
            </div>

            <!-- Buttons -->
            <div class="flex gap-2.5">
              <button
                class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style="background: rgba(255,255,255,0.05); color: #a1a1aa; border: 1px solid rgba(255,255,255,0.07);"
                @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'"
                @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'"
                :disabled="busy"
                @click="back"
              >
                Go back
              </button>
              <button
                class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style="background: #6ee76e; color: #050507;"
                @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = '#86efac'"
                @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = '#6ee76e'"
                :disabled="busy"
                @click="handleResume"
              >
                <span v-if="busy" class="inline-block w-3.5 h-3.5 border border-black/20 border-t-black/60 rounded-full animate-spin mr-1.5 align-middle" />
                {{ busy ? 'Resuming…' : 'Resume plan' }}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
