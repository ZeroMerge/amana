import React, { useEffect } from 'react';
import { Check } from 'lucide-react';

export function Toast({ message, onClose, duration = 4000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="toast-container">
      <Check size={16} color="#38A169" />
      <span>{message}</span>
    </div>
  );
}
