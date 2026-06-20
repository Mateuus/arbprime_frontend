import AdminPlaceholder from '@/components/admin/AdminPlaceholder';
import { Clock } from 'lucide-react';

const AdminSchedulesPage = () => (
  <AdminPlaceholder
    title="Agendamentos"
    subtitle="Tarefas agendadas e schedulers do sistema"
    icon={<Clock size={28} />}
  />
);

export default AdminSchedulesPage;
