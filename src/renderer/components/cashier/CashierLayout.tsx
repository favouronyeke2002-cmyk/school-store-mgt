import React from 'react';
import CashierPOS from './CashierPOS';

// ShiftProvider is applied at App level — no double-wrapping here.
const CashierLayout: React.FC = () => <CashierPOS />;

export default CashierLayout;
