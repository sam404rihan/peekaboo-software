import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  )
);
Table.displayName = "Table";

const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("[&_tr]:border-b border-outline-variant/20", className)} {...props} />
);
TableHeader.displayName = "TableHeader";

const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);
TableBody.displayName = "TableBody";

const TableFooter = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tfoot className={cn("bg-surface-container-low font-medium", className)} {...props} />
);
TableFooter.displayName = "TableFooter";

const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      "border-b border-outline-variant/15 transition-colors hover:bg-surface-container-low data-[state=selected]:bg-surface-container",
      className
    )}
    {...props}
  />
);
TableRow.displayName = "TableRow";

const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-on-surface-variant [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
);
TableHead.displayName = "TableHead";

const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn("px-4 py-3 align-middle text-on-surface [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
);
TableCell.displayName = "TableCell";

const TableCaption = ({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) => (
  <caption className={cn("mt-4 text-sm text-on-surface-variant", className)} {...props} />
);
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
