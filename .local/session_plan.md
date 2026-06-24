# Round 5 — School POS Bug Fixes & Features

## T001: Ledger Analytics Cards + Net Balance styling
- Above the ledger table, add 3 cards: Total Expected Revenue, Total Revenue Collected, Total Outstanding Debt
- Net Balance Due: green "Cleared" pill if 0, bold red amount if > 0
- Files: FeesManagement.tsx

## T002: Simplify Edit Student Modal
- Keep only Name, Class, Status toggles
- Remove fee breakdown section, fee checklist, manual adjustment
- Add "Manage Fees & View Ledger" button that closes modal + navigates to Fees & Billing
- Files: StudentManagement.tsx

## T003: Ledger "Actions" dropdown → "Manage Fees" modal
- Add Actions button to each ledger row
- Manage Fees modal: list available fee types, checkbox to assign, Save → DB update + reload
- Files: FeesManagement.tsx

## T004: SchoolSettings — class rename cascade + delete guard
- commitEditClass → execute UPDATE students SET student_class = new WHERE student_class = old
- requestRemoveClass → block if students assigned (already partially done), remove X buttons (inline edit only)
- Files: SchoolSettings.tsx, api.ts

## T005: FeesManagement Create/Edit Fee Type — auto term tagging
- Remove manual term selector from form
- On create, auto-read currentTerm from state and store in fee
- Fix Target Class (classes) vs Applicable To (Day/Boarding) label confusion
- Files: FeesManagement.tsx, api.ts

## T006: Cashier Walk-In state leakage fix
- Clear all walk-in form state on modal close/submit
- Files: CashierPOS.tsx

## T007: Inventory Set Stock modal close fix + delete cascade to CashierPOS
- Verify Set Stock closes modal on submit
- On inventory item delete, CashierPOS should reload inventory
- Files: InventoryManagement.tsx, CashierPOS.tsx

## T008: DB — check fee_types table for term column
- Check current fee_types schema
- Add term column if possible, otherwise store in academic_session

