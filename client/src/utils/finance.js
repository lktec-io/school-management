import { api, saveBlob } from '../api/client.js';

/** Download the official PDF receipt for a payment. */
export async function downloadReceipt(payment) {
  const blob = await api.blob(`/finance/payments/${payment.id}/receipt-pdf`);
  saveBlob(blob, `receipt-${String(payment.receiptNo).toLowerCase()}.pdf`);
}

/** Build and download a CSV file from rows of plain values. */
export function downloadCsv(fileName, header, rows) {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  // Byte-order mark so Excel opens UTF-8 names (e.g. Swahili/Arabic) correctly.
  saveBlob(new Blob([String.fromCharCode(0xfeff), csv], { type: 'text/csv;charset=utf-8' }), fileName);
}
