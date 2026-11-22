import { Image } from 'expo-image';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedButton } from '@/components/utils/themed-button';
import { ThemedText } from '@/components/utils/themed-text';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface OnboardingPresentationModalProps {
  /** Controls whether the presentation modal is shown. */
  visible: boolean;
  /** Called when the user finishes or skips the presentation tour. */
  onComplete: () => void;
  /** Optional testID for automated testing. */
  testID?: string;
}

type SlideId = 'report' | 'map' | 'community' | 'timeline';

interface FeatureSlide {
  id: SlideId;
  icon: string;
  eyebrowKey:
    | 'onboarding.slides.report.eyebrow'
    | 'onboarding.slides.map.eyebrow'
    | 'onboarding.slides.community.eyebrow'
    | 'onboarding.slides.timeline.eyebrow';
  titleKey:
    | 'onboarding.slides.report.title'
    | 'onboarding.slides.map.title'
    | 'onboarding.slides.community.title'
    | 'onboarding.slides.timeline.title';
  descriptionKey:
    | 'onboarding.slides.report.description'
    | 'onboarding.slides.map.description'
    | 'onboarding.slides.community.description'
    | 'onboarding.slides.timeline.description';
  highlightKeys: readonly [
    (
      | 'onboarding.slides.report.point1'
      | 'onboarding.slides.map.point1'
      | 'onboarding.slides.community.point1'
      | 'onboarding.slides.timeline.point1'
    ),
    (
      | 'onboarding.slides.report.point2'
      | 'onboarding.slides.map.point2'
      | 'onboarding.slides.community.point2'
      | 'onboarding.slides.timeline.point2'
    ),
  ];
}

const SLIDES: readonly FeatureSlide[] = [
  {
    id: 'report',
    icon: '📍',
    eyebrowKey: 'onboarding.slides.report.eyebrow',
    titleKey: 'onboarding.slides.report.title',
    descriptionKey: 'onboarding.slides.report.description',
    highlightKeys: ['onboarding.slides.report.point1', 'onboarding.slides.report.point2'],
  },
  {
    id: 'map',
    icon: '🗺️',
    eyebrowKey: 'onboarding.slides.map.eyebrow',
    titleKey: 'onboarding.slides.map.title',
    descriptionKey: 'onboarding.slides.map.description',
    highlightKeys: ['onboarding.slides.map.point1', 'onboarding.slides.map.point2'],
  },
  {
    id: 'community',
    icon: '💬',
    eyebrowKey: 'onboarding.slides.community.eyebrow',
    titleKey: 'onboarding.slides.community.title',
    descriptionKey: 'onboarding.slides.community.description',
    highlightKeys: ['onboarding.slides.community.point1', 'onboarding.slides.community.point2'],
  },
  {
    id: 'timeline',
    icon: '🏛️',
    eyebrowKey: 'onboarding.slides.timeline.eyebrow',
    titleKey: 'onboarding.slides.timeline.title',
    descriptionKey: 'onboarding.slides.timeline.description',
    highlightKeys: ['onboarding.slides.timeline.point1', 'onboarding.slides.timeline.point2'],
  },
];

