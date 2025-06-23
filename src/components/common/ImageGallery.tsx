import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useTranslation} from '../../contexts/TranslationContext';

interface ImageGalleryProps {
  images: string[];
  title?: string;
  maxPreviewImages?: number;
}

const {width: screenWidth} = Dimensions.get('window');

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  title,
  maxPreviewImages = 4,
}) => {
  const {t} = useTranslation();
  const [showFullGallery, setShowFullGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!images || images.length === 0) {
    return null;
  }

  const previewImages = images.slice(0, maxPreviewImages);
  const remainingImagesCount = images.length - maxPreviewImages;

  const openFullGallery = (index: number = 0) => {
    setSelectedImageIndex(index);
    setShowFullGallery(true);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedImageIndex(
        selectedImageIndex === 0 ? images.length - 1 : selectedImageIndex - 1,
      );
    } else {
      setSelectedImageIndex(
        selectedImageIndex === images.length - 1 ? 0 : selectedImageIndex + 1,
      );
    }
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      {/* Preview Grid */}
      <View style={styles.previewGrid}>
        {previewImages.map((imageUrl, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.previewImage,
              {width: previewImages.length === 1 ? '100%' : '48%'},
            ]}
            onPress={() => openFullGallery(index)}>
            <Image source={{uri: imageUrl}} style={styles.image} />

            {/* Show remaining count on last preview image */}
            {index === maxPreviewImages - 1 && remainingImagesCount > 0 && (
              <View style={styles.moreImagesOverlay}>
                <Text style={styles.moreImagesText}>
                  +{remainingImagesCount} {t('images.images')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Show all images link */}
      {images.length > maxPreviewImages && (
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => openFullGallery()}>
          <Icon name="photo-library" size={16} color="#10B981" />
          <Text style={styles.viewAllText}>
            {t('images.viewAll')} ({images.length})
          </Text>
        </TouchableOpacity>
      )}

      {/* Full Gallery Modal */}
      <Modal
        visible={showFullGallery}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullGallery(false)}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedImageIndex + 1} / {images.length}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFullGallery(false)}>
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Image Display */}
          <View style={styles.imageContainer}>
            <Image
              source={{uri: images[selectedImageIndex]}}
              style={styles.fullImage}
              resizeMode="contain"
            />

            {/* Navigation Buttons */}
            {images.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.navButton, styles.prevButton]}
                  onPress={() => navigateImage('prev')}>
                  <Icon name="chevron-left" size={32} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.navButton, styles.nextButton]}
                  onPress={() => navigateImage('next')}>
                  <Icon name="chevron-right" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <ScrollView
              horizontal
              style={styles.thumbnailStrip}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailContainer}>
              {images.map((imageUrl, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.thumbnail,
                    selectedImageIndex === index && styles.selectedThumbnail,
                  ]}
                  onPress={() => setSelectedImageIndex(index)}>
                  <Image
                    source={{uri: imageUrl}}
                    style={styles.thumbnailImage}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  previewImage: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: '#F3F4F6',
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullImage: {
    width: screenWidth,
    height: '80%',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -25,
  },
  prevButton: {
    left: 20,
  },
  nextButton: {
    right: 20,
  },
  thumbnailStrip: {
    maxHeight: 80,
    marginBottom: 20,
  },
  thumbnailContainer: {
    paddingHorizontal: 20,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedThumbnail: {
    borderColor: '#10B981',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});

export default ImageGallery;
