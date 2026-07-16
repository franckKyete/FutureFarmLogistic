import { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface AdminTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
  };
}

export function AdminTable<T extends { id: string | number }>({
  columns,
  data,
  onRowClick,
  pagination,
}: AdminTableProps<T>) {
  return (
    <div className="bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/40 rounded-xl overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--admin-surface-container-low)]/50 border-b border-[var(--admin-outline-variant)]/40">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)] ${
                    column.align === 'right'
                      ? 'text-right'
                      : column.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  } ${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-outline-variant)]/30">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]/60">
                  Aucune donnée disponible
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-[var(--admin-surface-container-low)]/30 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 text-sm text-[var(--admin-on-surface)] ${
                        column.align === 'right'
                          ? 'text-right'
                          : column.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      } ${column.className || ''}`}
                    >
                      {column.render ? column.render(row) : (row as any)[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="px-6 py-4 flex items-center justify-between bg-[var(--admin-surface-container-low)]/30 border-t border-[var(--admin-outline-variant)]/40">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Affichage de {Math.min((pagination.currentPage - 1) * pagination.itemsPerPage + 1, pagination.totalItems)} à{' '}
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} sur{' '}
            {pagination.totalItems.toLocaleString('fr-FR')} éléments
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="p-2 border border-[var(--admin-outline-variant)]/40 rounded-lg hover:bg-[var(--admin-surface-container-high)] disabled:opacity-50 text-[var(--admin-on-surface)]"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const pageNumber = i + 1;
              return (
                <button
                  key={pageNumber}
                  onClick={() => pagination.onPageChange(pageNumber)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    pagination.currentPage === pageNumber
                      ? 'bg-[var(--admin-primary)] text-white'
                      : 'border border-[var(--admin-outline-variant)]/40 hover:bg-[var(--admin-surface-container-high)] text-[var(--admin-on-surface)]'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
            {pagination.totalPages > 5 && <span className="px-2 py-2 text-[var(--admin-on-surface-variant)]">...</span>}
            {pagination.totalPages > 5 && (
              <button
                onClick={() => pagination.onPageChange(pagination.totalPages)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  pagination.currentPage === pagination.totalPages
                    ? 'bg-[var(--admin-primary)] text-white'
                    : 'border border-[var(--admin-outline-variant)]/40 hover:bg-[var(--admin-surface-container-high)] text-[var(--admin-on-surface)]'
                }`}
              >
                {pagination.totalPages}
              </button>
            )}
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="p-2 border border-[var(--admin-outline-variant)]/40 rounded-lg hover:bg-[var(--admin-surface-container-high)] disabled:opacity-50 text-[var(--admin-on-surface)]"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
