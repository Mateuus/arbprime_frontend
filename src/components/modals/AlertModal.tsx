import React from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface AlertModalProps {
  type: 'success' | 'error';
  title: string;
  message: string;
  onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({ type, title, message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center">
      <div className="bg-[#031715] w-full max-w-sm p-6 rounded-xl relative shadow-2xl text-white">
        <button className="absolute top-3 right-3 text-gray-400 hover:text-white" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="flex flex-col items-center gap-3">
          {type === 'success' ? (
            <CheckCircle size={48} className="text-green-500" />
          ) : (
            <AlertTriangle size={48} className="text-red-500" />
          )}
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-gray-300 text-center">{message}</p>

          <button
            onClick={onClose}
            className="mt-4 bg-white text-black font-semibold py-2 px-6 rounded-md hover:bg-gray-200"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;