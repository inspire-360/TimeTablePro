import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

async function waitForImages(sourceElement) {
  const images = Array.from(sourceElement.querySelectorAll('img'));

  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        }),
    ),
  );
}

export async function generateTimetablePdf({ fileName, sourceElement }) {
  if (!sourceElement) {
    throw new Error('A rendered timetable preview is required before generating the PDF.');
  }

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  await waitForImages(sourceElement);

  const canvas = await html2canvas(sourceElement, {
    backgroundColor: '#ffffff',
    logging: false,
    scale: 2,
    useCORS: true,
  });
  const pdf = new jsPDF({
    format: 'a4',
    orientation: 'landscape',
    unit: 'mm',
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;
  const sliceHeight = Math.floor((printableHeight * canvas.width) / printableWidth);
  let renderedHeight = 0;
  let pageIndex = 0;

  while (renderedHeight < canvas.height) {
    const currentSliceHeight = Math.min(sliceHeight, canvas.height - renderedHeight);
    const pageCanvas = document.createElement('canvas');

    pageCanvas.width = canvas.width;
    pageCanvas.height = currentSliceHeight;

    const context = pageCanvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to create the PDF page canvas.');
    }

    context.drawImage(
      canvas,
      0,
      renderedHeight,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      canvas.width,
      currentSliceHeight,
    );

    const imageData = pageCanvas.toDataURL('image/png');
    const imageHeight = (currentSliceHeight * printableWidth) / canvas.width;

    if (pageIndex > 0) {
      pdf.addPage('a4', 'landscape');
    }

    pdf.addImage(imageData, 'PNG', margin, margin, printableWidth, imageHeight, undefined, 'FAST');

    renderedHeight += currentSliceHeight;
    pageIndex += 1;
  }

  pdf.save(fileName);
}
