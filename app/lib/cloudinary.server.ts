import { v2 as cloudinary } from "cloudinary";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type UploadImageResult =
  | { ok: true; secureUrl: string }
  | { ok: false; error: string };

function configureCloudinary() {
  if (process.env.CLOUDINARY_URL) return true;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) return false;

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  return true;
}

export async function uploadImageToCloudinary(
  file: FormDataEntryValue | null,
  folder: string,
): Promise<UploadImageResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: true, secureUrl: "" };
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Choose a JPG, PNG, WebP, or GIF image.",
    };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: "Image must be 5 MB or smaller.",
    };
  }

  if (!configureCloudinary()) {
    return {
      ok: false,
      error: "Cloudinary uploads are not configured.",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const upload = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        },
        (error, result) => {
          if (error || !result?.secure_url) {
            reject(error ?? new Error("Cloudinary did not return an image URL."));
            return;
          }

          resolve({ secure_url: result.secure_url });
        },
      );

      stream.end(buffer);
    });

    return { ok: true, secureUrl: upload.secure_url };
  } catch (error) {
    console.error("[cloudinary] Image upload failed:", error);
    return {
      ok: false,
      error: "Image upload failed. Please try again.",
    };
  }
}
