import html2canvas from "html2canvas";

export async function generatePreviewImage(
  element: HTMLElement,
): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 4,
    useCORS: true,
    backgroundColor: null,
    logging: false,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to generate image"));
      }
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
