<script setup lang="ts">
import { darkTheme, NConfigProvider, NLayout, NLayoutSider, NLayoutContent, NMenu, type MenuOption } from 'naive-ui'
import { ref, h, computed, onMounted, onUnmounted } from 'vue'
import type { RecordingEntry, ScreenRecordingEntry, Collection } from './types'
import RecordingView from './views/RecordingView.vue'
import RecordingsView from './views/RecordingsView.vue'
import RecordingDetailView from './views/RecordingDetailView.vue'
import ScreenRecordingView from './views/ScreenRecordingView.vue'
import ScreenRecordingsListView from './views/ScreenRecordingsListView.vue'
import ScreenRecordingDetailView from './views/ScreenRecordingDetailView.vue'
import LiveAssistantView from './views/LiveAssistantView.vue'
import CareerView from './views/CareerView.vue'
import CollectionsView from './views/CollectionsView.vue'
import CollectionDetailView from './views/CollectionDetailView.vue'
import SettingsView from './views/SettingsView.vue'
import ProfileView from './views/ProfileView.vue'
import ElectronLoginView from './views/ElectronLoginView.vue'
import UploadView from './views/UploadView.vue'
import { isAuthenticated, fetchCurrentPlan, fetchPendingNotifications, markNotificationsRead } from './services/api'
import { Lock, Sun, Moon } from '@lucide/vue'
import { useTheme } from './composables/useTheme'

const { isDark, toggle: toggleTheme } = useTheme()
const naiveTheme = computed(() => isDark.value ? darkTheme : null)

const authenticated = ref(isAuthenticated())

const userPlan = ref<string | null>(null)
const liveIsLocked = computed(() => userPlan.value !== 'pro' && userPlan.value !== 'power')
const careerIsLocked = computed(() => userPlan.value !== 'pro' && userPlan.value !== 'power')

async function refreshPlan() {
  if (!isAuthenticated()) return
  const { plan, planStatus } = await fetchCurrentPlan()
  userPlan.value = planStatus === 'active' ? plan : null
}

function openUpgradePage() {
  const webUrl = import.meta.env.VITE_WEB_URL ?? 'http://localhost:5173'
  window.api.openExternal(`${webUrl}/dashboard`)
}

async function checkNotifications() {
  if (!isAuthenticated()) return
  try {
    const pending = await fetchPendingNotifications()
    if (pending.length === 0) return
    for (const n of pending) {
      if (Notification.permission === 'granted') {
        new Notification(n.title, { body: n.body, silent: false })
      }
    }
    await markNotificationsRead(pending.map((n) => n.id))
  } catch { /* best-effort */ }
}

onMounted(() => {
  void refreshPlan()
  void checkNotifications()
  window.addEventListener('focus', refreshPlan)
  window.addEventListener('focus', checkNotifications)
})

onUnmounted(() => {
  window.removeEventListener('focus', refreshPlan)
  window.removeEventListener('focus', checkNotifications)
})

const sidebarCollapsed = ref(false)
const activeKey = ref('audio')
const selectedRecording = ref<RecordingEntry | null>(null)
const selectedScreenRecording = ref<ScreenRecordingEntry | null>(null)
const selectedCollection = ref<Collection | null>(null)
const audioTab = ref<'record' | 'list'>('record')
const screenTab = ref<'record' | 'list'>('record')

function openScreenRecording(rec: ScreenRecordingEntry) {
  selectedScreenRecording.value = rec
}

function closeScreenRecording() {
  selectedScreenRecording.value = null
}

function onScreenSaved() {
  screenTab.value = 'list'
}

const menuOptions = computed((): MenuOption[] => [
  { label: 'Audio', key: 'audio' },
  { label: 'Upload', key: 'upload' },
  { label: 'Screen', key: 'screen' },
  {
    key: 'live',
    label: () => h('span', { style: 'display:flex;align-items:center;gap:6px;' }, [
      'Live',
      liveIsLocked.value
        ? h(Lock, { size: 10, title: 'Pro or Power plan required', style: 'color: var(--color-text-muted); flex-shrink: 0;' })
        : null
    ])
  },
  { label: 'Collections', key: 'collections' },
  {
    key: 'career',
    label: () => h('span', { style: 'display:flex;align-items:center;gap:6px;' }, [
      'Career',
      careerIsLocked.value
        ? h(Lock, { size: 10, title: 'Pro or Power plan required', style: 'color: var(--color-text-muted); flex-shrink: 0;' })
        : null
    ])
  },
  { type: 'divider', key: 'div' },
  { label: 'Profile', key: 'profile' },
  { label: 'Settings', key: 'settings' }
])
</script>

