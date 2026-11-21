// /find — the directory search page keeps searches private by construction:
// the query goes in a POST body (never the address bar), and a shared location is
// rounded to ~1 km in the browser before it is sent.

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DirectorySearchPage from './DirectorySearchPage';

const answer = {
  total: 1,
  understood: { specialties: ['Dermatology'], place: 'springfield', name: null, nearby: false },
  results: [{ name: 'Alpha Skin', url: '/p/alpha-skin', logo: null, specialties: ['Dermatology'], place: 'Springfield, IL',
    locations: 1, distanceKm: null, providers: [{ name: 'Dr. Rina Derm', specialization: 'Dermatology' }], moreProviders: 0 }],
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => answer });
});

test('searches with a POST body, never the URL, and shows what it understood', async () => {
  const before = window.location.href;
  render(<DirectorySearchPage />);
  await userEvent.type(screen.getByLabelText('Search practices'), 'dermatologist in springfield');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByRole('heading', { name: 'Alpha Skin' })).toBeInTheDocument();
  const [url, opts] = global.fetch.mock.calls[0];
  expect(url).toBe('/api/directory/search');
  expect(opts.method).toBe('POST');
  expect(JSON.parse(opts.body).q).toBe('dermatologist in springfield');
  expect(opts.credentials).toBe('omit');
  expect(window.location.href).toBe(before);
  expect(screen.getByText(/Dermatology · in springfield/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Alpha Skin/ })).toHaveAttribute('href', '/p/alpha-skin');
});

test('"Use my location" rounds the position to ~1 km before sending it', async () => {
  global.navigator.geolocation = {
    getCurrentPosition: (ok) => ok({ coords: { latitude: 39.781721, longitude: -89.650148 } }),
  };
  render(<DirectorySearchPage />);
  await userEvent.click(screen.getByRole('button', { name: /Use my location/ }));
  await screen.findByText(/Using your approximate location/);
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.lat).toBe(39.78);
  expect(body.lng).toBe(-89.65);
});
