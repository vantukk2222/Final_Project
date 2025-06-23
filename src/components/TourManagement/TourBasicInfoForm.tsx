import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useTranslation} from '../../contexts/TranslationContext';
import ImagePickerComponent from '../common/ImagePickerComponent';

interface TourBasicInfoFormProps {
  title: string;
  description: string;
  category:
    | 'cultural'
    | 'historical'
    | 'nature'
    | 'adventure'
    | 'food'
    | 'shopping'
    | 'mixed';
  difficulty: 'easy' | 'moderate' | 'challenging';
  language: string[];
  maxParticipants: string;
  price: {adult: string; child: string; currency: string};
  requirements: string[];
  included: string[];
  excluded: string[];
  notes: string;
  tourDate: Date;
  startTime: string;
  endTime: string;
  images: string[];
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onCategoryChange: (
    category:
      | 'cultural'
      | 'historical'
      | 'nature'
      | 'adventure'
      | 'food'
      | 'shopping'
      | 'mixed',
  ) => void;
  onDifficultyChange: (difficulty: 'easy' | 'moderate' | 'challenging') => void;
  onLanguageChange: (language: string[]) => void;
  onMaxParticipantsChange: (maxParticipants: string) => void;
  onPriceChange: (price: {
    adult: string;
    child: string;
    currency: string;
  }) => void;
  onRequirementsChange: (requirements: string[]) => void;
  onIncludedChange: (included: string[]) => void;
  onExcludedChange: (excluded: string[]) => void;
  onNotesChange: (notes: string) => void;
  onTourDateChange: (date: Date) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onImagesChange: (images: string[]) => void;
}

