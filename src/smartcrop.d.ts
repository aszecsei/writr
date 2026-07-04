declare module "smartcrop" {
  export interface CropOptions {
    width: number;
    height: number;
  }

  export interface Crop {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface CropResult {
    topCrop: Crop;
  }

  export function crop(
    image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    options: CropOptions,
  ): Promise<CropResult>;

  const smartcrop: { crop: typeof crop };
  export default smartcrop;
}
