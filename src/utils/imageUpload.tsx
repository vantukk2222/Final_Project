// src/utils/imageUpload.ts
import {launchImageLibrary} from 'react-native-image-picker';

export const handleImageUpload = async (): Promise<string | null> => {
  const result = await launchImageLibrary({mediaType: 'photo'});

  if (result.didCancel) return null;
  const asset = result.assets?.[0];
  if (!asset || !asset.uri) return null;

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: 'upload.jpg',
    type: 'image/jpeg',
  } as any);

  const cloud_name = 'djlhfgzbw';
  const upload_preset = 'chatapp';

  formData.append('upload_preset', upload_preset);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
      {
        method: 'POST',
        body: formData,
      },
    );
    const json = await res.json();
    return json;
  } catch (err) {
    console.error('Image upload error:', err);
    return null;
  }
};