const TourBasicInfoForm: React.FC<TourBasicInfoFormProps> = ({
  title,
  description,
  category,
  difficulty,
  language,
  maxParticipants,
  price,
  requirements,
  included,
  excluded,
  notes,
  tourDate,
  startTime,
  endTime,
  images,
  onTitleChange,
  onDescriptionChange,
  onCategoryChange,
  onDifficultyChange,
  onLanguageChange,
  onMaxParticipantsChange,
  onPriceChange,
  onRequirementsChange,
  onIncludedChange,
  onExcludedChange,
  onNotesChange,
  onTourDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onImagesChange,
}) => {
  const {t} = useTranslation();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const categories = [
    {
      key: 'cultural',
      label: t('tour.categories.cultural'),
      icon: 'account-balance',
    },
    {
      key: 'historical',
      label: t('tour.categories.historical'),
      icon: 'history-edu',
    },
    {key: 'nature', label: t('tour.categories.nature'), icon: 'nature'},
    {key: 'adventure', label: t('tour.categories.adventure'), icon: 'terrain'},
    {key: 'food', label: t('tour.categories.food'), icon: 'restaurant'},
    {
      key: 'shopping',
      label: t('tour.categories.shopping'),
      icon: 'shopping-bag',
    },
    {key: 'mixed', label: t('tour.categories.mixed'), icon: 'apps'},
  ];

  const difficulties = [
    {key: 'easy', label: t('tour.difficulty.easy'), color: '#10B981'},
    {key: 'moderate', label: t('tour.difficulty.moderate'), color: '#F59E0B'},
    {
      key: 'challenging',
      label: t('tour.difficulty.challenging'),
      color: '#EF4444',
    },
  ];

  const languages = [
    {key: 'en', label: 'English'},
    {key: 'vi', label: 'Tiếng Việt'},
    {key: 'fr', label: 'Français'},
    {key: 'es', label: 'Español'},
    {key: 'de', label: 'Deutsch'},
    {key: 'ja', label: '日本語'},
    {key: 'ko', label: '한국어'},
    {key: 'zh', label: '中文'},
  ];

  const addListItem = (
    list: string[],
    setList: (items: string[]) => void,
    item: string,
  ) => {
    if (item.trim() && !list.includes(item.trim())) {
      setList([...list, item.trim()]);
    }
  };

  const removeListItem = (
    list: string[],
    setList: (items: string[]) => void,
    index: number,
  ) => {
    setList(list.filter((_, i) => i !== index));
  };

  const formatTime = (time: string) => {
    if (!time) {
      return '';
    }
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <View style={styles.container}>
      {/* Basic Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('tour.form.basicInformation')}
        </Text>

        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('tour.form.tourTitle')} *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={onTitleChange}
            placeholder={t('tour.form.enterTourTitle')}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('tour.form.description')} *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={onDescriptionChange}
            placeholder={t('tour.form.enterTourDescription')}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Tour Images */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('tour.form.images')}</Text>
          <ImagePickerComponent
            images={images}
            onImagesChange={onImagesChange}
            maxImages={10}
            folder="tours"
            title={t('tour.form.selectTourImages')}
          />
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('tour.form.category')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowCategoryModal(true)}>
            <Icon
              name={categories.find(c => c.key === category)?.icon || 'apps'}
              size={20}
              color="#6B7280"
            />
            <Text style={styles.selectButtonText}>
              {categories.find(c => c.key === category)?.label ||
                t('tour.form.selectCategory')}
            </Text>
            <Icon name="keyboard-arrow-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Difficulty */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('tour.form.difficulty')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowDifficultyModal(true)}>
            <View
              style={[
                styles.difficultyIndicator,
                {
                  backgroundColor:
                    difficulties.find(d => d.key === difficulty)?.color ||
                    '#10B981',
                },
              ]}
            />
            <Text style={styles.selectButtonText}>
              {difficulties.find(d => d.key === difficulty)?.label ||
                t('tour.form.selectDifficulty')}
            </Text>
            <Icon name="keyboard-arrow-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Languages */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('tour.form.languages')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowLanguageModal(true)}>
            <Icon name="language" size={20} color="#6B7280" />
            <Text style={styles.selectButtonText}>
              {language?.length > 0
                ? language
                    .map(l => languages.find(lang => lang.key === l)?.label)
                    .join(', ')
                : t('tour.form.selectLanguages')}
            </Text>
            <Icon name="keyboard-arrow-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Schedule Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('tour.form.schedule')}</Text>

        {/* Tour Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('tour.form.tourDate')}</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowDatePicker(true)}>
            <Icon name="event" size={20} color="#6B7280" />
            <Text style={styles.selectButtonText}>
              {tourDate?.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Time Range */}
        <View style={styles.timeContainer}>
          <View style={[styles.inputGroup, {flex: 1, marginRight: 8}]}>
            <Text style={styles.label}>{t('tour.form.startTime')}</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowStartTimePicker(true)}>
              <Icon name="schedule" size={20} color="#6B7280" />
              <Text style={styles.selectButtonText}>
                {formatTime(startTime)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, {flex: 1, marginLeft: 8}]}>
            <Text style={styles.label}>{t('tour.form.endTime')}</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowEndTimePicker(true)}>
              <Icon name="schedule" size={20} color="#6B7280" />
              <Text style={styles.selectButtonText}>{formatTime(endTime)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Additional Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('tour.form.additionalInformation')}
        </Text>

        {/* Max Participants */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('tour.form.maxParticipants')}</Text>
          <TextInput
            style={styles.input}
            value={maxParticipants}
            onChangeText={onMaxParticipantsChange}
            placeholder={t('tour.form.enterMaxParticipants')}
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
        </View>

        {/* Price */}
        <View style={styles.priceContainer}>
          <View style={[styles.inputGroup, {flex: 2, marginRight: 8}]}>
            <Text style={styles.label}>{t('tour.form.adultPrice')}</Text>
            <TextInput
              style={styles.input}
              value={price?.adult}
              onChangeText={text => onPriceChange({...price, adult: text})}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, {flex: 2, marginHorizontal: 4}]}>
            <Text style={styles.label}>{t('tour.form.childPrice')}</Text>
            <TextInput
              style={styles.input}
              value={price?.child}
              onChangeText={text => onPriceChange({...price, child: text})}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, {flex: 1, marginLeft: 8}]}>
            <Text style={styles.label}>{t('tour.form.currency')}</Text>
            <TextInput
              style={styles.input}
              value={price?.currency}
              onChangeText={text => onPriceChange({...price, currency: text})}
              placeholder="USD"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('tour.form.notes')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={onNotesChange}
            placeholder={t('tour.form.enterAdditionalNotes')}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* Date/Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={tourDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              onTourDateChange(selectedDate);
            }
          }}
          minimumDate={new Date()}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={new Date(`2000-01-01T${startTime}:00`)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedTime) => {
            setShowStartTimePicker(false);
            if (selectedTime) {
              const hours = selectedTime.getHours().toString().padStart(2, '0');
              const minutes = selectedTime
                .getMinutes()
                .toString()
                .padStart(2, '0');
              onStartTimeChange(`${hours}:${minutes}`);
            }
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={new Date(`2000-01-01T${endTime}:00`)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedTime) => {
            setShowEndTimePicker(false);
            if (selectedTime) {
              const hours = selectedTime.getHours().toString().padStart(2, '0');
              const minutes = selectedTime
                .getMinutes()
                .toString()
                .padStart(2, '0');
              onEndTimeChange(`${hours}:${minutes}`);
            }
          }}
        />
      )}

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('tour.form.selectCategory')}
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.modalOption,
                    category === cat.key && styles.selectedOption,
                  ]}
                  onPress={() => {
                    onCategoryChange(cat.key as any);
                    setShowCategoryModal(false);
                  }}>
                  <Icon
                    name={cat.icon}
                    size={24}
                    color={category === cat.key ? '#10B981' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.modalOptionText,
                      category === cat.key && styles.selectedOptionText,
                    ]}>
                    {cat.label}
                  </Text>
                  {category === cat.key && (
                    <Icon name="check" size={20} color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Difficulty Modal */}
      <Modal
        visible={showDifficultyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDifficultyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('tour.form.selectDifficulty')}
              </Text>
              <TouchableOpacity onPress={() => setShowDifficultyModal(false)}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {difficulties.map(diff => (
                <TouchableOpacity
                  key={diff.key}
                  style={[
                    styles.modalOption,
                    difficulty === diff.key && styles.selectedOption,
                  ]}
                  onPress={() => {
                    onDifficultyChange(diff.key as any);
                    setShowDifficultyModal(false);
                  }}>
                  <View
                    style={[
                      styles.difficultyIndicator,
                      {backgroundColor: diff.color},
                    ]}
                  />
                  <Text
                    style={[
                      styles.modalOptionText,
                      difficulty === diff.key && styles.selectedOptionText,
                    ]}>
                    {diff.label}
                  </Text>
                  {difficulty === diff.key && (
                    <Icon name="check" size={20} color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('tour.form.selectLanguages')}
              </Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {languages.map(lang => (
                <TouchableOpacity
                  key={lang.key}
                  style={[
                    styles.modalOption,
                    language?.includes(lang.key) && styles.selectedOption,
                  ]}
                  onPress={() => {
                    const isSelected = language.includes(lang.key);
                    if (isSelected) {
                      onLanguageChange(language.filter(l => l !== lang.key));
                    } else {
                      onLanguageChange([...language, lang.key]);
                    }
                  }}>
                  <Icon
                    name="language"
                    size={24}
                    color={language?.includes(lang.key) ? '#10B981' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.modalOptionText,
                      language?.includes(lang.key) && styles.selectedOptionText,
                    ]}>
                    {lang.label}
                  </Text>
                  {language?.includes(lang.key) && (
                    <Icon name="check" size={20} color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  selectButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 8,
  },
  difficultyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timeContainer: {
    flexDirection: 'row',
  },
  priceContainer: {
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedOption: {
    backgroundColor: '#F0FDF4',
  },
  modalOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  selectedOptionText: {
    color: '#10B981',
    fontWeight: '500',
  },
});

export default TourBasicInfoForm;
