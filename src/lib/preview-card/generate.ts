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
