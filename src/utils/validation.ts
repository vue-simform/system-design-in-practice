/**
 * Client-Side Validation Utilities
 * 
 * Comprehensive validation system with:
 * - Type-safe validators
 * - Composable validation chains
 * - Built-in rules (required, email, length, pattern, etc.)
 * - Custom validators
 * - Async validation support
 * - Accessible error messages
 * 
 * Part of Feature #6: Client-Side Validation
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ValidationResult = {
  isValid: boolean;
  error?: string;
};

export type ValidationRule<T = any> = (value: T, formData?: any) => ValidationResult;

export type AsyncValidationRule<T = any> = (
  value: T,
  formData?: any
) => Promise<ValidationResult>;

export interface ValidatorOptions {
  message?: string;
  trim?: boolean;
}

export interface ValidationSchema {
  [fieldName: string]: ValidationRule[];
}

// ============================================================================
// Core Validator Factory
// ============================================================================

/**
 * Creates a validation rule with custom error message
 */
function createValidator(
  validator: (value: any, formData?: any) => boolean,
  defaultMessage: string,
  options: ValidatorOptions = {}
): ValidationRule {
  return (value: any, formData?: any): ValidationResult => {
    // Handle trimming for string values
    const processedValue =
      options.trim && typeof value === 'string' ? value.trim() : value;

    const isValid = validator(processedValue, formData);
    return {
      isValid,
      error: isValid ? undefined : options.message || defaultMessage,
    };
  };
}

// ============================================================================
// Built-in Validation Rules
// ============================================================================

/**
 * Required field validation
 * Checks for non-empty strings, non-null/undefined values, non-empty arrays
 */
export const required = (options: ValidatorOptions = {}): ValidationRule => {
  return createValidator(
    (value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') {
        const str = options.trim !== false ? value.trim() : value;
        return str.length > 0;
      }
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value).length > 0;
      return true;
    },
    'This field is required',
    options
  );
};

/**
 * Email format validation
 * Uses comprehensive regex for RFC 5322 compliance
 */
export const email = (options: ValidatorOptions = {}): ValidationRule => {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return createValidator(
    (value) => {
      if (!value || (typeof value === 'string' && value.trim() === '')) return true; // Optional
      return emailRegex.test(value);
    },
    'Please enter a valid email address',
    options
  );
};

/**
 * Minimum length validation (inclusive)
 */
export const minLength = (
  min: number,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value) return true; // Optional - use with required() for mandatory
      const length =
        typeof value === 'string'
          ? (options.trim !== false ? value.trim() : value).length
          : Array.isArray(value)
          ? value.length
          : 0;
      return length >= min;
    },
    `Must be at least ${min} characters`,
    options
  );
};

/**
 * Maximum length validation (inclusive)
 */
export const maxLength = (
  max: number,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value) return true; // Optional
      const length =
        typeof value === 'string'
          ? (options.trim !== false ? value.trim() : value).length
          : Array.isArray(value)
          ? value.length
          : 0;
      return length <= max;
    },
    `Must be at most ${max} characters`,
    options
  );
};

/**
 * Exact length validation
 */
export const exactLength = (
  length: number,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value) return true; // Optional
      const valueLength =
        typeof value === 'string'
          ? (options.trim !== false ? value.trim() : value).length
          : Array.isArray(value)
          ? value.length
          : 0;
      return valueLength === length;
    },
    `Must be exactly ${length} characters`,
    options
  );
};

/**
 * Length range validation (inclusive)
 */
export const lengthRange = (
  min: number,
  max: number,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value) return true; // Optional
      const length =
        typeof value === 'string'
          ? (options.trim !== false ? value.trim() : value).length
          : Array.isArray(value)
          ? value.length
          : 0;
      return length >= min && length <= max;
    },
    `Must be between ${min} and ${max} characters`,
    options
  );
};

/**
 * Pattern (regex) validation
 */
export const pattern = (
  regex: RegExp,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value || (typeof value === 'string' && value.trim() === '')) return true; // Optional
      return regex.test(value);
    },
    options.message || 'Invalid format',
    options
  );
};

/**
 * Numeric value validation
 */
