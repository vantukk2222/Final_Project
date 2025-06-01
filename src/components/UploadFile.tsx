import React, {useState} from 'react';
import {View, TouchableOpacity, Text, StyleSheet, Platform} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import Icon from 'react-native-vector-icons/FontAwesome5';

const FileUpload = ({onFileUploaded}) => {
  const [uploading, setUploading] = useState(false);

  const handleFilePick = async () => {
    try {
      const file = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      const data = new FormData();
      data.append('file', {
        uri:
          Platform.OS === 'ios'
            ? file[0].uri.replace('file://', '')
            : file[0].uri,
        type: file[0].type,
        name: file[0].name,
      });
      data.append('upload_preset', 'chatapp'); // Ensure preset allows unsigned uploads

      setUploading(true);

      const response = await fetch(
        'https://api.cloudinary.com/v1_1/djlhfgzbw/upload',
        {
          method: 'POST',
          body: data,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      const result = await response.json();
      if (response.ok) {
        onFileUploaded(result.secure_url, file[0].name);
        console.log('File available at:', result.secure_url);
      } else {
        console.error('Upload error:', result);
      }

      setUploading(false);
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        console.log('User canceled the file picker.');
      } else {
        console.error('Upload error:', error);
      }
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={handleFilePick}
        disabled={uploading}>
        <Icon name="paperclip" size={18} color="#5B72EF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    // marginTop: 20,
  },
  uploadButton: {
    // backgroundColor: '#4AC6D0',
    padding: 12,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default FileUpload;
