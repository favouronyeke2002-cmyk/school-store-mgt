import { supabase } from "./supabase";

// ─── SCHOOL SETTINGS ──────────────────────────────────────────────────────────
const LS_TERM = "pos_current_term";
const LS_CLASSES = "pos_class_list";
const LS_CLASS_CATEGORY = "pos_class_category_map";
const LS_BUNDLE_CATEGORY_CACHE = "pos_bundle_category_cache";
const DEFAULT_CLASS_LIST =
  '["JSS1A","JSS1B","JSS2A","JSS2B","JSS3A","JSS3B","SS1A","SS1B","SS2A","SS2B","SS3A","SS3B"]';

// Normalize legacy short-form term names to canonical long-form
function normalizeTerm(term: string | null | undefined): string {
  if (!term) return "First Term";
  const t = term.trim().toLowerCase();
  if (t === "1st term" || t === "1st term" || t === "term 1" || t === "term1")
    return "First Term";
  if (t === "2nd term" || t === "term 2" || t === "term2") return "Second Term";
  if (t === "3rd term" || t === "term 3" || t === "term3") return "Third Term";
  return term; // already canonical (e.g. "First Term")
}

export const settingsAPI = {
  async get() {
    const { data, error } = await supabase
      .from("school_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    const result: any = data ? { ...data } : {};
    // Merge localStorage fallbacks for columns that may not exist in schema yet
    const rawTerm = result.current_term || localStorage.getItem(LS_TERM);
    result.current_term = normalizeTerm(rawTerm);
    localStorage.setItem(LS_TERM, result.current_term); // overwrite any stale short-form value
    if (!result.class_list)
      result.class_list =
        localStorage.getItem(LS_CLASSES) || DEFAULT_CLASS_LIST;
    return result;
  },

  // ── Class Category Map helpers ────────────────────────────────────────────
  getClassCategoryMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(LS_CLASS_CATEGORY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  async saveClassCategoryMap(map: Record<string, string>): Promise<void> {
    const json = JSON.stringify(map);
    localStorage.setItem(LS_CLASS_CATEGORY, json);
    // Best-effort save to DB (column may not exist yet)
    const { error } = await supabase
      .from("school_settings")
      .upsert({ id: 1, class_category_map: json });
    if (error)
      console.warn(
        "class_category_map column not yet in schema — stored locally only",
      );
  },

  async save(updates: {
    school_name?: string;
    tagline?: string;
    phone_number?: string;
    logo_url?: string | null;
    academic_session?: string;
    address?: string;
    min_partial_payment_floor?: number;
    min_acceptance_partial_floor?: number;
    current_term?: string;
    class_list?: string;
  }) {
    const { current_term, class_list, ...baseUpdates } = updates;
    // Save base fields (always exist in schema)
    const { error } = await supabase
      .from("school_settings")
      .upsert({ id: 1, ...baseUpdates, updated_at: new Date().toISOString() });
    if (error) throw error;
    // Save new fields — fallback to localStorage if schema column missing
    if (current_term !== undefined) {
      localStorage.setItem(LS_TERM, current_term);
      const { error: e } = await supabase
        .from("school_settings")
        .upsert({ id: 1, current_term });
      if (e)
        console.warn("current_term column not yet in schema — stored locally");
    }
    if (class_list !== undefined) {
      localStorage.setItem(LS_CLASSES, class_list);
      const { error: e } = await supabase
        .from("school_settings")
        .upsert({ id: 1, class_list });
      if (e)
        console.warn("class_list column not yet in schema — stored locally");
    }
    return { success: true };
  },
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  async loginPin(pin: string) {
    const { data, error } = await supabase
      .from("pos_users")
      .select("id, username, role")
      .eq("pin", pin)
      .eq("is_active", true)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Invalid PIN" };
    if (data.role === "admin")
      return { success: false, error: "Admin must login with password" };
    return { success: true, user: data };
  },
  async loginPassword(password: string) {
    const { data, error } = await supabase
      .from("pos_users")
      .select("id, username, role")
      .eq("password", password)
      .eq("is_active", true)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Invalid password" };
    return { success: true, user: data };
  },
};

// ─── SHIFTS ───────────────────────────────────────────────────────────────────
export const shiftAPI = {
  async getActive() {
    const { data, error } = await supabase
      .from("shifts")
      .select("*, pos_users(username)")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...data, username: (data.pos_users as any)?.username };
  },
  async open(userId: number, openingCash: number) {
    const { data: existing } = await supabase
      .from("shifts")
      .select("id")
      .eq("status", "open")
      .maybeSingle();
    if (existing) throw new Error("A shift is already open. Close it first.");
    const { data, error } = await supabase
      .from("shifts")
      .insert({ user_id: userId, opening_cash: openingCash, status: "open" })
      .select()
      .single();
    if (error) throw error;
    return { success: true, shiftId: data.id };
  },
  async close(shiftId: number, closingCash: number) {
    const { data: shift } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", shiftId)
      .single();
    if (!shift) throw new Error("Shift not found");
    const { data: cashSales } = await supabase
      .from("transactions")
      .select("amount_paid")
      .eq("shift_id", shiftId)
      .eq("payment_mode", "Cash");
    const totalCashSales = (cashSales || []).reduce(
      (s: number, t: any) => s + Number(t.amount_paid),
      0,
    );
    const expectedCash = Number(shift.opening_cash) + totalCashSales;
    const difference = closingCash - expectedCash;
    const { error } = await supabase
      .from("shifts")
      .update({
        closing_cash: closingCash,
        expected_closing_cash: expectedCash,
        cash_difference: difference,
        closed_at: new Date().toISOString(),
        status: "closed",
      })
      .eq("id", shiftId);
    if (error) throw error;
    return { success: true, expectedCash, difference };
  },
  async getHistory() {
    const { data, error } = await supabase
      .from("shifts")
      .select("*, pos_users(username)")
      .order("opened_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map((s: any) => ({
      ...s,
      username: s.pos_users?.username,
    }));
  },
  async getExpectedCash(shiftId: number): Promise<number> {
    const { data: shift } = await supabase
      .from("shifts")
      .select("opening_cash")
      .eq("id", shiftId)
      .single();
    const { data: cashTxns } = await supabase
      .from("transactions")
      .select("amount_paid")
      .eq("shift_id", shiftId)
      .eq("payment_mode", "Cash");
    const totalCashSales = (cashTxns || []).reduce(
      (s: number, t: any) => s + Number(t.amount_paid),
      0,
    );
    // Subtract cash expenses from the drawer
    const { data: cashExpenses } = await supabase
      .from("expenses")
      .select("amount")
      .eq("shift_id", shiftId)
      .eq("payment_mode", "Cash Drawer");
    const totalCashExpenses = (cashExpenses || []).reduce(
      (s: number, e: any) => s + Number(e.amount),
      0,
    );
    return Number(shift?.opening_cash || 0) + totalCashSales - totalCashExpenses;
  },
};

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
export const studentAPI = {
  async getAll(filters?: {
    search?: string;
    class?: string;
    studentStatus?: string;
    page?: number;
    pageSize?: number;
    hasBalance?: boolean;
  }) {
    const pageSize = filters?.pageSize || 15;
    const page = filters?.page || 1;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const buildQuery = (withStatus: boolean) => {
      let q = supabase
        .from("students")
        .select("*", { count: "exact" })
        .order("name")
        .range(from, to);
      if (filters?.search) q = q.ilike("name", `%${filters.search}%`);
      if (filters?.class && filters.class !== "all")
        q = q.eq("student_class", filters.class);
      if (
        withStatus &&
        filters?.studentStatus &&
        filters.studentStatus !== "all"
      )
        q = q.eq("student_status", filters.studentStatus);
      if (filters?.hasBalance) q = q.gt("current_fees_owed", 0);
      return q;
    };

    let { data, error, count } = await buildQuery(true);
    if (error && (error.message || "").includes("student_status")) {
      // Column may not exist yet — retry without status filter
      ({ data, error, count } = await buildQuery(false));
    }
    if (error) throw error;
    return { students: data || [], total: count || 0, page, pageSize };
  },
  async getAllUnpaginated(filters?: { search?: string; class?: string }) {
    let query = supabase.from("students").select("*").order("name");
    if (filters?.search) query = query.ilike("name", `%${filters.search}%`);
    if (filters?.class && filters.class !== "all")
      query = query.eq("student_class", filters.class);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  async getClasses(): Promise<string[]> {
    // Always read from the master class list in settings, not from student records.
    // This ensures deleted classes disappear from all dropdowns immediately after saving settings.
    const { data } = await supabase
      .from("school_settings")
      .select("class_list")
      .eq("id", 1)
      .maybeSingle();
    const raw =
      data?.class_list ||
      localStorage.getItem(LS_CLASSES) ||
      DEFAULT_CLASS_LIST;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0)
        return parsed.sort() as string[];
    } catch {
      /* fall through to student-record fallback */
    }
    // Fallback: derive from existing student records if settings unavailable
    const { data: students } = await supabase
      .from("students")
      .select("student_class");
    return [...new Set((students || []).map((s: any) => s.student_class))]
      .filter(Boolean)
      .sort() as string[];
  },
  async getById(id: string) {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(data: {
    studentId?: string;
    name: string;
    studentClass: string;
    feesOwed?: number;
    admissionType?: "Returning" | "New";
    studentStatus?: "Day" | "Boarding";
  }) {
    let id = data.studentId;
    if (!id) {
      const { data: all } = await supabase
        .from("students")
        .select("student_id");
      const maxId = (all || []).reduce((max: number, s: any) => {
        const raw = s.student_id.replace(/^OIS-|^STU-/, "");
        const n = parseInt(raw);
        return !isNaN(n) && n > max ? n : max;
      }, 0);
      id = "OIS-" + String(maxId + 1).padStart(3, "0");
    }
    // Try with student_status first, fall back without if column missing
    const base = {
      student_id: id,
      name: data.name,
      student_class: data.studentClass,
      current_fees_owed: data.feesOwed || 0,
      admission_type: data.admissionType || "Returning",
    };
    const withStatus = { ...base, student_status: data.studentStatus || "Day" };
    const { error: e1 } = await supabase.from("students").insert(withStatus);
    if (e1) {
      const { error: e2 } = await supabase.from("students").insert(base);
      if (e2) return { success: false, error: e2.message };
    }
    return { success: true, studentId: id };
  },
  async update(
    id: string,
    data: {
      name: string;
      studentClass: string;
      admissionType?: "Returning" | "New";
      studentStatus?: "Day" | "Boarding";
    },
  ) {
    const base = {
      name: data.name,
      student_class: data.studentClass,
      admission_type: data.admissionType,
      updated_at: new Date().toISOString(),
    };
    const withStatus = { ...base, student_status: data.studentStatus };
    const { error: e1 } = await supabase
      .from("students")
      .update(data.studentStatus !== undefined ? withStatus : base)
      .eq("student_id", id);
    if (e1) {
      const { error: e2 } = await supabase
        .from("students")
        .update(base)
        .eq("student_id", id);
      if (e2) throw e2;
    }
    return { success: true };
  },
  async updateFees(id: string, fees: number) {
    const { error } = await supabase
      .from("students")
      .update({ current_fees_owed: fees, updated_at: new Date().toISOString() })
      .eq("student_id", id);
    if (error) throw error;
    return { success: true };
  },
  async delete(id: string) {
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("student_id", id);
    if (error) throw error;
    return { success: true };
  },
  async renameClass(oldName: string, newName: string) {
    const { error } = await supabase
      .from("students")
      .update({ student_class: newName })
      .eq("student_class", oldName);
    if (error) throw error;
    return { success: true };
  },
  async bulkImport(students: any[]) {
    // If any row lacks a student_id, generate sequential OIS-XXX IDs from the current max
    const needsId = students.some((s) => !s.student_id);
    let nextId = 1;
    if (needsId) {
      const { data: all } = await supabase
        .from("students")
        .select("student_id");
      const maxId = (all || []).reduce((max: number, s: any) => {
        const raw = String(s.student_id).replace(/^OIS-|^STU-/i, "");
        const n = parseInt(raw);
        return !isNaN(n) && n > max ? n : max;
      }, 0);
      nextId = maxId + 1;
    }
    const rows = students.map((s) => {
      let id = s.student_id || "";
      if (!id) id = "OIS-" + String(nextId++).padStart(3, "0");
      return {
        student_id: id,
        name: String(s.name).trim(),
        student_class: String(s.student_class).trim(),
        current_fees_owed: Number(s.fees_owed) || 0,
        admission_type: "Returning",
      };
    });
    const { error } = await supabase
      .from("students")
      .upsert(rows, { onConflict: "student_id" });
    if (error) return { success: false, error: error.message };
    return { success: true, count: rows.length };
  },
  async getHistory(studentId: string) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "*, transaction_items(quantity, unit_price, total_price, inventory(item_name)), fee_types(name)",
      )
      .eq("student_id", studentId)
      .order("timestamp", { ascending: false });
    if (error) throw error;
    return (data || []).map((t: any) => ({
      ...t,
      items_summary:
        t.transaction_items
          ?.map((ti: any) => `${ti.inventory?.item_name} (x${ti.quantity})`)
          .join(", ") || null,
      fee_name: t.fee_types?.name || null,
    }));
  },
};

