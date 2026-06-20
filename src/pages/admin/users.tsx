import AdminPlaceholder from '@/components/admin/AdminPlaceholder';
import { Users } from 'lucide-react';

const AdminUsersPage = () => (
  <AdminPlaceholder
    title="Usuários"
    subtitle="Gerenciamento de usuários da plataforma"
    icon={<Users size={28} />}
  />
);

export default AdminUsersPage;
