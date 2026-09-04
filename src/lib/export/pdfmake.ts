/**
 * Dynamically import pdfmake and register its virtual file system and the
 * embedded Courier font container. Dynamic so pdfmake's fonts/vfs never land
 * in the main bundle for users who never export a PDF.
 */
export async function loadPdfMake() {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const pdfFontsModule = await import("pdfmake/build/vfs_fonts");
  const courierFontModule = await import(
    "pdfmake/build/standard-fonts/Courier"
  );

  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const vfs = pdfFontsModule.default ?? pdfFontsModule;
  pdfMake.addVirtualFileSystem(vfs);

  const courierFont = courierFontModule.default ?? courierFontModule;
  pdfMake.addFontContainer(courierFont);

  return pdfMake;
}
