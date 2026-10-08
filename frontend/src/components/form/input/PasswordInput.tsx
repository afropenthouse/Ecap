import { useId, useState, type InputHTMLAttributes } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  passwordLabel?: string;
};

export default function PasswordInput({ id, className = '', passwordLabel = 'password', disabled, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeSlashIcon : EyeIcon;

  return (
    <div className="relative">
      <input {...props} id={inputId} disabled={disabled} type={visible ? 'text' : 'password'} className={`${className} pr-12`} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setVisible(value => !value)}
        aria-label={`${visible ? 'Hide' : 'Show'} ${passwordLabel}`}
        aria-pressed={visible}
        aria-controls={inputId}
        className="absolute inset-y-0 right-0 z-20 flex items-center rounded-r-md px-3 text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:text-gray-400 dark:hover:text-white"
      >
        <Icon aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
