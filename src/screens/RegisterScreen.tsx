// src/screens/RegisterScreen.tsx
import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { useForm, Controller } from "react-hook-form";
import { useNavigation } from "@react-navigation/native";

const RegisterScreen = () => {
  const { control, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();

  const onRegister = async (data: any) => {
    setLoading(true);
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(data.email, data.password);
      const user = userCredential.user;

      await firestore().collection("users").doc(user.uid).set({
        email: user.email,
        role: data.role || "tourist",
      });
      
      Alert.alert("Success", "Account created successfully!");
      navigation.navigate("Login");
    } catch (error: any) {
      Alert.alert("Register Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to get started</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <Controller
                control={control}
                name="email"
                rules={{ 
                  required: "Email is required",
                  pattern: {
                    value: /\S+@\S+\.\S+/,
                    message: "Please enter a valid email"
                  }
                }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    placeholder="your.email@example.com"
                    style={styles.input}
                    onChangeText={onChange}
                    value={value}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                )}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email.message?.toString()}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <Controller
                control={control}
                name="password"
                rules={{ 
                  required: "Password is required", 
                  minLength: { value: 6, message: "Password must be at least 6 characters" } 
                }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    placeholder="••••••••"
                    secureTextEntry
                    style={styles.input}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.password && <Text style={styles.errorText}>{errors.password.message?.toString()}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Role</Text>
              <Controller
                control={control}
                name="role"
                rules={{ required: "Role is required" }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    placeholder="tourist or tour_guide"
                    style={styles.input}
                    onChangeText={onChange}
                    value={value}
                    autoCapitalize="none"
                  />
                )}
              />
              {errors.role && <Text style={styles.errorText}>{errors.role.message?.toString()}</Text>}
            </View>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleSubmit(onRegister)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Register</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              style={styles.linkContainer}
            >
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.link}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  keyboardView: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
  errorText: {
    color: "#dc3545",
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    backgroundColor: "#4361ee",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  linkContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  linkText: {
    color: "#555",
    fontSize: 14,
  },
  link: {
    color: "#4361ee",
    fontWeight: "bold",
  },
});

export default RegisterScreen;
