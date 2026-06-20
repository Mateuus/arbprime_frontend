import AdminPlaceholder from '@/components/admin/AdminPlaceholder';
import { Zap } from 'lucide-react';

const AdminActionsPage = () => (
  <AdminPlaceholder
    title="Ações"
    subtitle="Ações administrativas sobre eventos e bookmakers"
    icon={<Zap size={28} />}
  />
);

export default AdminActionsPage;
