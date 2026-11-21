import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import Toaster from './Toaster';
import { showToast } from '../../utils/toast';

jest.useFakeTimers();

test('a password error shows on screen, announced as an alert, and closes itself', () => {
  render(<Toaster />);
  act(() => { showToast('alert', 'Passwords do not match'); });
  expect(screen.getByTestId('toast')).toHaveAttribute('data-kind', 'error');
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match');
  act(() => { jest.advanceTimersByTime(8100); });
  expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
});

test('success is polite, the same message twice shows once, and it can be dismissed', () => {
  render(<Toaster />);
  act(() => { showToast('success', 'Password changed'); showToast('success', 'Password changed'); });
  expect(screen.getAllByText('Password changed')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('Password changed');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByText('Password changed')).not.toBeInTheDocument();
});
