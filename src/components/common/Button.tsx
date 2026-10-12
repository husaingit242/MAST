import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  icon?: ReactNode;
};

export default function Button({ variant = 'secondary', icon, className = '', children, type = 'button', ...props }: Props) {
  return <button type={type} className={`button ${variant} ${className}`.trim()} {...props}>
    {icon}{children}
  </button>;
}
