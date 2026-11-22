import { type ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CardVariant = 'filled' | 'outlined' | 'elevated';
export type CardPadding = 'none' | 'small' | 'medium' | 'large';

export type ThemedCardProps = Omit<PressableProps, 'children' | 'style'> & {
  variant?: CardVariant;
  padding?: CardPadding;
  title?: string;
  subtitle?: string;
  /** Edge-to-edge content above the body, e.g. an image. */
  media?: ReactNode;
  /** Content below the body, e.g. buttons. */
  footer?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The soft shadow behind every card in the app (color: the theme's `shadow`). Cards that are not a
 * ThemedCard spread this in, so all cards cast the same shadow.
 */
export const CARD_SHADOW = {
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.18,
  shadowRadius: 6,
  elevation: 3,
} as const;

const paddingSizes: Record<CardPadding, number> = {
  none: 0,
  small: Spacing.two,
  medium: Spacing.three,
  large: Spacing.four,
};

export function ThemedCard({
  variant = 'filled',
  padding = 'medium',
  title,
  subtitle,
  media,
  footer,
  children,
  style,
  onPress,
  ...rest
}: ThemedCardProps) {
  const theme = useTheme();
  const pressable = Boolean(onPress);
  const inset = paddingSizes[padding];

  const backgroundColor = variant === 'outlined' ? theme.background : theme.cardBackground;
  // Every card casts a shadow; elevated cards a stronger one. The shadow sits on an outer frame,
  // because the inner layer clips content to the rounded corners and would clip the shadow too.
  const frameStyle: ViewStyle = {
    ...(variant === 'elevated' ? styles.elevated : styles.shadow),
    backgroundColor,
    shadowColor: theme.shadow,
  };
  const clipStyle: ViewStyle =
    variant === 'outlined'
      ? { backgroundColor, borderColor: theme.border, borderWidth: 1 }
      : { backgroundColor };

  const body = (
    <View style={[styles.body, { padding: inset }]}>
      {title || subtitle ? (
        <View style={styles.header}>
          {title ? <ThemedText type="cardTitle">{title}</ThemedText> : null}
          {subtitle ? (
            <ThemedText type="cardSubtitle" tone="secondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      {typeof children === 'string' ? (
        <ThemedText type="cardBody">{children}</ThemedText>
      ) : (
        children
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );

  const content = (
    <View style={[styles.clip, clipStyle]}>
      {media ? <View style={styles.media}>{media}</View> : null}
      {body}
    </View>
  );

  // A static card is a plain View: a disabled Pressable would be one accessibility element that
  // reports itself (and so every button inside it) as disabled.
  if (!pressable) {
    return (
      <View style={[styles.frame, frameStyle, style]} {...rest}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.frame, frameStyle, pressed && styles.pressed, style]}
      {...rest}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Outer frame: size, rounded shape and shadow. Not clipped, so the shadow shows.
  frame: {
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
  },
  // Inner layer: clips content (and the media's corners) to the rounded shape.
  clip: {
    flexGrow: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  // Soft shadow behind every card.
  shadow: CARD_SHADOW,
  elevated: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  media: {
    overflow: 'hidden',
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
  },
  body: {
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.half,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});
