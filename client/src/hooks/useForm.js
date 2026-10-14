import { useCallback, useState } from 'react';

/**
 * Minimal form state helper. Server validation errors (ApiError.details keyed by field)
 * are mapped onto `errors` automatically by `submit()`.
 */
export function useForm(initialValues) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  }, []);

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (event) => setField(name, event.target.value),
  });

  const bindCheckbox = (name) => ({
    name,
    type: 'checkbox',
    checked: Boolean(values[name]),
    onChange: (event) => setField(name, event.target.checked),
  });

  const submit = (handler) => async (event) => {
    event?.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setErrors({});
    try {
      return await handler(values);
    } catch (error) {
      if (error.details && typeof error.details === 'object' && !Array.isArray(error.details)) {
        setErrors(error.details);
      }
      setFormError(error.message);
      return undefined;
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, setField, bind, bindCheckbox, errors, setErrors, formError, setFormError, submitting, submit };
}
