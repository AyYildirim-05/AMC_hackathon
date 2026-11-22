import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { initialWindowMetrics, SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { MapIcon } from '@/components/map/MapIcon';
import { Spacing } from '@/constants/theme';
import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { useTheme } from '@/hooks/use-theme';

export type BoroughOption = {
  key: string;
  label: string;
  /** Shown under the label, e.g. the OpenNorth slug. */
  detail?: string;
  selected: boolean;
  testID?: string;
  /** Hidden while searching (e.g. "All boroughs"). */
  hideWhileSearching?: boolean;
};

export type BoroughPickerSheetProps = {
  visible: boolean;
  title: string;
  options: readonly BoroughOption[];
  onSelect: (key: string) => void;
  onClose: () => void;
  testID?: string;
};

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Bottom sheet for picking a borough: at most 75% of the screen, so the dimmed screen above stays
 * visible and closes it on tap; plus a close button, a search field and a scrolling list (Montreal
 * has 19 boroughs, too many to fit). Android's back button closes it too.
 */
export function BoroughPickerSheet({
  visible,
  title,
  options,
  onSelect,
  onClose,
  testID = 'borough-picker',
}: BoroughPickerSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  // Room for the home indicator: the app's safe-area insets, or the window's without a provider.
  const insets = useContext(SafeAreaInsetsContext) ?? initialWindowMetrics?.insets;
  const bottomInset = insets?.bottom ?? 0;

  const close = () => {
    setQuery('');
    onClose();
  };
  const search = fold(query.trim());
  const visibleOptions = options.filter((option) =>
    search ? !option.hideWhileSearching && fold(option.label).includes(search) : true,
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        {/* The dimmed screen above the sheet: tapping it closes the sheet. */}
        <Pressable
          testID={`${testID}-backdrop`}
          accessibilityLabel={t('profile.close')}
          style={styles.backdrop}
          onPress={close}
        />
        <View
          testID={testID}
          style={[styles.sheet, { paddingBottom: Spacing.three + bottomInset }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable
              testID={`${testID}-close`}
              accessibilityRole="button"
              accessibilityLabel={t('profile.close')}
              onPress={close}
              hitSlop={8}
              style={styles.closeButton}
            >
              <MapIcon name="close" size={14} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <MapIcon name="search" size={16} color={theme.textSecondary} />
            <TextInput
              testID={`${testID}-search`}
              value={query}
              onChangeText={setQuery}
              placeholder={t('feed.boroughSearch')}
              placeholderTextColor={theme.textSecondary}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {visibleOptions.map((option) => (
              <Pressable
                key={option.key}
                testID={option.testID}
                accessibilityRole="button"
                accessibilityState={{ selected: option.selected }}
                onPress={() => {
                  setQuery('');
                  onSelect(option.key);
                }}
                style={[styles.row, option.selected && styles.rowSelected]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, option.selected && styles.rowLabelSelected]}>
                    {option.label}
                  </Text>
                  {option.detail ? <Text style={styles.rowDetail}>{option.detail}</Text> : null}
                </View>
                {option.selected ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: `${theme.shadow}66`,
    },
    sheet: {
      maxHeight: '75%',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: theme.background,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.backgroundSelected,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 17, fontWeight: '700', color: theme.text },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.backgroundElement,
    },
    searchBar: {
      height: 40,
      borderRadius: 999,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      backgroundColor: theme.backgroundElement,
    },
    searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: theme.text, paddingVertical: 0 },
    // Shrinks to fit inside the sheet's max height and scrolls.
    list: { flexGrow: 0, flexShrink: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
      borderRadius: 12,
    },
    rowSelected: { backgroundColor: theme.backgroundElement },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 15, color: theme.text },
    rowLabelSelected: { fontWeight: '700' },
    rowDetail: { fontSize: 12, color: theme.textSecondary },
    check: { fontSize: 15, fontWeight: '700', color: theme.accent },
  });