<template>
  <NConfigProvider :theme="naiveTheme" style="height: 100%">
    <ElectronLoginView v-if="!authenticated" @authenticated="() => { authenticated = true; void refreshPlan() }" />
    <NLayout v-else has-sider style="height: 100%">
      <NLayoutSider
        :width="220"
        :collapsed="sidebarCollapsed"
        :collapsed-width="0"
        collapse-mode="width"
        show-trigger="arrow-circle"
        bordered
        content-style="display: flex; flex-direction: column;"
        @update:collapsed="(v: boolean) => sidebarCollapsed = v"
      >
        <div class="px-4 py-5 flex items-center justify-between">
          <span class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-text-muted)">
            MeetingNote
          </span>
          <button
            class="flex items-center justify-center w-6 h-6 rounded transition-colors"
            style="background: transparent; border: none; cursor: pointer; color: var(--color-text-muted);"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >
            <Sun v-if="isDark" :size="13" />
            <Moon v-else :size="13" />
          </button>
        </div>
        <NMenu v-model:value="activeKey" :options="menuOptions" :indent="20" />
      </NLayoutSider>

      <NLayout>
        <NLayoutContent style="height: 100%; overflow: hidden;">
          <!-- Audio -->
          <template v-if="activeKey === 'audio'">
            <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">
              <div v-if="!selectedRecording" class="flex gap-1 px-4 pt-3 pb-0 shrink-0">
                <button
                  v-for="tab in [{ key: 'record', label: 'Record' }, { key: 'list', label: 'Past Recordings' }]"
                  :key="tab.key"
                  class="px-3 py-1.5 rounded-t text-xs font-medium transition-colors"
                  :style="{
                    background: audioTab === tab.key ? 'var(--color-bg-surface)' : 'transparent',
                    color: audioTab === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
                    borderBottom: audioTab === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent'
                  }"
                  @click="audioTab = tab.key as 'record' | 'list'"
                >
                  {{ tab.label }}
                </button>
              </div>
              <div style="flex: 1; overflow: hidden; border-top: 1px solid var(--color-border-subtle);">
                <RecordingDetailView
                  v-if="selectedRecording"
                  :recording="selectedRecording"
                  @back="selectedRecording = null"
                  @updated="(r) => selectedRecording = r"
                />
                <RecordingView v-else-if="audioTab === 'record'" />
                <RecordingsView
                  v-else
                  @select="(r) => { selectedRecording = r; audioTab = 'list' }"
                />
              </div>
            </div>
          </template>

          <!-- Upload -->
          <template v-else-if="activeKey === 'upload'">
            <UploadView
              @saved="(entry) => { selectedRecording = entry; audioTab = 'list'; activeKey = 'audio' }"
              @video-saved="(entry) => { selectedScreenRecording = entry; screenTab = 'list'; activeKey = 'screen' }"
            />
          </template>

          <!-- Screen -->
          <template v-else-if="activeKey === 'screen'">
            <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">
              <div class="flex gap-1 px-4 pt-3 pb-0 shrink-0">
                <button
                  v-for="tab in [{ key: 'record', label: 'Record' }, { key: 'list', label: 'Past Recordings' }]"
                  :key="tab.key"
                  class="px-3 py-1.5 rounded-t text-xs font-medium transition-colors"
                  :style="{
                    background: screenTab === tab.key ? 'var(--color-bg-surface)' : 'transparent',
                    color: screenTab === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
                    borderBottom: screenTab === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent'
                  }"
                  @click="screenTab = tab.key as 'record' | 'list'"
                >
                  {{ tab.label }}
                </button>
              </div>
              <div style="flex: 1; overflow: hidden; border-top: 1px solid var(--color-border-subtle);">
                <ScreenRecordingView
                  v-if="screenTab === 'record'"
                  @saved="onScreenSaved"
                />
                <template v-else>
                  <ScreenRecordingDetailView
                    v-if="selectedScreenRecording"
                    :recording="selectedScreenRecording"
                    @back="closeScreenRecording"
                    @updated="(r) => selectedScreenRecording = r"
                  />
                  <ScreenRecordingsListView
                    v-else
                    @select="openScreenRecording"
                  />
                </template>
              </div>
            </div>
          </template>

          <template v-else-if="activeKey === 'live'">
            <div v-if="liveIsLocked" class="flex flex-col items-center justify-center h-full gap-4" style="color: var(--color-text-muted)">
              <Lock :size="48" style="color: var(--color-text-muted)" />
              <div class="text-center">
                <p class="text-sm font-semibold" style="color: var(--color-text)">Live Assistant is a Pro feature</p>
                <p class="text-xs mt-1" style="color: var(--color-text-muted)">Upgrade to Pro or Power to access real-time AI assistance.</p>
              </div>
              <button
                class="mt-1 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                style="background: var(--color-accent); color: var(--color-accent-fg);"
                @click="openUpgradePage"
              >
                Upgrade to Pro
              </button>
            </div>
            <LiveAssistantView v-else />
          </template>

          <!-- Career -->
          <template v-else-if="activeKey === 'career'">
            <div v-if="careerIsLocked" class="flex flex-col items-center justify-center h-full gap-4" style="color: var(--color-text-muted)">
              <Lock :size="48" style="color: var(--color-text-muted)" />
              <div class="text-center">
                <p class="text-sm font-semibold" style="color: var(--color-text)">Career Tools are a Pro feature</p>
                <p class="text-xs mt-1" style="color: var(--color-text-muted)">Upgrade to Pro or Power to access resume analysis, cover letters, JD decoding, and LinkedIn optimization.</p>
              </div>
              <button
                class="mt-1 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                style="background: var(--color-accent); color: var(--color-accent-fg);"
                @click="openUpgradePage"
              >
                Upgrade to Pro
              </button>
            </div>
            <CareerView v-else />
          </template>

          <!-- Collections -->
          <template v-else-if="activeKey === 'collections'">
            <CollectionDetailView
              v-if="selectedCollection"
              :collection="selectedCollection"
              @back="selectedCollection = null"
              @updated="(c) => selectedCollection = c"
            />
            <CollectionsView
              v-else
              @select="(c) => selectedCollection = c"
            />
          </template>

          <ProfileView v-else-if="activeKey === 'profile'" />
          <SettingsView v-else-if="activeKey === 'settings'" />
          <div
            v-else
            class="flex items-center justify-center h-full text-sm"
            style="color: var(--color-text-muted)"
          >
            Coming soon
          </div>
        </NLayoutContent>
      </NLayout>
    </NLayout>
  </NConfigProvider>
</template>
