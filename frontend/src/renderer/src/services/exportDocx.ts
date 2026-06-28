import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx'
import type { ExtractionResult } from '../types'

function spacer(): Paragraph {
  return new Paragraph({ text: '' })
}

function heading1(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1 })
}

function heading2(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2 })
}

function heading3(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3 })
}

function bullet(text: string): Paragraph {
  return new Paragraph({ text, bullet: { level: 0 } })
}

export async function buildDocxBuffer(extraction: ExtractionResult): Promise<ArrayBuffer> {
  const paragraphs: Paragraph[] = []

  paragraphs.push(
    new Paragraph({ text: 'Meeting Requirements', heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleString()}`,
          color: '888888',
          size: 20,
        }),
      ],
    }),
    spacer(),
  )

  if (extraction.summary) {
    paragraphs.push(heading1('Summary'), new Paragraph({ text: extraction.summary }), spacer())
  }

  if (extraction.requirements.functional.length) {
    paragraphs.push(heading1('Action Items & Requirements'))
    extraction.requirements.functional.forEach((r) => paragraphs.push(bullet(r)))
    paragraphs.push(spacer())
  }

  if (extraction.requirements.nonFunctional.length) {
    paragraphs.push(heading1('Constraints & Considerations'))
    extraction.requirements.nonFunctional.forEach((r) => paragraphs.push(bullet(r)))
    paragraphs.push(spacer())
  }

  if (extraction.features.length) {
    paragraphs.push(heading1('Features'))
    for (const feature of extraction.features) {
      paragraphs.push(heading2(feature.title), new Paragraph({ text: feature.description }))

      if (feature.dataFlow.length) {
        paragraphs.push(heading3('Data Flow'))
        feature.dataFlow.forEach((step, i) =>
          paragraphs.push(new Paragraph({ text: `${i + 1}. ${step}` })),
        )
      }

      if (feature.decisions.length) {
        paragraphs.push(heading3('Decisions'))
        feature.decisions.forEach((d) => paragraphs.push(bullet(d)))
      }

      if (feature.openQuestions.length) {
        paragraphs.push(heading3('Open Questions'))
        feature.openQuestions.forEach((q) => paragraphs.push(bullet(q)))
      }

      paragraphs.push(spacer())
    }
  }

  if (extraction.decisions.length) {
    paragraphs.push(heading1('Decisions'))
    extraction.decisions.forEach((d) => paragraphs.push(bullet(d)))
    paragraphs.push(spacer())
  }

  if (extraction.openQuestions.length) {
    paragraphs.push(heading1('Open Questions'))
    extraction.openQuestions.forEach((q) => paragraphs.push(bullet(q)))
  }

  const doc = new Document({ sections: [{ children: paragraphs }] })
  const blob = await Packer.toBlob(doc)
  return blob.arrayBuffer()
}