export const numeric = (options: ValidatorOptions = {}): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value) return true; // Optional
      return !isNaN(Number(value)) && isFinite(Number(value));
    },
    'Must be a valid number',
    options
  );
};

/**
 * Minimum numeric value validation (inclusive)
 */
export const min = (
  minValue: number,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value) return true; // Optional
      const num = Number(value);
      return !isNaN(num) && num >= minValue;
    },
    `Must be at least ${minValue}`,
    options
  );
};

/**
 * Maximum numeric value validation (inclusive)
 */
export const max = (
  maxValue: number,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value) return true; // Optional
      const num = Number(value);
      return !isNaN(num) && num <= maxValue;
    },
    `Must be at most ${maxValue}`,
    options
  );
};

/**
 * Numeric range validation (inclusive)
 */
export const range = (
  minValue: number,
  maxValue: number,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value) return true; // Optional
      const num = Number(value);
      return !isNaN(num) && num >= minValue && num <= maxValue;
    },
    `Must be between ${minValue} and ${maxValue}`,
    options
  );
};

/**
 * URL validation
 */
export const url = (options: ValidatorOptions = {}): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value || (typeof value === 'string' && value.trim() === '')) return true; // Optional
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    'Please enter a valid URL',
    options
  );
};

/**
 * Match another field (e.g., password confirmation)
 */
export const matches = (
  fieldName: string,
  fieldLabel: string,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value, formData) => {
      if (!value) return true; // Optional
      return value === formData?.[fieldName];
    },
    `Must match ${fieldLabel}`,
    options
  );
};

/**
 * One of (enum validation)
 */
export const oneOf = (
  allowedValues: any[],
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(
    (value) => {
      if (!value) return true; // Optional
      return allowedValues.includes(value);
    },
    `Must be one of: ${allowedValues.join(', ')}`,
    options
  );
};

/**
 * Custom validator
 * Allows for any custom validation logic
 */
export const custom = (
  validator: (value: any, formData?: any) => boolean,
  message: string,
  options: ValidatorOptions = {}
): ValidationRule => {
  return createValidator(validator, message, options);
};

// ============================================================================
// Async Validators
// ============================================================================

/**
 * Async unique validation (e.g., check username availability)
 */
export const uniqueAsync = (
  checkFn: (value: any) => Promise<boolean>,
  options: ValidatorOptions = {}
): AsyncValidationRule => {
  return async (value: any): Promise<ValidationResult> => {
    if (!value) return { isValid: true }; // Optional

    try {
      const isUnique = await checkFn(value);
      return {
        isValid: isUnique,
        error: isUnique ? undefined : options.message || 'This value is already taken',
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Unable to verify uniqueness',
      };
    }
  };
};

/**
 * Async custom validator
 */
export const asyncCustom = (
  validator: (value: any, formData?: any) => Promise<boolean>,
  message: string,
  options: ValidatorOptions = {}
): AsyncValidationRule => {
  return async (value: any, formData?: any): Promise<ValidationResult> => {
    if (!value) return { isValid: true }; // Optional

    try {
      const isValid = await validator(value, formData);
      return {
        isValid,
        error: isValid ? undefined : options.message || message,
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Validation failed',
      };
    }
  };
};

// ============================================================================
// Validation Composition
// ============================================================================

/**
 * Compose multiple validators into a single validator
 * Stops at first failure for efficiency
 */
