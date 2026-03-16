"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  Tag, 
  FileText,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import Link from "next/link";

const ExpensesPage = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    item_name: "",
    amount: "",
    category: "cloud",
    description: "",
    expense_date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      // Check admin status
      const balanceRes = await api.get("/credits/balance");
      setIsAdmin(balanceRes.data.is_super_admin === true);

      // Fetch expenses
      const response = await api.get("/admin/expenses");
      if (response.data.success) {
        setExpenses(response.data.expenses);
      }
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      toast.error("無法獲取數據");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post("/admin/expenses", {
        ...newExpense,
        amount: parseFloat(newExpense.amount)
      });
      if (response.data.success) {
        toast.success("支出紀錄已新增");
        setShowAddModal(false);
        setNewExpense({
          item_name: "",
          amount: "",
          category: "cloud",
          description: "",
          expense_date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
        });
        fetchData();
      }
    } catch (err: any) {
      console.error("Failed to add expense:", err);
      toast.error("新增失敗，請檢查欄位資料");
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm("確定要刪除此筆紀錄嗎？")) return;
    try {
      const response = await api.delete(`/admin/expenses/${id}`);
      if (response.data.success) {
        toast.success("紀錄已刪除");
        fetchData();
      }
    } catch (err: any) {
      console.error("Failed to delete expense:", err);
      toast.error("刪除失敗");
    }
  };

  const categories = [
    { value: "cloud", label: "雲端基礎設施" },
    { value: "gpu", label: "GPU 算力" },
    { value: "ad", label: "廣告行銷" },
    { value: "fine-tune", label: "模型微調" },
    { value: "domain", label: "網域與網頁" },
    { value: "other", label: "雜項支出" },
  ];

  if (loading && expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
        <p>正在讀取數據...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#0a0b14] min-h-screen text-slate-100">
      <div className="mb-6">
        <Link 
          href="/dashboard/angel" 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-medium group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          返回天使儀表板
        </Link>
      </div>

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            平台支出紀錄表
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isAdmin ? "超級管理員模式：您可以填寫與維護營運支出" : "天使投資人模式：檢視平台各項營運成本與支出明細"}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            新增支出
          </button>
        )}
      </div>

      <div className="bg-[#11121d] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#161826] text-slate-400 text-xs uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-4 border-b border-white/5">日期</th>
                <th className="px-6 py-4 border-b border-white/5">項目名稱</th>
                <th className="px-6 py-4 border-b border-white/5">分類</th>
                <th className="px-6 py-4 border-b border-white/5">金額 (NT$)</th>
                <th className="px-6 py-4 border-b border-white/5">說明</th>
                {isAdmin && <th className="px-6 py-4 border-b border-white/5 text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-20 text-center text-slate-500">
                    目前暫無支出紀錄
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-400">
                      {format(new Date(expense.expense_date), "yyyy/MM/dd", { locale: zhTW })}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      {expense.item_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-500/20">
                        {categories.find(c => c.value === expense.category)?.label || expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-rose-400 text-lg">
                      {parseFloat(expense.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                      {expense.description || "-"}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-[#161826]/50">
              <tr>
                <td colSpan={3} className="px-6 py-5 font-bold text-slate-400">總計本月支出</td>
                <td className="px-6 py-5 font-mono font-extrabold text-white text-xl">
                  NT$ {expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toLocaleString()}
                </td>
                <td colSpan={isAdmin ? 2 : 1}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#11121d] border border-white/10 w-full max-w-md rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Plus className="text-indigo-400" />
                新增支出紀錄
              </h3>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <FileText className="w-3 h-3" /> 項目名稱
                </label>
                <input
                  required
                  type="text"
                  placeholder="例如: AWS 伺服器費用"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                  value={newExpense.item_name}
                  onChange={(e) => setNewExpense({...newExpense, item_name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <DollarSign className="w-3 h-3" /> 金額
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Tag className="w-3 h-3" /> 分類
                  </label>
                  <select
                    className="w-full bg-[#161826] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                  >
                    {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> 支出日期
                </label>
                <input
                  required
                  type="datetime-local"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                  value={newExpense.expense_date}
                  onChange={(e) => setNewExpense({...newExpense, expense_date: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" /> 備註說明
                </label>
                <textarea
                  placeholder="選填項目細節..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all min-h-[80px]"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 px-4 py-3 rounded-xl font-bold transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 px-4 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
                >
                  確認新增
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
