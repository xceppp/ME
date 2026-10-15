"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data, label }: { data: { date: string; value: number }[]; label: string }) {
  if (data.length === 0) return <p className="text-sm text-muted">No {label.toLowerCase()} ratings in this range.</p>;
  return (
    <div className="h-56 w-full" role="img" aria-label={`${label} trend`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#283444" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#96A3B3", fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis domain={[1, 10]} tick={{ fill: "#96A3B3", fontSize: 11 }} width={28} />
          <Tooltip />
          <Line type="monotone" dataKey="value" name={label} stroke="#8FBFA8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeekChart({ data }: { data: { week: string; completed: number; eligible: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-muted">No weekly habit data yet.</p>;
  return (
    <div className="h-56 w-full" role="img" aria-label="Weekly habit completion">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#283444" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: "#96A3B3", fontSize: 11 }} />
          <YAxis tick={{ fill: "#96A3B3", fontSize: 11 }} width={28} />
          <Tooltip />
          <Bar dataKey="completed" name="Completed" fill="#8FBFA8" radius={6} />
          <Bar dataKey="eligible" name="Eligible" fill="#283444" radius={6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
