// QR codes for shared links: the dialog draws a scannable code for the link it is given
// (in the browser — nothing is sent anywhere), asks for the link only when opened, and
// offers Download / Print / Copy.

import { TextEncoder } from 'util';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QrCodeButton, { makeQrDataUrl } from './QrCodeButton';

// jsdom has no TextEncoder (every browser does); the QR encoder needs it.
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;

describe('QrCodeButton', () => {
  test('draws a PNG QR code for a link', async () => {
    const png = await makeQrDataUrl('https://app.example.com/s/Abc123Def456');
    expect(png).toMatch(/^data:image\/png;base64,/);
  });

  test('opens a dialog with the code and the link; the link is fetched once, only when opened', async () => {
    const getUrl = jest.fn().mockResolvedValue('https://app.example.com/s/Abc123Def456');
    render(<QrCodeButton getUrl={getUrl} title="Book with Dr Lee" description="Scan to book" />);
    expect(getUrl).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /qr code/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Book with Dr Lee' });
    expect(dialog).toBeInTheDocument();
    const img = await screen.findByAltText('QR code for https://app.example.com/s/Abc123Def456');
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(screen.getByText('https://app.example.com/s/Abc123Def456')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download png/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /print/i })).toBeEnabled();
    expect(getUrl).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('accepts a plain link and says so when there is none', async () => {
    render(<QrCodeButton getUrl="" title="Invitation" />);
    await userEvent.click(screen.getByRole('button', { name: /qr code/i }));
    expect(await screen.findByText(/no link to show/i)).toBeInTheDocument();
  });
});
