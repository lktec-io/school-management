import logger from './logger.js';

/**
 * Stream a PDFKit document as the HTTP response. All data must be loaded before calling,
 * so failures surface as normal JSON errors rather than truncated PDFs.
 * `?disposition=inline` lets the browser preview instead of downloading.
 */
export function streamPdf(req, res, doc, fileName, render) {
  const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  doc.on('error', (error) => {
    logger.error('PDF generation failed', { error: error.message });
    res.destroy(error);
  });
  doc.pipe(res);
  render(doc);
  doc.end();
}
