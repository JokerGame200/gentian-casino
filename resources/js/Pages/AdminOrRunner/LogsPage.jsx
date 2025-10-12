import React, { useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { useInertiaAutoRefresh } from "@/hooks/useInertiaAutoRefresh";

export default function LogsPage({ logs }) {
  // 🔄 alle 4s nur die Logs-Prop nachladen (kein Full-Reload)
  useInertiaAutoRefresh(["logs"], 4000);

  const { props } = usePage();
  const me = props?.auth?.user;
  const isAdmin = (me?.roles || []).includes("Admin");
  const isRunner = (me?.roles || []).includes("Runner");

  const [q, setQ] = useState("");

  const items = Array.isArray(logs?.data) ? logs.data : [];
  const filtered = useMemo(() => {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter((row) => {
      const fu = row?.from_user?.username ?? row?.fromUser?.username ?? "";
      const tu = row?.to_user?.username ?? row?.toUser?.username ?? "";
      return fu.toLowerCase().includes(s) || tu.toLowerCase().includes(s);
    });
  }, [items, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">
          Dealer Logs {isAdmin ? "(Admin)" : isRunner ? "(Runner)" : ""}
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Filter: Benutzer..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border rounded px-3 py-1 text-sm"
          />
          <button
            onClick={() =>
              router.reload({ only: ["logs"], preserveState: true, preserveScroll: true })
            }
            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
          >
            Aktualisieren
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2 w-48">Zeit</th>
              <th className="text-left p-2">Von</th>
              <th className="text-left p-2">An</th>
              <th className="text-right p-2 w-32">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const id = row.id ?? `${row.created_at}-${row.to_user_id}-${row.from_user_id}`;
              const fromUser = row?.from_user ?? row?.fromUser ?? {};
              const toUser = row?.to_user ?? row?.toUser ?? {};
              const amount = Number(row?.amount ?? 0);
              const isPlus = amount >= 0;
              const dt = row?.created_at ? new Date(row.created_at) : null;
              const when = dt ? dt.toLocaleString() : "-";

              return (
                <tr key={id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{when}</td>
                  <td className="p-2">{fromUser?.username ?? `#${row?.from_user_id ?? "-"}`}</td>
                  <td className="p-2">{toUser?.username ?? `#${row?.to_user_id ?? "-"}`}</td>
                  <td className="p-2 text-right font-mono">
                    <span className={isPlus ? "text-green-600" : "text-red-600"}>
                      {isPlus ? "+" : ""}
                      {amount.toFixed(2)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  Keine Einträge gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {Array.isArray(logs?.links) && logs.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {logs.links.map((l, i) => (
            <button
              key={i}
              className={`px-3 py-1 border rounded text-sm ${
                l.active ? "bg-gray-200" : "hover:bg-gray-50"
              } ${!l.url ? "opacity-50 cursor-not-allowed" : ""}`}
              dangerouslySetInnerHTML={{ __html: l.label }}
              disabled={!l.url}
              onClick={() =>
                l.url &&
                router.visit(l.url, {
                  preserveState: true,
                  preserveScroll: true,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
