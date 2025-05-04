import { Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';

interface FloatingInputProps {
  label: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  showTogglePassword?: boolean;
  rightButtonLabel?: string;
  onRightButtonClick?: () => void;
  disabled?: boolean;
}

const FloatingInput: React.FC<FloatingInputProps> = ({
  label,
  name,
  autoComplete,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  showTogglePassword = false,
  rightButtonLabel,
  onRightButtonClick,
  disabled = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputType =
    type === 'password' && showTogglePassword
      ? showPassword
        ? 'text'
        : 'password'
      : type;

  return (
    <div className="relative w-full">
      <input
        id={name}
        name={name}
        type={inputType}
        autoComplete={autoComplete}
        placeholder={placeholder || ' '} 
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="peer block w-full appearance-none rounded-md border border-transparent bg-[#1c2a2a] px-2.5 pb-2.5 pt-6 text-sm text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      <label
        htmlFor={name}
        className={`
          absolute left-2 top-1 px-1 text-xs text-white transition-all duration-200 bg-[#1c2a2a] 
          peer-placeholder-shown:top-1/2 peer-placeholder-shown:left-3 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
          peer-focus:top-1 peer-focus:left-2 peer-focus:text-xs peer-focus:text-teal-400
        `}
      >
        {label}
      </label>

      {showTogglePassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-2 flex items-center pr-3 text-gray-400 hover:text-white"
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      )}

      {rightButtonLabel && onRightButtonClick && (
        <button
          type="button"
          onClick={onRightButtonClick}
          className="absolute inset-y-0 right-2 my-auto h-7 px-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded"
        >
          {rightButtonLabel}
        </button>
      )}
    </div>
  );
};

export default FloatingInput;
