<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NInput, NInputGroup, NTag, createDiscreteApi } from 'naive-ui'
import { useRouter } from 'vue-router'
import TheNavbar from '../components/TheNavbar.vue'
import {
  Mic, Sparkles, MessageSquare, Monitor, Zap, Target,
  FolderOpen, Upload, LayoutList,
  HardDrive, ShieldCheck, KeyRound, Trash2,
  Download,
  type LucideIcon
} from '@lucide/vue'

const { message } = createDiscreteApi(['message'])
const router = useRouter()

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// Update these URLs when release builds are published
const DOWNLOAD_WINDOWS = '#download'

const email = ref('')
const submitting = ref(false)
const joined = ref(false)
const errorMsg = ref('')
const openFaq = ref<number | null>(null)

async function joinWaitlist(e: Event) {
  e.preventDefault()
  if (!email.value.trim() || submitting.value || joined.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${API_URL}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim() })
    })
    const data = await res.json()
    if (!res.ok) {
      errorMsg.value = data.error ?? 'Something went wrong.'
    } else {
      joined.value = true
      email.value = ''
      message.success("You're on the list! We'll notify you at launch.", { duration: 4000 })
    }
  } catch {
    errorMsg.value = 'Could not connect. Please try again.'
  } finally {
    submitting.value = false
  }
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

const features: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Mic,
    title: 'AI Transcription',
    desc: 'Deepgram nova-2 transcription of every spoken word — accurate, automatically formatted, and ready in seconds.'
  },
  {
    icon: Sparkles,
    title: 'Smart Extraction',
    desc: 'Automatically surfaces decisions, requirements, action items, and open questions from any meeting or recording.'
  },
  {
    icon: MessageSquare,
    title: 'AI Chat',
    desc: 'Ask anything about a past meeting in plain English. Get instant, grounded answers with full context.'
  },
  {
    icon: Monitor,
    title: 'Screen + Audio',
    desc: 'Capture your full screen alongside microphone and system audio for complete meeting context in one place.'
  },
  {
    icon: Zap,
    title: 'Live Assistant',
    desc: 'Real-time AI guidance streamed to a private overlay during any live call — invisible to screen sharing.'
  },
  {
    icon: Target,
    title: 'Interview Coach',
    desc: 'Hear a question, get a confident first-person answer — silently streamed to your private overlay in real time.'
  },
  {
    icon: FolderOpen,
    title: 'Collections',
    desc: 'Group multiple recordings together, synthesise a unified summary across all of them, and chat with the whole set.'
  },
  {
    icon: Upload,
    title: 'Upload & Analyse',
    desc: 'Drop in any audio or video file — MP4, MP3, WAV, MOV and more — and get the same AI analysis instantly.'
  },
  {
    icon: LayoutList,
    title: 'Structured Notes',
    desc: 'Every session produces functional requirements, non-functional requirements, features, decisions, and open questions — ready to paste into your backlog.'
  }
]

const steps = [
  {
    number: '01',
    title: 'Download & record',
    desc: 'Install MeetingNote, hit record. Capture audio, screen, or upload an existing file. Works with Zoom, Meet, Teams, or any app.'
  },
  {
    number: '02',
    title: 'AI does the work',
    desc: 'Deepgram transcribes your audio. AI extracts decisions, requirements, action items, and open questions automatically.'
  },
  {
    number: '03',
    title: 'Chat, export, act',
    desc: 'Query your notes with AI, generate Mermaid diagrams, group recordings into Collections, or export to Word.'
  }
]

const privacyPoints: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: HardDrive,
    title: 'Runs on your machine',
    desc: 'MeetingNote is a desktop app. Your recordings stay in your local user data folder — not uploaded to our servers.'
  },
  {
    icon: ShieldCheck,
    title: 'Overlay is screen-capture proof',
    desc: 'The live assistant overlay uses OS-level content protection — it\'s completely invisible to screen sharing, screenshots, and recording software.'
  },
  {
    icon: KeyRound,
    title: 'Managed AI — no key required',
    desc: 'AI processing runs through our managed OpenRouter account. Your subscription covers usage — you never need to configure an API key.'
  },
  {
    icon: Trash2,
    title: 'Delete anytime',
    desc: 'Every recording and note lives in your local app data. Delete from within the app and it\'s gone — permanently.'
  }
]

