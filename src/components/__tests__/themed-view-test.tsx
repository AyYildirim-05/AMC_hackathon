import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

async function styleOf(element: React.ReactElement) {
  await render(element);
  return StyleSheet.flatten(screen.getByTestId('view').props.style);
}

it('is vertical by default', async () => {
  const style = await styleOf(<ThemedView testID="view" />);

  expect(style.flexDirection).toBe('column');
});

it('lays children out in a row when horizontal', async () => {
  const style = await styleOf(<ThemedView testID="view" direction="horizontal" />);

  expect(style.flexDirection).toBe('row');
});

it('maps gap tokens and numbers, plus align, justify and wrap', async () => {
  const style = await styleOf(
    <ThemedView
      testID="view"
      direction="horizontal"
      gap="two"
      align="center"
      justify="space-between"
      wrap
    />,
  );

  expect(style).toMatchObject({
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  });
  expect((await styleOf(<ThemedView testID="view" gap={10} />)).gap).toBe(10);
});

it('lets an explicit style override the layout props', async () => {
  const style = await styleOf(
    <ThemedView testID="view" direction="horizontal" style={{ flexDirection: 'row-reverse' }} />,
  );

  expect(style.flexDirection).toBe('row-reverse');
});
