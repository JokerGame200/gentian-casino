import React, { useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { useInertiaAutoRefresh } from "@/hooks/useInertiaAutoRefresh";

export default function LogsPage({ logs }) {
  // Refresh the logs prop every 4s without a full reload
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
    <div className="space-y-6 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">
          Dealer Logs {isAdmin ? "(Admin)" : isRunner ? "(Dealer)" : ""}
        </h1>
        <div className="w-full sm:w-auto flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Filter: user..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:w-56 rounded bg-white/5 border border-white/15 px-3 py-1.5 text-sm text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400/60"
          />
          <button
            onClick={() =>
              router.reload({ only: ["logs"], preserveState: true, preserveScroll: true })
            }
            className="text-sm px-3 py-1.5 border border-white/15 rounded bg-white/5 hover:bg-white/10 transition-colors w-full sm:w-auto"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-white/10 rounded-xl">
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="bg-white/10 text-white/80">
            <tr>
              <th className="text-left px-2 py-2 font-semibold w-48">Time</th>
              <th className="text-left px-2 py-2 font-semibold">From</th>
              <th className="text-left px-2 py-2 font-semibold">To</th>
              <th className="text-right px-2 py-2 font-semibold w-32">Amount</th>
            </tr>
          </thead>
          <tbody className="bg-white/5">
            {filtered.map((row) => {
              const id = row.id ?? `${row.created_at}-${row.to_user_id}-${row.from_user_id}`;
              const fromUser = row?.from_user ?? row?.fromUser ?? {};
              const toUser = row?.to_user ?? row?.toUser ?? {};
              const amount = Number(row?.amount ?? 0);
              const isPlus = amount >= 0;
              const dt = row?.created_at ? new Date(row.created_at) : null;
              const when = dt ? dt.toLocaleString() : "-";

              return (
                <tr key={id} className="border-t border-white/10">
                  <td className="px-2 py-1.5 whitespace-nowrap text-white/80">{when}</td>
                  <td className="px-2 py-1.5 text-white/80">{fromUser?.username ?? `#${row?.from_user_id ?? "-"}`}</td>
                  <td className="px-2 py-1.5 text-white/80">{toUser?.username ?? `#${row?.to_user_id ?? "-"}`}</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    <span className={isPlus ? "text-emerald-300" : "text-rose-300"}>
                      {isPlus ? "+" : ""}
                      {amount.toFixed(2)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-white/60 border-t border-white/10">
                  No records found.
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
              className={`px-3 py-1 border border-white/15 rounded text-sm transition-colors ${
                l.active ? "bg-cyan-500 text-white" : "bg-white/5 hover:bg-white/10"
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
