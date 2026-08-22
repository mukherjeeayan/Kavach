import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

/** Centered card used by the login and register pages. */
export default function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background py-8 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">Keeping children safe online</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
}
