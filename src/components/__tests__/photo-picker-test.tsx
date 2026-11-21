import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import '@/i18n';
import { type PickedPhoto, PhotoPicker } from '@/components/photo-picker';

// The ripple animation isn't under test; a minimal stand-in avoids loading the native runtime.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const sharedValue = <T,>(initial: T) => {
    let value = initial;
    return { get: () => value, set: (next: T) => (value = next) };
  };
  return {
    __esModule: true,
    default: { View },
    useSharedValue: sharedValue,
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: <T,>(value: T) => value,
  };
});
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock(
  'expo-image-picker',
  () => ({
    requestCameraPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
  }),
  { virtual: true },
);

const picker = jest.mocked(ImagePicker);
const granted = { granted: true } as Awaited<
  ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>
>;
const denied = { granted: false } as Awaited<
  ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>
>;
const asset = (uri: string): ImagePicker.ImagePickerAsset => ({
  uri,
  width: 100,
  height: 100,
  mimeType: 'image/jpeg',
  fileName: `${uri}.jpg`,
});
const picked = (...uris: string[]): ImagePicker.ImagePickerResult => ({
  canceled: false,
  assets: uris.map(asset),
});
const photo = (uri: string): PickedPhoto => ({
  uri,
  mimeType: 'image/jpeg',
  fileName: `${uri}.jpg`,
});

beforeEach(() => jest.clearAllMocks());

it('adds a camera photo after permission is granted', async () => {
  picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
  picker.launchCameraAsync.mockResolvedValue(picked('a'));
  const onChange = jest.fn();
  await render(<PhotoPicker photos={[photo('old')]} onChange={onChange} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

  await waitFor(() => expect(onChange).toHaveBeenCalledWith([photo('old'), photo('a')]));
  expect(picker.launchCameraAsync).toHaveBeenCalledWith(
    expect.objectContaining({ mediaTypes: ['images'], quality: 0.6 }),
  );
});

it('explains a refused camera permission and never opens the camera', async () => {
  picker.requestCameraPermissionsAsync.mockResolvedValue(denied);
  const onChange = jest.fn();
  await render(<PhotoPicker photos={[]} onChange={onChange} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Camera access is off/);
  expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});

it('shows an error when the camera cannot open', async () => {
  picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
  picker.launchCameraAsync.mockRejectedValue(new Error('no camera on this device'));
  await render(<PhotoPicker photos={[]} onChange={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Could not open the camera/);
});

it('ignores a cancelled capture', async () => {
  picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
  picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
  const onChange = jest.fn();
  await render(<PhotoPicker photos={[]} onChange={onChange} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

  await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalled());
  expect(onChange).not.toHaveBeenCalled();
});

it('picks several library photos, limited to the remaining slots', async () => {
  picker.launchImageLibraryAsync.mockResolvedValue(picked('b', 'c', 'd'));
  const onChange = jest.fn();
  await render(<PhotoPicker photos={[photo('a')]} onChange={onChange} max={3} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));

  expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 2 }),
  );
  // A platform that ignores selectionLimit still cannot push past the maximum.
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onChange.mock.calls[0][0].map((p: PickedPhoto) => p.uri)).toEqual(['a', 'b', 'c']);
});

it('removes the chosen photo', async () => {
  const onChange = jest.fn();
  await render(<PhotoPicker photos={[photo('a'), photo('b')]} onChange={onChange} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Remove photo 1' }));

  expect(onChange).toHaveBeenCalledWith([photo('b')]);
});

it('disables both buttons once the limit is reached', async () => {
  await render(<PhotoPicker photos={[photo('a'), photo('b')]} onChange={jest.fn()} max={2} />);

  for (const name of ['Take photo', 'Choose from library']) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }
  expect(screen.getByText('You can add up to 2 photos.')).toBeOnTheScreen();
});
