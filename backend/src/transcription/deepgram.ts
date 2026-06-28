import https from 'https'

const DEEPGRAM_URL =
  'https://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&punctuate=true&paragraphs=true'

export function transcribeAudio(buffer: Buffer): Promise<{ transcript: string; durationSeconds: number }> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) return Promise.reject(new Error('DEEPGRAM_API_KEY is not set'))

  return new Promise((resolve, reject) => {
    const req = https.request(
      DEEPGRAM_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'audio/webm',
          'Content-Length': buffer.length
        },
        rejectUnauthorized: true
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString()) as {
              results?: { channels?: Array<{ alternatives?: Array<{ transcript: string }> }> }
              metadata?: { duration?: number }
              err_msg?: string
            }
            if (body.err_msg) return reject(new Error(`Deepgram error: ${body.err_msg}`))
            const transcript = body.results?.channels?.[0]?.alternatives?.[0]?.transcript
            if (!transcript) return reject(new Error('Deepgram returned an empty transcript'))
            const durationSeconds = body.metadata?.duration ?? 0
            resolve({ transcript, durationSeconds })
          } catch (e) {
            reject(e)
          }
        })
      }
    )

    req.on('error', reject)
    req.write(buffer)
    req.end()
  })
}
