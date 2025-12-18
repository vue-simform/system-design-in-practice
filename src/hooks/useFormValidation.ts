/**
 * useFormValidation Hook
 * 
 * Comprehensive form validation with:
 * - Real-time validation (onChange, onBlur)
 * - Field-level and form-level validation
 * - Touched/dirty state tracking
 * - Async validation support
 * - Accessible error handling
 * - Character counting
 * - Submit prevention when invalid
 * 
 * Part of Feature #6: Client-Side Validation
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ValidationRule,
  AsyncValidationRule,
  ValidationSchema,
} from '../utils/validation';
import {
  validateField,
  validateFieldAsync,
  validateForm,
  hasErrors as hasErrorsUtil,
} from '../utils/validation';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface UseFormValidationOptions<T extends Record<string, any>> {
  initialValues: T;
  validationSchema: ValidationSchema;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnMount?: boolean;
  debounceMs?: number;
  onSubmit: (values: T) => void | Promise<void>;
  onValidationError?: (errors: Record<string, string | undefined>) => void;
}

export interface FieldState {
  touched: boolean;
  dirty: boolean;
  validating: boolean;
}

export interface UseFormValidationReturn<T extends Record<string, any>> {
  values: T;
  errors: Record<string, string | undefined>;
  fieldStates: Record<string, FieldState>;
  isSubmitting: boolean;
  isValidating: boolean;
  isValid: boolean;
  isDirty: boolean;
  
  // Field manipulation
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setError: (field: keyof T, error: string | undefined) => void;
  setErrors: (errors: Record<string, string | undefined>) => void;
  
  // Field state
  setFieldTouched: (field: keyof T, touched?: boolean) => void;
  setAllTouched: () => void;
  
  // Validation
  validateField: (field: keyof T) => Promise<boolean>;
  validateAllFields: () => Promise<boolean>;
  
  // Form actions
  handleChange: (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleBlur: (field: keyof T) => () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  handleReset: () => void;
  
  // Utilities
  getFieldProps: (field: keyof T) => FieldProps;
  hasError: (field: keyof T) => boolean;
  showError: (field: keyof T) => boolean;
}

export interface FieldProps {
  value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
  'aria-invalid': boolean;
  'aria-describedby': string;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFormValidation<T extends Record<string, any>>({
  initialValues,
  validationSchema,
  validateOnChange = true,
  validateOnBlur = true,
  validateOnMount = false,
  debounceMs = 0,
  onSubmit,
  onValidationError,
}: UseFormValidationOptions<T>): UseFormValidationReturn<T> {
  // State
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrorsState] = useState<Record<string, string | undefined>>({});
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>(() => {
    const initial: Record<string, FieldState> = {};
    Object.keys(initialValues).forEach((key) => {
      initial[key] = { touched: false, dirty: false, validating: false };
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Refs
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mounted.current = false;
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Validate on mount
  useEffect(() => {
    if (validateOnMount) {
      validateAllFields();
    }
  }, []); // Only on mount

  // ============================================================================
  // Computed Values
  // ============================================================================

  const isValid = !hasErrorsUtil(errors);
  const isDirty = Object.values(fieldStates).some((state) => state.dirty);

  // ============================================================================
  // Field Value Setters
  // ============================================================================

  const setValue = useCallback((field: keyof T, value: any) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));
    
    // Mark as dirty
    setFieldStates((prev) => ({
      ...prev,
      [field]: { ...prev[field as string], dirty: true },
    }));
  }, []);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
    
    // Mark all updated fields as dirty
    setFieldStates((prev) => {
      const updated = { ...prev };
      Object.keys(newValues).forEach((key) => {
        updated[key] = { ...updated[key], dirty: true };
      });
      return updated;
    });
  }, []);

  // ============================================================================
  // Error Setters
  // ============================================================================

  const setError = useCallback((field: keyof T, error: string | undefined) => {
    setErrorsState((prev) => ({ ...prev, [field]: error }));
  }, []);

  const setErrors = useCallback((newErrors: Record<string, string | undefined>) => {
    setErrorsState(newErrors);
  }, []);

  // ============================================================================
  // Field State Setters
  // ============================================================================

  const setFieldTouched = useCallback((field: keyof T, touched: boolean = true) => {
    setFieldStates((prev) => ({
      ...prev,
      [field]: { ...prev[field as string], touched },
    }));
  }, []);

  const setAllTouched = useCallback(() => {
    setFieldStates((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        updated[key] = { ...updated[key], touched: true };
      });
      return updated;
    });
  }, []);

  // ============================================================================
  // Validation Functions
  // ============================================================================

  const validateFieldInternal = useCallback(
    async (field: keyof T): Promise<boolean> => {
      const fieldName = field as string;
      const validators = validationSchema[fieldName];
      
      if (!validators || validators.length === 0) {
        return true;
      }

      // Mark as validating
      setFieldStates((prev) => ({
        ...prev,
        [fieldName]: { ...prev[fieldName], validating: true },
      }));

      try {
        // Sync validation
        const error = validateField(values[field], validators, values);
        
        if (mounted.current) {
          setError(field, error);
          setFieldStates((prev) => ({
            ...prev,
            [fieldName]: { ...prev[fieldName], validating: false },
          }));
        }

        return error === undefined;
      } catch (err) {
        if (mounted.current) {
          setError(field, 'Validation error');
          setFieldStates((prev) => ({
            ...prev,
            [fieldName]: { ...prev[fieldName], validating: false },
          }));
        }
        return false;
      }
    },
    [validationSchema, values, setError]
  );

  const validateAllFields = useCallback(async (): Promise<boolean> => {
    setIsValidating(true);
    
    try {
      const formErrors = validateForm(values, validationSchema);
      
      if (mounted.current) {
        setErrors(formErrors);
        setIsValidating(false);
        
        const isFormValid = !hasErrorsUtil(formErrors);
        
        if (!isFormValid && onValidationError) {
          onValidationError(formErrors);
        }
        
        return isFormValid;
      }
      
      return true;
    } catch (err) {
      if (mounted.current) {
        setIsValidating(false);
      }
      return false;
    }
  }, [values, validationSchema, setErrors, onValidationError]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleChange = useCallback(
    (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setValue(field, value);

      // Validate on change (with debounce)
      if (validateOnChange) {
        const fieldName = field as string;
        
        // Clear existing timer
        if (debounceTimers.current[fieldName]) {
          clearTimeout(debounceTimers.current[fieldName]);
        }

        // Set new timer
        if (debounceMs > 0) {
          debounceTimers.current[fieldName] = setTimeout(() => {
            validateFieldInternal(field);
          }, debounceMs);
        } else {
          validateFieldInternal(field);
        }
      }
    },
    [setValue, validateOnChange, debounceMs, validateFieldInternal]
  );

  const handleBlur = useCallback(
    (field: keyof T) => () => {
      setFieldTouched(field, true);

      // Validate on blur
      if (validateOnBlur) {
        validateFieldInternal(field);
      }
    },
    [setFieldTouched, validateOnBlur, validateFieldInternal]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      console.log('[useFormValidation] handleSubmit called', { values });

      // Mark all fields as touched
      setAllTouched();

      // Validate all fields
      const isFormValid = await validateAllFields();

      console.log('[useFormValidation] Validation result:', isFormValid);

      if (!isFormValid) {
        console.log('[useFormValidation] Form invalid, stopping submission');
        return;
      }

      // Submit
      setIsSubmitting(true);
      
      try {
        console.log('[useFormValidation] Calling onSubmit');
        await onSubmit(values);
        console.log('[useFormValidation] onSubmit completed');
      } catch (error) {
        console.error('[useFormValidation] Submit error:', error);
        throw error;
      } finally {
        if (mounted.current) {
          setIsSubmitting(false);
        }
      }
    },
    [values, onSubmit, setAllTouched, validateAllFields]
  );

  const handleReset = useCallback(() => {
    setValuesState(initialValues);
    setErrorsState({});
    setFieldStates(() => {
      const reset: Record<string, FieldState> = {};
      Object.keys(initialValues).forEach((key) => {
        reset[key] = { touched: false, dirty: false, validating: false };
      });
      return reset;
    });
  }, [initialValues]);

  // ============================================================================
  // Utility Functions
  // ============================================================================

  const getFieldProps = useCallback(
    (field: keyof T): FieldProps => {
      const fieldName = field as string;
      return {
        value: values[field] ?? '',
        onChange: handleChange(field),
        onBlur: handleBlur(field),
        'aria-invalid': !!errors[fieldName],
        'aria-describedby': errors[fieldName] ? `${fieldName}-error` : '',
      };
    },
    [values, errors, handleChange, handleBlur]
  );

  const hasError = useCallback(
    (field: keyof T): boolean => {
      const fieldName = field as string;
      return errors[fieldName] !== undefined;
    },
    [errors]
  );

  const showError = useCallback(
    (field: keyof T): boolean => {
      const fieldName = field as string;
      return fieldStates[fieldName]?.touched && hasError(field);
    },
    [fieldStates, hasError]
  );

  // ============================================================================
  // Return API
  // ============================================================================

  return {
    // State
    values,
    errors,
    fieldStates,
    isSubmitting,
    isValidating,
    isValid,
    isDirty,

    // Setters
    setValue,
    setValues,
    setError,
    setErrors,
    setFieldTouched,
    setAllTouched,

    // Validation
    validateField: validateFieldInternal,
    validateAllFields,

    // Handlers
    handleChange,
    handleBlur,
    handleSubmit,
    handleReset,

    // Utilities
    getFieldProps,
    hasError,
    showError,
  };
}

// ============================================================================
// Helper Hook: useFieldValidation (for individual field)
// ============================================================================

export interface UseFieldValidationOptions {
  value: any;
  validators: ValidationRule[];
  asyncValidators?: AsyncValidationRule[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  formData?: Record<string, any>;
}

export interface UseFieldValidationReturn {
  error: string | undefined;
  isValidating: boolean;
  isValid: boolean;
  touched: boolean;
  validate: () => Promise<boolean>;
  setTouched: (touched: boolean) => void;
  clearError: () => void;
}

export function useFieldValidation({
  value,
  validators,
  asyncValidators = [],
  validateOnChange = true,
  debounceMs = 300,
  formData,
}: UseFieldValidationOptions): UseFieldValidationReturn {
  const [error, setError] = useState<string | undefined>();
  const [isValidating, setIsValidating] = useState(false);
  const [touched, setTouched] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const validate = useCallback(async (): Promise<boolean> => {
    setIsValidating(true);

    try {
      // Sync validation
      const syncError = validateField(value, validators, formData);
      
      if (syncError) {
        if (mounted.current) {
          setError(syncError);
          setIsValidating(false);
        }
        return false;
      }

      // Async validation
      if (asyncValidators.length > 0) {
        const asyncError = await validateFieldAsync(value, asyncValidators, formData);
        
        if (mounted.current) {
          setError(asyncError);
          setIsValidating(false);
        }
        
        return asyncError === undefined;
      }

      if (mounted.current) {
        setError(undefined);
        setIsValidating(false);
      }
      
      return true;
    } catch (err) {
      if (mounted.current) {
        setError('Validation error');
        setIsValidating(false);
      }
      return false;
    }
  }, [value, validators, asyncValidators, formData]);

  // Auto-validate on value change
  useEffect(() => {
    if (validateOnChange && touched) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      if (debounceMs > 0) {
        debounceTimer.current = setTimeout(() => {
          validate();
        }, debounceMs);
      } else {
        validate();
      }
    }
  }, [value, validateOnChange, touched, debounceMs, validate]);

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  return {
    error,
    isValidating,
    isValid: error === undefined && !isValidating,
    touched,
    validate,
    setTouched,
    clearError,
  };
}
