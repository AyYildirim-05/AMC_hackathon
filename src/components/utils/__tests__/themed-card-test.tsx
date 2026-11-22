import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ThemedCard } from '@/components/utils/themed-card';
import { Colors } from '@/constants/theme';

it('renders title, subtitle, string body and footer', async () => {
  await render(
    <ThemedCard title="Wedding" subtitle="14 June" footer={<Text>RSVP</Text>}>
      Dinner and dancing
    </ThemedCard>,
  );

  expect(screen.getByText('Wedding')).toBeOnTheScreen();
  expect(screen.getByText('14 June')).toBeOnTheScreen();
  expect(screen.getByText('Dinner and dancing')).toBeOnTheScreen();
  expect(screen.getByText('RSVP')).toBeOnTheScreen();
});

it('is not a button without onPress', async () => {
  await render(<ThemedCard title="Static" />);

  expect(screen.queryByRole('button')).toBeNull();
});

it('leaves buttons inside a static card enabled and reachable', async () => {
  const onPress = jest.fn();
  await render(
    <ThemedCard title="Static">
      <Pressable accessibilityRole="button" accessibilityLabel="Inner" onPress={onPress} />
    </ThemedCard>,
  );

  const inner = screen.getByRole('button', { name: 'Inner' });
  expect(inner).toBeEnabled();
  await fireEvent.press(inner);
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('is a pressable button with onPress', async () => {
  const onPress = jest.fn();
  await render(<ThemedCard title="Open" onPress={onPress} accessibilityLabel="Open card" />);

  await fireEvent.press(screen.getByRole('button', { name: 'Open card' }));

  expect(onPress).toHaveBeenCalledTimes(1);
});

/** The card's outer frame (shape and shadow) and its inner layer (border, clipping). */
const cardLayers = () => {
  const frame = screen.getByTestId('card');
  const inner = frame.children[0];
  if (typeof inner === 'string') throw new Error('expected the inner layer');
  return {
    frame: StyleSheet.flatten(frame.props.style),
    inner: StyleSheet.flatten(inner.props.style),
  };
};

it('uses theme colors for the outlined variant', async () => {
  await render(<ThemedCard variant="outlined" testID="card" />);

  const { frame, inner } = cardLayers();
  expect(frame).toMatchObject({ backgroundColor: Colors.light.background });
  expect(inner).toMatchObject({
    backgroundColor: Colors.light.background,
    borderColor: Colors.light.border,
    borderWidth: 1,
    overflow: 'hidden',
  });
});

it('casts a shadow behind every variant, a stronger one when elevated', async () => {
  const shadowOf = async (variant: 'filled' | 'outlined' | 'elevated') => {
    const { unmount } = await render(<ThemedCard variant={variant} testID="card" />);
    const { frame } = cardLayers();
    await unmount();
    return frame;
  };

  for (const variant of ['filled', 'outlined'] as const) {
    expect(await shadowOf(variant)).toMatchObject({
      shadowColor: Colors.light.shadow,
      shadowOpacity: 0.18,
      elevation: 3,
    });
  }
  const elevated = await shadowOf('elevated');
  expect(elevated).toMatchObject({ shadowColor: Colors.light.shadow, elevation: 6 });
  // The shadow sits on the frame, which must not clip it.
  expect(elevated.overflow).toBeUndefined();
});
