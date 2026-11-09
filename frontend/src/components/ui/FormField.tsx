import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormFieldRenderProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onInput: (e: React.FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

export interface FormFieldProps {
  id?: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  as?: 'input' | 'textarea';
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  minLength?: number;
  maxLength?: number;
  disabled?: boolean;
  children?: (props: FormFieldRenderProps) => React.ReactNode;
}

/**
 * Campo de formulario reutilizable con pistas ubicadas arriba del control y
 * sincronización de aria-invalid con :user-invalid tras interacción.
 */
export const FormField: React.FC<FormFieldProps> = ({
  id: customId,
  label,
  hint,
  error,
  required,
  as = 'input',
  type = 'text',
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  minLength,
  maxLength,
  disabled,
  children,
}) => {
  const generatedId = useId();
  const baseId = customId ?? generatedId;
  const hintId = hint ? `${baseId}-hint` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const syncAriaInvalid = (
    el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  ) => {
    try {
      const matchesInvalid = el.matches(':user-invalid') || Boolean(error);
      el.setAttribute('aria-invalid', matchesInvalid ? 'true' : 'false');
    } catch {
      if (error) {
        el.setAttribute('aria-invalid', 'true');
      }
    }
  };

  const controlProps: FormFieldRenderProps = {
    id: baseId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    onBlur: (e) => syncAriaInvalid(e.currentTarget),
    onInput: (e) => {
      if (e.currentTarget.hasAttribute('aria-invalid')) {
        syncAriaInvalid(e.currentTarget);
      }
    },
  };

  const defaultControlClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none disabled:bg-slate-100';

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={baseId} className="text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {hint && (
        <span id={hintId} className="text-xs text-slate-500">
          {hint}
        </span>
      )}
      {children ? (
        children(controlProps)
      ) : as === 'textarea' ? (
        <textarea
          {...controlProps}
          rows={3}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          disabled={disabled}
          className={defaultControlClass}
        />
      ) : (
        <input
          {...controlProps}
          type={type}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          min={min}
          max={max}
          step={step}
          minLength={minLength}
          maxLength={maxLength}
          disabled={disabled}
          className={defaultControlClass}
        />
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-red-600"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
