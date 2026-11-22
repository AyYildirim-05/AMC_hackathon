import { type ComponentRef, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { isSupportedLanguage, setLanguage, supportedLanguages } from '@/i18n';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmPasswordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const postalCodeRef = useRef<ComponentRef<typeof TextInput>>(null);

  const isRegister = mode === 'register';
  const currentLang = isSupportedLanguage(i18n.language) ? i18n.language : 'en';

  const switchMode = () => {
    setMode((prev) => (prev === 'signIn' ? 'register' : 'signIn'));
    setConfirmPassword('');
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    const normalizedPostal = postalCode.replace(/\s+/g, '').toUpperCase();

    if (
      !trimmedEmail ||
      !password ||
      (isRegister && (!trimmedUsername || !confirmPassword || !normalizedPostal))
    ) {
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
      if (password !== confirmPassword) {
        setErrorMessage(t('auth.errors.passwordMismatch'));
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
            preferredLanguage: currentLang === 'en' ? 'en' : 'fr',
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
              <View style={styles.topBar}>
                <ThemedView type="backgroundElement" style={styles.langToggle}>
                  {supportedLanguages.map((lang) => {
                    const active = lang === currentLang;
                    return (
                      <Pressable
                        key={lang}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => void setLanguage(lang)}
                        style={[
                          styles.langOption,
                          active && { backgroundColor: theme.primaryBtnBackground },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          weight="bold"
                          themeColor={active ? 'buttonText' : 'textSecondary'}
                        >
                          {lang.toUpperCase()}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ThemedView>
              </View>

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
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
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
                    ref={emailRef}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
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
                  <View
                    style={[
                      styles.passwordRow,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <TextInput
                      ref={passwordRef}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showPassword}
                      returnKeyType={isRegister ? 'next' : 'done'}
                      onSubmitEditing={() => {
                        if (isRegister) confirmPasswordRef.current?.focus();
                        else void handleSubmit();
                      }}
                      textContentType={isRegister ? 'newPassword' : 'password'}
                      placeholder={t('auth.passwordPlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      value={password}
                      onChangeText={setPassword}
                      style={[styles.passwordInput, { color: theme.text }]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setShowPassword((prev) => !prev)}
                      style={styles.toggleBtn}
                    >
                      <ThemedText type="caption" weight="semibold" tone="accent">
                        {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>

                {isRegister ? (
                  <>
                    <View style={styles.field}>
                      <ThemedText type="label">{t('auth.confirmPasswordLabel')}</ThemedText>
                      <TextInput
                        ref={confirmPasswordRef}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!showPassword}
                        returnKeyType="next"
                        onSubmitEditing={() => postalCodeRef.current?.focus()}
                        textContentType="newPassword"
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                        placeholderTextColor={theme.textSecondary}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        style={inputStyle}
                      />
                    </View>

                    <View style={styles.field}>
                      <ThemedText type="label">{t('auth.postalCodeLabel')}</ThemedText>
                      <TextInput
                        ref={postalCodeRef}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={7}
                        returnKeyType="done"
                        onSubmitEditing={() => void handleSubmit()}
                        placeholder={t('auth.postalCodePlaceholder')}
                        placeholderTextColor={theme.textSecondary}
                        value={postalCode}
                        onChangeText={setPostalCode}
                        style={inputStyle}
                      />
                    </View>
                  </>
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

export default AuthScreen;

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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: 999,
  },
  langOption: {
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    minWidth: 36,
    alignItems: 'center',
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  toggleBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  submitButton: {
    marginTop: Spacing.one,
  },
});
