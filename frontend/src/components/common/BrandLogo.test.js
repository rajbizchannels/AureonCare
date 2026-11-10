// The tagline has to be readable.
//
// The header used one 1050x350 PNG displayed 36px tall. Measured on the source artwork,
// the "Health | Efficiency | Growth" band is 37px of those 350 — so on screen it landed at
// 3.8 CSS pixels, where the strokes fall below a pixel and the browser averages them into
// a grey smear. That is what "blurred" was. It cannot be fixed by sharpening or by a
// higher-resolution source, because the problem is the final size.
//
// The fix is that the tagline is no longer part of the picture: it is live text, drawn as
// vectors, crisp at any size and zoom. These checks pin the two properties that make that
// true — it is TEXT, and it is set at a size a person can read — because both can be
// undone by a well-meaning tweak that puts it back inside an image or shrinks it to fit.

import React from 'react';
import { render, screen } from '@testing-library/react';
import BrandLogo from './BrandLogo';

const TAGLINE = 'Health | Efficiency | Growth';

test('the tagline is live text, not part of an image', () => {
  const { container } = render(<BrandLogo theme="light" />);
  const el = screen.getByText(TAGLINE);
  expect(el).toBeInTheDocument();
  // A text node, so the browser draws it as vectors at whatever the device's pixel
  // density is — the whole point.
  expect(el.tagName).not.toBe('IMG');
  // And no image is carrying it in its alt text instead.
  for (const img of container.querySelectorAll('img')) {
    expect(img.getAttribute('alt') || '').not.toContain('Health');
  }
});

test('the tagline is set at a size that can actually be read', () => {
  // 3.8px was the old effective size. Anything under about 9px is the same failure in a
  // different form, so this is the floor the component must not drop below.
  render(<BrandLogo theme="light" size={40} />);
  const px = parseFloat(screen.getByText(TAGLINE).style.fontSize);
  expect(px).toBeGreaterThanOrEqual(9);
});

test('it stays readable even when the lockup is asked to be small', () => {
  render(<BrandLogo theme="light" size={20} />);
  const px = parseFloat(screen.getByText(TAGLINE).style.fontSize);
  expect(px).toBeGreaterThanOrEqual(9);
});

test('the lockup scales as a unit', () => {
  const { container, rerender } = render(<BrandLogo theme="light" size={40} />);
  const markAt40 = parseFloat(container.querySelector('img').style.height);
  rerender(<BrandLogo theme="light" size={80} />);
  const markAt80 = parseFloat(container.querySelector('img').style.height);
  expect(markAt40).toBe(40);
  expect(markAt80).toBe(80);
  // The wordmark grows with it rather than staying pinned.
  expect(parseFloat(container.querySelectorAll('img')[1].style.height)).toBeGreaterThan(20);
});

test('the wordmark carries the accessible name and the mark does not repeat it', () => {
  const { container } = render(<BrandLogo theme="light" />);
  const imgs = container.querySelectorAll('img');
  expect(imgs).toHaveLength(2);
  // The A is decoration beside the wordmark; announcing it twice is noise.
  expect(imgs[0]).toHaveAttribute('aria-hidden', 'true');
  expect(imgs[1]).toHaveAttribute('alt', 'AureonCare');
});

test('the tagline can be dropped where there is no room for it', () => {
  render(<BrandLogo theme="light" showTagline={false} />);
  expect(screen.queryByText(TAGLINE)).toBeNull();
});

test('the tagline colour changes for dark mode', () => {
  // The artwork's green (#108050) does not carry against a slate background.
  const { rerender } = render(<BrandLogo theme="light" />);
  const light = screen.getByText(TAGLINE).style.color;
  rerender(<BrandLogo theme="dark" />);
  const dark = screen.getByText(TAGLINE).style.color;
  expect(dark).not.toBe(light);
});

test('it points at the cut-down assets, not the old combined logo', () => {
  // aureoncare-logo-wide.png is the one with the tagline baked in at 37px; using it here
  // would bring the blur straight back.
  const { container } = render(<BrandLogo theme="light" />);
  const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
  expect(srcs).toEqual(['/assets/aureoncare-mark.png', '/assets/aureoncare-wordmark.png']);
  expect(srcs.join()).not.toContain('logo-wide');
});
