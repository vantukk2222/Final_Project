interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
}

interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

class CloudinaryService {
  private config: CloudinaryConfig;

  constructor() {
    // Thay đổi thông tin này theo config Cloudinary của bạn
    this.config = {
      cloudName: 'djlhfgzbw', // Thay bằng cloud name của bạn
      uploadPreset: 'chatapp', // Thay bằng upload preset của bạn
    };
  }

  /**
   * Upload single image to Cloudinary
   * @param imageUri Local file URI from image picker
   * @param folder Optional folder name in Cloudinary
   * @returns Promise with image URL and metadata
   */
  async uploadImage(
    imageUri: string,
    folder?: string,
  ): Promise<CloudinaryUploadResponse> {
    try {
      const formData = new FormData();

      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg', // hoặc dùng `mime.lookup(imageUri)`
        name: `image_${Date.now()}.jpg`,
      } as any);

      formData.append('upload_preset', this.config.uploadPreset);
      if (folder) {
        formData.append('folder', folder);
      }

      // XÓA headers
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      const responseText = await response.text();
      console.log('Cloudinary raw response:', responseText);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error('Failed to upload image');
    }
  }

  /**
   * Upload multiple images to Cloudinary
   * @param imageUris Array of local file URIs
   * @param folder Optional folder name in Cloudinary
   * @returns Promise with array of image URLs and metadata
   */
  async uploadMultipleImages(
    imageUris: string[],
    folder?: string,
  ): Promise<CloudinaryUploadResponse[]> {
    try {
      const uploadPromises = imageUris.map(uri =>
        this.uploadImage(uri, folder),
      );
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Multiple upload error:', error);
      throw new Error('Failed to upload multiple images');
    }
  }

  /**
   * Delete image from Cloudinary
   * @param publicId Public ID of the image to delete
   * @returns Promise with deletion result
   */
  async deleteImage(_publicId: string): Promise<boolean> {
    try {
      // Note: For security, deletion should be done from backend
      // This is a placeholder for client-side reference
      console.warn('Image deletion should be handled on backend for security');
      return true;
    } catch (error) {
      console.error('Delete image error:', error);
      return false;
    }
  }

  /**
   * Generate optimized image URL with transformations
   * @param publicId Public ID of the image
   * @param width Desired width
   * @param height Desired height
   * @param quality Image quality (auto, 100, 80, etc.)
   * @returns Optimized image URL
   */
  getOptimizedImageUrl(
    publicId: string,
    width?: number,
    height?: number,
    quality: string = 'auto',
  ): string {
    let transformation = `q_${quality},f_auto`;

    if (width && height) {
      transformation += `,w_${width},h_${height},c_fill`;
    } else if (width) {
      transformation += `,w_${width},c_scale`;
    } else if (height) {
      transformation += `,h_${height},c_scale`;
    }

    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/${transformation}/${publicId}`;
  }

  /**
   * Generate thumbnail URL
   * @param publicId Public ID of the image
   * @returns Thumbnail URL
   */
  getThumbnailUrl(publicId: string): string {
    return this.getOptimizedImageUrl(publicId, 150, 150);
  }

  /**
   * Extract public ID from Cloudinary URL
   * @param url Cloudinary image URL
   * @returns Public ID
   */
  extractPublicId(url: string): string {
    const matches = url.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : '';
  }
}

export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;
