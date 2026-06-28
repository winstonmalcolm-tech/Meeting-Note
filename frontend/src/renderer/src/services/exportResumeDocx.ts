import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

function parseInline(node: Node, bold = false, italic = false): TextRun[] {
  const runs: TextRun[] = []
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? ''
      if (text) runs.push(new TextRun({ text, bold, italics: italic }))
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      runs.push(...parseInline(el, bold || tag === 'strong', italic || tag === 'em'))
    }
  }
  return runs
}

function parseBlock(el: Element): Paragraph[] {
  const tag = el.tagName.toLowerCase()

  if (tag === 'h1') {
    return [new Paragraph({ children: parseInline(el), heading: HeadingLevel.HEADING_1 })]
  }
  if (tag === 'h2') {
    return [new Paragraph({ children: parseInline(el), heading: HeadingLevel.HEADING_2 })]
  }
  if (tag === 'h3') {
    return [new Paragraph({ children: parseInline(el), heading: HeadingLevel.HEADING_3 })]
  }
  if (tag === 'p') {
    const runs = parseInline(el)
    return [new Paragraph({ children: runs.length ? runs : [new TextRun('')] })]
  }
  if (tag === 'ul') {
    return Array.from(el.querySelectorAll(':scope > li')).map((li) =>
      new Paragraph({ children: parseInline(li), bullet: { level: 0 } })
    )
  }
  if (tag === 'ol') {
    return Array.from(el.querySelectorAll(':scope > li')).map((li, i) =>
      new Paragraph({ children: [new TextRun(`${i + 1}. `), ...parseInline(li)] })
    )
  }
  return []
}

export async function exportResumeDocx(html: string, filename: string): Promise<boolean> {
  const dom = new DOMParser().parseFromString(html, 'text/html')
  const paragraphs: Paragraph[] = []

  for (const child of Array.from(dom.body.children)) {
    paragraphs.push(...parseBlock(child as Element))
  }

  if (!paragraphs.length) {
    paragraphs.push(new Paragraph({ children: [new TextRun('')] }))
  }

  const doc = new Document({ sections: [{ children: paragraphs }] })
  const blob = await Packer.toBlob(doc)
  const buffer = await blob.arrayBuffer()
  return window.api.saveDocx(buffer, filename)
}
