import AdminPlaceholder from '@/components/admin/AdminPlaceholder';
import { LayoutDashboard } from 'lucide-react';

const AdminDashboardPage = () => (
  <AdminPlaceholder
    title="Dashboard"
    subtitle="Painel de administração do ArbPrime"
    icon={<LayoutDashboard size={28} />}
  />
);

export default AdminDashboardPage;
