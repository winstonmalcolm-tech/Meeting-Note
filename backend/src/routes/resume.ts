import { Router } from 'express'
import multer from 'multer'
import { createRequire } from 'module'
import mammoth from 'mammoth'
import { authMiddleware } from '../middleware/auth'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

router.post('/career/resume/parse', authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const mime = file.mimetype
    const name = file.originalname.toLowerCase()
    let text = ''

    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      const result = await pdfParse(file.buffer)
      text = result.text
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer })
      text = result.value
    } else {
      res.status(400).json({ error: 'Only PDF and DOCX files are supported' })
      return
    }

    // Collapse excessive whitespace while preserving paragraph breaks
    text = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

    if (!text) {
      res.status(422).json({ error: 'Could not extract text from file. Try copying the text manually.' })
      return
    }

    res.json({ text })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to parse file' })
  }
})

export default router
