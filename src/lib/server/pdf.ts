/**
 * PDF text extraction (server-side).
 *
 * Uses the pdfjs legacy build so it runs in Node without a DOM. Only text is
 * read — no rendering, no fonts — which keeps it fast and dependency-light.
 */

export type ExtractedPdf = { text: string; pageCount: number };

export async function extractPdfText(buffer: ArrayBuffer): Promise<ExtractedPdf> {
  // Dynamic import keeps pdfjs out of any bundle that does not need it.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data,
    // Headless text extraction: skip fonts, eval and fetch.
    useSystemFonts: false,
    disableFontFace: true,
    useWorkerFetch: false,
  });

  const doc = await loadingTask.promise;
  const parts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      // Preserve line structure: pdfjs flags end-of-line items. Headings only
      // survive document splitting if the newlines are kept.
      const pageText = content.items
        .map((item) => {
          if (!('str' in item)) return '';
          return item.str + (item.hasEOL ? '\n' : ' ');
        })
        .join('')
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line.length > 0)
        .join('\n');
      if (pageText) parts.push(pageText);
      page.cleanup();
    }
    return { text: parts.join('\n\n'), pageCount: doc.numPages };
  } finally {
    await loadingTask.destroy();
  }
}
