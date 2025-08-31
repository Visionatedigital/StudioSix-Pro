import React, { useEffect, useState } from 'react';

const AdminCreditsPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grant, setGrant] = useState({ email: '', amount: 10 });

  const adminEmail = 'visionatedigital@gmail.com';

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const r = await fetch('/api/admin/credits', { headers: { 'X-Admin-Email': adminEmail } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed');
      setUsers(j.users || []);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  async function handleGrant(e) {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Email': adminEmail },
        body: JSON.stringify({ email: grant.email, amount: grant.amount })
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Grant failed');
      await fetchData();
      setGrant({ email: '', amount: 10 });
      alert(`Granted ${j.newBal} total renders to ${j.email}`);
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) return <div className="p-6 text-white">Loading…</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Admin: Render Credits</h1>
      <form onSubmit={handleGrant} className="mb-6 flex gap-2 items-end">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input value={grant.email} onChange={e=>setGrant({ ...grant, email: e.target.value })} className="px-3 py-2 rounded bg-slate-800 border border-slate-700" placeholder="user@example.com" />
        </div>
        <div>
          <label className="block text-sm mb-1">Amount</label>
          <input type="number" value={grant.amount} onChange={e=>setGrant({ ...grant, amount: parseInt(e.target.value||'0',10) })} className="w-24 px-3 py-2 rounded bg-slate-800 border border-slate-700" />
        </div>
        <button className="px-4 py-2 bg-studiosix-600 rounded">Grant</button>
      </form>
      <div className="overflow-auto border border-slate-700 rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Credits</th>
              <th className="text-left p-2">Renders this month</th>
              <th className="text-left p-2">Lifetime renders</th>
            </tr>
          </thead>
          <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-t border-slate-800">
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.render_credits || 0}</td>
              <td className="p-2">{u.usage_image_renders_this_month || 0}</td>
              <td className="p-2">{u.total_image_renders_used || 0}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCreditsPage;


