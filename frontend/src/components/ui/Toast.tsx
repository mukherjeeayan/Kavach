import { useEffect, useRef, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'info', duration = 4000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      fadeTimerRef.current = setTimeout(onClose, 300);
    }, duration);
    return () => {
      clearTimeout(timer);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(onClose, 300);
  };

  const styles = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all duration-300 ${
        styles[type]
      } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button
          onClick={handleClose}
          aria-label="Close notification"
          className="text-white/80 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
