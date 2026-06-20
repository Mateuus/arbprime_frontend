import React, { ReactNode } from 'react';

interface AdminPlaceholderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}

// Placeholder padrão das páginas de administração (tema escuro, "em desenvolvimento").
const AdminPlaceholder: React.FC<AdminPlaceholderProps> = ({ title, subtitle, icon }) => (
  <div className="container mx-auto px-4 py-8">
    <header className="mb-6 flex items-center gap-3">
      {icon && <span className="text-teal-400">{icon}</span>}
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
      </div>
    </header>

    <div className="bg-gray-900 border border-brand-border rounded-lg p-8 text-center">
      <p className="text-gray-300">Em desenvolvimento.</p>
    </div>
  </div>
);

export default AdminPlaceholder;
