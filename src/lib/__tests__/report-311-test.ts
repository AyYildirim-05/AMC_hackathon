import { Linking } from 'react-native';

import { setLanguage } from '@/i18n';
import { build311Email, call311, mailtoUrl, open311Email, reportReference } from '@/lib/report-311';

const issue = {
  id: '64b7f0c2a1b2c3d4e5f60719',
  title: 'Nid-de-poule profond',
  description: 'Un trou de 30 cm devant l’école.',
  category: 'roads_potholes' as const,
  address: '1250 Rue Rachel Est, Montréal',
  latitude: 45.5263121,
  longitude: -73.5774209,
  images: ['https://res.cloudinary.com/demo/image/upload/v1/issues/a.jpg'],
};

describe('311 email hand-off', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await setLanguage('en');
  });

  it('gives each report a short MonTone reference', () => {
    expect(reportReference('64b7f0c2a1b2c3d4e5f60719')).toBe('MonTone #F60719');
    expect(reportReference('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe('MonTone #C3D479');
  });

  it('writes the whole report into the email, in French', async () => {
    await setLanguage('fr');
    const email = build311Email(issue, { districtName: 'Le Plateau-Mont-Royal', to: '' });

    expect(email.subject).toBe('[MonTone #F60719] Nids-de-poule — 1250 Rue Rachel Est, Montréal');
    expect(email.body).toContain('Bonjour,');
    expect(email.body).toContain('Titre : Nid-de-poule profond');
    expect(email.body).toContain('Description : Un trou de 30 cm devant l’école.');
    expect(email.body).toContain('Adresse : 1250 Rue Rachel Est, Montréal');
    expect(email.body).toContain('Arrondissement : Le Plateau-Mont-Royal');
    expect(email.body).toContain('Coordonnées GPS : 45.526312, -73.577421');
    expect(email.body).toContain('https://www.openstreetmap.org/?mlat=45.526312&mlon=-73.577421');
    expect(email.body).toContain(
      'Photos :\n- https://res.cloudinary.com/demo/image/upload/v1/issues/a.jpg',
    );
    expect(email.body).toContain('Référence MonTone : MonTone #F60719');
    expect(email.body).toContain('Envoyé avec MonTone.');
  });

  it('writes it in English, leaving out what the report does not have', async () => {
    await setLanguage('en');
    const email = build311Email({ ...issue, description: '', images: [] });

    expect(email.body).toContain('Hello,');
    expect(email.body).toContain('Address: 1250 Rue Rachel Est, Montréal');
    expect(email.body).not.toContain('Description:');
    expect(email.body).not.toContain('Photos');
    expect(email.body).not.toContain('Borough');
  });

  it('builds a mailto link that keeps every character', () => {
    const url = mailtoUrl({ to: 'borough@example.org', subject: 'A & B?', body: 'x\ny = 1%' });
    expect(url).toBe('mailto:borough%40example.org?subject=A%20%26%20B%3F&body=x%0Ay%20%3D%201%25');
  });

  it('opens the mail app, and reports when there is none', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined);
    expect(await open311Email({ to: '', subject: 's', body: 'b' })).toBe(true);
    expect(open).toHaveBeenCalledWith('mailto:?subject=s&body=b');

    open.mockRejectedValueOnce(new Error('no handler'));
    expect(await open311Email({ to: '', subject: 's', body: 'b' })).toBe(false);
  });

  it('calls the 311 line', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined);
    expect(await call311()).toBe(true);
    expect(open).toHaveBeenCalledWith('tel:5148720311');
  });
});
