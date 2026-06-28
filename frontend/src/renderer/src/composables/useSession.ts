import { ref, toRaw } from 'vue'
import type { ExtractionResult, SessionStatus } from '../types'
import { transcribeAudio, extractRequirements } from '../services/api'
import { useSettings } from './useSettings'

const status = ref<SessionStatus>('idle')
const transcript = ref('')
const extraction = ref<ExtractionResult | null>(null)
const error = ref('')

export function useSession() {
  const { provider } = useSettings()

  async function process(audioBlob: Blob, recordingId?: string): Promise<void> {
    error.value = ''
    transcript.value = ''
    extraction.value = null

    try {
      status.value = 'transcribing'
      transcript.value = await transcribeAudio(audioBlob)

      status.value = 'extracting'
      extraction.value = await extractRequirements(transcript.value)

      status.value = 'done'

      if (recordingId) {
        await window.api.updateRecording(recordingId, {
          status: 'processed',
          provider: provider.value,
          transcript: transcript.value,
          extraction: toRaw(extraction.value)
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Processing failed'
      status.value = 'error'

      if (recordingId) {
        await window.api.updateRecording(recordingId, {
          status: 'error',
          errorMessage: error.value
        })
      }
    }
  }

  function loadFromRecording(entry: { transcript?: string; extraction?: ExtractionResult }) {
    transcript.value = entry.transcript ?? ''
    extraction.value = entry.extraction ?? null
    status.value = entry.transcript ? 'done' : 'idle'
    error.value = ''
  }

  return { status, transcript, extraction, error, process, loadFromRecording }
}
