import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShiftProvider } from '../../context/ShiftContext';
import CashierPOS from './CashierPOS';

const CashierLayout: React.FC = () => {
  const { logout } = useAuth();

  return (
    <ShiftProvider>
      <CashierPOS />
    </ShiftProvider>
  );
};

export default CashierLayout;
