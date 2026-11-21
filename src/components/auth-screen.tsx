import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedButton } from '@/components/themed-button';
import { ThemedCard } from '@/components/themed-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getApiErrorMessage, loginWithEmail, registerWithEmail } from '@/lib/auth/auth-api';
import { useAuth } from '@/providers/auth-provider';

type AuthMode = 'signIn' | 'register';

const POSTAL_CODE_REGEX = /^[A-Z]\d[A-Z]\d[A-Z]\d$/;

export function AuthScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { signIn } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const switchMode = () => {
    setMode((prev) => (prev === 'signIn' ? 'register' : 'signIn'));
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    const normalizedPostal = postalCode.replace(/\s+/g, '').toUpperCase();

    if (!trimmedEmail || !password || (isRegister && (!trimmedUsername || !normalizedPostal))) {
      setErrorMessage(t('auth.errors.requiredFields'));
      return;
    }

    if (isRegister) {
      if (!trimmedEmail.includes('@')) {
        setErrorMessage(t('auth.errors.invalidEmail'));
        return;
      }
      if (password.length < 8) {
        setErrorMessage(t('auth.errors.passwordTooShort'));
        return;
      }
      if (!POSTAL_CODE_REGEX.test(normalizedPostal)) {
        setErrorMessage(t('auth.errors.invalidPostalCode'));
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = isRegister
        ? await registerWithEmail({
            username: trimmedUsername,
            email: trimmedEmail.toLowerCase(),
            password,
            postalCode: normalizedPostal,
            preferredLanguage: i18n.language === 'en' ? 'en' : 'fr',
          })
        : await loginWithEmail({
            email: trimmedEmail,
            password,
          });

      await signIn(
        { accessToken: response.accessToken, refreshToken: response.refreshToken },
        response.user,
      );
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, t('auth.errors.network')));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.background,
      borderColor: theme.border,
      color: theme.text,
    },
  ];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.container}>
              <View style={styles.header}>
                <ThemedText type="h1">
                  {isRegister ? t('auth.registerTitle') : t('auth.signInTitle')}
                </ThemedText>
                <ThemedText type="body" tone="secondary">
                  {isRegister ? t('auth.registerSubtitle') : t('auth.signInSubtitle')}
                </ThemedText>
              </View>

              <ThemedCard variant="elevated" padding="large" style={styles.card}>
                {isRegister ? (
                  <View style={styles.field}>
                    <ThemedText type="label">{t('auth.usernameLabel')}</ThemedText>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder={t('auth.usernamePlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      value={username}
                      onChangeText={setUsername}
                      style={inputStyle}
                    />
                  </View>
                ) : null}

                <View style={styles.field}>
                  <ThemedText type="label">
                    {isRegister ? t('auth.emailLabel') : t('auth.emailOrUsernameLabel')}
                  </ThemedText>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType={isRegister ? 'emailAddress' : 'username'}
                    placeholder={
                      isRegister ? t('auth.emailPlaceholder') : t('auth.emailOrUsernamePlaceholder')
                    }
                    placeholderTextColor={theme.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    style={inputStyle}
                  />
                </View>

                <View style={styles.field}>
                  <ThemedText type="label">{t('auth.passwordLabel')}</ThemedText>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    textContentType={isRegister ? 'newPassword' : 'password'}
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    style={inputStyle}
                  />
                </View>

                {isRegister ? (
                  <View style={styles.field}>
                    <ThemedText type="label">{t('auth.postalCodeLabel')}</ThemedText>
                    <TextInput
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={7}
                      placeholder={t('auth.postalCodePlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      value={postalCode}
                      onChangeText={setPostalCode}
                      style={inputStyle}
                    />
                  </View>
                ) : null}

                {errorMessage ? (
                  <ThemedText type="error" accessibilityRole="alert">
                    {errorMessage}
                  </ThemedText>
                ) : null}

                <ThemedButton
                  fullWidth
                  loading={submitting}
                  onPress={() => void handleSubmit()}
                  style={styles.submitButton}
                >
                  {isRegister ? t('auth.registerButton') : t('auth.signInButton')}
                </ThemedButton>

                <ThemedButton type="text" fullWidth disabled={submitting} onPress={switchMode}>
                  {isRegister ? t('auth.switchToSignIn') : t('auth.switchToRegister')}
                </ThemedButton>
              </ThemedCard>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: Math.min(MaxContentWidth, 440),
    alignSelf: 'center',
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  card: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  submitButton: {
    marginTop: Spacing.one,
  },
});
