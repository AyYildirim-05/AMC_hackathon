/**
 * Stand-in for react-native-reanimated in Jest (the real library needs the native worklets runtime).
 * Mapped for every test in package.json `moduleNameMapper`; a test can still `jest.mock` its own.
 *
 * Animations jump straight to their target, so tests see each animation's end state.
 */
import { useState } from 'react';
import { Easing as RNEasing, FlatList, Image, ScrollView, Text, View } from 'react-native';

type SharedValue<T> = { value: T; get: () => T; set: (next: T) => void };

function makeShared<T>(initial: T): SharedValue<T> {
  let current = initial;
  return {
    get value() {
      return current;
    },
    set value(next: T) {
      current = next;
    },
    get: () => current,
    set: (next: T) => {
      current = next;
    },
  };
}

export function useSharedValue<T>(initial: T): SharedValue<T> {
  const [shared] = useState(() => makeShared(initial));
  return shared;
}

export const useAnimatedStyle = <T,>(factory: () => T): T => factory();
export const useAnimatedProps = <T,>(factory: () => T): T => factory();
export const useDerivedValue = <T,>(factory: () => T) => makeShared(factory());

/** Scroll handlers run on the JS thread here: the list's onScroll calls them with the event. */
export function useAnimatedScrollHandler(
  handlers: ((event: unknown) => void) | { onScroll?: (event: unknown) => void },
) {
  const onScroll = typeof handlers === 'function' ? handlers : handlers.onScroll;
  return (event: { nativeEvent?: unknown }) => onScroll?.(event.nativeEvent ?? event);
}

export const withTiming = <T,>(toValue: T) => toValue;
export const withSpring = <T,>(toValue: T) => toValue;
export const withDelay = <T,>(_delay: number, animation: T) => animation;
export const withSequence = <T,>(...animations: T[]) => animations[animations.length - 1];
export const withRepeat = <T,>(animation: T) => animation;
export const cancelAnimation = () => {};
export const runOnJS =
  <A extends unknown[], R>(fn: (...args: A) => R) =>
  (...args: A) =>
    fn(...args);

export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' } as const;

/** Piecewise-linear interpolation, like Reanimated's (clamped when asked). */
export function interpolate(
  x: number,
  input: readonly number[],
  output: readonly number[],
  extrapolate?: string,
): number {
  const last = input.length - 1;
  if (extrapolate === 'clamp') {
    if (x <= input[0]) return output[0];
    if (x >= input[last]) return output[last];
  }
  let i = 1;
  while (i < last && x > input[i]) i += 1;
  const [x0, x1, y0, y1] = [input[i - 1], input[i], output[i - 1], output[i]];
  return x1 === x0 ? y1 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

export const Easing = RNEasing;

/** Entering/exiting presets and keyframes: chainable no-ops. */
function chainable(): Record<string, unknown> {
  const builder: Record<string, unknown> = new Proxy(
    {},
    { get: (_target, key) => (key === 'build' ? () => () => ({}) : () => builder) },
  );
  return builder;
}
export class Keyframe {
  constructor(_definition: unknown) {
    return chainable() as unknown as Keyframe;
  }
}
export const FadeIn = chainable();
export const FadeOut = chainable();
export const FadeInDown = chainable();
export const FadeInUp = chainable();
export const LinearTransition = chainable();

const createAnimatedComponent = <C,>(component: C) => component;

const Animated = { View, Text, ScrollView, FlatList, Image, createAnimatedComponent };
export default Animated;
