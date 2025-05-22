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
    <ScrollView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Begin Your Journey</Text>
              <Text style={styles.subtitle}>Create an account to explore the world</Text>
            </View>

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
                  <View style={styles.inputWrapper}>
                    <TextInput
                      placeholder="your.email@example.com"
                      style={styles.input}
                      onChangeText={onChange}
                      value={value}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor="#A0A0A0"
                    />
                  </View>
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
                  <View style={styles.inputWrapper}>
                    <TextInput
                      placeholder="••••••••"
                      secureTextEntry
                      style={styles.input}
                      onChangeText={onChange}
                      value={value}
                      placeholderTextColor="#A0A0A0"
                    />
                  </View>
                )}
              />
              {errors.password && <Text style={styles.errorText}>{errors.password.message?.toString()}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>I am a</Text>
              <Controller
                control={control}
                name="role"
                rules={{ required: "Role is required" }}
                render={({ field: { onChange, value } }) => (
                  <View style={styles.roleSelector}>
                    <TouchableOpacity 
                      style={[styles.roleOption, value === "tourist" && styles.roleOptionSelected]} 
                      onPress={() => onChange("tourist")}
                    >
                      <Text style={[styles.roleText, value === "tourist" && styles.roleTextSelected]}>
                        Traveler
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.roleOption, value === "tour_guide" && styles.roleOptionSelected]} 
                      onPress={() => onChange("tour_guide")}
                    >
                      <Text style={[styles.roleText, value === "tour_guide" && styles.roleTextSelected]}>
                        Tour Guide
                      </Text>
                    </TouchableOpacity>
                  </View>
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
                <Text style={styles.buttonText}>Start Exploring</Text>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f7f7",
  },
  keyboardView: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  headerContainer: {
    marginBottom: 36,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 10,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: "#0f172a",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  roleSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  roleOptionSelected: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  roleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  roleTextSelected: {
    color: '#fff',
  },
  button: {
    backgroundColor: "#3b82f6",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  linkContainer: {
    marginTop: 24,
    alignItems: "center",
    padding: 8,
  },
  linkText: {
    color: "#64748b",
    fontSize: 15,
  },
  link: {
    color: "#3b82f6",
    fontWeight: "bold",
  },
});

export default RegisterScreen;