const faqs = [
  {
    q: 'What platforms does MeetingNote support?',
    a: 'MeetingNote is a Windows and macOS desktop app. It works with any meeting software — Zoom, Google Meet, Microsoft Teams, Webex, Discord, or any app that uses your system audio.'
  },
  {
    q: 'Do I need an AI API key?',
    a: 'No. AI processing is included with your subscription — powered by our managed OpenRouter account. You do not need to sign up for any AI service or configure anything.'
  },
  {
    q: 'Is the Interview Coach detectable?',
    a: 'No. The overlay window uses OS-level content protection (setContentProtection) which excludes it from all screen capture software, screenshots, and recording tools. Your interviewer sees only your face, not the overlay.'
  },
  {
    q: 'What file formats can I upload?',
    a: 'Video: MP4, MOV, MKV, AVI. Audio: MP3, WAV, M4A, OGG, FLAC, WebM. Upload any of these and MeetingNote will transcribe and extract structured notes automatically.'
  },
  {
    q: 'What happens to my data?',
    a: 'Recordings and notes are stored locally on your machine. Audio is sent to Deepgram for transcription and transcripts are sent to our AI provider for extraction — neither passes through our own servers in storage.'
  },
  {
    q: 'What are Collections?',
    a: 'Collections let you group multiple audio and screen recordings together. MeetingNote synthesises a single unified summary across all recordings in the collection and lets you chat with the entire set at once — useful for multi-session projects or interview series.'
  },
  {
    q: 'Can I export my notes?',
    a: 'Yes. MeetingNote exports structured notes and requirements to Word (.docx) and HTML. AI chat responses can also include Mermaid diagrams that are saved and viewable inside the app.'
  },
  {
    q: 'What is the monthly hour cap?',
    a: 'Each plan includes a rolling 30-day allowance of AI-processed audio (5 h / 15 h / 40 h). The counter resets automatically at your billing date. Unused hours do not roll over.'
  }
]
</script>

