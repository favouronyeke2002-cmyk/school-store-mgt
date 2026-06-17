import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Package, AlertCircle, Users, ArrowUpRight } from 'lucide-react';
import { adminAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`;
  return `₦${n.toFixed(0)}`;
};

const StatCard: React.FC<{ label: string; value: string; sub?: string; color?: string; icon: React.ReactNode }> = ({ label, value, sub, color = 'text-gray-900', icon }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-extrabold truncate ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-xl shadow-lg p-3 text-sm">
      <div className="font-semibold text-gray-700 mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [classRevenue, setClassRevenue] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [inventoryVal, setInventoryVal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      adminAPI.getStats(),
      adminAPI.getDailySales(period),
      adminAPI.getClassRevenue(),
      adminAPI.getTopProducts(10),
      adminAPI.getInventoryValuation(),
    ]).then(([s, d, c, p, i]) => {
      setStats(s);
      setDailySales(d);
      setClassRevenue(c);
      setTopProducts(p);
      setInventoryVal(i);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [period]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  const netProfit = stats?.profit || 0;
  const storeRevenue = stats?.storeRevenue || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Sales Summary</h1>
          <p className="text-sm text-gray-400 mt-0.5">Store performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setPeriod(d)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${period === d ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {d === 7 ? '7 days' : d === 30 ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
          <button onClick={loadData} className="px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50 text-gray-600">
            Refresh
          </button>
        </div>
      </div>

      {/* Top stat strip (Loyverse-style) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-5 divide-x">
          {[
            { label: 'Gross Sales', value: fmt(stats?.storeRevenue || 0), color: 'text-gray-900' },
            { label: 'Fees Collected', value: fmt(stats?.feesCollected || 0), color: 'text-gray-900' },
            { label: 'Cost of Goods', value: fmt(stats?.cogs || 0), color: 'text-gray-900' },
            { label: 'Net Sales', value: fmt(storeRevenue - (stats?.cogs || 0)), color: 'text-primary-700' },
            { label: 'Gross Profit', value: fmt(netProfit), color: netProfit >= 0 ? 'text-success-700' : 'text-danger-700' },
          ].map((item) => (
            <div key={item.label} className="px-5 py-4">
              <div className="text-xs text-gray-400 font-medium mb-1">{item.label}</div>
              <div className={`text-xl font-extrabold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Outstanding Fees" value={fmt(stats?.uncollectedFees || 0)} color="text-danger-700" icon={<AlertCircle className="w-5 h-5 text-danger-500" />} sub="Unpaid across all students" />
        <StatCard label="Transactions" value={(stats?.transactionCount || 0).toLocaleString()} color="text-gray-900" icon={<ShoppingBag className="w-5 h-5 text-primary-500" />} />
        <StatCard label="Profit Margin" value={`${stats?.profitMargin || 0}%`} color={Number(stats?.profitMargin) >= 0 ? 'text-success-700' : 'text-danger-700'} icon={<TrendingUp className="w-5 h-5 text-success-500" />} />
        <StatCard label="Inventory Value" value={fmt(inventoryVal?.total_retail_value || 0)} icon={<Package className="w-5 h-5 text-warning-500" />} sub={`${inventoryVal?.item_count || 0} items · ${inventoryVal?.total_units?.toLocaleString() || 0} units`} />
      </div>

      {/* Area Chart: Gross Sales over time */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Gross Sales Trend</h2>
          <span className="text-xs text-gray-400">Last {period} days</span>
        </div>
        {dailySales.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailySales} margin={{ top: 5, right: 0, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="storeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="feesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="store_sales" name="Store Sales" stroke="#3b82f6" strokeWidth={2} fill="url(#storeFill)" dot={{ r: 3, fill: '#3b82f6' }} />
              <Area type="monotone" dataKey="fees_collected" name="Fees Collected" stroke="#10b981" strokeWidth={2} fill="url(#feesFill)" dot={{ r: 3, fill: '#10b981' }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two-column: Revenue by Class + Top Products */}
      <div className="grid grid-cols-2 gap-6">
        {/* Revenue by class */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Revenue by Class</h2>
          {classRevenue.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={classRevenue} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis dataKey="student_class" type="category" width={52} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_revenue" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Products table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Top Products</h2>
          {topProducts.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No sales data yet</div>
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 8).map((p, i) => {
                const pct = topProducts[0]?.total_revenue > 0 ? (p.total_revenue / topProducts[0].total_revenue) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium text-gray-700 truncate">{p.item_name}</span>
                        <span className="text-sm font-bold text-gray-900 ml-2 shrink-0">{fmt(p.total_revenue)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{p.total_quantity} units</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Daily breakdown table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Daily Breakdown</h2>
          <span className="text-xs text-gray-400">Rows: {dailySales.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Store Sales', 'Fees Collected', 'Total'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dailySales.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-300">No data for this period</td></tr>
              ) : dailySales.map((row, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{row.date}</td>
                  <td className="px-5 py-3 text-primary-700 font-semibold">{fmt(row.store_sales)}</td>
                  <td className="px-5 py-3 text-success-700 font-semibold">{fmt(row.fees_collected)}</td>
                  <td className="px-5 py-3 font-extrabold text-gray-900">{fmt(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
