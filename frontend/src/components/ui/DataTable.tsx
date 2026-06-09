"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Transaction = {
  id: number;
  amount: number;
  timestamp: string;
  description: string;
  category: string;
  transaction_type: string;
  account: number;
  is_transfer?: boolean;
};

type TransactionLike = {
  amount?: number | string;
  transaction_type?: string;
  is_transfer?: boolean;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowSelection?: Record<string, boolean>;
  setRowSelection?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}
export function DataTableDemo<TData extends { id: string | number }, TValue>({
  columns,
  data,
  rowSelection: externalRowSelection,
  setRowSelection: externalSetRowSelection,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  
  const [internalRowSelection, setInternalRowSelection] = React.useState({});
  
  const rowSelection = externalRowSelection ?? internalRowSelection;
  const setRowSelection = externalSetRowSelection ?? setInternalRowSelection;

  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 15,
  });
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    onPaginationChange: setPagination,
    getRowId: (row) => String(row.id),
  });

  const signedAmount = (row: TData) => {
    const transaction = row as TData & TransactionLike;
    const rawAmount = Number(transaction.amount || 0);
    const absoluteAmount = Math.abs(rawAmount);
    const type = String(transaction.transaction_type || "").toLowerCase();
    if (type === "credit") return absoluteAmount;
    if (type === "debit") return -absoluteAmount;
    return rawAmount;
  };

  const summarizeRows = (rows: TData[]) => rows.reduce((total, row) => total + signedAmount(row), 0);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);

  const pageTotal = summarizeRows(table.getRowModel().rows.map((row) => row.original));
  const filteredTotal = summarizeRows(table.getFilteredRowModel().rows.map((row) => row.original));
  const transferCount = table.getFilteredRowModel().rows.filter((row) => (row.original as TData & TransactionLike).is_transfer).length;

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 py-4">
        <Input
          placeholder="Filter description..."
          value={
            (table.getColumn("description")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("description")?.setFilterValue(event.target.value)
          }
          className="w-full sm:max-w-sm bg-[#121212] rounded-none"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto sm:ml-auto bg-[#121212] rounded-none"
            >
              Columns <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="border p-2 sm:p-4 overflow-x-auto">
        <Table className="min-w-[760px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="border-t border-white/15 bg-white/[0.03] hover:bg-white/[0.04]">
                  <TableCell colSpan={columns.length}>
                    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-end">
                      <div className="flex items-center justify-between gap-3 sm:justify-start">
                        <span className="text-white/50">Page total</span>
                        <span className={pageTotal >= 0 ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
                          {formatMoney(pageTotal)}
                        </span>
                      </div>
                      <div className="hidden h-4 w-px bg-white/15 sm:block" />
                      <div className="flex items-center justify-between gap-3 sm:justify-start">
                        <span className="text-white/50">Filtered total</span>
                        <span className={filteredTotal >= 0 ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
                          {formatMoney(filteredTotal)}
                        </span>
                      </div>
                      {transferCount > 0 ? (
                        <>
                          <div className="hidden h-4 w-px bg-white/15 sm:block" />
                          <span className="text-xs text-white/40">{transferCount} transfer row{transferCount === 1 ? "" : "s"} included</span>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-4">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-none"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-none"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