export function OnboardingPresentationModal({
  visible,
  onComplete,
  testID = 'onboarding-presentation-modal',
}: OnboardingPresentationModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const slideWidth = Math.min(windowWidth, MaxContentWidth);

  const flatListRef = useRef<FlatList<FeatureSlide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [demoUpvoted, setDemoUpvoted] = useState(false);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const goToIndex = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, index));
    setCurrentIndex(clamped);
    flatListRef.current?.scrollToIndex({ index: clamped, animated: true });
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (slideWidth <= 0) return;
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
      setCurrentIndex(Math.max(0, Math.min(SLIDES.length - 1, nextIndex)));
    },
    [slideWidth],
  );

  const handlePrimaryAction = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      goToIndex(currentIndex + 1);
    }
  };

  const renderFeaturePreview = (slideId: SlideId) => {
    if (slideId === 'report') {
      return (
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.tint,
            },
          ]}
        >
          <View style={styles.previewRowBetween}>
            <View style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
              <Text style={[styles.chipMono, { color: theme.text }]}>OPENNORTH ✓</Text>
            </View>
            <Text style={[styles.metaMono, { color: theme.textSecondary }]}>MTL-311-2026</Text>
          </View>
          <Text style={[styles.previewHeading, { color: theme.text }]}>Le Plateau-Mont-Royal</Text>
          <Text style={[styles.previewSub, { color: theme.textSecondary }]}>
            45.5298° N, -73.5751° W • 1250 Rue Rachel Est
          </Text>
          <View style={styles.previewChipRow}>
            <View style={[styles.smallTag, { backgroundColor: theme.background }]}>
              <Text style={[styles.smallTagText, { color: theme.text }]}>📷 3 photos</Text>
            </View>
            <View style={[styles.smallTag, { backgroundColor: theme.background }]}>
              <Text style={[styles.smallTagText, { color: theme.success }]}>GPS Verified</Text>
            </View>
          </View>
        </View>
      );
    }

    if (slideId === 'map') {
      return (
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.tint,
            },
          ]}
        >
          <View style={styles.previewChipRow}>
            <View style={[styles.chip, { backgroundColor: theme.accent }]}>
              <Text style={[styles.chipLabel, { color: theme.buttonText }]}>
                {t('map.categoryShort.traffic_safety')}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
              <Text style={[styles.chipLabel, { color: theme.text }]}>
                {t('map.categoryShort.roads_potholes')}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
              <Text style={[styles.chipLabel, { color: theme.text }]}>
                {t('map.categoryShort.streetlights_utilities')}
              </Text>
            </View>
          </View>
          <View style={styles.statusLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.danger }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                {t('issue.status.not_started')}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                {t('issue.status.in_progress')}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                {t('issue.status.resolved')}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    if (slideId === 'community') {
      const voteCount = demoUpvoted ? 25 : 24;
      return (
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.tint,
            },
          ]}
        >
          <View style={styles.previewRowBetween}>
            <Text style={[styles.previewHeading, { color: theme.text }]}>@marc_velo</Text>
            <View style={[styles.smallTag, { backgroundColor: theme.background }]}>
              <Text style={[styles.smallTagText, { color: theme.success }]}>✓ 8</Text>
            </View>
          </View>
          <Text style={[styles.previewSub, { color: theme.textSecondary }]}>
            {t('onboarding.slides.community.sampleComment')}
          </Text>
          <View style={styles.previewChipRow}>
            <Pressable
              testID="onboarding-demo-upvote"
              accessibilityRole="button"
              onPress={() => setDemoUpvoted((prev) => !prev)}
              style={[
                styles.chip,
                {
                  backgroundColor: demoUpvoted ? theme.accent : theme.backgroundSelected,
                },
              ]}
            >
              <Text
                style={[styles.chipLabel, { color: demoUpvoted ? theme.buttonText : theme.text }]}
              >
                ▲ {voteCount}
              </Text>
            </Pressable>
            <View style={[styles.chip, { backgroundColor: theme.background }]}>
              <Text style={[styles.chipLabel, { color: theme.text }]}>📷 +2</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.previewCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.tint,
          },
        ]}
      >
        <View style={styles.timelinePreview}>
          {[
            { label: t('onboarding.slides.timeline.step1'), done: true },
            { label: t('onboarding.slides.timeline.step2'), done: true },
            { label: t('onboarding.slides.timeline.step3'), done: false },
          ].map((step, index) => (
            <View key={step.label} style={styles.timelineRow}>
              <View
                style={[
                  styles.timelineNode,
                  {
                    backgroundColor: step.done ? theme.success : theme.backgroundSelected,
                    borderColor: step.done ? theme.success : theme.tint,
                  },
                ]}
              >
                <Text style={[styles.timelineNodeText, { color: theme.buttonText }]}>
                  {step.done ? '✓' : String(index + 1)}
                </Text>
              </View>
              <Text
                style={[
                  styles.timelineLabel,
                  { color: step.done ? theme.text : theme.textSecondary },
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onComplete}
    >
      <SafeAreaView
        testID={testID}
        style={[styles.safeArea, { backgroundColor: theme.background }]}
      >
        <View style={styles.shell}>
          {/* Header with brand icon & Skip action */}
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <View
                style={[
                  styles.miniLogoFrame,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.tint,
                  },
                ]}
              >
                <Image
                  source={require('@/assets/images/montone-icon.png')}
                  style={styles.miniLogo}
                  contentFit="cover"
                />
              </View>
              <Text style={[styles.brandWordmark, { color: theme.text }]}>Montone</Text>
            </View>

            <Pressable
              testID="onboarding-skip-button"
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.skip')}
              onPress={onComplete}
              hitSlop={12}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={[styles.skipText, { color: theme.textSecondary }]}>
                {t('onboarding.skip')}
              </Text>
            </Pressable>
          </View>

          {/* Horizontal swipeable feature presentation slides */}
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            getItemLayout={(_, index) => ({
              length: slideWidth,
              offset: slideWidth * index,
              index,
            })}
            style={styles.pager}
            renderItem={({ item }) => (
              <View style={[styles.slide, { width: slideWidth }]}>
                <View style={styles.slideInner}>
                  {/* Feature emblem */}
                  <View
                    style={[
                      styles.iconHero,
                      {
                        backgroundColor: theme.neutral200,
                        borderColor: theme.tint,
                        shadowColor: theme.shadow,
                      },
                    ]}
                  >
                    <Text style={styles.iconHeroEmoji}>{item.icon}</Text>
                  </View>

                  {/* Copy */}
                  <View style={styles.copyBlock}>
                    <Text style={[styles.eyebrow, { color: theme.textSecondary }]}>
                      {t(item.eyebrowKey)}
                    </Text>
                    <ThemedText type="h2" align="center" style={styles.slideTitle}>
                      {t(item.titleKey)}
                    </ThemedText>
                    <Text style={[styles.slideDescription, { color: theme.textSecondary }]}>
                      {t(item.descriptionKey)}
                    </Text>
                  </View>

                  {/* Interactive feature preview */}
                  {renderFeaturePreview(item.id)}

                  {/* Highlight bullets */}
                  <View style={styles.highlightsList}>
                    {item.highlightKeys.map((key) => (
                      <View
                        key={key}
                        style={[
                          styles.highlightPill,
                          {
                            backgroundColor: theme.backgroundElement,
                            borderColor: theme.tint,
                          },
                        ]}
                      >
                        <Text style={[styles.highlightCheck, { color: theme.success }]}>✓</Text>
                        <Text style={[styles.highlightText, { color: theme.text }]}>{t(key)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          />

          {/* Pagination dots + navigation controls */}
          <View style={styles.footer}>
            <View style={styles.dotsRow} accessibilityRole="tablist">
              {SLIDES.map((slide, index) => {
                const active = index === currentIndex;
                return (
                  <Pressable
                    key={slide.id}
                    testID={`onboarding-dot-${index}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t('onboarding.slideIndicator', {
                      current: index + 1,
                      total: SLIDES.length,
                    })}
                    onPress={() => goToIndex(index)}
                    hitSlop={8}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: active ? theme.accent : theme.backgroundSelected,
                        width: active ? 28 : 8,
                      },
                    ]}
                  />
                );
              })}
            </View>

            <View style={styles.actionsRow}>
              {currentIndex > 0 ? (
                <ThemedButton
                  testID="onboarding-back-button"
                  type="secondary"
                  size="medium"
                  rounded
                  onPress={() => goToIndex(currentIndex - 1)}
                  style={styles.backBtn}
                >
                  {t('onboarding.back')}
                </ThemedButton>
              ) : null}

              <ThemedButton
                testID={isLastSlide ? 'onboarding-start-button' : 'onboarding-next-button'}
                type="primary"
                size="medium"
                rounded
                onPress={handlePrimaryAction}
                style={styles.primaryBtn}
              >
                {isLastSlide ? t('onboarding.getStarted') : t('onboarding.next')}
              </ThemedButton>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  miniLogoFrame: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  miniLogo: {
    width: 34,
    height: 34,
  },
  brandWordmark: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  skipButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  skipText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  slideInner: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconHero: {
    width: 84,
    height: 84,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  iconHeroEmoji: {
    fontSize: 38,
  },
  copyBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 420,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  slideTitle: {
    fontFamily: Fonts.rounded,
  },
  slideDescription: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  previewCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  previewRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  previewHeading: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '700',
  },
  previewSub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  previewChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: 999,
  },
  chipMono: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  chipLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
  },
  metaMono: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  smallTag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  smallTagText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
  },
  statusLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
  },
  timelinePreview: {
    gap: Spacing.two,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineNodeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  timelineLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  highlightsList: {
    width: '100%',
    maxWidth: 420,
    gap: Spacing.two,
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  highlightCheck: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '800',
  },
  highlightText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backBtn: {
    minWidth: 104,
  },
  primaryBtn: {
    flex: 1,
  },
});

export default OnboardingPresentationModal;
