# School POS & Store Management System

A complete offline desktop Point of Sale (POS) and School Store Management application built with Electron, React, and SQLite.

## Features

### Admin View (Password Login)
- **Dashboard**: Real-time revenue metrics, profit margins, and transaction analytics
- **Student Management**: Add, edit, delete students; view transaction history per student
- **Inventory Management**: Track stock, adjust quantities, view inventory valuation
- **Transaction History**: Advanced search with filters by date, student, type, payment mode
- **Shift Management**: View all shift history with cash accountability reports
- **User Management**: Create/disable admin/cashier accounts
- **Bulk Import**: Import students and inventory via CSV files

### Cashier View (4-digit PIN Login)
- **Shift-based Operation**: Must open shift with opening cash before use
- **Mandatory Student Selection**: No anonymous sales allowed
- **Debt Indicator**: Prominent display of student's outstanding fees
- **Store Purchase**: Add items to cart, process payments (Cash/POS)
- **Fees Collection**: Collect school fees, automatically updates student debt
- **Shift Close**: Summary showing expected vs. actual cash
- **Thermal Receipt Printing**: 80mm format receipts (Ctrl+P to print)

### Database Integrity
- Foreign key constraints prevent anonymous transactions
- Transaction immutability (cannot edit or delete)
- Automatic triggers enforce data integrity
- Row-level security patterns




## Installation

```bash
npm install
npm run build
npm start
```

## Development

```bash
npm run dev
```

## Database Schema

The SQLite database uses the following tables:
- `users` - Admin and Cashier accounts
- `students` - Student records with fees owed
- `inventory` - Store items with prices and stock
- `shifts` - Daily shift tracking
- `transactions` - All financial transactions (immutable)
- `transaction_items` - Item-level transaction details

## File Structure

```
src/
├── main/           # Electron main process
│   ├── main.js     # Main process, IPC handlers
│   └── preload.js  # Context bridge for renderer
├── renderer/       # React frontend
│   ├── components/
│   │   ├── admin/   # Admin dashboard components
│   │   ├── auth/    # Login screens
│   │   ├── cashier/ # POS interface
│   │   └── shared/  # Shared components
│   ├── context/    # React contexts
│   ├── styles/     # CSS
│   └── App.tsx     # Main React app
└── shared/
    ├── database/
    │   ├── schema.js  # SQLite schema
    │   └── seed.ts    # Sample data seeder
    └── types/         # TypeScript types
```

## License

MIT
