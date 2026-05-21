import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { RegistrationForm } from '../RegistrationForm';

describe('RegistrationForm', () => {
  it('shows inline errors for invalid email and short password', async () => {
    const user = userEvent.setup();

    render(<RegistrationForm />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await user.click(emailInput);
    await user.tab();

    await user.type(passwordInput, 'short');
    await user.tab();

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('keeps submit disabled until all fields are valid', async () => {
    const user = userEvent.setup();

    render(<RegistrationForm />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Register' });

    expect(submitButton).toBeDisabled();

    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, '12345678');

    expect(submitButton).toBeDisabled();

    await user.clear(emailInput);
    await user.type(emailInput, 'valid@example.com');

    expect(submitButton).toBeEnabled();
  });
});
