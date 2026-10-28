import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Pencil,
  X,
  UserPlus,
  AlertCircle,
  ExternalLink,
  CheckCircle,
  Download,
  FileText,
  Plus,
  Printer,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  studentAPI,
  feeTypeAPI,
  settingsAPI,
  studentFeeAPI,
  ledgerAPI,
  bundleAPI,
  bundlePaymentAPI,
  seniorClassKey,
} from "../../lib/api";
import PendingItems from "../shared/PendingItems";

const fmt = (n: number) =>
  `₦${(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Student {
  student_id: string;
  name: string;
  student_class: string;
  department_stream?: string | null;
  current_fees_owed: number;
  discount_amount: number;
  admission_type?: "Returning" | "New";
  student_status?: "Day" | "Boarding";
}
type FeeHeadFilter = "all" | "tuition" | "hostel" | "registration";
interface FeeBreakdownItem {
  name: string;
  balance: number;
}
interface FeeType {
  id: number;
  name: string;
  amount: number;
  fee_category: string;
  class_filter: string | null;
  academic_session: string;
}
interface DebtorReportRow {
  studentId: string;
  fullName: string;
  studentClass: string;
  studentType: "Day" | "Boarding";
  feeName: string;
  outstandingAmount: number;
}

const DEFAULT_CLASSES = [
  "JSS1A",
  "JSS1B",
  "JSS2A",
  "JSS2B",
  "JSS3A",
  "JSS3B",
  "SS1A",
  "SS1B",
  "SS2A",
  "SS2B",
  "SS3A",
  "SS3B",
];
const inputCls =
  "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400";

const StudentManagement: React.FC<{
  onNavigate?: (view: string, studentId?: string) => void;
}> = ({ onNavigate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Day" | "Boarding">(
    "all",
  );
  const [feeHeadFilter, setFeeHeadFilter] = useState<FeeHeadFilter>("all");
  const [expandedFeeStudent, setExpandedFeeStudent] = useState<string | null>(
    null,
  );
  const [feeBreakdowns, setFeeBreakdowns] = useState<
    Record<string, FeeBreakdownItem[]>
  >({});
  const [loadingFeeBreakdown, setLoadingFeeBreakdown] = useState<string | null>(
    null,
  );
  const [feeBreakdownError, setFeeBreakdownError] = useState("");

  const [classes, setClasses] = useState<string[]>(DEFAULT_CLASSES);
  const [streams, setStreams] = useState<string[]>([]);
  const [streamRequiredClasses, setStreamRequiredClasses] = useState<string[]>([
    "SS1",
    "SS2",
    "SS3",
  ]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [showDebtorExport, setShowDebtorExport] = useState(false);
  const [exportClass, setExportClass] = useState("all");
  const [exportFeeHead, setExportFeeHead] = useState("all");
  const [debtorReportRows, setDebtorReportRows] = useState<DebtorReportRow[]>(
    [],
  );
  const [debtorReportLoading, setDebtorReportLoading] = useState(false);
  const [debtorReportError, setDebtorReportError] = useState("");
  const [debtorReportReady, setDebtorReportReady] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [formData, setFormData] = useState({
    studentId: "",
    firstName: "",
    lastName: "",
    studentClass: "",
    departmentStream: "",
    selectedFeeIds: [] as number[],
    admissionType: "Returning" as "Returning" | "New",
    studentStatus: "Day" as "Day" | "Boarding",
  });
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const [editData, setEditData] = useState({
    name: "",
    studentClass: "",
    departmentStream: "",
    studentStatus: "Day" as "Day" | "Boarding",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSyncResult, setEditSyncResult] = useState<{
    removed: number;
    added: number;
  } | null>(null);
  const [totalOutstanding, setTotalOutstanding] = useState(0);

  const load = () => {
    setLoading(true);
    studentAPI
      .getAll({
        search,
        class: selectedClass,
        studentStatus: statusFilter !== "all" ? statusFilter : undefined,
        feeHead: feeHeadFilter === "all" ? undefined : feeHeadFilter,
        page,
        pageSize,
      })
      .then((d) => {
        setStudents(d.students);
        setTotal(d.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const [showLedger, setShowLedger] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [registrationBundles, setRegistrationBundles] = useState<any[]>([]);
  const [selectedRegistrationBundle, setSelectedRegistrationBundle] =
    useState("");
  const [selectedBundleItemIds, setSelectedBundleItemIds] = useState<number[]>(
    [],
  );
  const [bundleChargeSaving, setBundleChargeSaving] = useState(false);
  const [bundleChargeError, setBundleChargeError] = useState("");

  const viewLedger = async (s: Student) => {
    setSelectedStudent(s);
    setShowLedger(true);
    setLedgerLoading(true);
    try {
      const [entries, h, bundles] = await Promise.all([
        ledgerAPI.getStatement(s.student_id),
        studentAPI.getHistory(s.student_id),
        bundleAPI.getAll(),
      ]);
      setLedgerEntries(entries);
      setHistory(h);
      setRegistrationBundles(
        bundles.filter((bundle: any) => {
          if (
            !bundle.is_active ||
            !["registration", "returning_registration"].includes(
              bundle.bundle_type,
            ) ||
            (bundle.applicable_student_status !== "Returning Students Only" &&
              bundle.applicable_student_status !== "All Students")
          )
            return false;
          const categoryMap = settingsAPI.getClassCategoryMap();
          const normalize = (value?: string | null) =>
            String(value || "")
              .replace(/[\s._-]+/g, "")
              .toUpperCase();
          const className = normalize(s.student_class);
          const category = normalize(
            categoryMap[s.student_class] ||
              (/^(JSS|JHS)/i.test(s.student_class)
                ? "JUNIOR"
                : /^SS/i.test(s.student_class)
                  ? "SENIOR"
                  : ""),
          );
          const bundleCategory = normalize(bundle.class_category);
          if (
            bundleCategory &&
            bundleCategory !== className &&
            !className.startsWith(bundleCategory) &&
            bundleCategory !== category
          )
            return false;
          const targetClass = normalize(bundle.target_class);
          if (targetClass && !className.startsWith(targetClass)) return false;
          if (
            bundle.department_stream &&
            bundle.department_stream !== s.department_stream
          )
            return false;
          const residency = s.student_status || "Day";
          if (
            bundle.applicable_to === "Day Only" &&
            (s.student_status || "Day") !== "Day"
          )
            return false;
          if (
            bundle.applicable_to === "Boarding Only" &&
            s.student_status !== "Boarding"
          )
            return false;
          return true;
        }),
      );
      setSelectedRegistrationBundle("");
      setSelectedBundleItemIds([]);
      setBundleChargeError("");
    } catch (err) {
      console.error("Failed to load ledger:", err);
    }
    setLedgerLoading(false);
  };

  const attachRegistrationBundle = async () => {
    if (!selectedStudent || !selectedRegistrationBundle) return;
    setBundleChargeSaving(true);
    setBundleChargeError("");
    try {
      await bundlePaymentAPI.attachRegistrationBundleToStudent({
        studentId: selectedStudent.student_id,
        bundleId: Number(selectedRegistrationBundle),
        includedItemIds: selectedBundleItemIds,
        amount: registrationChargeAmount,
      });
      setLedgerEntries(
        await ledgerAPI.getStatement(selectedStudent.student_id),
      );
      setSelectedRegistrationBundle("");
    } catch (error) {
      setBundleChargeError((error as Error).message);
    }
    setBundleChargeSaving(false);
  };

  const selectedBundle = registrationBundles.find(
    (bundle: any) => bundle.id === Number(selectedRegistrationBundle),
  );
  const excludedBundleValue = selectedBundle
    ? selectedBundle.items
        .filter((item: any) => !selectedBundleItemIds.includes(item.item_id))
        .reduce(
          (sum: number, item: any) =>
            sum + Number(item.selling_price) * Number(item.quantity),
          0,
        )
    : 0;
  const registrationChargeAmount = selectedBundle
    ? Math.max(0, Number(selectedBundle.base_price) - excludedBundleValue)
    : 0;

  const loadTotalOutstanding = () => {
    (studentFeeAPI as any)
      .getTotalOutstanding()
      .then((v: number) => setTotalOutstanding(v))
      .catch(console.error);
  };

  useEffect(() => {
    load();
  }, [search, selectedClass, statusFilter, feeHeadFilter, page]);

  useEffect(() => {
    const refreshBalances = () => {
      load();
      loadTotalOutstanding();
    };
    window.addEventListener("pos:transaction-updated", refreshBalances);
    window.addEventListener("pos:transaction-voided", refreshBalances);
    return () => {
      window.removeEventListener("pos:transaction-updated", refreshBalances);
      window.removeEventListener("pos:transaction-voided", refreshBalances);
    };
  }, [search, selectedClass, statusFilter, feeHeadFilter, page]);

  // Reload the global outstanding total on mount and whenever a student is created/deleted
  useEffect(() => {
    loadTotalOutstanding();
  }, []);

  useEffect(() => {
    settingsAPI
      .get()
      .then((s) => {
        if (s?.class_list) {
          try {
            const parsed = JSON.parse(s.class_list);
            if (Array.isArray(parsed) && parsed.length > 0)
              setClasses(parsed.sort());
          } catch {
            /* use default */
          }
        }
        setStreams(Array.isArray(s.streams) ? s.streams : []);
        setStreamRequiredClasses(
          Array.isArray(s.stream_required_classes)
            ? s.stream_required_classes
            : ["SS1", "SS2", "SS3"],
        );
      })
      .catch(console.error);
    feeTypeAPI
      .getAll()
      .then((ft) => setFeeTypes(ft as FeeType[]))
      .catch(console.error);
  }, []);

  const requiresDepartmentStream = (className: string) => {
    const key = seniorClassKey(className);
    return !!key && streamRequiredClasses.includes(key);
  };

  useEffect(() => {
    if (showModal) {
      feeTypeAPI
        .getAll()
        .then((ft) => setFeeTypes(ft as FeeType[]))
        .catch(console.error);
    }
  }, [showModal]);

  // Auto-select all applicable fees whenever class or status changes while the modal is open
  useEffect(() => {
    if (!showModal) return;
    if (!formData.studentClass) {
      setFormData((prev) => ({ ...prev, selectedFeeIds: [] }));
      return;
    }
    const matching = feeTypes.filter((ft) => {
      const applicable = (ft as any).applicable_to || "All Students";
      if (applicable === "Day" && formData.studentStatus !== "Day")
        return false;
      if (applicable === "Boarding" && formData.studentStatus !== "Boarding")
        return false;
      if (!ft.class_filter) return true;
      const classList = ft.class_filter.split(",").map((c) => c.trim());
      return classList.includes(formData.studentClass);
    });
    setFormData((prev) => ({
      ...prev,
      selectedFeeIds: matching.map((ft) => ft.id),
    }));
  }, [formData.studentClass, formData.studentStatus, showModal, feeTypes]);

  const totalPages = Math.ceil(total / pageSize);

  const computeFeesOwed = () =>
    formData.selectedFeeIds.reduce((sum, id) => {
      const ft = feeTypes.find((f) => f.id === id);
      return sum + (ft ? Number(ft.amount) : 0);
    }, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    if (!firstName || !lastName || !formData.studentClass) {
      setFormError("First name, last name, and class are required.");
      return;
    }
    if (
      requiresDepartmentStream(formData.studentClass) &&
      !formData.departmentStream
    ) {
      setFormError("Choose a department stream for this senior class.");
      return;
    }
    setFormSaving(true);
    setFormError("");
    const result = await studentAPI.create({
      studentId: formData.studentId.trim() || undefined,
      name: `${firstName} ${lastName}`,
      studentClass: formData.studentClass,
      departmentStream: formData.departmentStream || null,
      admissionType: formData.admissionType,
      studentStatus: formData.studentStatus,
    });
    if (result.success) {
      setShowModal(false);
      setFormData({
        studentId: "",
        firstName: "",
        lastName: "",
        studentClass: "",
        departmentStream: "",
        selectedFeeIds: [],
        admissionType: "Returning",
        studentStatus: "Day",
      });
      load();
      loadTotalOutstanding();
    } else setFormError(result.error || "Failed to create student");
    setFormSaving(false);
  };

  const openDeleteConfirm = (s: Student) => {
    setSelectedStudent(s);
    setShowDeleteConfirm(true);
  };
  const handleDelete = async () => {
    if (!selectedStudent) return;
    await studentAPI.delete(selectedStudent.student_id);
    setShowDeleteConfirm(false);
    setSelectedStudent(null);
    load();
    loadTotalOutstanding();
  };

  const openEditStudent = (s: Student) => {
    setSelectedStudent(s);
    setEditData({
      name: s.name,
      studentClass: s.student_class,
      departmentStream: s.department_stream || "",
      studentStatus: (s.student_status as "Day" | "Boarding") || "Day",
    });
    setEditError("");
    setEditSyncResult(null);
    setShowEditStudent(true);
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!editData.name.trim() || !editData.studentClass) {
      setEditError("Name and class are required.");
      return;
    }
    if (
      requiresDepartmentStream(editData.studentClass) &&
      !editData.departmentStream
    ) {
      setEditError("Choose a department stream for this senior class.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    setEditSyncResult(null);
    try {
      const prevClass = selectedStudent.student_class;
      const prevStatus = selectedStudent.student_status;
      const isClassChanged = prevClass !== editData.studentClass;
      const isStatusChanged = prevStatus !== editData.studentStatus;

      await studentAPI.update(selectedStudent.student_id, {
        name: editData.name.trim(),
        studentClass: editData.studentClass,
        departmentStream: editData.departmentStream || null,
        studentStatus: editData.studentStatus,
      });

      // If class or housing status changed, execute and display mid-term swap result
      if (isClassChanged || isStatusChanged) {
        try {
          const swapResult = await studentFeeAPI.handleMidTermSwap({
            studentId: selectedStudent.student_id,
            prevClass,
            newClass: editData.studentClass,
            prevStatus,
            newStatus: editData.studentStatus,
          });
          setEditSyncResult(swapResult);
          setTimeout(() => {
            setShowEditStudent(false);
            setSelectedStudent(null);
            setEditSyncResult(null);
            load();
            loadTotalOutstanding();
          }, 2500);
        } catch (syncErr) {
          console.warn("Mid-term swap non-fatal error:", syncErr);
          setShowEditStudent(false);
          setSelectedStudent(null);
          load();
          loadTotalOutstanding();
        }
      } else {
        setShowEditStudent(false);
        setSelectedStudent(null);
        load();
      }
    } catch (e) {
      setEditError((e as Error).message);
    }
    setEditSaving(false);
  };

  const toggleFeeSelection = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      selectedFeeIds: prev.selectedFeeIds.includes(id)
        ? prev.selectedFeeIds.filter((x) => x !== id)
        : [...prev.selectedFeeIds, id],
    }));
  };

  const filteredFeeTypes = feeTypes.filter((ft) => {
    // Housing tier: only show fees that match this student's Day/Boarding status
    const applicable = (ft as any).applicable_to || "All Students";
    if (applicable === "Day" && formData.studentStatus !== "Day") return false;
    if (applicable === "Boarding" && formData.studentStatus !== "Boarding")
      return false;
    // Class match: class_filter is a comma-separated list; null means all classes
    if (!formData.studentClass || !ft.class_filter) return true;
    const classList = ft.class_filter.split(",").map((c) => c.trim());
    return classList.includes(formData.studentClass);
  });

  const filteredStudents = students;

  const toggleFeeBreakdown = async (student: Student) => {
    if (expandedFeeStudent === student.student_id) {
      setExpandedFeeStudent(null);
      setFeeBreakdownError("");
      return;
    }

    setExpandedFeeStudent(student.student_id);
    setFeeBreakdownError("");
    if (feeBreakdowns[student.student_id]) return;

    setLoadingFeeBreakdown(student.student_id);
    try {
      const [fees, entries] = await Promise.all([
        studentFeeAPI.getForStudent(student.student_id),
        ledgerAPI.getStatement(student.student_id),
      ]);
      const itemized = new Map<string, FeeBreakdownItem>();
      for (const fee of fees) {
        const balance = Math.max(
          0,
          Number(fee.amount_due || 0) - Number(fee.amount_paid || 0),
        );
        if (balance <= 0) continue;
        const name = String(fee.fee_name || "Fee");
        const key = name.trim().toLowerCase();
        const existing = itemized.get(key);
        itemized.set(key, {
          name,
          balance: balance + (existing?.balance || 0),
        });
      }

      const feeNames = new Set(itemized.keys());
      const ledgerBalances = new Map<
        string,
        { name: string; balance: number }
      >();
      for (const entry of entries) {
        const entryName = String(entry.fee_type_name || "").trim();
        if (!entryName || entryName.startsWith("Class Fee — ")) continue;
        const name = entryName.replace(
          /\s+(Remaining Balance|Outstanding Balance Forward)$/i,
          "",
        );
        const key = name.toLowerCase();
        if (feeNames.has(key)) continue;
        const existing = ledgerBalances.get(key) || { name, balance: 0 };
        existing.balance +=
          (entry.entry_type === "debit" ? 1 : -1) *
          Number(entry.amount || 0);
        ledgerBalances.set(key, existing);
      }
      for (const [key, ledgerFee] of ledgerBalances) {
        if (ledgerFee.balance > 0) {
          itemized.set(key, {
            name: ledgerFee.name,
            balance: ledgerFee.balance,
          });
        }
      }
      setFeeBreakdowns((previous) => ({
        ...previous,
        [student.student_id]: Array.from(itemized.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }));
    } catch (error) {
      setFeeBreakdownError(
        error instanceof Error ? error.message : "Could not load fee breakdown",
      );
    } finally {
      setLoadingFeeBreakdown(null);
    }
  };

  const loadDebtorReport = async (): Promise<DebtorReportRow[] | null> => {
    setDebtorReportLoading(true);
    setDebtorReportError("");
    try {
      const reportStudents = await studentAPI.getAllUnpaginated({
        class: exportClass,
      });
      const breakdowns = await studentFeeAPI.getOutstandingBreakdown(
        reportStudents.map((student: Student) => student.student_id),
      );
      const selectedFeeHead =
        exportFeeHead === "all"
          ? null
          : feeTypes.find((fee) => fee.name.trim() === exportFeeHead);
      if (exportFeeHead !== "all" && !selectedFeeHead)
        throw new Error("The selected fee head is no longer available.");
      const feeHeadName = selectedFeeHead?.name.trim() || null;
      const rows = reportStudents.flatMap((student: Student) =>
        (breakdowns[student.student_id] || [])
          .filter((fee: FeeBreakdownItem) => {
            const normalizedName = fee.name
              .replace(/^Arrears B\/F — /i, "")
              .toLowerCase();
            const normalizedHead = feeHeadName?.toLowerCase();
            return (
              fee.balance > 0 &&
              (!normalizedHead ||
                normalizedName === normalizedHead ||
                normalizedName.startsWith(`${normalizedHead} (`))
            );
          })
          .map((fee: FeeBreakdownItem) => ({
            studentId: student.student_id,
            fullName: student.name,
            studentClass: student.student_class,
            studentType: student.student_status || "Day",
            feeName: fee.name,
            outstandingAmount: fee.balance,
          })),
      );
      setDebtorReportRows(rows);
      setDebtorReportReady(true);
      return rows;
    } catch (error) {
      console.error("Failed to load debtors list:", error);
      setDebtorReportError(
        error instanceof Error ? error.message : "Could not load debtors list",
      );
      setDebtorReportRows([]);
      setDebtorReportReady(false);
      return null;
    } finally {
      setDebtorReportLoading(false);
    }
  };

  const exportDebtors = async (format: "xlsx" | "csv") => {
    const rows = await loadDebtorReport();
    if (!rows?.length) return;
    const headers = [
      "Student ID",
      "Full Name",
      "Class",
      "Type",
      "Specific Fee Owed",
      "Outstanding Amount",
    ];
    const csvSafe = (value: string) =>
      /^[\t\r\n=+\-@]/.test(value) ? `'${value}` : value;
    const worksheet =
      format === "csv"
        ? XLSX.utils.aoa_to_sheet([
            headers,
            ...rows.map((row) => [
              csvSafe(row.studentId),
              csvSafe(row.fullName),
              csvSafe(row.studentClass),
              row.studentType,
              csvSafe(row.feeName),
              row.outstandingAmount,
            ]),
          ])
        : XLSX.utils.json_to_sheet(
            rows.map((row) => ({
              "Student ID": row.studentId,
              "Full Name": row.fullName,
              Class: row.studentClass,
              Type: row.studentType,
              "Specific Fee Owed": row.feeName,
              "Outstanding Amount": row.outstandingAmount,
            })),
          );
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 14 },
      { wch: 12 },
      { wch: 28 },
      { wch: 20 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Debtors");
    const date = new Date().toISOString().slice(0, 10);
    try {
      XLSX.writeFile(
        workbook,
        `debtors-list-${date}.${format}`,
        format === "csv" ? { bookType: "csv" } : undefined,
      );
    } catch (error) {
      console.error("Failed to export debtors list:", error);
      setDebtorReportError(
        error instanceof Error
          ? error.message
          : "Could not export debtors list",
      );
    }
  };

  const printDebtorChecklist = async () => {
    const rows = await loadDebtorReport();
    if (!rows?.length) return;
    window.setTimeout(() => window.print(), 100);
  };

  const exportFeeHeadNames = Array.from(
    new Set(
      feeTypes
        .filter((fee) => fee.fee_category !== "archived")
        .map((fee) => fee.name.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Student Management</h1>
          <p className="text-gray-500">
            {total} students · {fmt(totalOutstanding)} outstanding
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setExportClass(selectedClass);
              setExportFeeHead("all");
              setDebtorReportRows([]);
              setDebtorReportError("");
              setDebtorReportReady(false);
              setShowDebtorExport(true);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
          >
            <FileText className="w-4 h-4" /> Export / Print Debtors List
          </button>
          <button
            onClick={() => {
              setFormData({
                studentId: "",
                firstName: "",
                lastName: "",
                studentClass: "",
                departmentStream: "",
                selectedFeeIds: [],
                admissionType: "Returning",
                studentStatus: "Day",
              });
              setFormError("");
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
          >
            <UserPlus className="w-4 h-4" /> Add Student
          </button>
        </div>
      </div>

      {
        <>
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex gap-4 flex-wrap">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="flex-1 min-w-40 px-3 py-2 border rounded-md text-sm"
                placeholder="Search by name or ID..."
              />
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Classes</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span>Filter by Fee Head</span>
                <select
                  aria-label="Filter by Fee Head"
                  value={feeHeadFilter}
                  onChange={(e) => {
                    setFeeHeadFilter(e.target.value as FeeHeadFilter);
                    setPage(1);
                    setExpandedFeeStudent(null);
                  }}
                  className="px-3 py-2 border rounded-md text-sm bg-white"
                >
                  <option value="all">All Fees</option>
                  <option value="tuition">Tuition Only</option>
                  <option value="hostel">Hostel Only</option>
                  <option value="registration">Registration / Levy</option>
                </select>
              </label>
              <div className="flex gap-1">
                {(["all", "Day", "Boarding"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setStatusFilter(s);
                      setPage(1);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === s ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {s === "all" ? "All" : s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Student ID
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Class
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Type / Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Fees Owed
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-12 text-gray-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-12 text-gray-400"
                      >
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <React.Fragment key={s.student_id}>
                        <tr className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">
                            {s.student_id}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{s.name}</span>
                              {s.discount_amount > 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                  Concession / Discount Applied
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-primary-100 text-primary-800 rounded text-xs">
                              {s.student_class}
                            </span>
                            {s.department_stream && (
                              <span className="text-xs text-gray-500">
                                · {s.department_stream}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${(s.admission_type || "Returning") === "Returning" ? "bg-gray-100 text-gray-700" : "bg-warning-100 text-warning-700"}`}
                              >
                                {s.admission_type || "Returning"}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${(s.student_status || "Day") === "Boarding" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}
                              >
                                {s.student_status || "Day"}
                              </span>
                              <PendingItems
                                studentId={s.student_id}
                                variant="badge"
                              />
                            </div>
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${s.current_fees_owed > 0 ? "text-danger-600" : "text-success-600"}`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleFeeBreakdown(s)}
                              aria-expanded={expandedFeeStudent === s.student_id}
                              aria-label={`Show itemized fees for ${s.name}`}
                              className="inline-flex items-center gap-1 rounded px-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
                            >
                              {fmt(s.current_fees_owed)}
                              {expandedFeeStudent === s.student_id ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => viewLedger(s)}
                              className="px-3 py-1.5 text-sm bg-primary-100 text-primary-700 rounded hover:bg-primary-200 inline-flex items-center gap-1 font-medium"
                            >
                              <FileText className="w-3.5 h-3.5" /> Ledger
                            </button>
                            <button
                              onClick={() => openEditStudent(s)}
                              className="px-2 py-1 text-sm bg-gray-100 rounded mx-1 hover:bg-gray-200 inline-flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => openDeleteConfirm(s)}
                              className="px-2 py-1 text-sm bg-danger-100 text-danger-700 rounded hover:bg-danger-200"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                        {expandedFeeStudent === s.student_id && (
                          <tr className="bg-gray-50 border-t">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="max-w-3xl ml-auto">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                  Outstanding fee breakdown
                                </h3>
                                {loadingFeeBreakdown === s.student_id ? (
                                  <p className="text-sm text-gray-500">
                                    Loading fee items...
                                  </p>
                                ) : feeBreakdownError ? (
                                  <p className="text-sm text-danger-600">
                                    {feeBreakdownError}
                                  </p>
                                ) : feeBreakdowns[s.student_id]?.length ? (
                                  <div className="rounded-lg border bg-white divide-y">
                                    {feeBreakdowns[s.student_id].map((fee) => (
                                      <div
                                        key={fee.name}
                                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                                      >
                                        <span className="text-gray-700">
                                          {fee.name}
                                        </span>
                                        <span className="font-semibold text-danger-600">
                                          {fmt(fee.balance)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">
                                    No active unpaid fee items found.
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-500 font-medium">
                Page {page} of {totalPages} ({total} students)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      }

      {showDebtorExport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="debtors-export-title"
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-auto"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 id="debtors-export-title" className="text-xl font-bold">
                  Export / Print Debtors List
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Only unpaid fee balances are included. Print opens your
                  browser&apos;s print dialog, where you can save as PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDebtorExport(false)}
                aria-label="Close debtors list"
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <label className="block text-sm font-medium text-gray-700">
                Class
                <select
                  value={exportClass}
                  onChange={(event) => {
                    setExportClass(event.target.value);
                    setDebtorReportRows([]);
                    setDebtorReportReady(false);
                  }}
                  className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white"
                >
                  <option value="all">All Classes</option>
                  {classes.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Fee Head
                <select
                  value={exportFeeHead}
                  onChange={(event) => {
                    setExportFeeHead(event.target.value);
                    setDebtorReportRows([]);
                    setDebtorReportReady(false);
                  }}
                  className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white"
                >
                  <option value="all">All Fee Heads</option>
                  {exportFeeHeadNames.map((feeName) => (
                    <option key={feeName} value={feeName}>
                      {feeName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {debtorReportError && (
              <div
                role="alert"
                className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-3 mb-4"
              >
                {debtorReportError}
              </div>
            )}
            {debtorReportRows.length > 0 && (
              <p className="text-sm text-gray-600 mb-4">
                {debtorReportRows.length} outstanding fee{" "}
                {debtorReportRows.length === 1 ? "item" : "items"} ·{" "}
                {fmt(
                  debtorReportRows.reduce(
                    (totalAmount, row) =>
                      totalAmount + row.outstandingAmount,
                    0,
                  ),
                )}{" "}
                outstanding
              </p>
            )}
            {!debtorReportLoading &&
              !debtorReportError &&
              debtorReportRows.length === 0 && (
                <p className="text-sm text-gray-500 mb-4">
                  {debtorReportReady
                    ? "No active debts found for the selected filters."
                    : "Choose filters, then export or print the matching active debts."}
                </p>
              )}
            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowDebtorExport(false)}
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void exportDebtors("csv")}
                disabled={debtorReportLoading}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {debtorReportLoading ? "Preparing..." : "Export CSV"}
              </button>
              <button
                type="button"
                onClick={() => void exportDebtors("xlsx")}
                disabled={debtorReportLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {debtorReportLoading ? "Preparing..." : "Export Excel"}
              </button>
              <button
                type="button"
                onClick={() => void printDebtorChecklist()}
                disabled={debtorReportLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                {debtorReportLoading
                  ? "Preparing..."
                  : "Print Cashier Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="debtors-print" aria-label="Cashier debt checklist">
        <h1>Cashier Debtors Checklist</h1>
        <p>Generated: {new Date().toLocaleDateString()}</p>
        <p>
          Class: {exportClass === "all" ? "All Classes" : exportClass} | Fee
          Head: {exportFeeHead === "all" ? "All Fee Heads" : exportFeeHead}
        </p>
        <p>
          Active debts: {debtorReportRows.length} fee items | Total outstanding:{" "}
          {fmt(
            debtorReportRows.reduce(
              (sum, row) => sum + row.outstandingAmount,
              0,
            ),
          )}
        </p>
        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Full Name</th>
              <th>Class</th>
              <th>Type</th>
              <th>Specific Fee Owed</th>
              <th>Outstanding</th>
              <th>Receipt checked / reference</th>
            </tr>
          </thead>
          <tbody>
            {debtorReportRows.map((row, index) => (
              <tr key={`${row.studentId}-${row.feeName}-${index}`}>
                <td>{row.studentId}</td>
                <td>{row.fullName}</td>
                <td>{row.studentClass}</td>
                <td>{row.studentType}</td>
                <td>{row.feeName}</td>
                <td>{fmt(row.outstandingAmount)}</td>
                <td className="receipt-check-cell"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Add Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Add New Student</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {formError && (
              <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Student ID{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      studentId: e.target.value.replace(/\s/g, ""),
                    })
                  }
                  className={inputCls}
                  placeholder="Auto-generated as OIS-XXX if empty"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    First Name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className={inputCls}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Last Name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className={inputCls}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Class <span className="text-danger-500">*</span>
                </label>
                <select
                  value={formData.studentClass}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      studentClass: e.target.value,
                      departmentStream: "",
                    })
                  }
                  className={inputCls}
                  required
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {!!seniorClassKey(formData.studentClass) &&
                streams.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Department Stream{" "}
                      {requiresDepartmentStream(formData.studentClass) && (
                        <span className="text-danger-500">*</span>
                      )}
                    </label>
                    <select
                      value={formData.departmentStream}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          departmentStream: e.target.value,
                        })
                      }
                      className={inputCls}
                      required={requiresDepartmentStream(formData.studentClass)}
                    >
                      <option value="">
                        {requiresDepartmentStream(formData.studentClass)
                          ? "Select Stream"
                          : "No Stream"}
                      </option>
                      {streams.map((stream) => (
                        <option key={stream} value={stream}>
                          {stream}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Admission Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, admissionType: "Returning" })
                    }
                    className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${formData.admissionType === "Returning" ? "bg-primary-600 border-primary-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-primary-400"}`}
                  >
                    Returning
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, admissionType: "New" })
                    }
                    className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${formData.admissionType === "New" ? "bg-warning-500 border-warning-500 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-warning-400"}`}
                  >
                    New
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Student Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, studentStatus: "Day" })
                    }
                    className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${formData.studentStatus === "Day" ? "bg-gray-700 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"}`}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, studentStatus: "Boarding" })
                    }
                    className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${formData.studentStatus === "Boarding" ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-indigo-400"}`}
                  >
                    Boarding
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">
                    Matching Fees (Auto-Assigned)
                  </label>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                    Auto-Assigns to Ledger
                  </span>
                </div>
                {feeTypes.length === 0 ? (
                  <div className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
                    <p className="text-xs text-gray-400 text-center">
                      No fee types created yet. Set up fees in the{" "}
                      <span className="font-medium text-gray-500">
                        Fees &amp; Billing
                      </span>{" "}
                      tab first.
                    </p>
                  </div>
                ) : filteredFeeTypes.length === 0 ? (
                  <div className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
                    <p className="text-xs text-gray-400 text-center">
                      No matching fees found for the selected class and status.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-auto border border-gray-200 rounded-lg p-2 bg-slate-50">
                    {filteredFeeTypes.map((ft) => (
                      <div
                        key={ft.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-xs"
                      >
                        <div>
                          <div className="text-sm font-semibold text-gray-800">
                            {ft.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            {ft.class_filter || "All Classes"} ·{" "}
                            {ft.applicable_to || "All Students"}
                            {ft.term ? ` · ${ft.term}` : ""}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-700">
                          {fmt(Number(ft.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {filteredFeeTypes.length > 0 && (
                  <div className="mt-2 text-xs font-semibold text-emerald-700">
                    Total initial ledger charges:{" "}
                    {fmt(
                      filteredFeeTypes.reduce(
                        (s, f) => s + Number(f.amount),
                        0,
                      ),
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
                >
                  {formSaving ? "Adding…" : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditStudent && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit Student</h2>
              <button
                onClick={() => setShowEditStudent(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm text-gray-500 font-mono">
              {selectedStudent.student_id}
            </div>
            {editError && (
              <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">
                {editError}
              </div>
            )}
            {editSyncResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-900">
                <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-800">
                  <span>✓</span> Mid-Term Fee Swap Applied
                </div>
                <div className="text-xs space-y-0.5 text-emerald-700">
                  {editSyncResult.unassignedFees?.length > 0 && (
                    <div>
                      Unassigned: {editSyncResult.unassignedFees.join(", ")}
                    </div>
                  )}
                  {editSyncResult.attachedFees?.length > 0 && (
                    <div>
                      Attached: {editSyncResult.attachedFees.join(", ")}
                    </div>
                  )}
                  {editSyncResult.transferredCredit > 0 && (
                    <div className="font-semibold text-emerald-800">
                      Paid Credit Transferred: ₦
                      {editSyncResult.transferredCredit.toLocaleString()}
                    </div>
                  )}
                  <div>
                    Past debts preserved as Arrears B/F. New Balance: ₦
                    {(editSyncResult.newBalance || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleEditStudent} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Full Name <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) =>
                    setEditData({ ...editData, name: e.target.value })
                  }
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Class <span className="text-danger-500">*</span>
                </label>
                <select
                  value={editData.studentClass}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      studentClass: e.target.value,
                      departmentStream: "",
                    })
                  }
                  className={inputCls}
                  required
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {!!seniorClassKey(editData.studentClass) &&
                streams.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Department Stream{" "}
                      {requiresDepartmentStream(editData.studentClass) && (
                        <span className="text-danger-500">*</span>
                      )}
                    </label>
                    <select
                      value={editData.departmentStream}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          departmentStream: e.target.value,
                        })
                      }
                      className={inputCls}
                      required={requiresDepartmentStream(editData.studentClass)}
                    >
                      <option value="">
                        {requiresDepartmentStream(editData.studentClass)
                          ? "Select Stream"
                          : "No Stream"}
                      </option>
                      {streams.map((stream) => (
                        <option key={stream} value={stream}>
                          {stream}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Student Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditData({ ...editData, studentStatus: "Day" })
                    }
                    className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${editData.studentStatus === "Day" ? "bg-gray-700 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"}`}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditData({ ...editData, studentStatus: "Boarding" })
                    }
                    className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${editData.studentStatus === "Boarding" ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-indigo-400"}`}
                  >
                    Boarding
                  </button>
                </div>
              </div>

              {/* Balance summary */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-sm text-gray-600 font-medium">
                  Total Balance Owed
                </span>
                <span
                  className={`text-lg font-bold ${selectedStudent.current_fees_owed > 0 ? "text-danger-600" : "text-success-600"}`}
                >
                  {fmt(selectedStudent.current_fees_owed)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowEditStudent(false);
                  onNavigate?.("fees", selectedStudent?.student_id);
                }}
                className="w-full py-2.5 border-2 border-primary-500 text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-50 flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Manage Fees &amp; View
                Ledger
              </button>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEditStudent(false)}
                  className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
                >
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-danger-600" />
            </div>
            <h2 className="text-lg font-bold mb-2">Delete Student?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Delete <strong>{selectedStudent.name}</strong> (
              {selectedStudent.student_id})? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-danger-600 text-white rounded-xl text-sm font-semibold hover:bg-danger-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal — merged into Ledger modal above */}
      {/* Statement of Account Modal */}
      {showLedger && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">Statement of Account</h2>
                <p className="text-gray-500">
                  {selectedStudent.name} — {selectedStudent.student_id}
                </p>
              </div>
              <button
                onClick={() => setShowLedger(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pending items */}
            <div className="mb-4">
              <PendingItems studentId={selectedStudent.student_id} />
            </div>

            <div className="flex flex-wrap items-end gap-2 mb-4">
              <label className="flex-1 min-w-56 text-sm font-medium text-gray-700">
                Add Registration Package Charge
                <select
                  value={selectedRegistrationBundle}
                  onChange={(e) => {
                    const id = e.target.value;
                    const bundle = registrationBundles.find(
                      (item: any) => item.id === Number(id),
                    );
                    setSelectedRegistrationBundle(id);
                    setSelectedBundleItemIds(
                      (bundle?.items || []).map((item: any) => item.item_id),
                    );
                  }}
                  className={`${inputCls} mt-1`}
                >
                  <option value="">Select a registration package</option>
                  {registrationBundles.map((bundle: any) => (
                    <option key={bundle.id} value={bundle.id}>
                      {bundle.name} — {fmt(Number(bundle.base_price))}
                    </option>
                  ))}
                </select>
              </label>
              {selectedBundle && selectedBundle.items.length > 0 && (
                <div className="w-full border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Package Contents
                  </p>
                  {selectedBundle.items.map((item: any) => (
                    <label
                      key={item.item_id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBundleItemIds.includes(item.item_id)}
                        onChange={(e) =>
                          setSelectedBundleItemIds((current) =>
                            e.target.checked
                              ? [...current, item.item_id]
                              : current.filter((id) => id !== item.item_id),
                          )
                        }
                      />
                      <span className="flex-1">
                        {item.item_name} × {item.quantity}
                      </span>
                      <span className="text-gray-500">
                        {fmt(
                          Number(item.selling_price) * Number(item.quantity),
                        )}
                      </span>
                    </label>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-semibold text-sm">
                    <span>Charge after exclusions</span>
                    <span>{fmt(registrationChargeAmount)}</span>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={attachRegistrationBundle}
                disabled={
                  !selectedRegistrationBundle ||
                  bundleChargeSaving ||
                  registrationChargeAmount <= 0
                }
                className="px-3 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {bundleChargeSaving ? "Posting…" : "Post Charge"}
              </button>
              {bundleChargeError && (
                <p className="w-full text-sm text-danger-600">
                  {bundleChargeError}
                </p>
              )}
              {!registrationBundles.length && !ledgerLoading && (
                <p className="w-full text-sm text-gray-500">
                  No active registration packages are configured.
                </p>
              )}
            </div>

            {ledgerLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                Loading ledger…
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No ledger entries found for this student.
              </div>
            ) : (
              (() => {
                const totalBilled = ledgerEntries
                  .filter((e) => e.entry_type === "debit")
                  .reduce((s, e) => s + Number(e.amount), 0);
                const totalPaid = ledgerEntries
                  .filter((e) => e.entry_type === "credit")
                  .reduce((s, e) => s + Number(e.amount), 0);
                return (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="text-xs text-gray-500 font-medium">
                          Total Billed
                        </div>
                        <div className="text-lg font-bold text-gray-800">
                          {fmt(totalBilled)}
                        </div>
                      </div>
                      <div className="bg-success-50 rounded-lg p-3 border border-success-100">
                        <div className="text-xs text-success-600 font-medium">
                          Total Paid
                        </div>
                        <div className="text-lg font-bold text-success-700">
                          {fmt(totalPaid)}
                        </div>
                      </div>
                      <div
                        className={`rounded-lg p-3 border ${totalBilled - totalPaid > 0 ? "bg-danger-50 border-danger-100" : "bg-gray-50 border-gray-100"}`}
                      >
                        <div
                          className={`text-xs font-medium ${totalBilled - totalPaid > 0 ? "text-danger-600" : "text-gray-500"}`}
                        >
                          Net Balance Due
                        </div>
                        <div
                          className={`text-lg font-bold ${totalBilled - totalPaid > 0 ? "text-danger-600" : "text-success-600"}`}
                        >
                          {fmt(totalBilled - totalPaid)}
                        </div>
                      </div>
                    </div>

                    {/* Itemized ledger table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                              Date
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                              Fee Type
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                              Entry
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                              Amount Billed
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                              Amount Paid
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                              Method
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                              Cashier
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerEntries.map((e) => (
                            <tr key={e.id} className="border-t">
                              <td className="px-3 py-2 text-xs text-gray-500">
                                {new Date(e.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2 font-medium text-gray-800">
                                {e.fee_type_name}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${e.entry_type === "debit" ? "bg-gray-100 text-gray-600" : "bg-success-100 text-success-700"}`}
                                >
                                  {e.entry_type === "debit"
                                    ? "Charge"
                                    : "Payment"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-700">
                                {e.entry_type === "debit"
                                  ? fmt(Number(e.amount))
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-success-700">
                                {e.entry_type === "credit"
                                  ? fmt(Number(e.amount))
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-500">
                                {e.payment_mode || "—"}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-500">
                                {e.cashier_name || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="font-bold border-t-2">
                          <tr>
                            <td colSpan={3} className="px-3 py-2">
                              Totals:
                            </td>
                            <td className="px-3 py-2 text-right">
                              {fmt(totalBilled)}
                            </td>
                            <td className="px-3 py-2 text-right text-success-700">
                              {fmt(totalPaid)}
                            </td>
                            <td
                              colSpan={2}
                              className="px-3 py-2 text-right text-danger-600"
                            >
                              Bal: {fmt(totalBilled - totalPaid)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
