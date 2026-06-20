import AdminPlaceholder from '@/components/admin/AdminPlaceholder';
import { Settings } from 'lucide-react';

const AdminSettingsPage = () => (
  <AdminPlaceholder
    title="Configurações"
    subtitle="Configurações administrativas do sistema"
    icon={<Settings size={28} />}
  />
);

export default AdminSettingsPage;
