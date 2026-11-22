import { fireEvent, render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { PublishReportButton } from '@/components/report/PublishReportButton';

/** Drives across the button: the 900 ms move to the right edge (not the fades). */
const drives = (spy: jest.SpyInstance) =>
  spy.mock.calls.filter(([, config]) => {
    const { toValue, duration } = config as { toValue: number; duration: number };
    return toValue === 1 && duration === 900;
  }).length;

describe('PublishReportButton', () => {
  let timing: jest.SpyInstance;
  beforeEach(() => {
    timing = jest.spyOn(Animated, 'timing');
  });
  afterEach(() => timing.mockRestore());

  it('shows the label with the district truck parked, and does not drive while idle', async () => {
    await render(
      <PublishReportButton
        label="Publish report"
        disabled={false}
        sending={false}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Publish report' })).toBeOnTheScreen();
    expect(screen.getByText('Publish report')).toBeOnTheScreen();
    expect(
      screen.getByTestId('publish-report-truck', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(drives(timing)).toBe(0);
  });

  it('drives the truck across once each time a report starts sending', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(
      <PublishReportButton
        label="Publish report"
        disabled={false}
        sending={false}
        onPress={onPress}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Publish report' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(
      <PublishReportButton label="Publish report" disabled sending onPress={onPress} />,
    );
    expect(drives(timing)).toBe(1);
    expect(screen.getByRole('button', { name: 'Publish report' })).toBeBusy();

    // Done sending: no second drive until the next report.
    await rerender(
      <PublishReportButton
        label="Publish report"
        disabled={false}
        sending={false}
        onPress={onPress}
      />,
    );
    expect(drives(timing)).toBe(1);
  });

  it('cannot be pressed while disabled', async () => {
    const onPress = jest.fn();
    await render(
      <PublishReportButton label="Publish report" disabled sending={false} onPress={onPress} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Publish report' }));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Publish report' })).toBeDisabled();
  });
});
