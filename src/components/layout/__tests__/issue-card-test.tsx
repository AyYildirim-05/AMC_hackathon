import i18n from '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { TEST_ISSUES } from '../../../../test/fixtures';
import { IssueCard } from '@/components/layout/IssueCard';
import { computeInitials, formatAddress, formatIssueDate } from '@/components/utils/formatter';
import { type Issue } from '@/models/Issue';

const mockBikeIssue = TEST_ISSUES[0];
const mockElevatorIssue = TEST_ISSUES[1];
const mockPotholeIssue = TEST_ISSUES[2];

describe('IssueCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
  });

  it('renders the mockup bike lane issue with all expected fields and badges in French', async () => {
    await render(<IssueCard issue={mockBikeIssue} />);

    // Header: user, initials, address, status
    expect(screen.getByText('@marc_velo')).toBeOnTheScreen();
    expect(screen.getByText('MG')).toBeOnTheScreen();
    expect(screen.getByText('1250 Rue Rachel Est, Montréal')).toBeOnTheScreen();
    expect(screen.getByText('En cours')).toBeOnTheScreen();

    // Title & description
    expect(screen.getByText('Blocked bike lane on Rue Rachel Est')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Construction barriers are blocking the protected bike lane near Parc La Fontaine with no marked detour.',
      ),
    ).toBeOnTheScreen();

    // Image & photo badge
    expect(screen.getByText('1 photo')).toBeOnTheScreen();

    // Official response callout
    expect(screen.getByText('@camille_mtl')).toBeOnTheScreen();
    expect(screen.getByText('Gestionnaire Arrondissement')).toBeOnTheScreen();
    expect(
      screen.getByText('“Inspection team notified. Barriers moved back...”'),
    ).toBeOnTheScreen();

    // Tags
    expect(screen.getByText('Sécurité cycliste')).toBeOnTheScreen();
    expect(screen.getByText('#MTL-311-2026-88412')).toBeOnTheScreen();

    // Footer actions
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.getByText('1 confirmé')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
  });

  it('renders translated badges when language is English', async () => {
    await i18n.changeLanguage('en');
    await render(<IssueCard issue={mockBikeIssue} />);

    expect(screen.getByText('In progress')).toBeOnTheScreen();
    expect(screen.getByText('Cycling safety')).toBeOnTheScreen();
    expect(screen.getByText('1 confirmed')).toBeOnTheScreen();
  });

  it('renders author information from issue.author', async () => {
    const customIssue: Issue = {
      ...mockBikeIssue,
      author: {
        username: 'velo_fanatic',
        name: 'Jean Tremblay',
        initials: 'JT',
      },
    };
    await render(<IssueCard issue={customIssue} />);

    expect(screen.getByText('@velo_fanatic')).toBeOnTheScreen();
    expect(screen.getByText('JT')).toBeOnTheScreen();
  });

  it('omits photo section when issue has no images', async () => {
    await render(<IssueCard issue={mockElevatorIssue} />);

    expect(screen.queryByText(/photo/i)).toBeNull();
  });

  it('omits official response when issue has no official_response', async () => {
    const issueWithoutResponse: Issue = {
      ...mockBikeIssue,
      official_response: null,
    };
    await render(<IssueCard issue={issueWithoutResponse} />);

    expect(screen.queryByText('@camille_mtl')).toBeNull();
  });

  it('renders official response from issue.official_response', async () => {
    const customIssue: Issue = {
      ...mockElevatorIssue,
      official_response: {
        author: 'stm_official',
        role: 'Technicien STM',
        comment: 'Pièce de rechange commandée.',
      },
    };
    await render(<IssueCard issue={customIssue} />);

    expect(screen.getByText('@stm_official')).toBeOnTheScreen();
    expect(screen.getByText('Technicien STM')).toBeOnTheScreen();
    expect(screen.getByText('“Pièce de rechange commandée.”')).toBeOnTheScreen();
  });

  it('omits 311 reference pill when external_311_ref is null', async () => {
    await render(<IssueCard issue={mockPotholeIssue} />);

    expect(screen.queryByText(/#MTL/i)).toBeNull();
  });

  it('handles action callbacks when tapped', async () => {
    const onPress = jest.fn();
    const onUpvote = jest.fn();
    const onConfirmResolution = jest.fn();
    const onCommentsPress = jest.fn();
    const onImagePress = jest.fn();

    await render(
      <IssueCard
        testID="test-issue-card"
        issue={mockBikeIssue}
        onPress={onPress}
        onUpvote={onUpvote}
        onConfirmResolution={onConfirmResolution}
        onCommentsPress={onCommentsPress}
        onImagePress={onImagePress}
      />,
    );

    // Press card
    await fireEvent.press(screen.getByTestId('test-issue-card'));
    expect(onPress).toHaveBeenCalledTimes(1);

    // Press upvote button
    await fireEvent.press(screen.getByTestId('issue-upvote-button'));
    expect(onUpvote).toHaveBeenCalledTimes(1);

    // Press confirm resolution button
    await fireEvent.press(screen.getByTestId('issue-confirm-button'));
    expect(onConfirmResolution).toHaveBeenCalledTimes(1);

    // Press comments button
    await fireEvent.press(screen.getByTestId('issue-comments-button'));
    expect(onCommentsPress).toHaveBeenCalledTimes(1);

    // Press photo
    await fireEvent.press(screen.getByTestId('issue-photo-button'));
    expect(onImagePress).toHaveBeenCalledWith(0);
  });

  it('displays weather element pills when the issue has weather elements', async () => {
    const weatherIssue: Issue = {
      ...TEST_ISSUES[0],
      elements: ['snow_ice', 'freezing_rain'],
    };

    await render(<IssueCard issue={weatherIssue} />);

    expect(screen.getByTestId('issue-element-pill-snow_ice')).toBeOnTheScreen();
    expect(screen.getByTestId('issue-element-pill-freezing_rain')).toBeOnTheScreen();
  });
});

