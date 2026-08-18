import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

/** Centered card used by the login and register pages. */
export default function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background py-8">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-primary mb-6">{title}</h1>
        {children}
      </div>
    </div>
  );
}
