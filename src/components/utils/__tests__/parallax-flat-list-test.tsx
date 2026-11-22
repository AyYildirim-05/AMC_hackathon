import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ParallaxFlatList } from '@/components/utils/parallax-flat-list';

const ITEMS = ['First report', 'Second report', 'Third report'];

it('shows the header above the items, and keeps what is in the header touchable', async () => {
  const onFilter = jest.fn();
  await render(
    <ParallaxFlatList
      header={
        <Pressable testID="header-button" accessibilityRole="button" onPress={onFilter}>
          <Text>Filters</Text>
        </Pressable>
      }
      data={ITEMS}
      keyExtractor={(item) => item}
      renderItem={({ item }) => <Text>{item}</Text>}
    />,
  );

  expect(screen.getByTestId('parallax-header')).toBeOnTheScreen();
  expect(screen.getByText('Filters')).toBeOnTheScreen();
  for (const item of ITEMS) expect(screen.getByText(item)).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId('header-button'));
  expect(onFilter).toHaveBeenCalledTimes(1);
});

it('follows scrolling without errors and keeps the list content', async () => {
  await render(
    <ParallaxFlatList
      testID="list"
      header={<Text>Header</Text>}
      data={ITEMS}
      keyExtractor={(item) => item}
      renderItem={({ item }) => <Text>{item}</Text>}
    />,
  );

  await fireEvent.scroll(screen.getByTestId('list'), {
    nativeEvent: {
      contentOffset: { x: 0, y: 120 },
      contentSize: { width: 390, height: 2000 },
      layoutMeasurement: { width: 390, height: 800 },
    },
  });

  expect(screen.getByText('Header')).toBeOnTheScreen();
  expect(screen.getByText('Third report')).toBeOnTheScreen();
});
