import React, { useEffect, useState } from "react";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const PaginationControls: React.FC<PaginationControlsProps> = ({
  page,
  pageSize,
  total,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const goToPage = (event: React.FormEvent) => {
    event.preventDefault();
    const requestedPage = Number(pageInput);
    if (!Number.isFinite(requestedPage)) {
      setPageInput(String(page));
      return;
    }
    onPageChange(
      Math.min(totalPages, Math.max(1, Math.trunc(requestedPage))),
    );
  };

  if (total === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3">
      <span className="text-sm text-gray-500">
        {total} {itemLabel}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          &lt; Previous
        </button>
        <form onSubmit={goToPage} className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2 text-gray-600">
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              step={1}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              aria-label="Go to page"
              className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </label>
          <span className="whitespace-nowrap text-gray-500">
            of {totalPages}
          </span>
          <button
            type="submit"
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            Go
          </button>
        </form>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next &gt;
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
};

export default PaginationControls;
