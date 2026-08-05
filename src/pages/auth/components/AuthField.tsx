import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { CircleAlert, Eye, EyeOff, Lock, type LucideIcon } from 'lucide-react';

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  icon: LucideIcon;
  error?: string;
  hint?: string;
  endAdornment?: ReactNode;
}

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { id, label, icon: Icon, error, hint, endAdornment, className = '', ...inputProps },
  ref
) {
  const errorId = error && id ? `${id}-error` : undefined;
  const hintId = hint && id ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId, inputProps['aria-describedby']].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-landing-text">
        {label}
      </label>
      <div className="relative">
        <Icon
          className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
            error ? 'text-landing-danger' : 'text-landing-text-muted'
          }`}
          aria-hidden="true"
        />
        <input
          {...inputProps}
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`min-h-12 w-full rounded-xl border bg-landing-surface py-3 pl-10 text-sm text-landing-text outline-none transition placeholder:text-landing-text-muted/80 disabled:cursor-not-allowed disabled:bg-landing-surface-muted disabled:opacity-70 ${
            endAdornment ? 'pr-12' : 'pr-4'
          } ${
            error
              ? 'border-landing-danger focus-visible:ring-2 focus-visible:ring-landing-danger/25'
              : 'border-landing-border-strong hover:border-landing-brand/45 focus-visible:border-landing-brand focus-visible:ring-2 focus-visible:ring-landing-brand/20'
          } ${className}`}
        />
        {endAdornment}
      </div>
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs font-medium leading-5 text-landing-danger">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-landing-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
});

type PasswordFieldProps = Omit<AuthFieldProps, 'icon' | 'type' | 'endAdornment'>;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  props,
  ref
) {
  const [isVisible, setIsVisible] = useState(false);
  const fieldLabel = props.label.toLocaleLowerCase('pt-BR');

  return (
    <AuthField
      {...props}
      ref={ref}
      icon={Lock}
      type={isVisible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          aria-label={`${isVisible ? 'Ocultar' : 'Mostrar'} ${fieldLabel}`}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((visible) => !visible)}
          className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-landing-text-muted transition-colors hover:bg-landing-surface-muted hover:text-landing-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-brand"
        >
          {isVisible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      }
    />
  );
});
