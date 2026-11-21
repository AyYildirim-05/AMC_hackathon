import { View, type ViewProps, type ViewStyle } from 'react-native';

import { Spacing, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ViewDirection = 'vertical' | 'horizontal';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
  /** Lays children out top-to-bottom (`vertical`, the default) or left-to-right (`horizontal`). */
  direction?: ViewDirection;
  /** Space between children: a `Spacing` token (e.g. `'two'`) or a number of points. */
  gap?: keyof typeof Spacing | number;
  /** Cross-axis alignment: vertical centering in a horizontal view, and vice versa. */
  align?: ViewStyle['alignItems'];
  /** Main-axis distribution, e.g. `'space-between'` to push the last child to the end. */
  justify?: ViewStyle['justifyContent'];
  /** Let children move to the next line when they run out of room. */
  wrap?: boolean;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  type,
  direction = 'vertical',
  gap,
  align,
  justify,
  wrap,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();

  const layout: ViewStyle = {
    flexDirection: direction === 'horizontal' ? 'row' : 'column',
    ...(gap !== undefined && { gap: typeof gap === 'number' ? gap : Spacing[gap] }),
    ...(align && { alignItems: align }),
    ...(justify && { justifyContent: justify }),
    ...(wrap && { flexWrap: 'wrap' }),
  };

  return (
    <View
      style={[{ backgroundColor: theme[type ?? 'background'] }, layout, style]}
      {...otherProps}
    />
  );
}
