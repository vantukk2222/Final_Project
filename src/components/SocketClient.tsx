// components/SocketClient.tsx
import React, { useEffect, useState } from 'react';
import { View, TextInput, Button, Text, FlatList, StyleSheet } from 'react-native';
import { io, Socket } from 'socket.io-client';

type Message = {
  msg: string;
  lan: string;
};

const socket: Socket = io('http://192.168.1.16:3000');

const SocketClient = () => {
  const [msg, setMsg] = useState('');
  const [lan, setLan] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected:', socket.id);
    });

    socket.on('receive_message', (data: Message) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (msg.trim() === '' || lan.trim() === '') return;

    socket.emit('send_message', {
      id: socket.id,
      msg,
      lan,
    });

    setMessages((prev) => [...prev, { msg: `You: ${msg}`, lan }]);

    setMsg('');
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Message"
        value={msg}
        onChangeText={setMsg}
        style={styles.input}
      />
      <TextInput
        placeholder="Language"
        value={lan}
        onChangeText={setLan}
        style={styles.input}
      />
      <Button title="Send" onPress={sendMessage} />

      <FlatList
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.message}>{`${item.lan.toUpperCase()}: ${item.msg}`}</Text>
        )}
      />
    </View>
  );
};

export default SocketClient;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 40 },
  input: { borderWidth: 1, marginBottom: 10, padding: 8, borderRadius: 4 },
  message: { paddingVertical: 4, fontSize: 16 },
});
