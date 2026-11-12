'use client';

const SIZE_CLASSES = {
  sm: 'text-[1.4rem] mb-2',
  md: 'text-2xl mb-3',
  lg: 'text-[2.5rem] mb-4',
} as const;

interface LoaderProps {
  /** Message shown under the spinner. Pass '' to render the spinner alone. */
  message?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/** The single loading indicator used everywhere in the app: FA spinner + message, centered. */
export function Loader({ message = 'Loading…', size = 'md', className = '' }: LoaderProps) {
  return (
    <div className={`p-10 text-center text-[#64748b] ${className}`}>
      <i className={`fa-solid fa-spinner fa-spin text-[#2563eb] ${SIZE_CLASSES[size]}`}></i>
      {message && <p className="font-semibold">{message}</p>}
    </div>
  );
}
