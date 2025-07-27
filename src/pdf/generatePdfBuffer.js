import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

function sanitizeText(text) {
  // Remove all non-ASCII characters
  return String(text).replace(/[^\x00-\x7F]/g, '');
}

export async function generatePdfBuffer(reservation) {
  const {
    id,
    service,
    date,
    time,
    user_name,
    user_email
  } = reservation;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();

  const drawText = (text, x, y, size = 12) => {
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    });
  };

  // Title (no emoji!)
  drawText('Barber Time Reservation Confirmation', 50, height - 60, 18);

  // User & Booking Info
  drawText(`Reservation ID: ${sanitizeText(id)}`, 50, height - 100);
  drawText(`Customer Name: ${sanitizeText(user_name || '—')}`, 50, height - 120);
  drawText(`Customer Email: ${sanitizeText(user_email)}`, 50, height - 140);
  drawText(`Service: ${sanitizeText(service)}`, 50, height - 160);
  drawText(`Date: ${sanitizeText(date)}`, 50, height - 180);
  drawText(`Time: ${sanitizeText(time)}`, 50, height - 200);

  drawText(`Your reservation is confirmed.`, 50, height - 240, 14);
  drawText(`Please arrive 10 minutes early.`, 50, height - 260, 10);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
