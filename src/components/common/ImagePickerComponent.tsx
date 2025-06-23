import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {launchImageLibrary, MediaType} from 'react-native-image-picker';
import {useTranslation} from '../../contexts/TranslationContext';
import cloudinaryService from '../../services/cloudinaryService';

interface ImagePickerComponentProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  folder?: string;
  title?: string;
}

const ImagePickerComponent: React.FC<ImagePickerComponentProps> = ({
  images,
  onImagesChange,
  maxImages = 5,
  folder,
  title,
}) => {
  const {t} = useTranslation();
  const [uploading, setUploading] = useState(false);

  const selectImages = () => {
    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      Alert.alert(
        t('common.error'),
        t('images.maxImagesReached', {max: maxImages}),
      );
      return;
    }

    launchImageLibrary(
      {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        selectionLimit: Math.min(remainingSlots, 5),
        includeBase64: false,
      },
      response => {
        if (response.didCancel || response.errorMessage) {
          return;
        }

        if (response.assets) {
          uploadImages(response.assets);
        }
      },
    );
  };

  const uploadImages = async (assets: any[]) => {
    setUploading(true);
    try {
      console.log('Uploading images:', assets);
      const imageUris = assets
        .filter(asset => asset.uri)
        .map(asset => asset.uri!);

      const uploadResults = await cloudinaryService.uploadMultipleImages(
        imageUris,
        folder,
      );

      const newImageUrls = uploadResults.map(result => result.secure_url);
      onImagesChange([...images, ...newImageUrls]);

      Alert.alert(
        t('common.success'),
        t('images.uploadSuccess', {count: newImageUrls.length}),
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(t('common.error'), t('images.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    Alert.alert(
      t('images.confirmRemove'),
      t('images.removeImageConfirmation'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => {
            const newImages = images.filter((_, i) => i !== index);
            onImagesChange(newImages);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      {/* Images Grid */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.imageScroll}>
        {/* Add Button */}
        {images?.length < maxImages && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={selectImages}
            disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <>
                <Icon name="add-a-photo" size={24} color="#10B981" />
                <Text style={styles.addButtonText}>
                  {t('images.addImages')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Image Items */}
        {images?.map((imageUrl, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{uri: imageUrl}} style={styles.image} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeImage(index)}>
              <Icon name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Image Counter */}
      <Text style={styles.imageCounter}>
        {images?.length} / {maxImages} {t('images.images')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  imageScroll: {
    marginBottom: 8,
  },
  addButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginRight: 8,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCounter: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
});

export default ImagePickerComponent;
