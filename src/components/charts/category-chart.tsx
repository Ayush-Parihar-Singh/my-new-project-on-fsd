"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function CategoryChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <div role="img" aria-label={`Listings by category: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#E3E8E1" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#5C6B64" }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12, fill: "#1E2A25" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E3E8E1", fontSize: 12 }} cursor={{ fill: "#EEF5F1" }} />
          <Bar dataKey="count" name="Listings" fill="#245C45" radius={[0, 8, 8, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
