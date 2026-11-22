/**
 * Jest stand-in for react-native-maps, whose native module does not exist under Jest.
 * Applied automatically to every test (a root __mocks__ file for a node module); a test's own
 * jest.mock('react-native-maps', factory) still takes precedence.
 * MapView and Marker render plain Views that keep their props, so tests can read coordinates.
 */
import { forwardRef, useImperativeHandle } from 'react';
import { View, type ViewProps } from 'react-native';

export const mockAnimateToRegion = jest.fn();

/** View props plus the map props tests read back (other map props pass through untyped). */
type Props = ViewProps & { coordinate?: { latitude: number; longitude: number } };

const MapView = forwardRef<{ animateToRegion: typeof mockAnimateToRegion }, Props>(
  function MockMapView({ children, ...props }, ref) {
    useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
    return <View {...props}>{children}</View>;
  },
);

export function Marker({ children, ...props }: Props) {
  return <View {...props}>{children}</View>;
}

export function Polyline(props: Props) {
  return <View {...props} />;
}

export default MapView;