// ─── INVENTORY CATEGORIES ─────────────────────────────────────────────────────
export const categoryAPI = {
  async getAll() {
    const { data, error } = await supabase
      .from("inventory_categories")
      .select("*")
      .order("name");
    if (error) throw error;
    return data || [];
  },
  async create(name: string, color: string) {
    const { error } = await supabase
      .from("inventory_categories")
      .insert({ name, color });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
  async update(id: number, name: string, color: string) {
    const { error } = await supabase
      .from("inventory_categories")
      .update({ name, color })
      .eq("id", id);
    if (error) throw error;
    return { success: true };
  },
  async delete(id: number) {
    const { error } = await supabase
      .from("inventory_categories")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { success: true };
  },
};

// ─── INVENTORY ────────────────────────────────────────────────────────────────
export const inventoryAPI = {
  async getAll(filters?: {
    search?: string;
    lowStock?: boolean;
    categoryId?: number | null;
    activeOnly?: boolean;
    archivedOnly?: boolean;
  }) {
    const buildQuery = (withActive: boolean) => {
      let q = supabase
        .from("inventory")
        .select("*, inventory_categories(name, color)")
        .order("item_name");
      if (filters?.search)
        q = q.or(
          `item_name.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%`,
        );
      if (filters?.lowStock) q = q.lte("stock_quantity", 10);
      if (filters?.categoryId) q = q.eq("category_id", filters.categoryId);
      if (withActive && filters?.activeOnly) q = q.eq("is_active", true);
      if (withActive && filters?.archivedOnly) q = q.eq("is_active", false);
      return q;
    };
    let { data, error } = await buildQuery(true);
    if (error && error.message?.includes("is_active"))
      ({ data, error } = await buildQuery(false));
    if (error) throw error;
    return (data || []).map((i: any) => ({
      ...i,
      is_active: i.is_active !== false,
      category_name: i.inventory_categories?.name || null,
      category_color: i.inventory_categories?.color || null,
    }));
  },
  async getById(id: number) {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("item_id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async getByBarcode(barcode: string) {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("barcode", barcode)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(data: {
    itemName: string;
    costPrice: number;
    sellingPrice: number;
    stockQuantity?: number;
    barcode?: string;
    categoryId?: number | null;
  }) {
    const { data: item, error } = await supabase
      .from("inventory")
      .insert({
        item_name: data.itemName,
        cost_price: data.costPrice,
        selling_price: data.sellingPrice,
        stock_quantity: data.stockQuantity || 0,
        barcode: data.barcode || null,
        category_id: data.categoryId || null,
      })
      .select("item_id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, itemId: item.item_id };
  },
  async update(
    id: number,
    data: {
      itemName: string;
      costPrice: number;
      sellingPrice: number;
      barcode?: string;
      categoryId?: number | null;
    },
  ) {
    const { error } = await supabase
      .from("inventory")
      .update({
        item_name: data.itemName,
        cost_price: data.costPrice,
        selling_price: data.sellingPrice,
        barcode: data.barcode || null,
        category_id: data.categoryId || null,
      })
      .eq("item_id", id);
    if (error) throw error;
    return { success: true };
  },
  async adjustStock(id: number, quantity: number, reason: string) {
    const { data: item } = await supabase
      .from("inventory")
      .select("stock_quantity")
      .eq("item_id", id)
      .single();
    if (!item) throw new Error("Item not found");
    await supabase
      .from("inventory")
      .update({ stock_quantity: Math.max(0, item.stock_quantity + quantity) })
      .eq("item_id", id);
    await supabase
      .from("stock_adjustments")
      .insert({ item_id: id, quantity_change: quantity, reason });
    return { success: true };
  },
  async setStock(id: number, newQty: number) {
    const { data: item } = await supabase
      .from("inventory")
      .select("stock_quantity")
      .eq("item_id", id)
      .single();
    if (!item) throw new Error("Item not found");
    const diff = newQty - item.stock_quantity;
    await supabase
      .from("inventory")
      .update({ stock_quantity: Math.max(0, newQty) })
      .eq("item_id", id);
    await supabase
      .from("stock_adjustments")
      .insert({
        item_id: id,
        quantity_change: diff,
        reason: "Admin stock override",
      })
      .then(() => {})
      .catch(() => {});
    return { success: true };
  },
  async bulkImport(items: any[]) {
    const genBarcode = () =>
      String(Math.floor(Math.random() * 900000000000) + 100000000000);
    const rows = items.map((i) => ({
      item_name: i.item_name,
      barcode: i.barcode || genBarcode(),
      cost_price: Number(i.cost_price) || 0,
      selling_price: Number(i.selling_price) || 0,
      stock_quantity: Number(i.stock_quantity) || 0,
    }));
    const { error } = await supabase
      .from("inventory")
      .upsert(rows, { onConflict: "barcode" });
    if (error) return { success: false, error: error.message };
    return { success: true, count: rows.length };
  },
  async smartDelete(
    id: number,
  ): Promise<{ deleted: boolean; archived: boolean; error?: string }> {
    try {
      const { data: history } = await supabase
        .from("transaction_items")
        .select("id")
        .eq("item_id", id)
        .limit(1);
      if (history && history.length > 0) {
        const { error } = await supabase
          .from("inventory")
          .update({ is_active: false })
          .eq("item_id", id);
        if (error)
          return { deleted: false, archived: false, error: error.message };
        return { deleted: false, archived: true };
      } else {
        const { error } = await supabase
          .from("inventory")
          .delete()
          .eq("item_id", id);
        if (error)
          return { deleted: false, archived: false, error: error.message };
        return { deleted: true, archived: false };
      }
    } catch (e) {
      return { deleted: false, archived: false, error: (e as Error).message };
    }
  },
};

// ─── FEE TYPES ────────────────────────────────────────────────────────────────
export const feeTypeAPI = {
  async getAll(session?: string) {
    let q = supabase
      .from("fee_types")
      .select("*")
      .order("created_at", { ascending: false });
    if (session) q = q.eq("academic_session", session);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async getByClass(studentClass: string) {
    // Get fee types applicable to a class (class_filter matches OR is null=all)
    const { data, error } = await supabase
      .from("fee_types")
      .select("*")
      .or(`class_filter.eq.${studentClass},class_filter.is.null`);
    if (error) throw error;
    return data || [];
  },
  async create(data: {
    name: string;
    description?: string;
    academicSession: string;
    term?: string;
    amount: number;
    classFilter?: string;
    feeCategory?: "standard" | "registration";
    applicableTo?: string;
  }) {
    const payload = {
      name: data.name,
      description: data.description || null,
      academic_session: data.academicSession,
      term: data.term || null,
      amount: data.amount,
      class_filter: data.classFilter || null,
      fee_category: data.feeCategory || "standard",
      applicable_to: data.applicableTo || "All Students",
    };
    const { data: res, error } = await supabase
      .from("fee_types")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: (res as any).id };
  },
  async update(
    id: number,
    data: {
      name: string;
      description?: string;
      amount: number;
      classFilter?: string;
      feeCategory?: "standard" | "registration";
      applicableTo?: string;
    },
  ) {
    const base = {
      name: data.name,
      description: data.description || null,
      amount: data.amount,
      class_filter: data.classFilter || null,
      fee_category: data.feeCategory || "standard",
    };
    const withApplicable = {
      ...base,
      applicable_to: data.applicableTo || "All Students",
    };
    const { error: e1 } = await supabase
      .from("fee_types")
      .update(withApplicable)
      .eq("id", id);
    if (e1) {
      const { error: e2 } = await supabase
        .from("fee_types")
        .update(base)
        .eq("id", id);
      if (e2) throw e2;
    }
    return { success: true };
  },
  async delete(id: number) {
    const { error } = await supabase.from("fee_types").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  },
  async cascadeDelete(
    id: number,
  ): Promise<{ success: boolean; error?: string; studentsAffected: number }> {
    const { data: sfRows, error: sfErr } = await supabase
      .from("student_fees")
      .select("student_id, amount_due, amount_paid")
      .eq("fee_type_id", id);
    if (sfErr)
      return { success: false, error: sfErr.message, studentsAffected: 0 };
    const unpaid = (sfRows || []).filter(
      (sf: any) => Number(sf.amount_due) > Number(sf.amount_paid),
    );
    for (const sf of unpaid) {
      const delta = Number(sf.amount_due) - Number(sf.amount_paid);
      const { data: stu } = await supabase
        .from("students")
        .select("current_fees_owed")
        .eq("student_id", sf.student_id)
        .single();
      if (stu)
        await supabase
          .from("students")
          .update({
            current_fees_owed: Math.max(
              0,
              Number(stu.current_fees_owed) - delta,
            ),
            updated_at: new Date().toISOString(),
          })
          .eq("student_id", sf.student_id);
    }
    await supabase.from("student_fees").delete().eq("fee_type_id", id);
    const { error } = await supabase.from("fee_types").delete().eq("id", id);
    if (error)
      return {
        success: false,
        error: error.message,
        studentsAffected: unpaid.length,
      };
    return { success: true, studentsAffected: unpaid.length };
  },
  // Assign a fee type to students; for 'standard' fees, exclude 'New' admission students
  async assignToStudents(
    feeTypeId: number,
    amount: number,
    classFilter?: string,
    specificStudentId?: string,
    feeCategory: "standard" | "registration" = "standard",
    applicableTo?: string,
  ) {
    let query = supabase
      .from("students")
      .select("student_id, current_fees_owed");

    if (specificStudentId) {
      query = query.eq("student_id", specificStudentId);
    } else {
      if (classFilter) query = query.eq("student_class", classFilter);
      // Standard fees do NOT apply to 'New' students
      if (feeCategory === "standard")
        query = query.eq("admission_type", "Returning");
      // Filter by student status if applicable_to is set
      if (applicableTo === "Day") query = query.eq("student_status", "Day");
      else if (applicableTo === "Boarding")
        query = query.eq("student_status", "Boarding");
    }

    const { data: students } = await query;
    if (!students || students.length === 0) return { success: true, count: 0 };

    // SAFEGUARD: check which students already have this fee type assigned
    // so we never double-increment current_fees_owed
    const { data: existing } = await supabase
      .from("student_fees")
      .select("student_id")
      .eq("fee_type_id", feeTypeId);
    const alreadyAssigned = new Set(
      (existing || []).map((sf: any) => sf.student_id),
    );

    const rows = students.map((s: any) => ({
      student_id: s.student_id,
      fee_type_id: feeTypeId,
      amount_due: amount,
      amount_paid: 0,
    }));
    const { error } = await supabase.from("student_fees").upsert(rows, {
      onConflict: "student_id,fee_type_id",
      ignoreDuplicates: true,
    });
    if (error) return { success: false, error: error.message };

    // Only increment current_fees_owed for genuinely NEW assignments
    let newCount = 0;
    for (const s of students) {
      if (!alreadyAssigned.has(s.student_id)) {
        const newOwed = Number(s.current_fees_owed || 0) + amount;
        await supabase
          .from("students")
          .update({
            current_fees_owed: newOwed,
            updated_at: new Date().toISOString(),
          })
          .eq("student_id", s.student_id);
        newCount++;
      }
    }

    return { success: true, count: newCount };
  },
};

// ─── STUDENT FEE LEDGER ───────────────────────────────────────────────────────
export const studentFeeAPI = {
  async remove(sfId: number, studentId: string, balanceToSubtract: number) {
    const { error } = await supabase
      .from("student_fees")
      .delete()
      .eq("id", sfId);
    if (error) return { success: false, error: error.message };
    const { data: student } = await supabase
      .from("students")
      .select("current_fees_owed")
      .eq("student_id", studentId)
      .single();
    if (student) {
      const newOwed = Math.max(
        0,
        Number(student.current_fees_owed || 0) - balanceToSubtract,
      );
      await supabase
        .from("students")
        .update({
          current_fees_owed: newOwed,
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", studentId);
    }
    return { success: true };
  },
  async applyDiscount(sfId: number, studentId: string, discountAmount: number) {
    const { data: sf } = await supabase
      .from("student_fees")
      .select("amount_due")
      .eq("id", sfId)
      .single();
    if (!sf) return { success: false, error: "Fee record not found" };
    const newAmountDue = Math.max(0, Number(sf.amount_due) - discountAmount);
    const { error } = await supabase
      .from("student_fees")
      .update({ amount_due: newAmountDue })
      .eq("id", sfId);
    if (error) return { success: false, error: error.message };
    const { data: student } = await supabase
      .from("students")
      .select("current_fees_owed")
      .eq("student_id", studentId)
      .single();
    if (student) {
      const newOwed = Math.max(
        0,
        Number(student.current_fees_owed || 0) - discountAmount,
      );
      await supabase
        .from("students")
        .update({
          current_fees_owed: newOwed,
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", studentId);
    }
    return { success: true };
  },
  async getForStudent(studentId: string) {
    const { data, error } = await supabase
      .from("student_fees")
      .select(
        "*, fee_types(name, description, academic_session, fee_category, term)",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((sf: any) => ({
      ...sf,
      fee_name: sf.fee_types?.name || "Unknown",
      fee_description: sf.fee_types?.description || "",
      academic_session: sf.fee_types?.academic_session || "",
      fee_category: sf.fee_types?.fee_category || "standard",
      term: sf.fee_types?.term || null,
      balance: Number(sf.amount_due) - Number(sf.amount_paid),
    }));
  },
  // Compute the true balance for one student directly from student_fees rows
  async calculateStudentBalance(studentId: string): Promise<number> {
    const { data, error } = await supabase
      .from("student_fees")
      .select("amount_due, amount_paid")
      .eq("student_id", studentId);
    if (error) throw error;
    return (data || []).reduce(
      (sum: number, sf: any) =>
        sum + Math.max(0, Number(sf.amount_due) - Number(sf.amount_paid)),
      0,
    );
  },

  // One-time cleanup: delete orphaned student_fee rows (fee_type_id deleted from fee_types),
  // then recalculate and write the correct current_fees_owed for every student.
  async recalibrateAllBalances(): Promise<{
    updated: number;
    orphansRemoved: number;
  }> {
    // 1. Valid fee type IDs
    const { data: feeTypes } = await supabase.from("fee_types").select("id");
    const validIds = new Set((feeTypes || []).map((ft: any) => ft.id));

    // 2. All student_fees rows
    const { data: allSFs } = await supabase
      .from("student_fees")
      .select("id, student_id, fee_type_id, amount_due, amount_paid");

    // 3. Remove orphaned rows (fee_type deleted or no longer in master list)
    const orphans = (allSFs || []).filter(
      (sf: any) => !validIds.has(sf.fee_type_id),
    );
    for (const orphan of orphans) {
      await supabase.from("student_fees").delete().eq("id", orphan.id);
    }

    // 4. Compute correct balance per student from valid rows only
    const validSFs = (allSFs || []).filter((sf: any) =>
      validIds.has(sf.fee_type_id),
    );
    const balanceMap = new Map<string, number>();
    for (const sf of validSFs) {
      const bal = Math.max(0, Number(sf.amount_due) - Number(sf.amount_paid));
      balanceMap.set(sf.student_id, (balanceMap.get(sf.student_id) || 0) + bal);
    }

    // 5. Write corrected balances to every student record
    const { data: students } = await supabase
      .from("students")
      .select("student_id");
    let updated = 0;
    for (const stu of students || []) {
      const correct = balanceMap.get(stu.student_id) || 0;
      await supabase
        .from("students")
        .update({
          current_fees_owed: correct,
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", stu.student_id);
      updated++;
    }

    return { updated, orphansRemoved: orphans.length };
  },

  async getAll(filters?: { session?: string }) {
    const { data, error } = await supabase
      .from("student_fees")
      .select(
        "*, students(name, student_class, admission_type), fee_types(name, academic_session, fee_category)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || [])
      .map((sf: any) => ({
        ...sf,
        student_name: sf.students?.name,
        student_class: sf.students?.student_class,
        admission_type: sf.students?.admission_type,
        student_status: "Day",
        fee_name: sf.fee_types?.name,
        academic_session: sf.fee_types?.academic_session,
        fee_category: sf.fee_types?.fee_category,
        balance: Number(sf.amount_due) - Number(sf.amount_paid),
      }))
      .filter(
        (sf: any) =>
          !filters?.session || sf.academic_session === filters.session,
      );
  },
  async getLedger(session?: string) {
    const { data, error } = await supabase
      .from("student_fees")
      .select(
        "student_id, amount_due, amount_paid, students(name, student_class), fee_types(academic_session)",
      );
    if (error) throw error;
    const map = new Map<string, any>();
    for (const sf of data || []) {
      if (
        session &&
        sf.fee_types?.academic_session &&
        sf.fee_types.academic_session !== session
      )
        continue;
      const id = sf.student_id;
      if (!map.has(id))
        map.set(id, {
          student_id: id,
          name: (sf.students as any)?.name || "Unknown",
          student_class: (sf.students as any)?.student_class || "",
          student_status: "Day",
          total_billed: 0,
          total_paid: 0,
        });
      const entry = map.get(id)!;
      entry.total_billed += Number(sf.amount_due);
      entry.total_paid += Number(sf.amount_paid);
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, outstanding: e.total_billed - e.total_paid }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async recordPayment(
    studentFeeId: number,
    amount: number,
    studentId: string,
    shiftId: number,
    paymentMode: string,
    customerName?: string,
    targetClass?: string,
  ) {
    const { data: sf } = await supabase
      .from("student_fees")
      .select("amount_due, amount_paid, fee_type_id")
      .eq("id", studentFeeId)
      .single();
    if (!sf) throw new Error("Fee record not found");
    const balance = Number(sf.amount_due) - Number(sf.amount_paid);
    if (amount > balance + 0.01)
      throw new Error(
        `Cannot pay ₦${amount.toLocaleString("en-NG")} — balance is only ₦${balance.toLocaleString("en-NG")}`,
      );

    await tryInsertTxn({
      student_id: studentId,
      shift_id: shiftId,
      type: "FEES_CASH_COLLECTION",
      amount_paid: amount,
      payment_mode: paymentMode,
      fee_type_id: sf.fee_type_id,
      customer_name: customerName,
      target_class: targetClass,
    });
    await supabase
      .from("student_fees")
      .update({ amount_paid: Number(sf.amount_paid) + amount })
      .eq("id", studentFeeId);

    const { data: student } = await supabase
      .from("students")
      .select("current_fees_owed")
      .eq("student_id", studentId)
      .single();
    if (student)
      await supabase
        .from("students")
        .update({
          current_fees_owed: Math.max(
            0,
            Number(student.current_fees_owed) - amount,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", studentId);
    return { success: true };
  },
};

// ─── TRANSACTION INSERT HELPER ────────────────────────────────────────────────
// Tries to stamp customer_name + target_class into the row; if the columns don't
// exist yet in the live DB it retries without them (graceful fallback).
async function tryInsertTxn(
  payload: Record<string, any>,
): Promise<{ transaction_id: number }> {
  const { customer_name, target_class, ...base } = payload;
  const withSnap = {
    ...base,
    customer_name: customer_name ?? null,
    target_class: target_class ?? null,
  };
  let { data, error } = await supabase
    .from("transactions")
    .insert(withSnap)
    .select("transaction_id")
    .single();
  if (
    error &&
    (error.message.includes("column") ||
      error.message.includes("does not exist"))
  ) {
    ({ data, error } = await supabase
      .from("transactions")
      .insert(base)
      .select("transaction_id")
      .single());
  }
  if (error) throw error;
  return data as { transaction_id: number };
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export const transactionAPI = {
  async getHistory(filters?: { shiftId?: number; studentId?: string }) {
    let query = supabase.from("transactions").select(`
      *,
      students (
        name,
        student_class,
        student_id
      ),
      applicants (
        first_name,
        last_name,
        proposed_class
      )
    `);
    if (filters?.shiftId) query = query.eq("shift_id", filters.shiftId);
    if (filters?.studentId) query = query.eq("student_id", filters.studentId);
    query = query.order("timestamp", { ascending: false }).limit(500);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((t: any) => {
      let finalName = "";
      let finalClass = "";
      if (t.students) {
        finalName = t.students.name;
        finalClass = t.students.student_class || "—";
      } else if (t.applicants) {
        const app = t.applicants;
        finalName = `${app.first_name || ""} ${app.last_name || ""}`.trim();
        finalClass = app.proposed_class || "New Admission";
      } else {
        finalName = t.customer_name || "Walk-In";
        finalClass = t.target_class || "—";
      }
      return {
        transaction_id: t.transaction_id || t.id,
        student_id: t.student_id || "—",
        shift_id: t.shift_id,
        type: t.type,
        amount_paid: t.amount_paid,
        payment_mode: t.payment_mode,
        timestamp: t.timestamp,
        student_name: finalName,
        student_class: finalClass,
      };
    });
  },
  async search(filters: {
    query?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    paymentMode?: string;
  }) {
    // 1. Explicitly join with both students AND applicants directly from the transactions foreign keys
    let queryBuilder = supabase.from("transactions").select(`
        *,
        students (
          name,
          student_class,
          student_id
        ),
        applicants (
          first_name,
          last_name,
          proposed_class
        )
      `);

    // 2. Apply core parameters filtering
    if (filters.type) queryBuilder = queryBuilder.eq("type", filters.type);
    if (filters.paymentMode)
      queryBuilder = queryBuilder.eq("payment_mode", filters.paymentMode);
    if (filters.startDate)
      queryBuilder = queryBuilder.gte(
        "timestamp",
        `${filters.startDate}T00:00:00`,
      );
    if (filters.endDate)
      queryBuilder = queryBuilder.lte(
        "timestamp",
        `${filters.endDate}T23:59:59`,
      );

    queryBuilder = queryBuilder
      .order("timestamp", { ascending: false })
      .limit(500);

    const { data, error } = await queryBuilder;
    if (error) throw error;

    // 3. Flatten matching profile tables down cleanly for the UI layout
    let results = (data || []).map((t: any) => {
      let finalName = "";
      let finalClass = "";

      if (t.students) {
        // Enrolled fully active student match
        finalName = t.students.name;
        finalClass = t.students.student_class || "—";
      } else if (t.applicants) {
        // Pending admission / registration stage applicant match
        const app = t.applicants;
        finalName = `${app.first_name || ""} ${app.last_name || ""}`.trim();
        finalClass = app.proposed_class || "New Admission";
      } else {
        // Fallback for standalone baseline cash system sales
        finalName = "Walk-In Applicant";
        finalClass = "—";
      }
      return {
        transaction_id: t.transaction_id || t.id,
        // Remove the APP-# placeholder fallback and leave it clean
        student_id: t.student_id || "—",
        shift_id: t.shift_id,
        type: t.type,
        amount_paid: t.amount_paid,
        payment_mode: t.payment_mode,
        timestamp: t.timestamp,
        student_name: finalName,
        student_class: finalClass,
      };
    });

    // 4. Handle structural text matching filtration (client-side)
    if (filters.query) {
      const qLow = filters.query.toLowerCase();
      results = results.filter(
        (t: any) =>
          t.student_name?.toLowerCase().includes(qLow) ||
          t.student_id?.toLowerCase().includes(qLow),
      );
    }

    return results;
  },
  async getDetails(transactionId: number) {
    const { data: items, error: itemsError } = await supabase
      .from("transaction_items")
      .select("*, inventory(item_name)")
      .eq("transaction_id", transactionId);
    if (itemsError) throw itemsError;

    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("*, fee_types(name)")
      .eq("transaction_id", transactionId)
      .maybeSingle();
    if (txnError) throw txnError;

    return {
      items: (items || []).map((i: any) => ({
        ...i,
        item_name: i.inventory?.item_name || i.item_name,
      })),
      transaction: txn ? {
        ...txn,
        fee_type_name: txn.fee_types?.name || null,
      } : null,
    };
  },

  async createPurchase(
    studentId: string,
    shiftId: number,
    cart: { item_id: number; item_name: string; selling_price: number; quantity: number }[],
    paymentMode: string,
    customerName?: string,
    targetClass?: string,
  ) {
    const total = cart.reduce((s, i) => s + i.selling_price * i.quantity, 0);

    const { data: txnData, error: txnError } = await supabase
      .from("transactions")
      .insert({
        student_id: studentId,
        shift_id: shiftId,
        type: "STORE_PURCHASE",
        amount_paid: total,
        payment_mode: paymentMode,
        customer_name: customerName || null,
        target_class: targetClass || null,
      })
      .select("transaction_id")
      .single();

    if (txnError) {
      // Fallback without customer_name/target_class if columns don't exist
      const { data: fallbackTxn, error: fallbackError } = await supabase
        .from("transactions")
        .insert({
          student_id: studentId,
          shift_id: shiftId,
          type: "STORE_PURCHASE",
          amount_paid: total,
          payment_mode: paymentMode,
        })
        .select("transaction_id")
        .single();
      if (fallbackError) return { success: false, error: fallbackError.message };
      if (!fallbackTxn) return { success: false, error: "Failed to create transaction" };
      const txnId = (fallbackTxn as any).transaction_id;
      const itemRows = cart.map((i) => ({
        transaction_id: txnId,
        item_id: i.item_id,
        quantity: i.quantity,
        unit_price: i.selling_price,
        total_price: i.selling_price * i.quantity,
      }));
      const { error: itemsError } = await supabase.from("transaction_items").insert(itemRows);
      if (itemsError) return { success: false, error: itemsError.message };
      // Decrement inventory directly
      for (const item of cart) {
        const { data: inv } = await supabase
          .from("inventory")
          .select("stock_quantity")
          .eq("item_id", item.item_id)
          .single();
        if (inv) {
          await supabase
            .from("inventory")
            .update({ stock_quantity: Math.max(0, inv.stock_quantity - item.quantity) })
            .eq("item_id", item.item_id);
        }
      }
      return { success: true, transaction_id: txnId };
    }

    const txnId = (txnData as any).transaction_id;
    const itemRows = cart.map((i) => ({
      transaction_id: txnId,
      item_id: i.item_id,
      quantity: i.quantity,
      unit_price: i.selling_price,
      total_price: i.selling_price * i.quantity,
    }));
    const { error: itemsError } = await supabase.from("transaction_items").insert(itemRows);
    if (itemsError) return { success: false, error: itemsError.message };

    // Decrement inventory directly
    for (const item of cart) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("stock_quantity")
        .eq("item_id", item.item_id)
        .single();
      if (inv) {
        await supabase
          .from("inventory")
          .update({ stock_quantity: Math.max(0, inv.stock_quantity - item.quantity) })
          .eq("item_id", item.item_id);
      }
    }

    return { success: true, transaction_id: txnId };
  },

  async getForStudent(studentId: string) {
    const { data: txns, error } = await supabase
      .from("transactions")
      .select("*, fee_types(name)")
      .eq("student_id", studentId)
      .order("timestamp", { ascending: false });

    if (error) throw error;
    if (!txns || txns.length === 0) return [];

    const txnIds = txns.map((t: any) => t.transaction_id || t.id);
    const { data: allItems } = await supabase
      .from("transaction_items")
      .select("*, inventory(item_name)")
      .in("transaction_id", txnIds);

    const byTxn = new Map<number, any[]>();
    for (const item of allItems || []) {
      const tId = item.transaction_id;
      if (!byTxn.has(tId)) byTxn.set(tId, []);
      byTxn.get(tId)!.push({ ...item, item_name: item.inventory?.item_name });
    }

    return txns.map((t: any) => {
      const currentId = t.transaction_id || t.id;
      return {
        ...t,
        fee_type_name: t.fee_types?.name,
        items: byTxn.get(currentId) || [],
      };
    });
  },
};

// ─── ADMIN ANALYTICS ─────────────────────────────────────────────────────────
export const adminAPI = {
  async getStats() {
    const [
      txnResult,
      storeResult,
      feesResult,
      cogsResult,
      feesOwedResult,
      countResult,
    ] = await Promise.all([
      supabase.from("transactions").select("amount_paid"),
      supabase
        .from("transactions")
        .select("amount_paid")
        .eq("type", "STORE_PURCHASE"),
      supabase
        .from("transactions")
        .select("amount_paid")
        .eq("type", "FEES_CASH_COLLECTION"),
      supabase
        .from("transaction_items")
        .select("quantity, unit_price, item_id"),
      supabase.from("students").select("current_fees_owed"),
      supabase
        .from("transactions")
        .select("transaction_id", { count: "exact", head: true }),
    ]);
    const { data: invData } = await supabase
      .from("inventory")
      .select("item_id, cost_price");
    const totalRevenue = (txnResult.data || []).reduce(
      (s: number, t: any) => s + Number(t.amount_paid),
      0,
    );
    const storeRevenue = (storeResult.data || []).reduce(
      (s: number, t: any) => s + Number(t.amount_paid),
      0,
    );
    const feesCollected = (feesResult.data || []).reduce(
      (s: number, t: any) => s + Number(t.amount_paid),
      0,
    );
    const costMap = new Map(
      (invData || []).map((i: any) => [i.item_id, Number(i.cost_price)]),
    );
    const cogs = (cogsResult.data || []).reduce(
      (s: number, ti: any) => s + ti.quantity * (costMap.get(ti.item_id) || 0),
      0,
    );
    const profit = storeRevenue - cogs;
    const profitMargin =
      storeRevenue > 0 ? ((profit / storeRevenue) * 100).toFixed(2) : "0";
    const uncollectedFees = (feesOwedResult.data || []).reduce(
      (s: number, st: any) => s + Number(st.current_fees_owed),
      0,
    );
    return {
      totalRevenue,
      storeRevenue,
      feesCollected,
      cogs,
      profit,
      profitMargin,
      uncollectedFees,
      transactionCount: countResult.count || 0,
    };
  },
  async getDailySales(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data, error } = await supabase
      .from("transactions")
      .select("timestamp, type, amount_paid")
      .gte("timestamp", since.toISOString())
      .order("timestamp");
    if (error) throw error;
    const grouped: Record<string, any> = {};
    for (const t of data || []) {
      const date = t.timestamp.slice(0, 10);
      if (!grouped[date])
        grouped[date] = { store_sales: 0, fees_collected: 0, total: 0 };
      const amt = Number(t.amount_paid);
      if (t.type === "STORE_PURCHASE") grouped[date].store_sales += amt;
      else grouped[date].fees_collected += amt;
      grouped[date].total += amt;
    }
    return Object.entries(grouped)
      .map(([date, vals]) => ({ date, ...vals }))
      .reverse();
  },
  async getClassRevenue() {
    const { data, error } = await supabase
      .from("transactions")
      .select("amount_paid, students(student_class)");
    if (error) throw error;
    const grouped: Record<string, any> = {};
    for (const t of data || []) {
      const cls = (t.students as any)?.student_class || "Unknown";
      if (!grouped[cls])
        grouped[cls] = { total_revenue: 0, transaction_count: 0 };
      grouped[cls].total_revenue += Number(t.amount_paid);
      grouped[cls].transaction_count += 1;
    }
    return Object.entries(grouped)
      .map(([student_class, vals]) => ({ student_class, ...vals }))
      .sort((a, b) => b.total_revenue - a.total_revenue);
  },
  async getTopProducts(limit: number = 10) {
    const { data, error } = await supabase
      .from("transaction_items")
      .select("item_id, quantity, total_price, inventory(item_name)")
      .order("total_price", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const grouped: Record<number, any> = {};
    for (const ti of data || []) {
      const id = ti.item_id;
      if (!grouped[id])
        grouped[id] = {
          item_name: (ti.inventory as any)?.item_name || "Unknown",
          total_quantity: 0,
          total_revenue: 0,
        };
      grouped[id].total_quantity += ti.quantity;
      grouped[id].total_revenue += Number(ti.total_price);
    }
    return Object.values(grouped).sort(
      (a, b) => b.total_revenue - a.total_revenue,
    );
  },
  async getInventoryValuation() {
    const { data, error } = await supabase
      .from("inventory")
      .select("item_id, stock_quantity, cost_price, selling_price");
    if (error) throw error;
    const items = data || [];
    return {
      item_count: items.length,
      total_units: items.reduce((s: number, i: any) => s + i.stock_quantity, 0),
      total_cost_value: items.reduce(
        (s: number, i: any) => s + i.stock_quantity * Number(i.cost_price),
        0,
      ),
      total_retail_value: items.reduce(
        (s: number, i: any) => s + i.stock_quantity * Number(i.selling_price),
        0,
      ),
    };
  },
};

// ─── USERS ────────────────────────────────────────────────────────────────────
export const userAPI = {
  async getAll() {
    const { data, error } = await supabase
      .from("pos_users")
      .select("*")
      .order("username");
    if (error) throw error;
    return data || [];
  },
  async create(data: {
    username: string;
    password: string;
    pin: string;
    role: string;
  }) {
    const { error } = await supabase.from("pos_users").insert({
      username: data.username,
      password: data.password,
      pin: data.pin,
      role: data.role,
      is_active: true,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
  async update(
    id: number,
    data: { username: string; pin: string; isActive: boolean },
  ) {
    const { error } = await supabase
      .from("pos_users")
      .update({
        username: data.username,
        pin: data.pin,
        is_active: data.isActive,
      })
      .eq("id", id);
    if (error) throw error;
    return { success: true };
  },
  async resetPassword(id: number, password: string) {
    const { error } = await supabase
      .from("pos_users")
      .update({ password })
      .eq("id", id);
    if (error) throw error;
    return { success: true };
  },
  async resetPin(id: number, pin: string) {
    const { error } = await supabase
      .from("pos_users")
      .update({ pin })
      .eq("id", id);
    if (error) throw error;
    return { success: true };
  },
};

// ─── BUNDLES ──────────────────────────────────────────────────────────────────
// ─── Bundle category localStorage cache ───────────────────────────────────────
// Persists class_category + coaching_addon locally when DB columns not yet migrated.
type BundleCacheEntry = {
  class_category: string | null;
  coaching_addon: boolean;
};
function getBundleCategoryCache(): Record<number, BundleCacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(LS_BUNDLE_CATEGORY_CACHE) || "{}");
  } catch {
    return {};
  }
}
function saveBundleCategoryCache(id: number, entry: BundleCacheEntry) {
  const c = getBundleCategoryCache();
  c[id] = entry;
  localStorage.setItem(LS_BUNDLE_CATEGORY_CACHE, JSON.stringify(c));
}
function clearBundleCategoryCache(id: number) {
  const c = getBundleCategoryCache();
  delete c[id];
  localStorage.setItem(LS_BUNDLE_CATEGORY_CACHE, JSON.stringify(c));
}

function mapBundleItems(bundle_items: any[]) {
  return (bundle_items || []).map((bi: any) => ({
    id: bi.id,
    item_id: bi.inventory?.item_id,
    item_name: bi.inventory?.item_name,
    selling_price: Number(bi.inventory?.selling_price || 0),
    stock_quantity: bi.inventory?.stock_quantity || 0,
    quantity: bi.quantity,
  }));
}

export const bundleAPI = {
  async getAll() {
    const { data, error } = await supabase
      .from("bundles")
      .select(
        "*, bundle_items(*, inventory(item_id, item_name, selling_price, stock_quantity))",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    const cache = getBundleCategoryCache();
    return (data || []).map((b: any) => {
      const cached = cache[b.id];
      return {
        ...b,
        applicable_to: b.applicable_to || "All Students",
        class_category: b.class_category || cached?.class_category || null,
        coaching_addon: b.coaching_addon ?? cached?.coaching_addon ?? false,
        items: mapBundleItems(b.bundle_items),
      };
    });
  },
  async getById(id: number) {
    const { data, error } = await supabase
      .from("bundles")
      .select(
        "*, bundle_items(*, inventory(item_id, item_name, selling_price, stock_quantity))",
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    const cached = getBundleCategoryCache()[id];
    return {
      ...data,
      applicable_to: data.applicable_to || "All Students",
      class_category: data.class_category || cached?.class_category || null,
      coaching_addon: data.coaching_addon ?? cached?.coaching_addon ?? false,
      items: mapBundleItems(data.bundle_items),
    };
  },
  async checkSchemaHasCategory(): Promise<boolean> {
    const { error } = await supabase
      .from("bundles")
      .select("class_category")
      .limit(1);
    if (!error) return true;
    return !(
      error.message.toLowerCase().includes("does not exist") ||
      error.message.includes("42703") ||
      error.message.includes("PGRST204")
    );
  },
  async create(data: {
    name: string;
    description?: string;
    basePrice: number;
    bundleType: "acceptance" | "registration" | "custom";
    applicableTo?: string;
    classCategory?: string | null;
    coachingAddon?: boolean;
    items: { itemId: number; quantity: number }[];
  }) {
    const basePayload = {
      name: data.name,
      description: data.description || null,
      base_price: data.basePrice,
      bundle_type: data.bundleType,
      applicable_to: data.applicableTo || "All Students",
    };
    const fullPayload = {
      ...basePayload,
      class_category: data.classCategory || null,
      coaching_addon: data.coachingAddon ?? false,
    };
    let res = await supabase
      .from("bundles")
      .insert(fullPayload)
      .select("id")
      .single();
    if (res.error)
      res = await supabase
        .from("bundles")
        .insert(basePayload)
        .select("id")
        .single();
    if (res.error) return { success: false, error: res.error.message };
    const bundle = res.data as any;
    const itemRows = data.items.map((i) => ({
      bundle_id: bundle.id,
      item_id: i.itemId,
      quantity: i.quantity,
    }));
    const { error: itemError } = await supabase
      .from("bundle_items")
      .insert(itemRows);
    if (itemError) return { success: false, error: itemError.message };
    // Always persist category locally — ensures UI retains selection even if DB columns pending migration
    saveBundleCategoryCache(bundle.id, {
      class_category: data.classCategory || null,
      coaching_addon: data.coachingAddon ?? false,
    });
    return { success: true, id: bundle.id };
  },
  async update(
    id: number,
    data: {
      name: string;
      description?: string;
      basePrice: number;
      bundleType: "acceptance" | "registration" | "custom";
      applicableTo?: string;
      classCategory?: string | null;
      coachingAddon?: boolean;
      isActive?: boolean;
      items: { itemId: number; quantity: number }[];
    },
  ) {
    const basePayload = {
      name: data.name,
      description: data.description || null,
      base_price: data.basePrice,
      bundle_type: data.bundleType,
      is_active: data.isActive ?? true,
      applicable_to: data.applicableTo || "All Students",
    };
    const fullPayload = {
      ...basePayload,
      class_category: data.classCategory || null,
      coaching_addon: data.coachingAddon ?? false,
    };
    let { error } = await supabase
      .from("bundles")
      .update(fullPayload)
      .eq("id", id);
    if (error)
      ({ error } = await supabase
        .from("bundles")
        .update(basePayload)
        .eq("id", id));
    if (error) return { success: false, error: error.message };
    // Persist category locally — retains selection even when DB column missing
    saveBundleCategoryCache(id, {
      class_category: data.classCategory || null,
      coaching_addon: data.coachingAddon ?? false,
    });
    // Delete existing items and re-insert
    await supabase.from("bundle_items").delete().eq("bundle_id", id);
    const itemRows = data.items.map((i) => ({
      bundle_id: id,
      item_id: i.itemId,
      quantity: i.quantity,
    }));
    const { error: itemError } = await supabase
      .from("bundle_items")
      .insert(itemRows);
    if (itemError) return { success: false, error: itemError.message };
    return { success: true };
  },
  async delete(id: number) {
    await supabase.from("bundle_items").delete().eq("bundle_id", id);
    const { error } = await supabase.from("bundles").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    clearBundleCategoryCache(id);
    return { success: true };
  },
};

// ─── APPLICANTS ───────────────────────────────────────────────────────────────
export const applicantAPI = {
  async getAll(filters?: {
    status?: "pending" | "eligible" | "enrolled";
    search?: string;
  }) {
    let query = supabase
      .from("applicants")
      .select("*, students(name, student_class, student_id)")
      .order("created_at", { ascending: false });
    if (filters?.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    let results = (data || []).map((a: any) => ({
      ...a,
      full_name: `${a.first_name} ${a.last_name}`,
      enrolled_student_name: a.students?.name || null,
      enrolled_student_class: a.students?.student_class || null,
    }));
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (a: any) =>
          a.full_name.toLowerCase().includes(q) || a.phone?.includes(q),
      );
    }
    return results;
  },
  async getById(id: number) {
    const { data, error } = await supabase
      .from("applicants")
      .select("*, students(name, student_class, student_id)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      full_name: `${data.first_name} ${data.last_name}`,
      enrolled_student_name: data.students?.name || null,
      enrolled_student_class: data.students?.student_class || null,
    };
  },
  async create(data: {
    firstName: string;
    lastName: string;
    proposedClass?: string;
    phone?: string;
    notes?: string;
    studentStatus?: string;
  }) {
    const base = {
      first_name: data.firstName,
      last_name: data.lastName,
      proposed_class: data.proposedClass || null,
      phone: data.phone || null,
      notes: data.notes || null,
    };
    const withStatus = { ...base, student_status: data.studentStatus || "Day" };
    let res = await supabase
      .from("applicants")
      .insert(withStatus)
      .select("id")
      .single();
    if (res.error)
      res = await supabase
        .from("applicants")
        .insert(base)
        .select("id")
        .single();
    if (res.error) return { success: false, error: res.error.message };
    return { success: true, id: (res.data as any).id };
  },
  async markEligible(id: number) {
    const { error } = await supabase
      .from("applicants")
      .update({
        status: "eligible",
        eligible_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
  async enroll(id: number, studentId: string) {
    const { error } = await supabase
      .from("applicants")
      .update({
        status: "enrolled",
        enrolled_student_id: studentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
  async delete(id: number) {
    const { error } = await supabase.from("applicants").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
  async getPayments(applicantId: number) {
    const { data, error } = await supabase
      .from("applicant_payments")
      .select("*, bundles(name, base_price), fee_types(name)")
      .eq("applicant_id", applicantId);
    if (error) throw error;
    return (data || []).map((p: any) => ({
      ...p,
      bundle_name: p.bundles?.name || null,
      fee_name: p.fee_types?.name || null,
      balance: Number(p.amount_due) - Number(p.amount_paid),
    }));
  },
};

// ─── BUNDLE & APPLICANT PAYMENT TRANSACTIONS ───────────────────────────────────
export const bundlePaymentAPI = {
  // Process a bundle payment (acceptance or registration) for an applicant
  async processBundlePayment(params: {
    applicantId: number;
    bundleId: number;
    shiftId: number;
    amountPaid: number;
    paymentMode: "Cash" | "POS_Transfer";
    minPartialFloor: number;
    customerName?: string;
    targetClass?: string;
  }) {
    const {
      applicantId,
      bundleId,
      shiftId,
      amountPaid,
      paymentMode,
      minPartialFloor,
      customerName,
      targetClass,
    } = params;

    // Get bundle details
    const bundle = await bundleAPI.getById(bundleId);
    if (!bundle) throw new Error("Bundle not found");

    const totalDue = Number(bundle.base_price);

    // Validate partial payment floor
    if (amountPaid < totalDue && amountPaid < minPartialFloor) {
      throw new Error(
        `Partial payment must be at least ₦${minPartialFloor.toLocaleString("en-NG")}`,
      );
    }

    // Check or create applicant_payments record
    let { data: existingPayment } = await supabase
      .from("applicant_payments")
      .select("*")
      .eq("applicant_id", applicantId)
      .eq("bundle_id", bundleId)
      .maybeSingle();

    let amountDue = totalDue;
    let alreadyPaid = 0;
    let paymentRecordId: number;

    if (existingPayment) {
      paymentRecordId = existingPayment.id;
      amountDue = Number(existingPayment.amount_due);
      alreadyPaid = Number(existingPayment.amount_paid);
    } else {
      const { data: newPayment, error: createError } = await supabase
        .from("applicant_payments")
        .insert({
          applicant_id: applicantId,
          bundle_id: bundleId,
          amount_due: totalDue,
          amount_paid: 0,
        })
        .select("id")
        .single();
      if (createError) throw createError;
      paymentRecordId = newPayment.id;
    }

    const newTotalPaid = alreadyPaid + amountPaid;
    if (newTotalPaid > amountDue + 0.01) {
      throw new Error(
        `Payment of ₦${amountPaid.toLocaleString("en-NG")} exceeds balance of ₦${(amountDue - alreadyPaid).toLocaleString("en-NG")}`,
      );
    }

    // Create transaction
    const txnType =
      bundle.bundle_type === "acceptance"
        ? "ACCEPTANCE_FEE"
        : "BUNDLE_PURCHASE";
    const txn = await tryInsertTxn({
      applicant_id: applicantId,
      shift_id: shiftId,
      type: txnType,
      amount_paid: amountPaid,
      payment_mode: paymentMode,
      bundle_id: bundleId,
      notes: `${bundle.name} - ${newTotalPaid >= amountDue ? "Full" : "Partial"} Payment`,
      customer_name: customerName,
      target_class: targetClass,
    });

    // Decrement bundle items from inventory
    for (const item of bundle.items) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("stock_quantity")
        .eq("item_id", item.item_id)
        .single();
      if (inv) {
        const newStock = Math.max(0, inv.stock_quantity - item.quantity);
        await supabase
          .from("inventory")
          .update({ stock_quantity: newStock })
          .eq("item_id", item.item_id);
      }
    }

    // Create transaction_items for the bundle items (for receipt printing)
    const itemRows = bundle.items.map((item: any) => ({
      transaction_id: txn.transaction_id,
      item_id: item.item_id,
      quantity: item.quantity,
      unit_price: item.selling_price,
      total_price: item.selling_price * item.quantity,
    }));
    await supabase.from("transaction_items").insert(itemRows);

    // Update applicant_payments
    await supabase
      .from("applicant_payments")
      .update({
        amount_paid: newTotalPaid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRecordId);

    // If payment meets threshold, mark applicant as eligible
    if (newTotalPaid >= minPartialFloor) {
      await applicantAPI.markEligible(applicantId);
    }

    const details = await transactionAPI.getDetails(txn.transaction_id);
    return {
      success: true,
      transactionId: txn.transaction_id,
      ...details,
      total: amountPaid,
      balance: amountDue - newTotalPaid,
      isFullPayment: newTotalPaid >= amountDue,
    };
  },

  // Process a flat ₦3,000 admission form payment for an applicant (decrements "Admission Form" inventory)
  async processFormPayment(params: {
    applicantId: number;
    shiftId: number;
    paymentMode: "Cash" | "POS_Transfer";
  }) {
    const { applicantId, shiftId, paymentMode } = params;
    const FORM_PRICE = 3000;

    // Auto-fetch applicant to stamp name/class snapshot
    const { data: applicantRow } = await supabase
      .from("applicants")
      .select("first_name, last_name, proposed_class")
      .eq("id", applicantId)
      .single();
    const customerName = applicantRow
      ? `${applicantRow.first_name} ${applicantRow.last_name}`
      : null;
    const targetClass = applicantRow?.proposed_class || null;

    const txn = await tryInsertTxn({
      applicant_id: applicantId,
      shift_id: shiftId,
      type: "BUNDLE_PURCHASE",
      amount_paid: FORM_PRICE,
      payment_mode: paymentMode,
      notes: "Admission Form Purchase",
      customer_name: customerName,
      target_class: targetClass,
    });

    // Find an "Admission Form" inventory item and decrement by 1
    const { data: formItems } = await supabase
      .from("inventory")
      .select("item_id, stock_quantity, item_name")
      .ilike("item_name", "%admission form%")
      .limit(1);
    const formItem = formItems?.[0] as any;
    const items: any[] = [];
    if (formItem) {
      await supabase
        .from("inventory")
        .update({ stock_quantity: Math.max(0, formItem.stock_quantity - 1) })
        .eq("item_id", formItem.item_id);
      await supabase.from("transaction_items").insert({
        transaction_id: txn.transaction_id,
        item_id: formItem.item_id,
        quantity: 1,
        unit_price: FORM_PRICE,
        total_price: FORM_PRICE,
      });
      items.push({
        item_name: formItem.item_name,
        quantity: 1,
        total_price: FORM_PRICE,
      });
    } else {
      items.push({
        item_name: "Admission Application Form",
        quantity: 1,
        total_price: FORM_PRICE,
      });
    }

    await applicantAPI.markEligible(applicantId);
    return {
      success: true,
      transactionId: txn.transaction_id,
      total: FORM_PRICE,
      items,
    };
  },

  // Process a registration fee directly from the fee engine (no bundle record needed).
  // Amount + line-items are determined by the category_group fee engine at the UI layer.
  async processDirectRegistrationPayment(params: {
    applicantId: number;
    shiftId: number;
    paymentMode: "Cash" | "POS_Transfer";
    amount: number;
    categoryGroup: string;
    studentStatus: string;
    coachingIncluded: boolean;
    customerName?: string;
    targetClass?: string;
  }) {
    const {
      applicantId,
      shiftId,
      paymentMode,
      amount,
      categoryGroup,
      studentStatus,
      coachingIncluded,
      customerName,
      targetClass,
    } = params;

    const baseAmount = coachingIncluded ? amount - 10_000 : amount;
    const notes = `Registration Fee — ${categoryGroup} (${studentStatus})${coachingIncluded ? " + Coaching Add-on" : ""}`;

    const txn = await tryInsertTxn({
      applicant_id: applicantId,
      shift_id: shiftId,
      type: "BUNDLE_PURCHASE",
      amount_paid: amount,
      payment_mode: paymentMode,
      notes,
      customer_name: customerName ?? null,
      target_class: targetClass ?? null,
    });

    const lineItems: {
      item_name: string;
      quantity: number;
      total_price: number;
    }[] = [
      {
        item_name: `Registration Package — ${categoryGroup} ${studentStatus}`,
        quantity: 1,
        total_price: baseAmount,
      },
    ];
    if (coachingIncluded) {
      lineItems.push({
        item_name: "Coaching Add-on",
        quantity: 1,
        total_price: 10_000,
      });
    }

    await applicantAPI.markEligible(applicantId);
    return {
      success: true,
      transactionId: txn.transaction_id,
      total: amount,
      items: lineItems,
    };
  },

  // Process school fees payment for a student with partial payment floor
  async processFeesPaymentWithFloor(params: {
    studentFeeId: number;
    amount: number;
    studentId: string;
    shiftId: number;
    paymentMode: "Cash" | "POS_Transfer";
    minPartialFloor: number;
    customerName?: string;
    targetClass?: string;
  }) {
    const {
      studentFeeId,
      amount,
      studentId,
      shiftId,
      paymentMode,
      minPartialFloor,
      customerName,
      targetClass,
    } = params;

    const { data: sf } = await supabase
      .from("student_fees")
      .select("amount_due, amount_paid, fee_type_id")
      .eq("id", studentFeeId)
      .single();
    if (!sf) throw new Error("Fee record not found");
    const balance = Number(sf.amount_due) - Number(sf.amount_paid);

    // Validate floor for partial payments
    if (amount < balance && amount < minPartialFloor) {
      throw new Error(
        `Partial payment must be at least ₦${minPartialFloor.toLocaleString("en-NG")}`,
      );
    }

    if (amount > balance + 0.01) {
      throw new Error(
        `Cannot pay ₦${amount.toLocaleString("en-NG")} — balance is only ₦${balance.toLocaleString("en-NG")}`,
      );
    }

    await tryInsertTxn({
      student_id: studentId,
      shift_id: shiftId,
      type: "FEES_CASH_COLLECTION",
      amount_paid: amount,
      payment_mode: paymentMode,
      fee_type_id: sf.fee_type_id,
      customer_name: customerName,
      target_class: targetClass,
    });
    await supabase
      .from("student_fees")
      .update({ amount_paid: Number(sf.amount_paid) + amount })
      .eq("id", studentFeeId);

    const { data: student } = await supabase
      .from("students")
      .select("current_fees_owed")
      .eq("student_id", studentId)
      .single();
    if (student)
      await supabase
        .from("students")
        .update({
          current_fees_owed: Math.max(
            0,
            Number(student.current_fees_owed) - amount,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", studentId);

    return { success: true, newBalance: balance - amount };
  },
};

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
export const expenseAPI = {
  // Add a new expense record
  async addExpense(params: {
    shiftId?: number;
    category: string;
    amount: number;
    paymentMode: "Cash Drawer" | "Bank Transfer";
    description?: string;
    createdBy?: number;
  }) {
    const { shiftId, category, amount, paymentMode, description, createdBy } = params;
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        shift_id: shiftId || null,
        category,
        amount,
        payment_mode: paymentMode,
        description: description || null,
        created_by: createdBy || null,
      })
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: (data as any).id };
  },

  // Get all expenses for a specific shift
  async getExpensesByShift(shiftId: number) {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("shift_id", shiftId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((e: any) => ({
      ...e,
      payment_mode: e.payment_mode,
    }));
  },

  // Get total cash expenses for a shift (for expected cash calculation)
  async getCashExpensesByShift(shiftId: number) {
    const { data, error } = await supabase
      .from("expenses")
      .select("amount")
      .eq("shift_id", shiftId)
      .eq("payment_mode", "Cash Drawer");
    if (error) throw error;
    return (data || []).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
  },

  // Get expense summary grouped by category for a date range
  async getExpensesSummary(startDate?: string, endDate?: string) {
    let query = supabase
      .from("expenses")
      .select("category, amount, payment_mode, created_at");
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);
    const { data, error } = await query;
    if (error) throw error;

    const grouped: Record<string, { total: number; count: number; cashTotal: number; bankTotal: number }> = {};
    for (const e of data || []) {
      const cat = e.category;
      if (!grouped[cat]) {
        grouped[cat] = { total: 0, count: 0, cashTotal: 0, bankTotal: 0 };
      }
      grouped[cat].total += Number(e.amount);
      grouped[cat].count += 1;
      if (e.payment_mode === "Cash Drawer") {
        grouped[cat].cashTotal += Number(e.amount);
      } else {
        grouped[cat].bankTotal += Number(e.amount);
      }
    }
    return Object.entries(grouped).map(([category, vals]) => ({
      category,
      ...vals,
    }));
  },

  // Get term expenses summary for dashboard analytics
  async getTermExpensesSummary() {
    // Get expenses for the current academic term (last 3 months typically)
    const { data, error } = await supabase
      .from("expenses")
      .select("category, amount, payment_mode, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const byCategory: Record<string, number> = {};
    let totalCash = 0;
    let totalBank = 0;
    let grandTotal = 0;

    for (const e of data || []) {
      const cat = e.category;
      const amt = Number(e.amount);
      byCategory[cat] = (byCategory[cat] || 0) + amt;
      grandTotal += amt;
      if (e.payment_mode === "Cash Drawer") {
        totalCash += amt;
      } else {
        totalBank += amt;
      }
    }

    return {
      byCategory: Object.entries(byCategory).map(([category, total]) => ({ category, total })),
      totalCash,
      totalBank,
      grandTotal,
      count: (data || []).length,
    };
  },

  // Delete an expense record
  async deleteExpense(id: number) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Get all expenses for transaction history (with filters)
  async getExpensesForHistory(params: {
    startDate?: string;
    endDate?: string;
    category?: string;
    paymentMode?: string;
  }) {
    let query = supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });

    if (params.startDate) query = query.gte("created_at", params.startDate);
    if (params.endDate) query = query.lte("created_at", params.endDate);
    if (params.category) query = query.eq("category", params.category);
    if (params.paymentMode) query = query.eq("payment_mode", params.paymentMode);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((e: any) => ({
      expense_id: e.id,
      transaction_id: `EXP-${e.id}`,
      type: "EXPENSE",
      category: e.category,
      amount_paid: Number(e.amount),
      payment_mode: e.payment_mode,
      timestamp: e.created_at,
      description: e.description,
      shift_id: e.shift_id,
    }));
  },
};
