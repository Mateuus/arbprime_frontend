import {
  User as IconUser,
  ScrollText,
  Lock,
  Mail,
  Building2,
  Settings,
  ListChecks
} from "lucide-react";
import { GiCoins, GiSoccerBall } from "react-icons/gi";
import { RiShieldUserLine } from "react-icons/ri";
import { MdOutlineFilterAlt } from "react-icons/md";
import { BiBookContent } from "react-icons/bi";

export const userMenus = [
  {
    id: 'perfil',
    label: 'MINHA CONTA',
    icon: <IconUser size={20} />,
    children: [
      { id: 'details', label: 'Dados Pessoais', description: 'Altere seus dados pessoais.', icon: <RiShieldUserLine size={16} /> },
      { id: 'change-password', label: 'Trocar Senha', description: 'Altere sua senha de acesso.', icon: <Lock size={16} /> },
      { id: 'mensagens', label: 'Mensagens', description: 'Suas mensagens do sistema.', icon: <Mail size={16} /> }
    ]
  },
  {
    id: 'arbbet',
    label: 'ARB BET',
    icon: <GiSoccerBall size={20} />,
    children: [
      { id: 'ab-bookmakers', label: 'Casas de Apostas', description: 'description.', icon: <Building2 size={16} /> },
      { id: 'ab-filters', label: 'Filtros', description: 'description.', icon: <MdOutlineFilterAlt size={16} /> }
    ]
  },
  {
    id: 'arbcrypto',
    label: 'ARB CRYPTO',
    icon: <GiCoins size={20} />,
    children: [
      { id: 'ac-exchanges', label: 'Exchanges', description: 'description.', icon: <Settings size={16} /> },
      { id: 'ac-filters', label: 'Filtros', description: 'description.', icon: <MdOutlineFilterAlt size={16} /> }
    ]
  },
  {
    id: 'apostador',
    label: 'APOSTAS',
    icon: <ScrollText size={20} />,
    children: [
      { id: 'historico', label: 'Histórico de Apostas', description: 'description.', icon: <BiBookContent size={16} /> },
      { id: 'criador', label: 'Histórico do Criador', description: 'description.', icon: <ListChecks size={16} /> }
    ]
  }
];