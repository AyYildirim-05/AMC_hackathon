import { type ReactElement, useState } from 'react';
import { type FlatListProps, StyleSheet, View } from 'react-native';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

/** How fast the header moves relative to the content: 0.5 = half speed. */
const HEADER_SPEED = 0.5;
/** How much the header grows when the list is pulled down past its top. */
const OVERSCROLL_SCALE = 0.12;

// Reanimated's FlatList draws its own cells, so a custom CellRendererComponent is not supported.
export type ParallaxFlatListProps<T> = Omit<
  FlatListProps<T>,
  'ListHeaderComponent' | 'onScroll' | 'CellRendererComponent'
> & {
  /** Scrolls at half speed and fades out while the items slide over it. */
  header: ReactElement;
};

/**
 * A FlatList with a parallax header: the header moves at half the scroll speed and fades out as the
 * items scroll over it; pulling down past the top stretches it a little. The header stays inside
 * the list, so whatever it contains (inputs, buttons) remains touchable. Runs on the UI thread.
 */
export function ParallaxFlatList<T>({ header, ...listProps }: ParallaxFlatListProps<T>) {
  const scrollY = useSharedValue(0);
  const [headerHeight, setHeaderHeight] = useState(1);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  const headerStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      // Inside the scrolling content, moving down by (1 − speed) · y makes it travel at `speed`.
      transform: [
        { translateY: y > 0 ? y * (1 - HEADER_SPEED) : 0 },
        {
          scale: interpolate(y, [-headerHeight, 0], [1 + OVERSCROLL_SCALE, 1], Extrapolation.CLAMP),
        },
      ],
      opacity: interpolate(y, [0, headerHeight * 0.9], [1, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <Reanimated.FlatList
      {...listProps}
      onScroll={onScroll}
      scrollEventThrottle={16}
      ListHeaderComponent={
        <Reanimated.View
          testID="parallax-header"
          onLayout={(event) => setHeaderHeight(Math.max(1, event.nativeEvent.layout.height))}
          style={[styles.header, headerStyle]}
        >
          <View>{header}</View>
        </Reanimated.View>
      }
    />
  );
}

const styles = StyleSheet.create({
  // Drawn under the items, which slide over it.
  header: { zIndex: -1 },
});
