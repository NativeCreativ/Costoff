"use client";

import { Check, X } from "lucide-react";

const ROLE_COLUMNS = [
  { key: "dh", label: "Delivery Head – DH" },
  { key: "am", label: "Account Manager – AM" },
  { key: "spoc", label: "SPOC" },
  { key: "rt", label: "Recruiter – RT" },
  { key: "hr", label: "HR" },
  { key: "viewer", label: "Viewer" },
] as const;

type RoleKey = (typeof ROLE_COLUMNS)[number]["key"];
type PermissionRow = { action: string } & Record<RoleKey, boolean>;

const PERMISSION_ROWS: PermissionRow[] = [
  {
    action: "Create & Edit Demands",
    dh: true,
    am: true,
    spoc: false,
    rt: false,
    hr: false,
    viewer: false,
  },
  {
    action: "Source & Add Candidates",
    dh: true,
    am: true,
    spoc: false,
    rt: true,
    hr: false,
    viewer: false,
  },
  {
    action: "Schedule Interviews",
    dh: true,
    am: true,
    spoc: false,
    rt: true,
    hr: false,
    viewer: false,
  },
  {
    action: "Issue & Accept Offers",
    dh: true,
    am: true,
    spoc: false,
    rt: false,
    hr: true,
    viewer: false,
  },
  {
    action: "User Management",
    dh: true,
    am: false,
    spoc: false,
    rt: false,
    hr: false,
    viewer: false,
  },
];

function PermissionIndicator({ allowed }: { allowed: boolean }) {
  return (
    <span
      className={
        "inline-flex h-6 w-6 items-center justify-center rounded-full " +
        (allowed
          ? "bg-[#dcfce7] text-[#16a34a]"
          : "bg-[#fee2e2] text-[#dc2626]")
      }
      title={allowed ? "Allowed" : "Not allowed"}
      aria-label={allowed ? "Allowed" : "Not allowed"}
    >
      {allowed ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      ) : (
        <X className="h-3.5 w-3.5" strokeWidth={3} />
      )}
    </span>
  );
}

export function RolesView() {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <h2 className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">
          Default access by role
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table w-full table-fixed">
          <colgroup>
            <col className="w-[240px]" />
            {ROLE_COLUMNS.map((role) => (
              <col key={role.key} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Module / Feature Action</th>
              {ROLE_COLUMNS.map((role) => (
                <th key={role.key} style={{ textAlign: "center" }}>
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_ROWS.map((row) => (
              <tr key={row.action}>
                <td className="font-semibold text-[#0f172a]">{row.action}</td>
                {ROLE_COLUMNS.map((role) => (
                  <td key={role.key}>
                    <div className="flex items-center justify-center">
                      <PermissionIndicator allowed={row[role.key]} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
