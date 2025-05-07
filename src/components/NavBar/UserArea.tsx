import React from 'react';

import {
  User as IconUser,
} from 'lucide-react';
import UserAuthButtons from '@/components/Buttons/UserAuthButtons';
//import { isValidTab, AbaTab } from "@/components/modals/UserModalDesktop";

interface UserAreaProps {
  isAuthenticated: boolean;
}

const UserArea: React.FC<UserAreaProps> = ({ isAuthenticated }) => {
  //const [selectedTab, setSelectedTab] = useState<AbaTab | null>(null);

  



  return (
    <div
      className="relative z-50"
    >
      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 p-[2px] bg-cyan-900 cursor-pointer flex items-center justify-center">
              <IconUser size={22} className="text-white" />
          </div>
        </div>
      ) : (
        <UserAuthButtons />
      )}
    </div>
  );
};

export default UserArea;
