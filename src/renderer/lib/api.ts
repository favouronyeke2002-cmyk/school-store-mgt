import { supabase } from './supabase';

// ─── SCHOOL SETTINGS ──────────────────────────────────────────────────────────
export const settingsAPI = {
  async get() {
    const { data, error } = await supabase.from('school_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data;
  },
  async save(updates: {
    school_name?: string;
    tagline?: string;
    phone_number?: string;
    logo_url?: string | null;
    academic_session?: string;
    address?: string;
  }) {
    const { error } = await supabase.from('school_settings').upsert({ id: 1, ...updates, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { success: true };
  },
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  async loginPin(pin: string) {
    const { data, error } = await supabase
      .from('pos_users').select('id, username, role')
      .eq('pin', pin).eq('is_active', true).maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Invalid PIN' };
    if (data.role === 'admin') return { success: false, error: 'Admin must login with password' };
    return { success: true, user: data };
  },
  async loginPassword(password: string) {
    const { data, error } = await supabase
      .from('pos_users').select('id, username, role')
      .eq('password', password).eq('is_active', true).maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Invalid password' };
    return { success: true, user: data };
  },
};

// ─── SHIFTS ───────────────────────────────────────────────────────────────────
export const shiftAPI = {
  async getActive() {
    const { data, error } = await supabase
      .from('shifts').select('*, pos_users(username)')
      .eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...data, username: (data.pos_users as any)?.username };
  },
  async open(userId: number, openingCash: number) {
    const { data: existing } = await supabase.from('shifts').select('id').eq('status', 'open').maybeSingle();
    if (existing) throw new Error('A shift is already open. Close it first.');
    const { data, error } = await supabase.from('shifts').insert({ user_id: userId, opening_cash: openingCash, status: 'open' }).select().single();
    if (error) throw error;
    return { success: true, shiftId: data.id };
  },
  async close(shiftId: number, closingCash: number, _userId: number) {
    const { data: shift } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
    if (!shift) throw new Error('Shift not found');
    const { data: cashSales } = await supabase.from('transactions').select('amount_paid').eq('shift_id', shiftId).eq('payment_mode', 'Cash');
    const totalCashSales = (cashSales || []).reduce((s: number, t: any) => s + Number(t.amount_paid), 0);
    const expectedCash = Number(shift.opening_cash) + totalCashSales;
    const difference = closingCash - expectedCash;
    const { error } = await supabase.from('shifts').update({ closing_cash: closingCash, expected_closing_cash: expectedCash, cash_difference: difference, closed_at: new Date().toISOString(), status: 'closed' }).eq('id', shiftId);
    if (error) throw error;
    return { success: true, expectedCash, difference };
  },
  async getHistory() {
    const { data, error } = await supabase.from('shifts').select('*, pos_users(username)').order('opened_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data || []).map((s: any) => ({ ...s, username: s.pos_users?.username }));
  },
};

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
export const studentAPI = {
  async getAll(filters?: { search?: string; class?: string }) {
    let query = supabase.from('students').select('*').order('name');
    if (filters?.search) query = query.ilike('name', `%${filters.search}%`);
    if (filters?.class && filters.class !== 'all') query = query.eq('student_class', filters.class);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  async getClasses() {
    const { data, error } = await supabase.from('students').select('student_class');
    if (error) throw error;
    const unique = [...new Set((data || []).map((s: any) => s.student_class))].sort();
    return unique;
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('students').select('*').eq('student_id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(data: { studentId?: string; name: string; studentClass: string; feesOwed?: number }) {
    let id = data.studentId;
    if (!id) {
      const { data: all } = await supabase.from('students').select('student_id');
      const maxId = (all || []).reduce((max: number, s: any) => { const n = parseInt(s.student_id.replace('STU-', '')); return n > max ? n : max; }, 0);
      id = 'STU-' + String(maxId + 1).padStart(4, '0');
    }
    const { error } = await supabase.from('students').insert({ student_id: id, name: data.name, student_class: data.studentClass, current_fees_owed: data.feesOwed || 0 });
    if (error) return { success: false, error: error.message };
    return { success: true, studentId: id };
  },
  async update(id: string, data: { name: string; studentClass: string }) {
    const { error } = await supabase.from('students').update({ name: data.name, student_class: data.studentClass, updated_at: new Date().toISOString() }).eq('student_id', id);
    if (error) throw error;
    return { success: true };
  },
  async updateFees(id: string, fees: number) {
    const { error } = await supabase.from('students').update({ current_fees_owed: fees, updated_at: new Date().toISOString() }).eq('student_id', id);
    if (error) throw error;
    return { success: true };
  },
  async delete(id: string) {
    const { error } = await supabase.from('students').delete().eq('student_id', id);
    if (error) throw error;
    return { success: true };
  },
  async bulkImport(students: any[]) {
    const rows = students.map((s) => ({ student_id: s.student_id, name: s.name, student_class: s.student_class, current_fees_owed: Number(s.fees_owed) || 0 }));
    const { error } = await supabase.from('students').upsert(rows, { onConflict: 'student_id' });
    if (error) return { success: false, error: error.message };
    return { success: true, count: rows.length };
  },
  async getHistory(studentId: string) {
    const { data, error } = await supabase.from('transactions').select('*, transaction_items(quantity, unit_price, total_price, inventory(item_name)), fee_types(name)').eq('student_id', studentId).order('timestamp', { ascending: false });
    if (error) throw error;
    return (data || []).map((t: any) => ({
      ...t,
      items_summary: t.transaction_items?.map((ti: any) => `${ti.inventory?.item_name} (x${ti.quantity})`).join(', ') || null,
      fee_name: t.fee_types?.name || null,
    }));
  },
};

// ─── INVENTORY CATEGORIES ─────────────────────────────────────────────────────
export const categoryAPI = {
  async getAll() {
    const { data, error } = await supabase.from('inventory_categories').select('*').order('name');
    if (error) throw error;
    return data || [];
  },
  async create(name: string, color: string) {
    const { error } = await supabase.from('inventory_categories').insert({ name, color });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
  async update(id: number, name: string, color: string) {
    const { error } = await supabase.from('inventory_categories').update({ name, color }).eq('id', id);
    if (error) throw error;
    return { success: true };
  },
  async delete(id: number) {
    const { error } = await supabase.from('inventory_categories').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },
};

// ─── INVENTORY ────────────────────────────────────────────────────────────────
export const inventoryAPI = {
  async getAll(filters?: { search?: string; lowStock?: boolean; categoryId?: number | null }) {
    let query = supabase.from('inventory').select('*, inventory_categories(name, color)').order('item_name');
    if (filters?.search) query = query.or(`item_name.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%`);
    if (filters?.lowStock) query = query.lte('stock_quantity', 10);
    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((i: any) => ({ ...i, category_name: i.inventory_categories?.name || null, category_color: i.inventory_categories?.color || null }));
  },
  async getById(id: number) {
    const { data, error } = await supabase.from('inventory').select('*').eq('item_id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async getByBarcode(barcode: string) {
    const { data, error } = await supabase.from('inventory').select('*').eq('barcode', barcode).maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(data: { itemName: string; costPrice: number; sellingPrice: number; stockQuantity?: number; barcode?: string; categoryId?: number | null }) {
    const { data: item, error } = await supabase.from('inventory').insert({ item_name: data.itemName, cost_price: data.costPrice, selling_price: data.sellingPrice, stock_quantity: data.stockQuantity || 0, barcode: data.barcode || null, category_id: data.categoryId || null }).select('item_id').single();
    if (error) return { success: false, error: error.message };
    return { success: true, itemId: item.item_id };
  },
  async update(id: number, data: { itemName: string; costPrice: number; sellingPrice: number; barcode?: string; categoryId?: number | null }) {
    const { error } = await supabase.from('inventory').update({ item_name: data.itemName, cost_price: data.costPrice, selling_price: data.sellingPrice, barcode: data.barcode || null, category_id: data.categoryId || null }).eq('item_id', id);
    if (error) throw error;
    return { success: true };
  },
  async adjustStock(id: number, quantity: number, reason: string) {
    const { data: item } = await supabase.from('inventory').select('stock_quantity').eq('item_id', id).single();
    if (!item) throw new Error('Item not found');
    await supabase.from('inventory').update({ stock_quantity: item.stock_quantity + quantity }).eq('item_id', id);
    await supabase.from('stock_adjustments').insert({ item_id: id, quantity_change: quantity, reason });
    return { success: true };
  },
  async bulkImport(items: any[]) {
    const rows = items.map((i) => ({ item_name: i.item_name, barcode: i.barcode || null, cost_price: Number(i.cost_price) || 0, selling_price: Number(i.selling_price) || 0, stock_quantity: Number(i.stock_quantity) || 0 }));
    const { error } = await supabase.from('inventory').upsert(rows, { onConflict: 'barcode' });
    if (error) return { success: false, error: error.message };
    return { success: true, count: rows.length };
  },
};

// ─── FEE TYPES ────────────────────────────────────────────────────────────────
export const feeTypeAPI = {
  async getAll(session?: string) {
    let q = supabase.from('fee_types').select('*').order('created_at', { ascending: false });
    if (session) q = q.eq('academic_session', session);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async create(data: { name: string; description?: string; academicSession: string; amount: number; classFilter?: string }) {
    const { data: ft, error } = await supabase.from('fee_types').insert({ name: data.name, description: data.description || null, academic_session: data.academicSession, amount: data.amount, class_filter: data.classFilter || null }).select('id').single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: ft.id };
  },
  async update(id: number, data: { name: string; description?: string; amount: number; classFilter?: string }) {
    const { error } = await supabase.from('fee_types').update({ name: data.name, description: data.description || null, amount: data.amount, class_filter: data.classFilter || null }).eq('id', id);
    if (error) throw error;
    return { success: true };
  },
  async delete(id: number) {
    const { error } = await supabase.from('fee_types').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },
  // Assign a fee type to all students in a class (or a specific student)
  async assignToStudents(feeTypeId: number, amount: number, classFilter?: string, specificStudentId?: string) {
    let students: any[] = [];
    if (specificStudentId) {
      const { data } = await supabase.from('students').select('student_id').eq('student_id', specificStudentId);
      students = data || [];
    } else if (classFilter) {
      const { data } = await supabase.from('students').select('student_id').eq('student_class', classFilter);
      students = data || [];
    } else {
      const { data } = await supabase.from('students').select('student_id');
      students = data || [];
    }

    if (students.length === 0) return { success: true, count: 0 };

    const rows = students.map((s) => ({ student_id: s.student_id, fee_type_id: feeTypeId, amount_due: amount, amount_paid: 0 }));
    const { error } = await supabase.from('student_fees').upsert(rows, { onConflict: 'student_id,fee_type_id', ignoreDuplicates: true });
    if (error) return { success: false, error: error.message };
    return { success: true, count: rows.length };
  },
};

// ─── STUDENT FEE LEDGER ───────────────────────────────────────────────────────
export const studentFeeAPI = {
  async getForStudent(studentId: string) {
    const { data, error } = await supabase.from('student_fees').select('*, fee_types(name, description, academic_session)').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((sf: any) => ({
      ...sf,
      fee_name: sf.fee_types?.name || 'Unknown',
      fee_description: sf.fee_types?.description || '',
      academic_session: sf.fee_types?.academic_session || '',
      balance: Number(sf.amount_due) - Number(sf.amount_paid),
    }));
  },
  async getAll(filters?: { session?: string }) {
    let q = supabase.from('student_fees').select('*, students(name, student_class), fee_types(name, academic_session)').order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((sf: any) => ({
      ...sf,
      student_name: sf.students?.name,
      student_class: sf.students?.student_class,
      fee_name: sf.fee_types?.name,
      academic_session: sf.fee_types?.academic_session,
      balance: Number(sf.amount_due) - Number(sf.amount_paid),
    })).filter((sf: any) => !filters?.session || sf.academic_session === filters.session);
  },
  async recordPayment(studentFeeId: number, amount: number, studentId: string, shiftId: number, paymentMode: string) {
    // Validate overpayment
    const { data: sf } = await supabase.from('student_fees').select('amount_due, amount_paid, fee_type_id').eq('id', studentFeeId).single();
    if (!sf) throw new Error('Fee record not found');
    const balance = Number(sf.amount_due) - Number(sf.amount_paid);
    if (amount > balance) throw new Error(`Cannot pay ₦${amount.toLocaleString('en-NG')} — balance is only ₦${balance.toLocaleString('en-NG')}`);

    // Create transaction
    const { error: txnError } = await supabase.from('transactions').insert({ student_id: studentId, shift_id: shiftId, type: 'FEES_CASH_COLLECTION', amount_paid: amount, payment_mode: paymentMode, fee_type_id: sf.fee_type_id });
    if (txnError) throw txnError;

    // Update student_fees.amount_paid
    const newPaid = Number(sf.amount_paid) + amount;
    const { error: updateError } = await supabase.from('student_fees').update({ amount_paid: newPaid }).eq('id', studentFeeId);
    if (updateError) throw updateError;

    // Update student.current_fees_owed (keep in sync)
    const { data: student } = await supabase.from('students').select('current_fees_owed').eq('student_id', studentId).single();
    if (student) {
      await supabase.from('students').update({ current_fees_owed: Math.max(0, Number(student.current_fees_owed) - amount), updated_at: new Date().toISOString() }).eq('student_id', studentId);
    }
    return { success: true };
  },
};

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export const transactionAPI = {
  async createPurchase(studentId: string, shiftId: number, items: any[], paymentMode: string) {
    if (!studentId) throw new Error('Student ID is required. No anonymous purchases allowed.');
    const totalAmount = items.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);

    const { data: txn, error: txnError } = await supabase.from('transactions').insert({ student_id: studentId, shift_id: shiftId, type: 'STORE_PURCHASE', amount_paid: totalAmount, payment_mode: paymentMode }).select('transaction_id').single();
    if (txnError) throw txnError;

    const itemRows = items.map((item) => ({ transaction_id: txn.transaction_id, item_id: item.item_id, quantity: item.quantity, unit_price: item.selling_price, total_price: item.selling_price * item.quantity }));
    const { error: itemsError } = await supabase.from('transaction_items').insert(itemRows);
    if (itemsError) throw itemsError;

    for (const item of items) {
      const { data: inv } = await supabase.from('inventory').select('stock_quantity').eq('item_id', item.item_id).single();
      if (inv) await supabase.from('inventory').update({ stock_quantity: Math.max(0, inv.stock_quantity - item.quantity) }).eq('item_id', item.item_id);
    }

    const details = await transactionAPI.getDetails(txn.transaction_id);
    return { success: true, transactionId: txn.transaction_id, ...details, total: totalAmount };
  },
  async getHistory(filters?: { studentId?: string; limit?: number }) {
    let query = supabase.from('transactions').select('*, students(name, student_class)').order('timestamp', { ascending: false });
    if (filters?.studentId) query = query.eq('student_id', filters.studentId);
    if (filters?.limit) query = query.limit(filters.limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((t: any) => ({ ...t, student_name: t.students?.name, student_class: t.students?.student_class }));
  },
  async getDetails(id: number) {
    const { data: txn, error: txnError } = await supabase.from('transactions').select('*, students(name, student_class), fee_types(name)').eq('transaction_id', id).single();
    if (txnError) throw txnError;
    const { data: items } = await supabase.from('transaction_items').select('*, inventory(item_name)').eq('transaction_id', id);
    return {
      transaction: { ...txn, student_name: txn.students?.name, student_class: txn.students?.student_class, fee_type_name: txn.fee_types?.name },
      items: (items || []).map((i: any) => ({ ...i, item_name: i.inventory?.item_name })),
    };
  },
  async search(filters: { query?: string; startDate?: string; endDate?: string; type?: string; paymentMode?: string }) {
    let q = supabase.from('transactions').select('*, students(name, student_class, student_id)').order('timestamp', { ascending: false }).limit(500);
    if (filters.type) q = q.eq('type', filters.type);
    if (filters.paymentMode) q = q.eq('payment_mode', filters.paymentMode);
    if (filters.startDate) q = q.gte('timestamp', filters.startDate);
    if (filters.endDate) q = q.lte('timestamp', filters.endDate + 'T23:59:59');
    const { data, error } = await q;
    if (error) throw error;
    let results = (data || []).map((t: any) => ({ ...t, student_name: t.students?.name, student_class: t.students?.student_class }));
    if (filters.query) {
      const qLow = filters.query.toLowerCase();
      results = results.filter((t: any) => t.student_name?.toLowerCase().includes(qLow) || t.student_id?.toLowerCase().includes(qLow));
    }
    return results;
  },
};

// ─── ADMIN ANALYTICS ─────────────────────────────────────────────────────────
export const adminAPI = {
  async getStats() {
    const [txnResult, storeResult, feesResult, cogsResult, feesOwedResult, countResult] = await Promise.all([
      supabase.from('transactions').select('amount_paid'),
      supabase.from('transactions').select('amount_paid').eq('type', 'STORE_PURCHASE'),
      supabase.from('transactions').select('amount_paid').eq('type', 'FEES_CASH_COLLECTION'),
      supabase.from('transaction_items').select('quantity, unit_price, item_id'),
      supabase.from('students').select('current_fees_owed'),
      supabase.from('transactions').select('transaction_id', { count: 'exact', head: true }),
    ]);
    const { data: invData } = await supabase.from('inventory').select('item_id, cost_price');
    const totalRevenue = (txnResult.data || []).reduce((s: number, t: any) => s + Number(t.amount_paid), 0);
    const storeRevenue = (storeResult.data || []).reduce((s: number, t: any) => s + Number(t.amount_paid), 0);
    const feesCollected = (feesResult.data || []).reduce((s: number, t: any) => s + Number(t.amount_paid), 0);
    const costMap = new Map((invData || []).map((i: any) => [i.item_id, Number(i.cost_price)]));
    const cogs = (cogsResult.data || []).reduce((s: number, ti: any) => s + ti.quantity * (costMap.get(ti.item_id) || 0), 0);
    const profit = storeRevenue - cogs;
    const profitMargin = storeRevenue > 0 ? (profit / storeRevenue * 100).toFixed(2) : '0';
    const uncollectedFees = (feesOwedResult.data || []).reduce((s: number, st: any) => s + Number(st.current_fees_owed), 0);
    return { totalRevenue, storeRevenue, feesCollected, cogs, profit, profitMargin, uncollectedFees, transactionCount: countResult.count || 0 };
  },
  async getDailySales(days: number = 30) {
    const since = new Date(); since.setDate(since.getDate() - days);
    const { data, error } = await supabase.from('transactions').select('timestamp, type, amount_paid').gte('timestamp', since.toISOString()).order('timestamp');
    if (error) throw error;
    const grouped: Record<string, { store_sales: number; fees_collected: number; total: number }> = {};
    for (const t of data || []) {
      const date = t.timestamp.slice(0, 10);
      if (!grouped[date]) grouped[date] = { store_sales: 0, fees_collected: 0, total: 0 };
      const amt = Number(t.amount_paid);
      if (t.type === 'STORE_PURCHASE') grouped[date].store_sales += amt;
      else grouped[date].fees_collected += amt;
      grouped[date].total += amt;
    }
    return Object.entries(grouped).map(([date, vals]) => ({ date, ...vals })).reverse();
  },
  async getClassRevenue() {
    const { data, error } = await supabase.from('transactions').select('amount_paid, students(student_class)');
    if (error) throw error;
    const grouped: Record<string, { total_revenue: number; transaction_count: number }> = {};
    for (const t of data || []) {
      const cls = (t.students as any)?.student_class || 'Unknown';
      if (!grouped[cls]) grouped[cls] = { total_revenue: 0, transaction_count: 0 };
      grouped[cls].total_revenue += Number(t.amount_paid);
      grouped[cls].transaction_count += 1;
    }
    return Object.entries(grouped).map(([student_class, vals]) => ({ student_class, ...vals })).sort((a, b) => b.total_revenue - a.total_revenue);
  },
  async getTopProducts(limit: number = 10) {
    const { data, error } = await supabase.from('transaction_items').select('item_id, quantity, total_price, inventory(item_name)').order('total_price', { ascending: false }).limit(limit);
    if (error) throw error;
    const grouped: Record<number, { item_name: string; total_quantity: number; total_revenue: number }> = {};
    for (const ti of data || []) {
      const id = ti.item_id;
      if (!grouped[id]) grouped[id] = { item_name: (ti.inventory as any)?.item_name || 'Unknown', total_quantity: 0, total_revenue: 0 };
      grouped[id].total_quantity += ti.quantity;
      grouped[id].total_revenue += Number(ti.total_price);
    }
    return Object.values(grouped).sort((a, b) => b.total_revenue - a.total_revenue);
  },
  async getInventoryValuation() {
    const { data, error } = await supabase.from('inventory').select('item_id, stock_quantity, cost_price, selling_price');
    if (error) throw error;
    const items = data || [];
    return { item_count: items.length, total_units: items.reduce((s: number, i: any) => s + i.stock_quantity, 0), total_cost_value: items.reduce((s: number, i: any) => s + i.stock_quantity * Number(i.cost_price), 0), total_retail_value: items.reduce((s: number, i: any) => s + i.stock_quantity * Number(i.selling_price), 0) };
  },
};

// ─── USERS ────────────────────────────────────────────────────────────────────
export const userAPI = {
  async getAll() {
    const { data, error } = await supabase.from('pos_users').select('*').order('username');
    if (error) throw error;
    return data || [];
  },
  async create(data: { username: string; password: string; pin: string; role: string }) {
    const { error } = await supabase.from('pos_users').insert({ username: data.username, password: data.password, pin: data.pin, role: data.role, is_active: true });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
  async update(id: number, data: { username: string; pin: string; isActive: boolean }) {
    const { error } = await supabase.from('pos_users').update({ username: data.username, pin: data.pin, is_active: data.isActive }).eq('id', id);
    if (error) throw error;
    return { success: true };
  },
  async resetPassword(id: number, password: string) {
    const { error } = await supabase.from('pos_users').update({ password }).eq('id', id);
    if (error) throw error;
    return { success: true };
  },
};
