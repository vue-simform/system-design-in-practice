/**
 * Validation UI Components
 * 
 * Accessible form validation components:
 * - FormField: Complete field wrapper with label, input, error, hint
 * - ErrorMessage: Accessible error message display
 * - ValidationFeedback: Success/error visual indicators
 * - FieldHint: Helper text for form fields
 * - CharacterCounter: Character count with limit
 * 
 * Part of Feature #6: Client-Side Validation
 */

import React from 'react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ErrorMessageProps {
  error?: string;
  fieldId: string;
  show?: boolean;
}

export interface ValidationFeedbackProps {
  isValid: boolean;
  showSuccess?: boolean;
  isValidating?: boolean;
}

export interface FieldHintProps {
  hint: string;
  fieldId: string;
}

export interface CharacterCounterProps {
  current: number;
  max: number;
  showRemaining?: boolean;
  warningThreshold?: number; // Show warning when remaining < threshold
}

export interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'url' | 'tel' | 'number';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  showCharCount?: boolean;
  className?: string;
}

export interface TextAreaFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  showCharCount?: boolean;
  className?: string;
}

// ============================================================================
// ErrorMessage Component
// ============================================================================

export function ErrorMessage({ error, fieldId, show = true }: ErrorMessageProps) {
  if (!error || !show) return null;

  return (
    <p
      id={`${fieldId}-error`}
      className="mt-1 text-sm text-red-600 flex items-center gap-1"
      role="alert"
      aria-live="polite"
    >
      <svg
        className="w-4 h-4 shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
      <span>{error}</span>
    </p>
  );
}

// ============================================================================
// ValidationFeedback Component
// ============================================================================

export function ValidationFeedback({
  isValid,
  showSuccess = false,
  isValidating = false,
}: ValidationFeedbackProps) {
  if (isValidating) {
    return (
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <svg
          className="w-5 h-5 text-gray-400 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="sr-only">Validating...</span>
      </div>
    );
  }

  if (!showSuccess || !isValid) {
    return null;
  }

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2">
      <svg
        className="w-5 h-5 text-green-500"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span className="sr-only">Valid</span>
    </div>
  );
}

// ============================================================================
// FieldHint Component
// ============================================================================

export function FieldHint({ hint, fieldId }: FieldHintProps) {
  if (!hint) return null;

  return (
    <p
      id={`${fieldId}-hint`}
      className="mt-1 text-sm text-gray-500"
      role="note"
    >
      {hint}
    </p>
  );
}

// ============================================================================
// CharacterCounter Component
// ============================================================================

export function CharacterCounter({
  current,
  max,
  showRemaining = true,
  warningThreshold = 20,
}: CharacterCounterProps) {
  const remaining = max - current;
  const isOverLimit = remaining < 0;
  const isWarning = remaining < warningThreshold && remaining >= 0;

  const colorClass = isOverLimit
    ? 'text-red-600'
    : isWarning
    ? 'text-yellow-600'
    : 'text-gray-500';

  return (
    <div
      className={`text-sm ${colorClass} flex items-center gap-1`}
      aria-live="polite"
      aria-atomic="true"
    >
      {showRemaining ? (
        <>
          <span>{remaining}</span>
          <span className="sr-only">characters remaining</span>
          <span aria-hidden="true">/ {max}</span>
        </>
      ) : (
        <>
          <span>{current}</span>
          <span className="sr-only">of</span>
          <span aria-hidden="true">/ {max}</span>
        </>
      )}
      {isOverLimit && (
        <svg
          className="w-4 h-4 ml-1"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </div>
  );
}

// ============================================================================
// FormField Component (Input)
// ============================================================================

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  hint,
  required = false,
  disabled = false,
  placeholder,
  maxLength,
  showCharCount = false,
  className = '',
}: FormFieldProps) {
  const hasError = !!error;
  const inputId = name;

  return (
    <div className={`mb-4 ${className}`}>
      {/* Label */}
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {/* Input Container */}
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          aria-invalid={hasError}
          aria-describedby={
            hasError
              ? `${inputId}-error`
              : hint
              ? `${inputId}-hint`
              : undefined
          }
          className={`
            block w-full px-3 py-2 pr-10
            border rounded-md shadow-sm
            focus:outline-none focus:ring-2
            transition-colors
            ${
              hasError
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
            }
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          `}
        />

        {/* Validation Feedback Icon */}
        {!hasError && value && (
          <ValidationFeedback isValid={true} showSuccess={true} />
        )}
      </div>

      {/* Error Message */}
      <ErrorMessage error={error} fieldId={inputId} show={hasError} />

      {/* Hint Text or Character Counter */}
      <div className="flex justify-between items-center mt-1">
        {hint && !hasError && <FieldHint hint={hint} fieldId={inputId} />}
        {showCharCount && maxLength && (
          <CharacterCounter current={value.length} max={maxLength} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TextAreaField Component
// ============================================================================

export function TextAreaField({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  hint,
  required = false,
  disabled = false,
  placeholder,
  rows = 4,
  maxLength,
  showCharCount = false,
  className = '',
}: TextAreaFieldProps) {
  const hasError = !!error;
  const inputId = name;

  return (
    <div className={`mb-4 ${className}`}>
      {/* Label */}
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {/* TextArea */}
      <textarea
        id={inputId}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        required={required}
        aria-invalid={hasError}
        aria-describedby={
          hasError
            ? `${inputId}-error`
            : hint
            ? `${inputId}-hint`
            : undefined
        }
        className={`
          block w-full px-3 py-2
          border rounded-md shadow-sm
          focus:outline-none focus:ring-2
          transition-colors
          resize-vertical
          ${
            hasError
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
        `}
      />

      {/* Error Message */}
      <ErrorMessage error={error} fieldId={inputId} show={hasError} />

      {/* Hint Text or Character Counter */}
      <div className="flex justify-between items-center mt-1">
        {hint && !hasError && <FieldHint hint={hint} fieldId={inputId} />}
        {showCharCount && maxLength && (
          <CharacterCounter current={value.length} max={maxLength} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ValidationSummary Component
// ============================================================================

export interface ValidationSummaryProps {
  errors: Record<string, string | undefined>;
  title?: string;
  className?: string;
}

export function ValidationSummary({
  errors,
  title = 'Please fix the following errors:',
  className = '',
}: ValidationSummaryProps) {
  const errorMessages = Object.values(errors).filter((error) => error !== undefined);

  if (errorMessages.length === 0) return null;

  return (
    <div
      className={`bg-red-50 border border-red-200 rounded-md p-4 mb-4 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start">
        <svg
          className="w-5 h-5 text-red-600 mt-0.5 mr-3 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800 mb-2">{title}</h3>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {errorMessages.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SuccessMessage Component
// ============================================================================

export interface SuccessMessageProps {
  message: string;
  show?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function SuccessMessage({
  message,
  show = true,
  onDismiss,
  className = '',
}: SuccessMessageProps) {
  if (!show) return null;

  return (
    <div
      className={`bg-green-50 border border-green-200 rounded-md p-4 mb-4 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-green-600 mt-0.5 mr-3 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-green-700">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-green-600 hover:text-green-800 transition-colors"
            aria-label="Dismiss message"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
