"use client";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  day: string;
  published: number;
  completed: number;
}

/** Daily published vs completed listings. Values are counts from the database. */
export function TrendChart({ data, label }: { data: TrendPoint[]; label: string }) {
  const rows = data.map((d) => ({ ...d, label: new Date(d.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) }));
  return (
    <div role="img" aria-label={`${label}. ${rows.length} days shown.`} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gPub" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#245C45" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#245C45" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E3E8E1" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5C6B64" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5C6B64" }} tickLine={false} axisLine={false} width={32} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E3E8E1", fontSize: 12 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="published" name="Published" stroke="#245C45" fill="url(#gPub)" strokeWidth={2} />
          <Area type="monotone" dataKey="completed" name="Completed" stroke="#E98770" fill="#E98770" fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
