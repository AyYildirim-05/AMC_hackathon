import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedButton } from '@/components/utils/themed-button';
import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UploadableImage } from '@/lib/uploads/cloudinary';

/** Issue reports allow at most this many photos; the server enforces the same cap. */
export const MAX_ISSUE_PHOTOS = 5;

/** A photo taken or picked on the device, not uploaded yet. */
export type PickedPhoto = Extract<UploadableImage, { uri: string }>;

/** Compressed before upload; issue photos don't need full sensor resolution. */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };

const THUMBNAIL_SIZE = 88;

export type PhotoPickerProps = {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  max?: number;
};

const toPickedPhoto = ({ uri, mimeType, fileName }: ImagePicker.ImagePickerAsset): PickedPhoto => ({
  uri,
  mimeType,
  fileName,
});

/**
 * Takes or picks photos for an issue report and keeps them on the device. The form that hosts it
 * uploads them on submit with `uploadIssuePhotos(photos)` and sends the URLs as the issue's `images`.
 */
export function PhotoPicker({ photos, onChange, max = MAX_ISSUE_PHOTOS }: PhotoPickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const remaining = max - photos.length;

  const add = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    // The library may return more than asked on platforms that ignore selectionLimit.
    onChange([...photos, ...result.assets.map(toPickedPhoto)].slice(0, max));
  };

  const takePhoto = async () => {
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError(t('photos.cameraDenied'));
        return;
      }
      add(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
    } catch {
      setError(t('photos.unavailable'));
    }
  };

  // The system photo picker needs no permission on current iOS and Android.
  const choosePhotos = async () => {
    setError(null);
    try {
      add(
        await ImagePicker.launchImageLibraryAsync({
          ...PICKER_OPTIONS,
          allowsMultipleSelection: true,
          selectionLimit: remaining,
        }),
      );
    } catch {
      setError(t('photos.unavailable'));
    }
  };

  const remove = (index: number) => onChange(photos.filter((_, i) => i !== index));

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <ThemedButton type="secondary" onPress={takePhoto} disabled={remaining <= 0}>
          {t('photos.take')}
        </ThemedButton>
        <ThemedButton type="border" onPress={choosePhotos} disabled={remaining <= 0}>
          {t('photos.choose')}
        </ThemedButton>
      </View>

      <ThemedText type="caption" tone="secondary">
        {remaining <= 0
          ? t('photos.limitReached', { max })
          : t('photos.count', { count: photos.length, max })}
      </ThemedText>

      {error && (
        <ThemedText type="error" accessibilityRole="alert">
          {error}
        </ThemedText>
      )}

      {photos.length > 0 && (
        <View style={styles.thumbnails}>
          {photos.map((photo, index) => (
            <View key={`${photo.uri}-${index}`}>
              <Image
                source={{ uri: photo.uri }}
                style={[styles.thumbnail, { backgroundColor: theme.backgroundElement }]}
                contentFit="cover"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('photos.remove', { number: index + 1 })}
                hitSlop={Spacing.two}
                onPress={() => remove(index)}
                style={[styles.remove, { backgroundColor: theme.danger }]}
              >
                <ThemedText type="label" style={{ color: theme.buttonText }}>
                  ×
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumbnail: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, borderRadius: Spacing.two },
  remove: {
    position: 'absolute',
    top: -Spacing.one,
    right: -Spacing.one,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Spacing.two * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
