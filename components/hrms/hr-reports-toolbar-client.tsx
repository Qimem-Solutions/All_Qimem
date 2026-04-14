"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HrmsLinkButton } from "@/components/hrms/hrms-link-button";

type DeptRow = { id: string; name: string; employee_count: number };

export function HrReportsToolbarClient({
  departments,
  totalEmployees,
}: {
  departments: DeptRow[];
  totalEmployees: number;
}) {
  const [filter, setFilter] = useState<"all" | "turnover" | "departments">("all");

  const downloadCsv = useCallback(() => {
    const header = "Department,Employees\n";
    const body = departments.map((d) => `"${d.name.replace(/"/g, '""')}",${d.employee_count}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hrms-departments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [departments]);

  const downloadSummaryCsv = useCallback(() => {
    const lines = [
      "Metric,Value",
      `Total employees,${totalEmployees}`,
      `Departments listed,${departments.length}`,
      "",
      "Department,Employees",
      ...departments.map((d) => `"${d.name.replace(/"/g, '""')}",${d.employee_count}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hrms-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [departments, totalEmployees]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters & export</CardTitle>
        <CardDescription>
          Export live data as CSV. Filter chips highlight what you&apos;re exploring (charts below
          stay the same data source).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === "turnover" ? "primary" : "secondary"}
            size="sm"
            type="button"
            onClick={() => setFilter("turnover")}
          >
            Turnover view
          </Button>
          <Button
            variant={filter === "departments" ? "primary" : "secondary"}
            size="sm"
            type="button"
            onClick={() => setFilter("departments")}
          >
            All departments
          </Button>
          <Button
            variant={filter === "all" ? "primary" : "secondary"}
            size="sm"
            type="button"
            onClick={() => setFilter("all")}
          >
            Full snapshot
          </Button>
        </div>
        <p className="text-xs text-zinc-500">
          Active view:{" "}
          <span className="text-gold">
            {filter === "all"
              ? "Full snapshot"
              : filter === "turnover"
                ? "Turnover (placeholder label — extend with history table later)"
                : "Department breakdown"}
          </span>
        </p>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="secondary" size="sm" type="button" onClick={downloadCsv}>
            Download departments CSV
          </Button>
          <Button variant="secondary" size="sm" type="button" onClick={downloadSummaryCsv}>
            Download summary CSV
          </Button>
          <HrmsLinkButton href="/hrms/employees" variant="outline" size="sm">
            Open employee directory
          </HrmsLinkButton>
        </div>
      </CardContent>
    </Card>
  );
}
