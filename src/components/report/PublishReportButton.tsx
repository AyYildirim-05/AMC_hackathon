import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { MapIcon } from '@/components/map/MapIcon';

export type PublishReportButtonProps = {
  label: string;
  disabled: boolean;
  /** True while the report is being sent: the district's truck drives across the button. */
  sending: boolean;
  onPress: () => void;
  testID?: string;
};

const TRUCK_SIZE = 22;
/** Space between the truck and the button's edges. */
const INSET = 16;
const DRIVE_MS = 900;
const PARK_MS = 250;
const FADE_MS = 160;

/**
 * "Publish report" button with a district service truck parked at its left edge. Each time a report
 * starts sending, the truck drives to the right edge (bouncing slightly, as on a road), pauses, then
 * fades out and reappears parked at the left, ready for the next report.
 */
export function PublishReportButton({
  label,
  disabled,
  sending,
  onPress,
  testID = 'publish-report-button',
}: PublishReportButtonProps) {
  const [width, setWidth] = useState(0);
  const [drive] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));

  // The current run, so it can be stopped if the screen goes away mid-drive.
  const runRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => () => runRef.current?.stop(), []);

  // One drive per report sent, independent of how long the request takes (finishing the request
  // early does not cut the drive short).
  useEffect(() => {
    if (!sending) return;
    runRef.current?.stop();
    drive.setValue(0);
    opacity.setValue(1);
    const run = Animated.sequence([
      Animated.timing(drive, {
        toValue: 1,
        duration: DRIVE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(PARK_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
      // Back to its parking spot at the left edge while invisible, then fade back in.
      Animated.timing(drive, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
    ]);
    runRef.current = run;
    run.start();
  }, [sending, drive, opacity]);

  // From the left edge to the right edge of the button.
  const travel = Math.max(0, width - INSET * 2 - TRUCK_SIZE);
  const translateX = drive.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  // A small bounce, as if driving on a road.
  const translateY = drive.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: [0, -1.5, 0, -1.5, 0, 0],
  });

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: sending }}
      disabled={disabled}
      onPress={onPress}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Animated.View
        testID="publish-report-truck"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.truck, { opacity, transform: [{ translateX }, { translateY }] }]}
      >
        <MapIcon name="truck" size={TRUCK_SIZE} color="#FFFFFF" />
      </Animated.View>
      <View style={styles.labelArea}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#0A2540',
    justifyContent: 'center',
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.45,
    elevation: 0,
    shadowOpacity: 0,
  },
  pressed: { opacity: 0.85 },
  truck: {
    position: 'absolute',
    left: INSET,
    width: TRUCK_SIZE,
    height: TRUCK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // Drives over the label.
    zIndex: 1,
  },
  // Leaves room for the parked truck so the label stays centered and clear of it.
  labelArea: {
    paddingHorizontal: INSET + TRUCK_SIZE + 8,
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
