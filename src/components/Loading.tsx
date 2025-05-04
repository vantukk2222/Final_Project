import React from 'react';
import { Modal, View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface LoadingProps {
    isLoading: boolean;
}

const Loading: React.FC<LoadingProps> = ({ isLoading }) => {
    if (!isLoading) return null;

    return (
        <Modal
            transparent
            animationType="fade"
            visible={isLoading}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.text}>Loading...</Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: 'rgba(25, 25, 25, 0.9)',
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: 'white',
        marginTop: 10,
        fontSize: 16,
    }
});

export default Loading;