describe('IssueCard Helpers', () => {
  it('formats address without trailing province and postal code', () => {
    expect(formatAddress('1250 Rue Rachel Est, Montréal, QC H2J 2J9')).toBe(
      '1250 Rue Rachel Est, Montréal',
    );
    expect(formatAddress('505 Rue Sainte-Catherine Est, Montréal')).toBe(
      '505 Rue Sainte-Catherine Est, Montréal',
    );
  });

  it('formats date to short day and month', () => {
    expect(formatIssueDate('2026-11-18T08:00:00.000Z', 'fr')).toBe('18 nov');
  });

  it('computes avatar initials accurately', () => {
    expect(computeInitials('marc_velo')).toBe('MV');
    expect(computeInitials('Sarah Chen')).toBe('SC');
    expect(computeInitials('@camille')).toBe('CA');
    expect(computeInitials('')).toBe('AV');
  });
  describe('collapsible', () => {
    const description =
      'Construction barriers are blocking the protected bike lane near Parc La Fontaine with no marked detour.';

    it('shows only the top part (header and title) until tapped', async () => {
      await render(<IssueCard issue={mockBikeIssue} collapsible testID="card" />);

      expect(screen.getByText('@marc_velo')).toBeOnTheScreen();
      expect(screen.getByText('En cours')).toBeOnTheScreen();
      expect(screen.getByText('Blocked bike lane on Rue Rachel Est')).toBeOnTheScreen();
      // The other parts stay mounted (each measures its natural height) but folded: out of reach.
      expect(screen.queryByText(description)).toBeNull();
      expect(screen.getByText(description, { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByText('@camille_mtl')).toBeNull();
      expect(screen.queryByTestId('issue-upvote-button')).toBeNull();
      expect(screen.getByTestId('card')).not.toBeExpanded();
    });

    it('unfolds every part on tap, then folds them back on a second tap', async () => {
      const onPress = jest.fn();
      const onUpvote = jest.fn();
      await render(
        <IssueCard
          issue={mockBikeIssue}
          collapsible
          onPress={onPress}
          onUpvote={onUpvote}
          testID="card"
        />,
      );

      await fireEvent.press(screen.getByTestId('card'));

      expect(screen.getByTestId('card')).toBeExpanded();
      expect(screen.getByText(description)).toBeOnTheScreen();
      expect(screen.getByText('1 photo')).toBeOnTheScreen();
      expect(screen.getByText('@camille_mtl')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('issue-upvote-button'));
      expect(onUpvote).toHaveBeenCalledTimes(1);
      // A collapsible card's tap unfolds it; it does not also call onPress.
      expect(onPress).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByTestId('card'));

      expect(screen.getByTestId('card')).not.toBeExpanded();
      expect(screen.queryByText(description)).toBeNull();
      expect(screen.queryByTestId('issue-upvote-button')).toBeNull();
    });

    it('is off by default: the whole card shows and a tap calls onPress', async () => {
      const onPress = jest.fn();
      await render(<IssueCard issue={mockBikeIssue} onPress={onPress} testID="card" />);

      expect(screen.getByText(description)).toBeOnTheScreen();
      expect(screen.getByTestId('issue-upvote-button')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('card'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
