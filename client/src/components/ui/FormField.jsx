import { cloneElement, isValidElement, useId } from 'react';

/**
 * Label + control + hint/error wrapper. The child control receives id, aria-invalid
 * and aria-describedby automatically.
 */
export default function FormField({ label, required = false, error, hint, className = '', children }) {
  const id = useId();
  const messageId = `${id}-message`;
  const control = isValidElement(children)
    ? cloneElement(children, {
      id: children.props.id || id,
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': error || hint ? messageId : undefined,
      required: children.props.required ?? required,
    })
    : children;

  return (
    <div className={`form-field ${className}`.trim()}>
      <label className={`form-label${required ? ' form-label--required' : ''}`} htmlFor={children?.props?.id || id}>
        {label}
      </label>
      {control}
      {error ? (
        <span id={messageId} className="form-error">{error}</span>
      ) : hint ? (
        <span id={messageId} className="form-hint">{hint}</span>
      ) : null}
    </div>
  );
}
