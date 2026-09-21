import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  User,
  UserPlus,
  X,
} from "lucide-react";
import PendingItems from "../../shared/PendingItems";

const fmt = (n: number) =>
  `₦${(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CashierSalePage: React.FC<any> = (props) => {
  const {
    activeShift,
    user,
    selectedStudent,
    studentClassFilter,
    classes,
    studentSearch,
    studentSuggestions,
    showStudentDrop,
    studentSuggPage,
    studentSuggTotalPages,
    walkInApplicant,
    walkInEditMode,
    walkInEditName,
    setWalkInEditName,
    walkInEditClass,
    setWalkInEditClass,
    quickAddedStudentIds,
    bundlePaymentInfo,
    bundleFullyPaid,
    scope,
    saleMode,
    cart,
    cartOpen,
    setCartOpen,
    paymentMode,
    loading,
    setSelectedStudent,
    setStudentSearch,
    setStudentSuggPage,
    setStudentClassFilter,
    setShowWalkIn,
    setShowQuickAdd,
    setQuickAddError,
    clearStudent,
    setWalkInApplicant,
    setWalkInModalError,
    setWalkInError,
    setShowWalkInForm,
    setShowWalkInAcceptance,
    setShowWalkInRegistration,
    setWalkInAcceptanceBundle,
    setWalkInRegistrationBundle,
    setShowQuickEditStudent,
    setQuickEditName,
    setQuickEditClass,
    setQuickEditError,
    setHistoryDrawerTarget,
    setSaleMode,
    setActiveCat,
    categories,
    activeCat,
    itemSearch,
    setItemSearch,
    inventory,
    addToCart,
    updateQty,
    setPaymentMode,
    setShowCheckout,
    cartTotal,
    setSelectedFee,
    setFeesAmount,
    setFeesDiscount,
    bundleBalanceAmount,
    setBundleBalanceAmount,
    setShowBundleBalancePayment,
    showReceipt,
    lastTxn,
    schoolSettings,
    setShowReceipt,
    setLastTxn,
    setTab,
    handleWalkInEditSave,
    handleWalkInBundleAction,
    handleFeesPayment,
    handleStorePurchase,
    handleBundleBalancePayment,
    selectedFee,
    feesAmount,
    feesDiscount,
    feesPayMode,
    setFeesPayMode,
    studentFees,
    classFees,
    setBundleFullyPaid,
    setBundlePaymentInfo,
    setSelectedBundle,
    setBundleAmount,
    setBundlePayMode,
    setBundleError,
    setShowBundlePayment,
    refund,
  } = props;

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b px-5 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-bold text-gray-900">New Sale</h1>
            <p className="text-xs text-gray-400">
              Shift #{activeShift.id} ·{" "}
              {new Date(activeShift.opened_at).toLocaleTimeString()}
            </p>
          </div>
          <span className="text-sm text-gray-600 font-medium">
            {user?.username}
          </span>
        </div>

        <div className="bg-white border-b px-5 py-4 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Select Customer
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setStudentSearch("");
                  setWalkInApplicant(null);
                  setWalkInModalError("");
                  setWalkInError("");
                  setShowWalkInForm(false);
                  setShowWalkInAcceptance(false);
                  setShowWalkInRegistration(false);
                  setWalkInAcceptanceBundle(null);
                  setWalkInRegistrationBundle(null);
                  setShowWalkIn(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-warning-50 border border-warning-300 text-warning-700 hover:bg-warning-100 rounded-lg text-xs font-semibold transition-all"
              >
                <User className="w-3.5 h-3.5" /> Walk-In Applicant
              </button>
              <button
                onClick={() => {
                  setShowQuickAdd(true);
                  setQuickAddError("");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-300 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-semibold transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" /> Quick Add Student
              </button>
            </div>
          </div>
          <div className="flex gap-2 relative">
            <select
              value={studentClassFilter}
              onChange={(e) => {
                setStudentClassFilter(e.target.value);
                setSelectedStudent(null);
                setStudentSearch("");
                setStudentSuggPage(1);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 shrink-0"
            >
              <option value="all">All Classes</option>
              <option value="__pending__">Pending Applicants</option>
              {classes.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  if (selectedStudent) setSelectedStudent(null);
                  setStudentSuggPage(1);
                }}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="Search by name…"
              />
              {selectedStudent && (
                <button
                  onClick={clearStudent}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showStudentDrop &&
              studentSuggestions.length > 0 &&
              !selectedStudent && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-30">
                  <div className="max-h-60 overflow-auto">
                    {studentSuggestions.map((s: any) => (
                      <div
                        key={s.student_id}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 border-b last:border-0 text-left"
                      >
                        <button
                          onClick={() => props.selectStudent(s)}
                          className="flex-1 text-left min-w-0 mr-2"
                        >
                          <div className="font-medium text-sm truncate">
                            {s.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            {s.student_class} · {s.student_id}
                          </div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {s.current_fees_owed > 0 && (
                            <span className="text-xs font-bold text-danger-600 bg-danger-50 px-2 py-0.5 rounded-full">
                              Owes {fmt(s.current_fees_owed)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryDrawerTarget({
                                id: s.student_id,
                                name: s.name,
                                class: s.student_class,
                                current_fees_owed: s.current_fees_owed,
                              });
                            }}
                            className="px-2 py-1 bg-gray-100 hover:bg-primary-50 text-gray-600 hover:text-primary-700 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="View History / Ledger"
                          >
                            <FileText className="w-3.5 h-3.5" /> History
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {studentSuggTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 px-4 py-2 border-t bg-gray-50">
                      <button
                        onClick={() =>
                          setStudentSuggPage((p: number) => Math.max(1, p - 1))
                        }
                        disabled={studentSuggPage <= 1}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-gray-500">
                        {studentSuggPage}/{studentSuggTotalPages}
                      </span>
                      <button
                        onClick={() =>
                          setStudentSuggPage((p: number) =>
                            Math.min(studentSuggTotalPages, p + 1),
                          )
                        }
                        disabled={studentSuggPage >= studentSuggTotalPages}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
          </div>

          {walkInApplicant && !props.showBundlePayment && (
            <div className="mt-3 bg-warning-50 border border-warning-300 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-warning-200 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-warning-700" />
                  </div>
                  <div className="flex-1">
                    {walkInEditMode ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={walkInEditName}
                          onChange={(e) => setWalkInEditName(e.target.value)}
                          className="text-sm font-bold text-warning-900 bg-white border border-warning-300 rounded px-2 py-1 w-40"
                          placeholder="Full name"
                        />
                        <select
                          value={walkInEditClass}
                          onChange={(e) => setWalkInEditClass(e.target.value)}
                          className="text-xs bg-white border border-warning-300 rounded px-2 py-1"
                        >
                          {classes.map((c: string) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-warning-900">
                          {walkInApplicant.full_name}
                        </div>
                        <div className="text-xs text-warning-600">
                          {walkInApplicant.proposed_class ||
                            "Walk-In Applicant"}{" "}
                          · #{walkInApplicant.id}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {walkInEditMode ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleWalkInEditSave}
                      disabled={
                        props.walkInEditSaving || !walkInEditName.trim()
                      }
                      className="px-2 py-1 bg-success-600 text-white text-xs font-semibold rounded hover:bg-success-700 disabled:opacity-50"
                    >
                      {props.walkInEditSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => props.setWalkInEditMode(false)}
                      className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        props.setWalkInEditName(
                          walkInApplicant.full_name || "",
                        );
                        props.setWalkInEditClass(
                          walkInApplicant.proposed_class || classes[0] || "",
                        );
                        props.setWalkInEditMode(true);
                      }}
                      className="p-1.5 text-warning-500 hover:text-warning-700 hover:bg-warning-100 rounded"
                      title="Edit name/class"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setHistoryDrawerTarget({
                          id: String(walkInApplicant.id),
                          name: walkInApplicant.full_name,
                          class: walkInApplicant.proposed_class || "Applicant",
                          isApplicant: true,
                        })
                      }
                      className="p-1.5 text-warning-600 hover:text-warning-800 hover:bg-warning-100 rounded"
                      title="View History / Ledger"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setWalkInApplicant(null)}
                      className="text-warning-400 hover:text-warning-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {!props.walkInEditMode && (
                <>
                  <p className="text-xs text-warning-700 mb-3">
                    Applicant created. Choose a payment action:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleWalkInBundleAction("form")}
                      className="flex flex-col items-center gap-1 py-2.5 px-2 bg-white border border-warning-200 rounded-lg hover:bg-warning-100 text-warning-800 transition-all"
                    >
                      <span className="text-base font-extrabold">₦3k</span>
                      <span className="text-xs font-semibold">Form</span>
                    </button>
                    <button
                      onClick={() => handleWalkInBundleAction("acceptance")}
                      className="flex flex-col items-center gap-1 py-2.5 px-2 bg-white border border-warning-200 rounded-lg hover:bg-warning-100 text-warning-800 transition-all"
                    >
                      <span className="text-base font-extrabold">₦</span>
                      <span className="text-xs font-semibold">Acceptance</span>
                    </button>
                    <button
                      onClick={() => handleWalkInBundleAction("registration")}
                      className="flex flex-col items-center gap-1 py-2.5 px-2 bg-white border border-warning-200 rounded-lg hover:bg-warning-100 text-warning-800 transition-all"
                    >
                      <span className="text-base font-extrabold">₦₦</span>
                      <span className="text-xs font-semibold">
                        Registration
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {selectedStudent &&
            props.quickAddedStudentIds.has(selectedStudent.student_id) && (
              <div className="mt-2 flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-xl px-3 py-2">
                <span className="text-xs text-primary-700 font-medium flex-1">
                  Quick-added this shift — name or class incorrect?
                </span>
                <button
                  onClick={() => {
                    setQuickEditName(selectedStudent.name);
                    setQuickEditClass(selectedStudent.student_class);
                    setQuickEditError("");
                    setShowQuickEditStudent(true);
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg text-xs font-semibold"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
            )}

          {selectedStudent && selectedStudent.current_fees_owed > 0 && (
            <div className="mt-3 flex items-center gap-3 bg-danger-600 text-white rounded-xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  Outstanding Fees
                </div>
                <div className="text-xl font-extrabold">
                  {fmt(selectedStudent.current_fees_owed)}
                </div>
              </div>
            </div>
          )}

          {selectedStudent && (
            <div className="mt-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
              <div className="min-w-0">
                <span className="font-bold text-sm text-blue-950">
                  {selectedStudent.name}
                </span>
                <span className="text-xs text-blue-600 ml-2 font-medium">
                  ({selectedStudent.student_class} •{" "}
                  {selectedStudent.student_id})
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setHistoryDrawerTarget({
                    id: selectedStudent.student_id,
                    name: selectedStudent.name,
                    class: selectedStudent.student_class,
                    current_fees_owed: selectedStudent.current_fees_owed,
                  })
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 hover:border-blue-400 text-blue-700 rounded-lg text-xs font-semibold shadow-sm transition-all shrink-0"
              >
                <FileText className="w-3.5 h-3.5" /> View History / Ledger
              </button>
            </div>
          )}

          {selectedStudent && (
            <div className="mt-3">
              <PendingItems studentId={selectedStudent.student_id} />
            </div>
          )}

          {selectedStudent && (
            <div className="mt-3 flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setSaleMode("store")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${saleMode === "store" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                Store Purchase
              </button>
              <button
                onClick={() => setSaleMode("fees")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${saleMode === "fees" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                Collect Fees
              </button>
            </div>
          )}
        </div>

        {selectedStudent && saleMode === "store" && (
          <div className="flex-1 overflow-auto">
            <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto shrink-0">
              <button
                onClick={() => setActiveCat(null)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCat === null ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                <Tag className="w-3.5 h-3.5" /> All
              </button>
              {categories.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  style={activeCat === c.id ? { background: c.color } : {}}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCat === c.id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="p-4">
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Search items or scan barcode…"
                />
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {inventory.map((item: any) => (
                  <button
                    key={item.item_id}
                    onClick={() => addToCart(item)}
                    disabled={item.stock_quantity <= 0}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${item.stock_quantity <= 0 ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed" : "bg-white border-gray-200 hover:border-primary-400 hover:shadow-md active:scale-95"}`}
                  >
                    {item.category_name && (
                      <span
                        className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded text-white mb-1"
                        style={{ background: item.category_color || "#6b7280" }}
                      >
                        {item.category_name}
                      </span>
                    )}
                    <div className="font-medium text-sm text-gray-800 leading-tight mb-1">
                      {item.item_name}
                    </div>
                    <div className="text-base font-extrabold text-primary-600">
                      {fmt(item.selling_price)}
                    </div>
                    <div
                      className={`text-xs mt-1 font-medium ${item.stock_quantity <= 5 ? "text-danger-500" : item.stock_quantity <= 10 ? "text-warning-600" : "text-gray-400"}`}
                    >
                      {item.stock_quantity <= 0
                        ? "Out of stock"
                        : `${item.stock_quantity} in stock`}
                    </div>
                  </button>
                ))}
              </div>
              {inventory.length === 0 && (
                <div className="text-center py-12 text-gray-300 text-sm">
                  No items found
                </div>
              )}
            </div>
          </div>
        )}

        {selectedStudent && saleMode === "fees" && (
          <div className="flex-1 overflow-auto p-4">
            <div className="max-w-lg mx-auto space-y-4 mt-2">
              <h2 className="font-bold text-lg">Collect Fees</h2>
              <p className="text-sm text-gray-500">
                Student: <strong>{selectedStudent.name}</strong> ·{" "}
                {selectedStudent.student_class}
              </p>

              {bundleFullyPaid ? (
                <div className="flex items-center gap-3 bg-success-50 border border-success-300 rounded-xl p-4">
                  <CheckCircle className="w-6 h-6 text-success-600 shrink-0" />
                  <div>
                    <div className="font-bold text-success-800">
                      Bundle Fully Paid
                    </div>
                    <div className="text-sm text-success-600">
                      Registration fee bundle balance has been cleared.
                    </div>
                  </div>
                </div>
              ) : bundlePaymentInfo?.hasBundle &&
                !bundlePaymentInfo?.isFullPayment &&
                (bundlePaymentInfo?.balanceDue ?? 0) > 0 ? (
                <div className="space-y-3">
                  <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-warning-600" />
                      <span className="font-semibold text-warning-800">
                        Registration Fee Bundle - Outstanding Balance
                      </span>
                    </div>
                    <p className="text-sm text-warning-700 mb-2">
                      This student has an outstanding balance on their
                      registration bundle.
                    </p>
                    <div className="flex justify-between items-center bg-white rounded-lg p-3 border border-warning-200">
                      <span className="font-medium text-gray-700">
                        Outstanding Balance:
                      </span>
                      <span className="text-xl font-extrabold text-danger-600">
                        {fmt(bundlePaymentInfo?.balanceDue)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setBundleBalanceAmount(
                        String(bundlePaymentInfo?.balanceDue),
                      );
                      setShowBundleBalancePayment(true);
                    }}
                    className="w-full py-3 bg-warning-600 text-white font-bold rounded-xl hover:bg-warning-700 transition-all"
                  >
                    Collect Towards Bundle Balance
                  </button>
                </div>
              ) : null}

              {(studentFees?.length ?? 0) === 0 ? (
                !(
                  bundlePaymentInfo?.hasBundle &&
                  !bundlePaymentInfo?.isFullPayment
                ) && (
                  <div className="bg-success-50 border border-success-200 rounded-xl p-6 text-center">
                    <CheckCircle className="w-10 h-10 text-success-500 mx-auto mb-2" />
                    <div className="font-semibold text-success-700">
                      No outstanding fees!
                    </div>
                    <div className="text-sm text-success-600 mt-1">
                      This student has no assigned fees with a balance.
                    </div>
                  </div>
                )
              ) : (
                <>
                  <div className="space-y-2">
                    {studentFees?.map((fee: any) => (
                      <button
                        key={fee?.id}
                        onClick={() => {
                          setSelectedFee(fee);
                          setFeesAmount("");
                          setFeesDiscount("");
                        }}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedFee?.id === fee?.id ? "border-primary-500 bg-primary-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-gray-900">
                              {fee?.fee_name}
                            </div>
                            {fee?.fee_description && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {fee.fee_description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-0.5">
                              {fee?.academic_session}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <div className="text-xs text-gray-400">Balance</div>
                            <div className="text-lg font-extrabold text-danger-600">
                              {fmt(fee?.balance)}
                            </div>
                            <div className="text-xs text-gray-400">
                              of {fmt(fee?.amount_due)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-success-500 h-1.5 rounded-full"
                            style={{
                              width: `${fee?.amount_due ? (fee.amount_paid / fee.amount_due) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          Paid: {fmt(fee?.amount_paid)}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedFee && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                      <div className="font-semibold text-gray-900">
                        Paying: {selectedFee.fee_name}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Enter Amount Collected
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                            ₦
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            max={selectedFee.balance}
                            value={feesAmount}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v > selectedFee.balance)
                                setFeesAmount(String(selectedFee.balance));
                              else setFeesAmount(e.target.value);
                            }}
                            className="w-full pl-8 pr-3 py-3 border-2 border-gray-200 rounded-xl text-2xl font-bold focus:outline-none focus:border-primary-400"
                            placeholder="0.00"
                            autoFocus
                          />
                        </div>
                        {(() => {
                          const disc = feesDiscount
                            ? parseFloat(feesDiscount) || 0
                            : 0;
                          const netBal = Math.max(
                            0,
                            selectedFee.balance - disc,
                          );
                          return (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => setFeesAmount(String(netBal))}
                                className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-semibold"
                              >
                                Full Balance {fmt(netBal)}
                              </button>
                              <button
                                onClick={() =>
                                  setFeesAmount(String(Math.round(netBal / 2)))
                                }
                                className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                              >
                                Half
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Discount / Concession{" "}
                          <span className="text-gray-400 font-normal">
                            (₦, optional)
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500 text-sm">
                            ₦
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={feesDiscount}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v >= selectedFee.balance)
                                setFeesDiscount(
                                  String(selectedFee.balance - 1),
                                );
                              else setFeesDiscount(e.target.value);
                            }}
                            className="w-full pl-8 pr-3 py-2.5 border border-warning-200 bg-warning-50 rounded-xl text-sm focus:outline-none focus:border-warning-400"
                            placeholder="0.00"
                          />
                        </div>
                        {feesDiscount && parseFloat(feesDiscount) > 0 && (
                          <p className="text-xs text-warning-700 mt-1 font-medium">
                            Net balance after discount:{" "}
                            {fmt(
                              Math.max(
                                0,
                                selectedFee.balance - parseFloat(feesDiscount),
                              ),
                            )}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Payment Method
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => props.setFeesPayMode("Cash")}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all ${props.feesPayMode === "Cash" ? "bg-success-600 border-success-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-success-400"}`}
                          >
                            <Banknote className="w-4 h-4" /> CASH
                          </button>
                          <button
                            onClick={() => props.setFeesPayMode("POS_Transfer")}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all ${props.feesPayMode === "POS_Transfer" ? "bg-primary-600 border-primary-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-primary-400"}`}
                          >
                            <CreditCard className="w-4 h-4" /> POS
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const disc = feesDiscount
                          ? parseFloat(feesDiscount) || 0
                          : 0;
                        const netBal = Math.max(0, selectedFee.balance - disc);
                        const amt = parseFloat(feesAmount);
                        return (
                          <button
                            onClick={handleFeesPayment}
                            disabled={
                              !feesAmount ||
                              isNaN(amt) ||
                              amt <= 0 ||
                              amt > netBal ||
                              props.loading
                            }
                            className="w-full py-4 bg-success-600 text-white font-bold rounded-xl hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                          >
                            {props.loading
                              ? "Processing…"
                              : `Record ${feesAmount ? fmt(amt) : ""} Payment`}
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}

              {(classFees?.length ?? 0) > 0 &&
                (studentFees?.length ?? 0) === 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">
                      Available Fees for {selectedStudent?.student_class}
                    </h3>
                    <div className="space-y-2">
                      {classFees?.map((ft: any) => (
                        <div
                          key={ft?.id}
                          className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium text-sm text-gray-800">
                              {ft?.name}
                            </div>
                            {ft?.description && (
                              <div className="text-xs text-gray-400">
                                {ft.description}
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-gray-700">
                            {fmt(Number(ft?.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {!selectedStudent && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
            <User className="w-16 h-16 mb-4" />
            <p className="font-medium text-lg text-gray-400">
              Search for a student above
            </p>
            <p className="text-sm">Select class and type the student's name</p>
          </div>
        )}
      </div>

      {cartOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setCartOpen(false)}
        />
      )}

      <div
        className={`${cartOpen ? "fixed bottom-0 left-0 right-0 max-h-[85vh] z-50 flex flex-col rounded-t-2xl" : "hidden"} md:relative md:flex md:bottom-auto md:left-auto md:right-auto md:max-h-none md:z-auto md:rounded-none md:w-80 bg-white border-l md:flex-col shrink-0`}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gray-500" />
            <h2 className="font-bold text-gray-900">Cart</h2>
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <span className="bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {cart.length}
              </span>
            )}
            <button
              className="md:hidden p-1 text-gray-400 hover:text-gray-600"
              onClick={() => setCartOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-3 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 py-12">
              <ShoppingCart className="w-10 h-10 mb-2" />
              <p className="text-sm">
                {!selectedStudent
                  ? "Select a student first"
                  : "Tap items to add"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item: any) => (
                <div
                  key={item.item_id}
                  className="flex items-center gap-2 bg-gray-50 rounded-xl p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {item.item_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {fmt(item.selling_price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.item_id, -1)}
                      className="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center hover:bg-gray-300 text-sm font-bold"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.item_id, 1)}
                      className="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center hover:bg-gray-300 text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-sm font-bold text-gray-900 w-16 text-right">
                    {fmt(item.selling_price * item.quantity)}
                  </div>
                  <button
                    onClick={() =>
                      props.setCart((p: any[]) =>
                        p.filter((i: any) => i.item_id !== item.item_id),
                      )
                    }
                    className="text-gray-300 hover:text-danger-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && saleMode === "store" && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="text-xl font-extrabold text-gray-900">
                {fmt(cartTotal)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setPaymentMode("Cash")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === "Cash" ? "bg-success-600 border-success-600 text-white shadow-md" : "bg-white border-gray-200 text-gray-600 hover:border-success-400"}`}
              >
                <Banknote className="w-4 h-4" /> CASH
              </button>
              <button
                onClick={() => setPaymentMode("POS_Transfer")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === "POS_Transfer" ? "bg-primary-600 border-primary-600 text-white shadow-md" : "bg-white border-gray-200 text-gray-600 hover:border-primary-400"}`}
              >
                <CreditCard className="w-4 h-4" /> POS
              </button>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full py-4 bg-success-600 text-white font-bold rounded-xl hover:bg-success-700 text-lg shadow-sm"
            >
              Charge {fmt(cartTotal)}
            </button>
          </div>
        )}
      </div>

      {props.tab === "sale" && (
        <button
          className="md:hidden fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-success-600 text-white px-4 py-3 rounded-2xl shadow-xl font-bold text-sm"
          onClick={() => setCartOpen(true)}
        >
          <ShoppingCart className="w-5 h-5" />
          {cart.length > 0
            ? `${cart.length} item${cart.length > 1 ? "s" : ""} · ${fmt(cartTotal)}`
            : "Cart"}
        </button>
      )}
    </div>
  );
};

export default CashierSalePage;
