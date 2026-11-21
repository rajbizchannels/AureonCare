import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InlineFormScroller from './InlineFormScroller';

// MutationObserver callbacks run as microtasks after the click.
const flush = () => new Promise((r) => setTimeout(r, 0));

// jsdom has no layout: place every element below the fold unless a test says otherwise.
let below = true;
beforeEach(() => {
  below = true;
  Element.prototype.scrollIntoView = jest.fn();
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() =>
    (below ? { top: 2000, bottom: 2300, height: 300, left: 0, right: 100, width: 100 }
      : { top: 100, bottom: 300, height: 200, left: 0, right: 100, width: 100 }));
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(); return 1; });
});
afterEach(() => jest.restoreAllMocks());

const Screen = ({ dialog = false, navigate = false }) => {
  const [open, setOpen] = useState(false);
  if (navigate && open) return <form aria-label="new page"><input aria-label="Other" /><input /></form>;
  const form = <form aria-label="add"><input aria-label="Name" /><input aria-label="City" /></form>;
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Add location</button>
      {open && (dialog ? <div role="dialog">{form}</div> : form)}
    </div>
  );
};

test('opening an inline form below the fold scrolls to it and focuses its first field', async () => {
  render(<><InlineFormScroller /><Screen /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Add location' }));
  await flush();
  expect(screen.getByRole('form', { name: 'add' }).scrollIntoView).toHaveBeenCalled();
  expect(screen.getByLabelText('Name')).toHaveFocus();
});

test('a form already on screen is left alone', async () => {
  below = false;
  render(<><InlineFormScroller /><Screen /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Add location' }));
  await flush();
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
});

const DialogToggle = () => {
  const [open, setOpen] = useState(false);
  return (
    <div role="dialog">
      <button type="button" onClick={() => setOpen(true)}>Change password</button>
      {open && <form aria-label="pw"><input aria-label="Current" /><input aria-label="New" /></form>}
    </div>
  );
};

test('a form toggled open inside a dialog that is already showing is scrolled to', async () => {
  render(<><InlineFormScroller /><DialogToggle /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
  await flush();
  expect(screen.getByRole('form', { name: 'pw' }).scrollIntoView).toHaveBeenCalled();
  expect(screen.getByLabelText('Current')).toHaveFocus();
});

test('forms in dialogs that are just opening, and pages a click navigated to, are not scrolled', async () => {
  const { unmount } = render(<><InlineFormScroller /><Screen dialog /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Add location' }));
  await flush();
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  unmount();
  render(<><InlineFormScroller /><Screen navigate /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Add location' }));
  await flush();
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
});
