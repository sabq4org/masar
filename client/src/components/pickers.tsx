import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { CalendarDays, Search, User2, X } from "lucide-react";
import type { Priority, UserLite } from "../lib/types";
import { PRIORITIES } from "../lib/types";
import { Avatar } from "./bits";
import { dueLabel, toDateInput } from "../lib/dates";

/** حاوية منبثقة خفيفة: تُغلق بالنقر خارجها أو Esc */
export function Popover({
  open,
  onClose,
  children,
  align = "start",
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={clsx(
        "absolute top-full z-50 mt-1 min-w-56 rounded-field border border-line bg-surface p-1.5 shadow-lg",
        align === "start" ? "right-0" : "left-0",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

/** منتقي المسؤول — قائمة أعضاء ببحث (نموذج أسانا) */
export function AssigneePicker({
  value,
  onChange,
  compact,
}: {
  value: { id: number; name: string; avatarColor: string; avatarUrl?: string | null } | null | undefined;
  onChange: (userId: number | null) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data } = useQuery<UserLite[] | null>({ queryKey: ["/api/users"] });
  const users = Array.isArray(data) ? data : [];
  const filtered = q ? users.filter((u) => u.name.includes(q)) : users;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={clsx(
          "group flex items-center gap-1.5 rounded-chip text-xs font-semibold",
          compact
            ? "p-0"
            : "border border-dashed border-transparent px-1 py-0.5 hover:border-line hover:bg-line-soft/60",
        )}
        title={value ? `المسؤول: ${value.name}` : "تعيين مسؤول"}
      >
        {value ? (
          <>
            <Avatar name={value.name} color={value.avatarColor} src={value.avatarUrl} size={compact ? 6 : 7} />
            {!compact && <span className="max-w-28 truncate">{value.name}</span>}
            {!compact && (
              <span
                role="button"
                aria-label="إزالة المسؤول"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="hidden text-ink-3 hover:text-danger group-hover:inline"
              >
                <X size={12} />
              </span>
            )}
          </>
        ) : (
          <span
            className={clsx(
              "flex items-center justify-center rounded-chip border border-dashed border-ink-3/50 text-ink-3",
              compact ? "h-6 w-6" : "h-7 w-7",
            )}
          >
            <User2 size={compact ? 12 : 14} />
          </span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <div className="mb-1 flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1">
          <Search size={12} className="text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث عن عضو…"
            className="w-full bg-transparent text-xs focus:outline-none"
          />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {value && (
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold text-ink-3 hover:bg-line-soft"
            >
              <X size={13} /> بلا مسؤول
            </button>
          )}
          {filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                onChange(u.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft"
            >
              <Avatar name={u.name} color={u.avatarColor} src={u.avatarUrl} size={6} />
              <span className="flex-1 truncate">{u.name}</span>
              {u.roleLabel && <span className="text-[10px] text-ink-3">{u.roleLabel}</span>}
            </button>
          ))}
          {!filtered.length && (
            <div className="px-2 py-3 text-center text-xs text-ink-3">لا نتائج</div>
          )}
        </div>
      </Popover>
    </div>
  );
}

/** منتقي تاريخ الاستحقاق — خيارات سريعة + تقويم (نموذج أسانا) */
export function DueDatePicker({
  value,
  onChange,
  isCompleted,
  compact,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  isCompleted?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const quick = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(17, 0, 0, 0);
    onChange(d.toISOString());
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={clsx(
          "flex items-center gap-1 rounded-chip text-xs font-semibold",
          !compact && "border border-dashed border-transparent px-1 py-0.5 hover:border-line hover:bg-line-soft/60",
        )}
        title="تاريخ الاستحقاق"
      >
        {value ? (
          <span
            className={clsx(
              "tabular-nums",
              isCompleted
                ? "text-ink-3"
                : new Date(value) < new Date(new Date().setHours(0, 0, 0, 0))
                  ? "text-danger"
                  : "text-ink-2",
            )}
          >
            {dueLabel(value)}
          </span>
        ) : (
          <span
            className={clsx(
              "flex items-center justify-center rounded-chip border border-dashed border-ink-3/50 text-ink-3",
              compact ? "h-6 w-6" : "h-7 w-7",
            )}
          >
            <CalendarDays size={compact ? 12 : 14} />
          </span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="w-56 p-2">
        <div className="mb-2 grid grid-cols-3 gap-1 text-center text-[11px] font-bold">
          <button onClick={() => quick(0)} className="rounded-md border border-line px-1.5 py-1 hover:bg-line-soft">اليوم</button>
          <button onClick={() => quick(1)} className="rounded-md border border-line px-1.5 py-1 hover:bg-line-soft">غدًا</button>
          <button onClick={() => quick(7)} className="rounded-md border border-line px-1.5 py-1 hover:bg-line-soft">أسبوع</button>
        </div>
        <input
          type="date"
          dir="ltr"
          value={toDateInput(value)}
          onChange={(e) => {
            if (!e.target.value) return onChange(null);
            const d = new Date(e.target.value + "T17:00:00");
            onChange(d.toISOString());
            setOpen(false);
          }}
          className="w-full rounded-md border border-line bg-paper px-2 py-1.5 text-xs focus:outline-none"
        />
        {value && (
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-ink-3 hover:bg-line-soft hover:text-danger"
          >
            <X size={12} /> إزالة التاريخ
          </button>
        )}
      </Popover>
    </div>
  );
}

/** منتقي الأولوية — أقراص ملونة */
export function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority | null;
  onChange: (p: Priority | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = value ? PRIORITIES[value] : null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center rounded-chip border border-dashed border-transparent px-1 py-0.5 hover:border-line hover:bg-line-soft/60"
        title="الأولوية"
      >
        {current ? (
          <span
            className="rounded-chip px-2 py-0.5 text-[11px] font-bold"
            style={{ background: current.bg, color: current.fg }}
          >
            {current.label}
          </span>
        ) : (
          <span className="px-1 text-xs text-ink-3">—</span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="w-40">
        {(["urgent", "high", "normal", "low"] as Priority[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              onChange(p);
              setOpen(false);
            }}
            className="flex w-full items-center rounded-md px-2 py-1.5 hover:bg-line-soft"
          >
            <span
              className="rounded-chip px-2 py-0.5 text-[11px] font-bold"
              style={{ background: PRIORITIES[p].bg, color: PRIORITIES[p].fg }}
            >
              {PRIORITIES[p].label}
            </span>
          </button>
        ))}
        <button
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-ink-3 hover:bg-line-soft"
        >
          <X size={12} /> بلا أولوية
        </button>
      </Popover>
    </div>
  );
}
