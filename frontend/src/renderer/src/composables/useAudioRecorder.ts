import { ref, onUnmounted } from 'vue'

export function useAudioRecorder() {
  const isRecording = ref(false)
  const isPaused = ref(false)
  const duration = ref(0)
  const audioLevel = ref(0)
  const captureSystem = ref(true)

  let micStream: MediaStream | null = null
  let systemStream: MediaStream | null = null
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let durationTimer: ReturnType<typeof setInterval> | null = null
  let levelFrame: number | null = null
  let mediaRecorder: MediaRecorder | null = null
  const chunks: Blob[] = []

  async function startRecording(): Promise<void> {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      })

      audioCtx = new AudioContext()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      const destination = audioCtx.createMediaStreamDestination()

      const micSource = audioCtx.createMediaStreamSource(micStream)
      micSource.connect(analyser)
      micSource.connect(destination)

      if (captureSystem.value) {
        try {
          const sources = await window.api.getDesktopSources()
          // Filter for actual screen sources (not windows) for system audio capture
          const screen = sources.find((s) => s.id.startsWith('screen:')) ?? sources[0]
          if (screen) {
            const sysStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: screen.id
                }
              } as MediaTrackConstraints,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: screen.id
                }
              } as MediaTrackConstraints
            })
            sysStream.getVideoTracks().forEach((t) => t.stop())
            if (sysStream.getAudioTracks().length > 0) {
              systemStream = sysStream
              audioCtx.createMediaStreamSource(sysStream).connect(destination)
            } else {
              sysStream.getTracks().forEach((t) => t.stop())
            }
          }
        } catch (sysErr) {
          console.warn('System audio unavailable, mic-only:', sysErr)
        }
      }

      mediaRecorder = new MediaRecorder(destination.stream)
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      mediaRecorder.start(1000)

      isRecording.value = true
      isPaused.value = false
      duration.value = 0

      durationTimer = setInterval(() => { duration.value++ }, 1000)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      function tick() {
        analyser!.getByteFrequencyData(dataArray)
        audioLevel.value = dataArray.reduce((a, b) => a + b, 0) / (dataArray.length * 255)
        levelFrame = requestAnimationFrame(tick)
      }
      tick()
    } catch (err) {
      console.error('Microphone access denied or unavailable:', err)
    }
  }

  function togglePause(): void {
    if (!mediaRecorder || !isRecording.value) return

    if (isPaused.value) {
      mediaRecorder.resume()
      durationTimer = setInterval(() => { duration.value++ }, 1000)
      const dataArray = new Uint8Array(analyser!.frequencyBinCount)
      function tick() {
        analyser!.getByteFrequencyData(dataArray)
        audioLevel.value = dataArray.reduce((a, b) => a + b, 0) / (dataArray.length * 255)
        levelFrame = requestAnimationFrame(tick)
      }
      tick()
      isPaused.value = false
    } else {
      mediaRecorder.pause()
      if (durationTimer !== null) { clearInterval(durationTimer); durationTimer = null }
      if (levelFrame !== null) { cancelAnimationFrame(levelFrame); levelFrame = null }
      audioLevel.value = 0
      isPaused.value = true
    }
  }

  // Returns a Promise that resolves only after onstop fires — guaranteeing
  // the final ondataavailable chunk is included in the blob before we return.
  function stopRecording(): Promise<Blob | null> {
    if (!mediaRecorder || !isRecording.value) return Promise.resolve(null)

    return new Promise((resolve) => {
      mediaRecorder!.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        chunks.length = 0
        resolve(blob)
      }

      // Tear down streams and timers
      micStream?.getTracks().forEach((t) => t.stop())
      systemStream?.getTracks().forEach((t) => t.stop())
      audioCtx?.close()
      if (durationTimer !== null) clearInterval(durationTimer)
      if (levelFrame !== null) cancelAnimationFrame(levelFrame)

      micStream = null
      systemStream = null
      isRecording.value = false
      audioLevel.value = 0

      // stop() triggers final ondataavailable then onstop — must be last
      mediaRecorder!.stop()
    })
  }

  onUnmounted(() => stopRecording())

  return { isRecording, isPaused, duration, audioLevel, captureSystem, startRecording, stopRecording, togglePause }
}
