// Feedback while a click is working.
//
// The complaint this answers: a button fired an async handler and nothing on screen
// changed until it came back, so a slow save looked exactly like a click that missed —
// and people clicked again, which for a form that posts means a duplicate record.
//
// Also covers ConfirmationModal, which used to call `onConfirm(); onClose();` and close
// instantly, leaving the work it had just started to run behind a screen showing no sign
// of it. Most forms in the app confirm through that dialog, so it is the one place worth
// getting right.

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BusyButton from './BusyButton';
import ConfirmationModal from '../modals/ConfirmationModal';

/** A promise plus the lever that settles it, so a test can hold a click mid-flight. */
const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('BusyButton', () => {
  test('shows a spinner and disables itself while the handler is pending', async () => {
    const d = deferred();
    render(<BusyButton onClick={() => d.promise}>Save</BusyButton>);
    const button = screen.getByRole('button', { name: /Save/ });

    expect(button).toBeEnabled();
    await userEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.animate-spin')).toBeTruthy();

    d.resolve();
    await waitFor(() => expect(button).toBeEnabled());
    expect(button.querySelector('.animate-spin')).toBeNull();
  });

  test('swaps the label while working, when given one', async () => {
    const d = deferred();
    render(<BusyButton onClick={() => d.promise} busyLabel="Saving…">Save</BusyButton>);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveTextContent('Saving…'));
    d.resolve();
    await waitFor(() => expect(button).toHaveTextContent('Save'));
  });

  test('a second click while working does not reach the handler', async () => {
    // The point of disabling it: double-clicking Save on a slow connection is how one
    // appointment becomes two.
    const d = deferred();
    const onClick = jest.fn(() => d.promise);
    render(<BusyButton onClick={onClick}>Save</BusyButton>);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    d.resolve();
  });

  test('becomes usable again after a FAILED handler', async () => {
    // Otherwise a failed save leaves the button dead and the only way to retry is a reload.
    const d = deferred();
    render(<BusyButton onClick={() => d.promise.catch(() => {})}>Save</BusyButton>);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    d.reject(new Error('nope'));
    await waitFor(() => expect(button).toBeEnabled());
  });

  test('does not flash a spinner for a synchronous handler', async () => {
    // A spinner that appears and vanishes in the same frame is worse than none.
    const onClick = jest.fn();
    render(<BusyButton onClick={onClick}>Go</BusyButton>);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
    expect(button).toBeEnabled();
    expect(button.querySelector('.animate-spin')).toBeNull();
  });

  test('stays disabled when the caller says it is busy', () => {
    render(<BusyButton busy onClick={jest.fn()}>Save</BusyButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('ConfirmationModal', () => {
  const open = (props = {}) => render(
    <ConfirmationModal
      theme="light"
      isOpen
      onClose={jest.fn()}
      onConfirm={jest.fn()}
      title="Confirm Save"
      confirmText="Save Changes"
      {...props}
    />,
  );

  test('stays open with a spinner while the confirmed action runs', async () => {
    const d = deferred();
    const onClose = jest.fn();
    open({ onConfirm: () => d.promise, onClose, busyText: 'Saving…' });

    await userEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    // The old behaviour: closed immediately, work invisible.
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: /Saving…/ })).toBeDisabled());

    d.resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('closes once the action finishes', async () => {
    const onClose = jest.fn();
    open({ onConfirm: async () => {}, onClose });
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  test('closes even when the action fails, so the dialog is never stuck', async () => {
    const onClose = jest.fn();
    open({ onConfirm: async () => { throw new Error('nope'); }, onClose });
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  test('a synchronous handler still closes immediately', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    open({ onConfirm, onClose });
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalled();
  });

  test('confirming twice runs the action once', async () => {
    const d = deferred();
    const onConfirm = jest.fn(() => d.promise);
    open({ onConfirm });
    const button = screen.getByRole('button', { name: /Save Changes/ });
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await userEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    d.resolve();
  });
});
