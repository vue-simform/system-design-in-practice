import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
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

  it('shows inline error for invalid email format', async () => {
    const user = userEvent.setup();

    render(<RegistrationForm />);

    const emailInput = screen.getByLabelText('Email');
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
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

  it('submits valid values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<RegistrationForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'valid@example.com');
    await user.type(screen.getByLabelText('Password'), '12345678');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'valid@example.com',
      password: '12345678',
    });
  });

  it('does not submit when values are invalid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<RegistrationForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'invalid-email');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