<template>
  <div class="min-h-screen antialiased" style="background: var(--color-bg); color: var(--color-text);">

    <!-- Nav -->
    <TheNavbar>
      <button class="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block" @click="scrollTo('features')">Features</button>
      <button class="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block" @click="scrollTo('how-it-works')">How it works</button>
      <button class="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block" @click="scrollTo('pricing')">Pricing</button>
      <button class="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block" @click="scrollTo('download')">Download</button>
      <RouterLink to="/login" class="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">Log in</RouterLink>
      <RouterLink to="/signup">
        <NButton type="primary" size="small">Get Started</NButton>
      </RouterLink>
    </TheNavbar>

    <!-- Hero -->
    <section class="relative pt-40 pb-28 px-6 overflow-hidden">
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]
                    bg-[radial-gradient(ellipse_at_top,rgba(110,231,110,0.07)_0%,transparent_70%)]" />
      </div>
      <div class="relative max-w-4xl mx-auto text-center">
        <NTag type="success" :bordered="false" size="small" class="mb-6">Now available — download for free</NTag>
        <h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
          Your meetings.<br>
          <span class="text-[#6ee76e]">Understood.</span>
        </h1>
        <p class="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          MeetingNote records, transcribes, and extracts structured insights from every conversation —
          so you can focus on the discussion, not the notes.
        </p>

        <!-- Download CTAs -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <a :href="DOWNLOAD_WINDOWS" @click.prevent="scrollTo('download')">
            <NButton type="primary" size="large" class="w-full sm:w-auto px-8">
              <template #icon><Download :size="16" /></template>
              Download for Windows
            </NButton>
          </a>
          <div class="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-sm text-zinc-500"
               style="cursor: default">
            <Download :size="16" class="opacity-40" />
            macOS
            <span class="ml-1 px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-zinc-500">Coming Soon</span>
          </div>
        </div>

        <p class="text-xs text-zinc-600 mb-10">Free to download · subscription required for AI features</p>

        <div class="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500">
          <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[#6ee76e]" />Works with Zoom, Meet &amp; Teams</span>
          <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[#6ee76e]" />Runs locally on your machine</span>
          <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[#6ee76e]" />No API key needed</span>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="py-24 px-6">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-16">
          <p class="text-xs font-semibold tracking-widest uppercase text-[#6ee76e] mb-3">Features</p>
          <h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white">Everything your meetings need</h2>
          <p class="text-zinc-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
            From raw audio to structured documentation in seconds. MeetingNote handles every step — so nothing gets lost between your ears and your team's backlog.
          </p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="f in features" :key="f.title"
            class="group p-6 rounded-2xl border border-white/5 bg-white/2
                   hover:border-[#6ee76e]/20 hover:bg-white/4 transition-all duration-300 cursor-default"
          >
            <div class="mb-4 text-[#6ee76e]">
              <component :is="f.icon" :size="28" :stroke-width="1.5" />
            </div>
            <h3 class="text-base font-semibold text-white mb-2">{{ f.title }}</h3>
            <p class="text-sm text-zinc-400 leading-relaxed">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="py-24 px-6 border-t border-white/5">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-16">
          <p class="text-xs font-semibold tracking-widest uppercase text-[#6ee76e] mb-3">How it works</p>
          <h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white">From recording to insights in seconds</h2>
          <p class="text-zinc-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
            No configuration, no fuss. Hit record and let MeetingNote handle the rest.
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div class="hidden md:block absolute top-8 left-[calc(16.6%+1rem)] right-[calc(16.6%+1rem)]
                      h-px bg-gradient-to-r from-[#6ee76e]/30 via-[#6ee76e]/60 to-[#6ee76e]/30" />
          <div v-for="s in steps" :key="s.number" class="text-center relative">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full
                        border border-[#6ee76e]/30 bg-[#6ee76e]/5 mb-5 relative z-10">
              <span class="text-lg font-bold text-[#6ee76e]">{{ s.number }}</span>
            </div>
            <h3 class="text-base font-semibold text-white mb-2">{{ s.title }}</h3>
            <p class="text-sm text-zinc-400 leading-relaxed max-w-xs mx-auto">{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Interview Coach callout -->
    <section class="py-24 px-6">
      <div class="max-w-5xl mx-auto">
        <div class="relative rounded-3xl overflow-hidden border border-[#6ee76e]/15
                    bg-gradient-to-br from-[#0a1a0a] to-[#05070a] p-10 sm:p-14">
          <div class="absolute inset-0 pointer-events-none
                      bg-[radial-gradient(ellipse_60%_60%_at_80%_40%,rgba(96,165,250,0.06)_0%,transparent_70%)]" />
          <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <NTag type="info" :bordered="false" size="small" class="mb-5">Interview Mode</NTag>
              <h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4 leading-tight">
                Never freeze in an interview again.
              </h2>
              <p class="text-zinc-400 leading-relaxed mb-6">
                MeetingNote listens to your interviewer through your system audio and streams
                a confident, first-person answer — silently, in a private overlay only you can see.
              </p>
              <ul class="space-y-3 text-sm text-zinc-300">
                <li class="flex items-start gap-3"><span class="text-[#6ee76e] mt-0.5 shrink-0">✓</span>Real-time — response appears as the question finishes</li>
                <li class="flex items-start gap-3"><span class="text-[#6ee76e] mt-0.5 shrink-0">✓</span>Personalised from your profile — role, skills, background</li>
                <li class="flex items-start gap-3"><span class="text-[#6ee76e] mt-0.5 shrink-0">✓</span>Remembers what you've already said — no contradictions</li>
                <li class="flex items-start gap-3"><span class="text-[#6ee76e] mt-0.5 shrink-0">✓</span>Hidden from screen recording — your secret stays yours</li>
              </ul>
            </div>
            <div class="relative">
              <div class="rounded-2xl border border-white/8 bg-[#0a0a0a]/90 p-5 backdrop-blur">
                <div class="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
                  <div class="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
                  <span class="text-xs text-zinc-500 font-medium tracking-widest uppercase">Live — Interview Mode</span>
                  <span class="ml-auto text-xs text-zinc-700">● ● ●</span>
                </div>
                <p class="text-xs text-zinc-500 italic mb-3">"Tell me about a time you led a project under a tight deadline…"</p>
                <div class="h-px bg-white/5 mb-3" />
                <p class="text-sm text-[#e5e5e5] leading-relaxed">
                  In my previous role I led a three-person team to rebuild our authentication
                  service in under two weeks before a compliance audit. I started by breaking
                  the work into daily milestones and holding a short standup each morning to
                  catch blockers early. We shipped on time and passed the audit with zero findings.
                </p>
                <div class="mt-3 flex justify-end"><span class="text-xs text-zinc-600">AI · 0.8s</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Privacy & Security -->
    <section class="py-24 px-6 border-t border-white/5">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-16">
          <p class="text-xs font-semibold tracking-widest uppercase text-[#6ee76e] mb-3">Privacy & Security</p>
          <h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white">Built for sensitive conversations</h2>
          <p class="text-zinc-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
            Meetings contain your most confidential discussions. MeetingNote is designed from the ground up to keep them that way.
          </p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="p in privacyPoints" :key="p.title"
            class="flex gap-4 p-6 rounded-2xl border border-white/5 bg-white/2"
          >
            <div class="shrink-0 mt-0.5 text-[#6ee76e]">
              <component :is="p.icon" :size="22" :stroke-width="1.5" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-white mb-1.5">{{ p.title }}</h3>
              <p class="text-sm text-zinc-400 leading-relaxed">{{ p.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="py-24 px-6 border-t border-white/5">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-16">
          <p class="text-xs font-semibold tracking-widest uppercase text-[#6ee76e] mb-3">Pricing</p>
          <h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white">Simple, transparent pricing</h2>
          <p class="text-zinc-400 mt-4 text-sm">Three plans. No hidden fees. Cancel anytime.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">

          <!-- Starter -->
          <div class="rounded-2xl border border-white/5 bg-white/2 p-7 flex flex-col">
            <div class="mb-6">
              <p class="text-sm font-semibold text-zinc-400 mb-3">Starter</p>
              <div class="flex items-baseline gap-1 mb-1">
                <span class="text-4xl font-bold text-white">$9</span>
                <span class="text-zinc-500 text-sm">/month</span>
              </div>
              <p class="text-xs text-zinc-600">For occasional users · 1–2 meetings/week</p>
            </div>
            <ul class="space-y-3 text-sm text-zinc-300 flex-1 mb-7">
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span><span><strong class="text-white">5 hours</strong> of meeting analysis / month</span></li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Transcription &amp; smart extraction</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>AI chat over your notes</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Audio &amp; screen recording</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>File upload (audio &amp; video)</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Collections &amp; export</li>
              <li class="flex items-start gap-2.5"><span class="text-zinc-600 shrink-0">–</span><span class="text-zinc-600">Interview Coach</span></li>
              <li class="flex items-start gap-2.5"><span class="text-zinc-600 shrink-0">–</span><span class="text-zinc-600">Live Meeting Assistant</span></li>
            </ul>
            <NButton size="large" class="w-full" @click="router.push('/signup?plan=starter')">Get Starter</NButton>
          </div>

          <!-- Pro (highlighted) -->
          <div class="relative rounded-2xl border border-[#6ee76e]/35 bg-[#6ee76e]/4 p-7 flex flex-col">
            <div class="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span class="px-3 py-1 rounded-full text-xs font-semibold bg-[#6ee76e] text-black tracking-wide">Most popular</span>
            </div>
            <div class="mb-6">
              <p class="text-sm font-semibold text-[#6ee76e] mb-3">Pro</p>
              <div class="flex items-baseline gap-1 mb-1">
                <span class="text-4xl font-bold text-white">$20</span>
                <span class="text-zinc-500 text-sm">/month</span>
              </div>
              <p class="text-xs text-zinc-600">For regular users · daily meetings</p>
            </div>
            <ul class="space-y-3 text-sm text-zinc-300 flex-1 mb-7">
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span><span><strong class="text-white">15 hours</strong> of meeting analysis / month</span></li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Transcription &amp; smart extraction</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>AI chat over your notes</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Audio &amp; screen recording</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>File upload (audio &amp; video)</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Collections &amp; export</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Interview Coach</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Live Meeting Assistant</li>
            </ul>
            <NButton type="primary" size="large" class="w-full" @click="router.push('/signup?plan=pro')">Get Pro</NButton>
          </div>

          <!-- Power -->
          <div class="rounded-2xl border border-white/5 bg-white/2 p-7 flex flex-col">
            <div class="mb-6">
              <p class="text-sm font-semibold text-zinc-400 mb-3">Power</p>
              <div class="flex items-baseline gap-1 mb-1">
                <span class="text-4xl font-bold text-white">$45</span>
                <span class="text-zinc-500 text-sm">/month</span>
              </div>
              <p class="text-xs text-zinc-600">For heavy users · back-to-back meetings</p>
            </div>
            <ul class="space-y-3 text-sm text-zinc-300 flex-1 mb-7">
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span><span><strong class="text-white">40 hours</strong> of meeting analysis / month</span></li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Transcription &amp; smart extraction</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>AI chat over your notes</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Audio &amp; screen recording</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>File upload (audio &amp; video)</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Collections &amp; export</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Interview Coach</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Live Meeting Assistant</li>
              <li class="flex items-start gap-2.5"><span class="text-[#6ee76e] shrink-0">✓</span>Priority support</li>
            </ul>
            <NButton size="large" class="w-full" @click="router.push('/signup?plan=power')">Get Power</NButton>
          </div>
        </div>

        <p class="text-center text-xs text-zinc-600 mt-8">
          Need even more capacity? <a href="mailto:hello@meetingnote.app" class="text-zinc-400 hover:text-white transition-colors">Contact us</a> for a custom plan.
        </p>
      </div>
    </section>

    <!-- Download -->
    <section id="download" class="py-24 px-6 border-t border-white/5">
      <div class="max-w-3xl mx-auto text-center">
        <p class="text-xs font-semibold tracking-widest uppercase text-[#6ee76e] mb-3">Download</p>
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">Get MeetingNote</h2>
        <p class="text-zinc-400 text-sm mb-12 leading-relaxed max-w-xl mx-auto">
          Free to download. Sign up for a plan inside the app to unlock AI features.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-10">
          <!-- Windows -->
          <a
            :href="DOWNLOAD_WINDOWS"
            class="group flex flex-col items-center gap-4 p-8 rounded-2xl border border-white/5 bg-white/2
                   hover:border-[#6ee76e]/30 hover:bg-white/4 transition-all duration-300 no-underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" class="text-[#6ee76e]">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.549H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
            </svg>
            <div>
              <p class="text-white font-semibold mb-1">Windows</p>
              <p class="text-xs text-zinc-500">Windows 10 / 11 · 64-bit</p>
            </div>
            <NButton type="primary" size="medium" class="w-full">
              <template #icon><Download :size="14" /></template>
              Download .exe
            </NButton>
          </a>

          <!-- macOS -->
          <div class="flex flex-col items-center gap-4 p-8 rounded-2xl border border-white/5 bg-white/2 opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" class="text-zinc-500">
              <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
            </svg>
            <div class="text-center">
              <p class="text-zinc-400 font-semibold mb-1">macOS</p>
              <p class="text-xs text-zinc-600">macOS 12+ · Apple Silicon &amp; Intel</p>
            </div>
            <div class="w-full py-2 px-4 rounded-lg border border-white/10 text-center text-sm text-zinc-500">
              Coming Soon
            </div>
          </div>
        </div>

        <p class="text-xs text-zinc-600">
          Current version: <span class="text-zinc-500">v1.0.0</span> ·
          <a href="mailto:hello@meetingnote.app" class="text-zinc-400 hover:text-white transition-colors">Report an issue</a>
        </p>
      </div>
    </section>

    <!-- FAQ -->
    <section class="py-24 px-6 border-t border-white/5">
      <div class="max-w-2xl mx-auto">
        <div class="text-center mb-16">
          <p class="text-xs font-semibold tracking-widest uppercase text-[#6ee76e] mb-3">FAQ</p>
          <h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white">Common questions</h2>
        </div>
        <div class="space-y-2">
          <div
            v-for="(faq, i) in faqs" :key="i"
            class="rounded-xl border border-white/5 bg-white/2 overflow-hidden"
          >
            <button
              class="w-full flex items-center justify-between px-5 py-4 text-left"
              @click="openFaq = openFaq === i ? null : i"
            >
              <span class="text-sm font-medium text-white">{{ faq.q }}</span>
              <span class="text-zinc-500 ml-4 shrink-0 transition-transform duration-200"
                    :style="{ transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)' }">+</span>
            </button>
            <div v-if="openFaq === i" class="px-5 pb-4">
              <p class="text-sm text-zinc-400 leading-relaxed">{{ faq.a }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section id="waitlist" class="py-28 px-6 border-t border-white/5">
      <div class="max-w-xl mx-auto text-center">
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">Ready to get started?</h2>
        <p class="text-zinc-400 mb-10 leading-relaxed">Download the app and pick a plan in minutes.</p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <NButton type="primary" size="large" class="px-8" @click="scrollTo('download')">
            <template #icon><Download :size="16" /></template>
            Download MeetingNote
          </NButton>
          <RouterLink to="/signup">
            <NButton size="large" class="px-8">Create Account</NButton>
          </RouterLink>
        </div>
        <p class="text-xs text-zinc-600">Or join the waitlist to be notified of new features:</p>
        <form class="flex flex-col sm:flex-row gap-3 justify-center mt-4" @submit="joinWaitlist">
          <NInputGroup>
            <NInput v-model:value="email" placeholder="you@company.com" size="large" :disabled="joined || submitting" />
            <NButton type="primary" size="large" :loading="submitting" :disabled="joined || !email.trim()" attr-type="submit">
              {{ joined ? '✓ You\'re in!' : 'Notify Me' }}
            </NButton>
          </NInputGroup>
        </form>
        <p v-if="errorMsg" class="text-sm text-red-400 mt-3">{{ errorMsg }}</p>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-white/5 py-8 px-6">
      <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-1.5">
          <span class="text-[#6ee76e] font-bold">Meeting</span>
          <span class="text-white font-bold">Note</span>
        </div>
        <div class="flex items-center gap-6 text-xs text-zinc-600">
          <a href="#" class="hover:text-zinc-400 transition-colors">Privacy</a>
          <a href="#" class="hover:text-zinc-400 transition-colors">Terms</a>
          <a href="mailto:hello@meetingnote.app" class="hover:text-zinc-400 transition-colors">Contact</a>
        </div>
        <p class="text-xs text-zinc-600">© {{ new Date().getFullYear() }} MeetingNote. All rights reserved.</p>
      </div>
    </footer>

  </div>
</template>

<style scoped>
html {
  scroll-behavior: smooth;
}

section[id] {
  scroll-margin-top: 72px;
}
</style>
