import path from 'path'
import fs from 'fs'

const TELUGU_REGEX = /[ఀ-౿]/

export function setupFonts(doc: PDFKit.PDFDocument) {
  const fp = path.join(process.cwd(), 'public', 'fonts')
  const hasNoto = fs.existsSync(path.join(fp, 'NotoSans-Regular.ttf'))
  const hasTe = fs.existsSync(path.join(fp, 'NotoSansTelugu-Regular.ttf'))
  if (hasNoto) { doc.registerFont('NotoSans', path.join(fp, 'NotoSans-Regular.ttf')); doc.registerFont('NotoSans-Bold', path.join(fp, 'NotoSans-Bold.ttf')) }
  if (hasTe) doc.registerFont('NotoTelugu', path.join(fp, 'NotoSansTelugu-Regular.ttf'))
  return {
    regular: hasNoto ? 'NotoSans' : 'Helvetica',
    bold: hasNoto ? 'NotoSans-Bold' : 'Helvetica-Bold',
    telugu: hasTe ? 'NotoTelugu' : (hasNoto ? 'NotoSans' : 'Helvetica'),
  }
}

export function splitMixed(text: string): { text: string; telugu: boolean }[] {
  const segments: { text: string; telugu: boolean }[] = []
  let current = ''
  let currentTelugu = false
  for (const char of text) {
    const isTe = TELUGU_REGEX.test(char)
    if (current && isTe !== currentTelugu) { segments.push({ text: current, telugu: currentTelugu }); current = '' }
    current += char; currentTelugu = isTe
  }
  if (current) segments.push({ text: current, telugu: currentTelugu })
  return segments
}

export function drawMixedText(doc: PDFKit.PDFDocument, fonts: { regular: string; telugu: string }, text: string, x: number, y: number, opts?: { width?: number }) {
  const segments = splitMixed(text)
  if (!segments.some(s => s.telugu)) {
    doc.font(fonts.regular).text(text, x, y, opts)
    return
  }
  let cx = x
  const maxW = opts?.width || 500
  for (const seg of segments) {
    doc.font(seg.telugu ? fonts.telugu : fonts.regular)
    const w = doc.widthOfString(seg.text)
    if (cx + w > x + maxW) break
    doc.text(seg.text, cx, y, { width: maxW - (cx - x), lineBreak: false })
    cx += w
  }
}

export function drawInfoRow(doc: PDFKit.PDFDocument, fonts: { regular: string; bold: string; telugu: string }, label: string, value: string, y: number, margin: number, width: number) {
  doc.font(fonts.regular).fontSize(9).fillColor('#666666').text(label, margin, y)
  drawMixedText(doc, fonts, value, margin + width * 0.4, y, { width: width * 0.6 })
  doc.fillColor('#333333')
}

export function fmtPaise(paise: number): string {
  const r = paise / 100
  if (r === Math.floor(r)) return `Rs.${Math.floor(r).toLocaleString('en-IN')}`
  return `Rs.${r.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

export function fmtDate(iso: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
