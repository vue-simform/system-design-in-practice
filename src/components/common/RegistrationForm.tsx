import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { email as emailRule, minLength, required, validateField } from '../../utils/validation';

interface RegistrationFormValues {
  email: string;
  password: string;
}

interface RegistrationFormTouched {
  email: boolean;
  password: boolean;
}

interface RegistrationFormProps {
  onSubmit?: (values: RegistrationFormValues) => void;
}

const EMAIL_VALIDATORS = [
  required({ message: 'Email is required' }),
  emailRule({ message: 'Please enter a valid email address' }),
];

const PASSWORD_VALIDATORS = [
  required({ message: 'Password is required', trim: false }),
  minLength(8, { message: 'Password must be at least 8 characters', trim: false }),
];

function validateEmail(email: string): string | undefined {
  return validateField(email, EMAIL_VALIDATORS);
}

function validatePassword(password: string): string | undefined {
  return validateField(password, PASSWORD_VALIDATORS);
}

export function RegistrationForm({ onSubmit }: RegistrationFormProps) {
  const [values, setValues] = useState<RegistrationFormValues>({
    email: '',
    password: '',
  });
  const [touched, setTouched] = useState<RegistrationFormTouched>({
    email: false,
    password: false,
  });

  const errors = useMemo(
    () => ({
      email: validateEmail(values.email),
      password: validatePassword(values.password),
    }),
    [values.email, values.password]
  );

  const isFormValid = !errors.email && !errors.password;

  const handleChange =
    (field: keyof RegistrationFormValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleBlur = (field: keyof RegistrationFormTouched) => () => {
    if (field === 'email') {
      setValues((prev) => ({
        ...prev,
        email: prev.email.trim(),
      }));
    }

    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setTouched({ email: true, password: true });

    if (!isFormValid) {
      return;
    }

    onSubmit?.({
      email: values.email.trim(),
      password: values.password,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="registration-email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="registration-email"
          type="email"
          name="email"
          value={values.email}
          onChange={handleChange('email')}
          onBlur={handleBlur('email')}
          aria-invalid={touched.email && !!errors.email}
          aria-describedby={touched.email && errors.email ? 'registration-email-error' : undefined}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
            touched.email && errors.email
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
          }`}
          placeholder="name@example.com"
        />
        {touched.email && errors.email && (
          <p id="registration-email-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="registration-password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="registration-password"
          type="password"
          name="password"
          value={values.password}
          onChange={handleChange('password')}
          onBlur={handleBlur('password')}
          aria-invalid={touched.password && !!errors.password}
          aria-describedby={touched.password && errors.password ? 'registration-password-error' : undefined}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
            touched.password && errors.password
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
          }`}
          placeholder="At least 8 characters"
        />
        {touched.password && errors.password && (
          <p id="registration-password-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
            {errors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isFormValid}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Register
      </button>
    </form>
  );
}
