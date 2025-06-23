# Image Upload Feature Documentation

## Overview
Chức năng upload và quản lý nhiều ảnh cho Tour, Destinations, và Activities sử dụng Cloudinary.

## Components

### 1. CloudinaryService (`src/services/cloudinaryService.ts`)
Service để upload ảnh lên Cloudinary và quản lý URL ảnh.

**Chức năng chính:**
- `uploadImage()`: Upload 1 ảnh
- `uploadMultipleImages()`: Upload nhiều ảnh  
- `deleteImage()`: Xóa ảnh (cần backend)
- `getOptimizedImageUrl()`: Tạo URL ảnh tối ưu với transformations
- `getThumbnailUrl()`: Tạo URL thumbnail

**Cấu hình cần thiết:**
```typescript
// Thay đổi thông tin trong CloudinaryService constructor
{
  cloudName: 'your-cloud-name',     // Cloud name từ Cloudinary
  uploadPreset: 'your-upload-preset' // Upload preset đã cấu hình
}
```

### 2. ImagePickerComponent (`src/components/common/ImagePickerComponent.tsx`)
Component cho phép người dùng chọn, upload và quản lý nhiều ảnh.

**Props:**
- `images: string[]` - Mảng URL ảnh hiện tại
- `onImagesChange: (images: string[]) => void` - Callback khi ảnh thay đổi
- `maxImages?: number` - Số ảnh tối đa (mặc định: 5)
- `folder?: string` - Thư mục trên Cloudinary
- `title?: string` - Tiêu đề component

**Sử dụng:**
```tsx
<ImagePickerComponent
  images={images}
  onImagesChange={setImages}
  maxImages={10}
  folder="tours"
  title="Select Tour Images"
/>
```

### 3. ImageGallery (`src/components/common/ImageGallery.tsx`)
Component hiển thị gallery ảnh với modal xem toàn màn hình.

**Props:**
- `images: string[]` - Mảng URL ảnh
- `title?: string` - Tiêu đề gallery
- `maxPreviewImages?: number` - Số ảnh preview (mặc định: 4)

**Sử dụng:**
```tsx
<ImageGallery
  images={tour.images || []}
  title="Tour Gallery"
  maxPreviewImages={4}
/>
```

## Data Structure Updates

### Tour Types (`src/types/tour.ts`)
Đã thêm field `images?: string[]` vào:
- `TourItinerary` - Gallery ảnh của tour
- `Destination` - Ảnh địa điểm
- `Activity` - Ảnh hoạt động

## Integration

### 1. TourBasicInfoForm
Đã tích hợp ImagePickerComponent cho tour images:
```tsx
// Thêm props
images: string[];
onImagesChange: (images: string[]) => void;

// Sử dụng trong form
<ImagePickerComponent
  images={images}
  onImagesChange={onImagesChange}
  maxImages={10}
  folder="tours"
  title={t('tour.form.selectTourImages')}
/>
```

### 2. AddDestinationModal
Đã tích hợp ImagePickerComponent cho destination và activity images:
```tsx
// Destination images
<ImagePickerComponent
  images={destination.images || []}
  onImagesChange={(images) => setDestination({...destination, images})}
  maxImages={5}
  folder="destinations"
/>

// Activity images  
<ImagePickerComponent
  images={currentActivity.images || []}
  onImagesChange={images => setCurrentActivity({...currentActivity, images})}
  maxImages={3}
  folder="activities"
/>
```

### 3. CreateTourScreen
Đã thêm state và logic để lưu images:
```tsx
const [images, setImages] = useState<string[]>([]);

// Truyền vào TourBasicInfoForm
<TourBasicInfoForm
  // ... other props
  images={images}
  onImagesChange={setImages}
/>

// Lưu vào Firestore
const tourData = {
  // ... other fields
  images: images.length > 0 ? images : undefined,
};
```

## Localization

Đã thêm các key đa ngôn ngữ trong `src/locales/lan_en.json`:
```json
{
  "tour": {
    "form": {
      "images": "Images",
      "selectTourImages": "Select Tour Images"
    },
    "destinations": {
      "selectImages": "Select Images"
    },
    "activities": {
      "selectImages": "Select Images"
    }
  },
  "images": {
    "addImages": "Add Images",
    "images": "images",
    "maxImagesReached": "Maximum {max} images allowed",
    "uploadSuccess": "{count} image(s) uploaded successfully",
    "uploadError": "Failed to upload images. Please try again.",
    "confirmRemove": "Remove Image",
    "removeImageConfirmation": "Are you sure you want to remove this image?",
    "viewAll": "View All"
  }
}
```

## Setup Instructions

### 1. Cloudinary Setup
1. Tạo tài khoản Cloudinary
2. Tạo upload preset:
   - Vào Settings > Upload presets
   - Tạo preset mới với mode "Unsigned"
   - Cấu hình transformations nếu cần
3. Cập nhật config trong `cloudinaryService.ts`

### 2. Dependencies
Đảm bảo đã cài đặt:
```bash
npm install react-native-image-picker
```

### 3. Platform Setup
**Android:** Thêm permissions trong `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
```

**iOS:** Thêm permissions trong `ios/YourProject/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>This app needs access to camera to take photos</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>This app needs access to photo library to select images</string>
```

## Folder Structure
```
tours/
├── {tourId}/
│   ├── image1.jpg
│   └── image2.jpg
destinations/
├── {destinationId}/
│   ├── image1.jpg
│   └── image2.jpg  
activities/
├── {activityId}/
│   ├── image1.jpg
│   └── image2.jpg
```

## Usage Examples

### Upload Tour Images
```tsx
const [tourImages, setTourImages] = useState<string[]>([]);

<ImagePickerComponent
  images={tourImages}
  onImagesChange={setTourImages}
  maxImages={10}
  folder={`tours/${tourId}`}
  title="Tour Gallery"
/>
```

### Display Image Gallery
```tsx
// In tour detail screen
<ImageGallery
  images={tour.images || []}
  title="Tour Photos"
  maxPreviewImages={4}
/>
```

### Save to Firestore
```tsx
await firestore().collection('tours').add({
  title: 'My Tour',
  description: 'Tour description',
  images: tourImages, // Array of Cloudinary URLs
  // ... other fields
});
```

## Performance Considerations

1. **Image Optimization**: Service tự động áp dụng transformations (resize, quality, format)
2. **Lazy Loading**: ImageGallery chỉ load ảnh khi cần
3. **Caching**: Cloudinary CDN tự động cache ảnh
4. **Thumbnails**: Sử dụng thumbnail cho preview, full size cho modal

## Error Handling

Service xử lý các lỗi:
- Network errors
- Invalid file formats  
- Upload failures
- File size limits

## Security Notes

1. **Upload Preset**: Sử dụng unsigned preset cho client-side upload
2. **File Validation**: Kiểm tra định dạng và kích thước file
3. **Delete Images**: Nên implement trên backend với API secret
4. **Rate Limiting**: Cloudinary có rate limits, cần xử lý appropriately
