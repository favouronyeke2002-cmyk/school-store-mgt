import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { adminAPI } from '../../lib/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [classRevenue, setClassRevenue] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [inventoryValuation, setInventoryValuation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
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
      setInventoryValuation(i);
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  const formatCurrency = (n: number) => `N${n?.toLocaleString() || 0}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Overview of store performance</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="px-3 py-2 border rounded-md">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: formatCurrency(stats?.totalRevenue) },
          { label: 'Store Revenue', value: formatCurrency(stats?.storeRevenue) },
          { label: 'Fees Collected', value: formatCurrency(stats?.feesCollected) },
          { label: 'Net Profit', value: formatCurrency(stats?.profit), sub: `${stats?.profitMargin}% margin` },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-5">
            <div className="text-sm text-gray-500 mb-1">{s.label}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            {s.sub && <div className="text-sm text-success-600">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'COGS', value: formatCurrency(stats?.cogs) },
          { label: 'Outstanding Fees', value: formatCurrency(stats?.uncollectedFees) },
          { label: 'Transactions', value: stats?.transactionCount || 0 },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-5">
            <div className="text-sm text-gray-500 mb-1">{s.label}</div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Daily Sales Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Daily Sales Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tickFormatter={(v) => `N${v / 1000}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Line type="monotone" dataKey="store_sales" stroke="#3b82f6" strokeWidth={2} name="Store" />
              <Line type="monotone" dataKey="fees_collected" stroke="#10b981" strokeWidth={2} name="Fees" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Class */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Revenue by Class</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={classRevenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `N${v / 1000}k`} />
              <YAxis dataKey="student_class" type="category" width={60} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Bar dataKey="total_revenue" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Top Products</h2>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-3">{p.item_name}</td>
                  <td className="px-4 py-3 text-right">{p.total_quantity}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inventory Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Inventory Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Total Items</div>
              <div className="text-2xl font-bold">{inventoryValuation?.item_count || 0}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Total Units</div>
              <div className="text-2xl font-bold">{inventoryValuation?.total_units?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Cost Value</div>
              <div className="text-2xl font-bold">{formatCurrency(inventoryValuation?.total_cost_value)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Retail Value</div>
              <div className="text-2xl font-bold text-success-600">{formatCurrency(inventoryValuation?.total_retail_value)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