export function composeValidators(...validators: ValidationRule[]): ValidationRule {
  return (value: any, formData?: any): ValidationResult => {
    for (const validator of validators) {
      const result = validator(value, formData);
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  };
}

/**
 * Validate entire form based on schema
 */
export function validateForm(
  formData: Record<string, any>,
  schema: ValidationSchema
): Record<string, string | undefined> {
  const errors: Record<string, string | undefined> = {};

  Object.keys(schema).forEach((fieldName) => {
    const validators = schema[fieldName];
    const value = formData[fieldName];

    for (const validator of validators) {
      const result = validator(value, formData);
      if (!result.isValid) {
        errors[fieldName] = result.error;
        break; // Stop at first error per field
      }
    }
  });

  return errors;
}

/**
 * Validate a single field
 */
export function validateField(
  value: any,
  validators: ValidationRule[],
  formData?: Record<string, any>
): string | undefined {
  for (const validator of validators) {
    const result = validator(value, formData);
    if (!result.isValid) {
      return result.error;
    }
  }
  return undefined;
}

/**
 * Async validation for a single field
 */
export async function validateFieldAsync(
  value: any,
  validators: AsyncValidationRule[],
  formData?: Record<string, any>
): Promise<string | undefined> {
  for (const validator of validators) {
    const result = await validator(value, formData);
    if (!result.isValid) {
      return result.error;
    }
  }
  return undefined;
}

// ============================================================================
// Common Validation Schemas
// ============================================================================

/**
 * Post creation validation schema
 */
export const postValidationSchema: ValidationSchema = {
  title: [
    required({ message: 'Post title is required' }),
    minLength(5, { message: 'Title must be at least 5 characters' }),
    maxLength(200, { message: 'Title must not exceed 200 characters' }),
    pattern(/^[a-zA-Z0-9\s.,!?'-]+$/, {
      message: 'Title contains invalid characters',
    }),
  ],
  content: [
    required({ message: 'Post content is required' }),
    minLength(10, { message: 'Content must be at least 10 characters' }),
    maxLength(5000, { message: 'Content must not exceed 5000 characters' }),
  ],
};

/**
 * Comment validation schema
 */
export const commentValidationSchema: ValidationSchema = {
  comment: [
    required({ message: 'Comment cannot be empty' }),
    minLength(1, { message: 'Comment must have at least 1 character' }),
    maxLength(1000, { message: 'Comment must not exceed 1000 characters' }),
  ],
};

/**
 * User profile validation schema
 */
export const profileValidationSchema: ValidationSchema = {
  name: [
    required({ message: 'Name is required' }),
    minLength(2, { message: 'Name must be at least 2 characters' }),
    maxLength(50, { message: 'Name must not exceed 50 characters' }),
  ],
  email: [
    required({ message: 'Email is required' }),
    email({ message: 'Please enter a valid email address' }),
  ],
  bio: [
    maxLength(500, { message: 'Bio must not exceed 500 characters' }),
  ],
  website: [
    url({ message: 'Please enter a valid URL' }),
  ],
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if form has any errors
 */
export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some((error) => error !== undefined);
}

/**
 * Get all error messages as array
 */
export function getErrorMessages(
  errors: Record<string, string | undefined>
): string[] {
  return Object.values(errors).filter((error) => error !== undefined) as string[];
}

/**
 * Count number of errors
 */
export function countErrors(errors: Record<string, string | undefined>): number {
  return getErrorMessages(errors).length;
}

/**
 * Get first error message
 */
export function getFirstError(
  errors: Record<string, string | undefined>
): string | undefined {
  return getErrorMessages(errors)[0];
}

/**
 * Sanitize input (basic XSS prevention)
 */
export function sanitizeInput(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Normalize whitespace (trim and collapse multiple spaces)
 */
export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Character counter with limit
 */
export function getCharacterCount(
  value: string,
  max: number
): { count: number; remaining: number; isOverLimit: boolean } {
  const count = value.length;
  const remaining = max - count;
  return {
    count,
    remaining,
    isOverLimit: remaining < 0,
  };
}

/**
 * Debounce validation (useful for async validators)
 */
export function debounceValidation<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

// ============================================================================
// Validation Error Class
// ============================================================================

export class ValidationError extends Error {
  field: string;
  value?: any;

  constructor(field: string, message: string, value?: any) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

// ============================================================================
// Export All
// ============================================================================

export default {
  // Validators
  required,
  email,
  minLength,
  maxLength,
  exactLength,
  lengthRange,
  pattern,
  numeric,
  min,
  max,
  range,
  url,
  matches,
  oneOf,
  custom,
  uniqueAsync,
  asyncCustom,

  // Composition
  composeValidators,
  validateForm,
  validateField,
  validateFieldAsync,

  // Schemas
  postValidationSchema,
  commentValidationSchema,
  profileValidationSchema,

  // Utilities
  hasErrors,
  getErrorMessages,
  countErrors,
  getFirstError,
  sanitizeInput,
  normalizeWhitespace,
  getCharacterCount,
  debounceValidation,

  // Classes
  ValidationError,
};
