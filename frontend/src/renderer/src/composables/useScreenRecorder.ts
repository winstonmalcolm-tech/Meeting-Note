import { ref } from 'vue'

export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
}

// Module-level state — survives tab navigation
const isRecording = ref(false)
const isPaused = ref(false)
const duration = ref(0)
const activeSourceName = ref('')
const activeSourceType = ref<'screen' | 'window'>('screen')
const activeWithMic = ref(true)

let mediaRecorder: MediaRecorder | null = null
let screenStream: MediaStream | null = null
let micStream: MediaStream | null = null
let audioCtx: AudioContext | null = null
let durationTimer: ReturnType<typeof setInterval> | null = null
let overlayCommandCleanup: (() => void) | null = null
const chunks: Blob[] = []

function pushOverlayState(): void {
  window.api.updateOverlayState({ duration: duration.value, isPaused: isPaused.value })
}

function startDurationTimer(): void {
  durationTimer = setInterval(() => {
    duration.value++
    pushOverlayState()
  }, 1000)
}

function stopDurationTimer(): void {
  if (durationTimer !== null) { clearInterval(durationTimer); durationTimer = null }
}

export function useScreenRecorder() {
  async function startRecording(source: DesktopSource, withMic: boolean, onStopped: (blob: Blob) => Promise<void>): Promise<void> {
    screenStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      } as MediaTrackConstraints,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          minWidth: 1280,
          maxWidth: 3840,
          minHeight: 720,
          maxHeight: 2160
        }
      } as MediaTrackConstraints
    })

    const videoTracks = screenStream.getVideoTracks()
    const systemAudioTracks = screenStream.getAudioTracks()

    audioCtx = new AudioContext()
    const destination = audioCtx.createMediaStreamDestination()

    if (systemAudioTracks.length > 0) {
      audioCtx.createMediaStreamSource(new MediaStream(systemAudioTracks)).connect(destination)
    }

    if (withMic) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        })
        audioCtx.createMediaStreamSource(micStream).connect(destination)
      } catch {
        console.warn('Microphone unavailable, continuing without mic')
      }
    }

    const combinedStream = new MediaStream([
      ...videoTracks,
      ...destination.stream.getAudioTracks()
    ])

    const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')
      ? 'video/webm; codecs=vp9,opus'
      : 'video/webm'

    mediaRecorder = new MediaRecorder(combinedStream, { mimeType })
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    mediaRecorder.start(1000)

    isRecording.value = true
    isPaused.value = false
    duration.value = 0
    activeSourceName.value = source.name
    activeSourceType.value = source.id.startsWith('screen:') ? 'screen' : 'window'
    activeWithMic.value = withMic
    startDurationTimer()

    // Show overlay and wire up its commands
    window.api.showOverlay()
    pushOverlayState()

    overlayCommandCleanup = window.api.onOverlayCommand(async (cmd: 'pause' | 'stop') => {
      if (cmd === 'pause') togglePause()
      if (cmd === 'stop') {
        const blob = await stopRecording()
        if (blob) await onStopped(blob)
      }
    })
  }

  function togglePause(): void {
    if (!mediaRecorder || !isRecording.value) return
    if (isPaused.value) {
      mediaRecorder.resume()
      startDurationTimer()
      isPaused.value = false
    } else {
      mediaRecorder.pause()
      stopDurationTimer()
      isPaused.value = true
    }
    pushOverlayState()
  }

  function stopRecording(): Promise<Blob | null> {
    if (!mediaRecorder || !isRecording.value) return Promise.resolve(null)

    return new Promise((resolve) => {
      mediaRecorder!.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        chunks.length = 0
        resolve(blob)
      }

      screenStream?.getTracks().forEach((t) => t.stop())
      micStream?.getTracks().forEach((t) => t.stop())
      audioCtx?.close()
      stopDurationTimer()

      screenStream = null
      micStream = null
      isRecording.value = false
      isPaused.value = false

      overlayCommandCleanup?.()
      overlayCommandCleanup = null
      window.api.hideOverlay()

      mediaRecorder!.stop()
    })
  }

  return {
    isRecording, isPaused, duration,
    activeSourceName, activeSourceType, activeWithMic,
    startRecording, togglePause, stopRecording
  }
}
