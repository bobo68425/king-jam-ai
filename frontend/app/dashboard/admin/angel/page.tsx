'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldAlert, 
  ToggleLeft, 
  ToggleRight, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Phone,
  FileText,
  Edit3,
  X,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_angel: boolean;
  investment_units: number;
  angel_phone?: string | null;
  angel_note?: string | null;
  referral_code: string | null;
  created_at: string;
}

export default function AngelManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAngelFilter, setIsAngelFilter] = useState<boolean | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [updatingUnitsId, setUpdatingUnitsId] = useState<number | null>(null);
  
  // Modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editReferralCode, setEditReferralCode] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const fetchUsers = async () => {
    try {
      let url = `/admin/users?limit=100`;
      if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;
      if (isAngelFilter !== null) url += `&is_angel=${isAngelFilter}`;

      const response = await api.get(url);
      const data = response.data;
      setUsers(data.users);
    } catch (error) {
      console.error(error);
      toast.error('無法取得用戶數據');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isAngelFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const toggleAngelStatus = async (user: User) => {
    try {
      setTogglingId(user.id);
      const url = `/admin/users/${user.id}/toggle-angel`;
      const response = await api.post(url);
      const data = response.data;
      
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, is_angel: data.is_angel, investment_units: data.investment_units } : u
      ));
      
      toast.success(data.message);
    } catch (error) {
      console.error(error);
      toast.error('更換天使身份失敗');
    } finally {
      setTogglingId(null);
    }
  };

  const handleUpdateUnits = async (user_id: number, units: number) => {
    try {
      setUpdatingUnitsId(user_id);
      const response = await api.post(`/admin/users/${user_id}/set-investment-units`, { units });
      const data = response.data;
      
      setUsers(prev => prev.map(u => 
        u.id === user_id ? { ...u, investment_units: data.investment_units } : u
      ));
      
      toast.success(data.message);
    } catch (error) {
      console.error(error);
      toast.error('更新投資單位失敗');
    } finally {
      setUpdatingUnitsId(null);
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditPhone(user.angel_phone || '');
    setEditNote(user.angel_note || '');
    setEditReferralCode(user.referral_code || '');
  };

  const handleSaveProfile = async () => {
    if (!editingUser) return;
    try {
      setIsSavingProfile(true);
      const response = await api.post(`/admin/users/${editingUser.id}/set-angel-profile`, {
        phone: editPhone,
        note: editNote,
        referral_code: editReferralCode
      });
      
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id ? { ...u, angel_phone: editPhone, angel_note: editNote, referral_code: editReferralCode } : u
      ));
      
      toast.success('資料更新成功');
      setEditingUser(null);
    } catch (error) {
      console.error(error);
      toast.error('更新資料失敗');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
        <div className="relative">
          <div className="flex items-center gap-5 mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
              <div className="relative flex items-center justify-center h-14 w-14 rounded-2xl bg-[#1a1c2e] border border-blue-500/30 shadow-2xl shadow-blue-500/20">
                <Shield className="text-blue-400 h-7 w-7 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-3">
                天使投資人管理
              </h1>
              <div className="flex items-center gap-3 mt-1.5 font-bold">
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-tighter">
                  Super Admin
                </span>
                <span className="text-slate-500 text-sm">系統層級存取控制</span>
              </div>
            </div>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed font-medium">
            僅超級管理員可見，負責管理天使權限、持股單位與聯絡資料。
          </p>
        </div>

      {/* Investment Summary Stats */}
      {!loading && users.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#11121d] border border-white/5 p-4 rounded-2xl shadow-xl flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">已核准天使</p>
              <p className="text-2xl font-black text-white">{users.filter(u => u.is_angel).length} <span className="text-sm text-slate-500 font-medium">位</span></p>
            </div>
          </div>
          <div className="bg-[#11121d] border border-white/5 p-4 rounded-2xl shadow-xl flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <ToggleRight className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">總持股佔比</p>
              <p className="text-2xl font-black text-white">{users.reduce((acc, curr) => acc + (curr.investment_units || 0), 0)} <span className="text-sm text-slate-500 font-medium">%</span></p>
            </div>
          </div>
          <div className="bg-[#11121d] border border-white/5 p-4 rounded-2xl shadow-xl flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">總計畫籌資額</p>
              <p className="text-2xl font-black text-white">
                <span className="text-xs text-emerald-500 mr-1">NT$</span>
                {(users.reduce((acc, curr) => acc + (curr.investment_units || 0), 0) * 200000).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 篩選與搜尋 */}
      <div className="bg-[#11121d] p-5 rounded-2xl shadow-xl mb-6 border border-white/5">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <form onSubmit={handleSearch} className="relative flex-grow w-full">
            <input
              type="text"
              placeholder="搜尋 Email 或 姓名..."
              className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 text-slate-500 h-5 w-5" />
          </form>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsAngelFilter(null)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isAngelFilter === null 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setIsAngelFilter(true)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isAngelFilter === true 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              僅天使
            </button>
          </div>
        </div>
      </div>

      {/* 用戶列表 */}
      <div className="bg-[#11121d] rounded-2xl shadow-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-500 font-medium">載入中...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">找不到匹配的用戶</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">用戶</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">投資人資料 / 權限</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">投資單位</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center text-blue-400 font-black text-sm">
                          {user.full_name ? user.full_name[0].toUpperCase() : '?'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-white group-hover:text-blue-400 transition-colors leading-tight">{user.full_name || '未填寫姓名'}</span>
                          <span className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</span>
                          <div className="flex gap-2 mt-1.5 grayscale group-hover:grayscale-0 transition-all opacity-60 group-hover:opacity-100">
                            <span className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-500 font-mono">ID: {user.id}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-500 font-mono">JOIN: {new Date(user.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-2.5">
                        <div className="flex gap-1.5">
                          {user.is_admin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black tracking-widest uppercase">
                              Super Admin
                            </span>
                          )}
                          {user.is_angel && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] font-black tracking-widest uppercase">
                              Authorized Angel
                            </span>
                          )}
                        </div>
                        
                        {user.is_angel && (
                          <div className="flex flex-col gap-1.5 bg-white/[0.03] border border-white/5 p-2 rounded-xl">
                            <div className="flex items-center gap-2 text-[11px] text-slate-300">
                              <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
                                <Phone className="h-3 w-3 text-blue-400" />
                              </div>
                              <span className="font-bold">{user.angel_phone || '無電話'}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-[11px] text-blue-400 font-mono">
                              <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
                                <Share2 className="h-3 w-3" />
                              </div>
                              <span className="truncate max-w-[180px]">kingjam.app/?ref={user.referral_code || '---'}</span>
                            </div>

                            <button 
                              onClick={() => handleOpenEdit(user)}
                              className="w-full mt-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[9px] text-slate-400 font-black tracking-tight flex items-center justify-center gap-1.5 transition-all"
                            >
                              <Edit3 className="h-2.5 w-2.5" /> 編輯詳細資料與備註
                            </button>
                            
                            {user.angel_note && (
                              <div className="mt-1 pt-1 border-t border-white/5 text-[10px] text-slate-500 italic flex gap-1.5 line-clamp-1">
                                <FileText className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" />
                                {user.angel_note}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {user.is_angel ? (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              className="w-16 px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white font-mono outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-bold"
                              defaultValue={user.investment_units}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val !== user.investment_units) {
                                  handleUpdateUnits(user.id, val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseInt((e.target as HTMLInputElement).value);
                                  if (!isNaN(val) && val !== user.investment_units) {
                                    handleUpdateUnits(user.id, val);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }
                              }}
                              disabled={updatingUnitsId === user.id}
                            />
                            {updatingUnitsId === user.id && (
                              <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                                <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-black uppercase leading-none">單位</span>
                            <span className="text-[11px] text-orange-400 font-mono font-bold leading-none mt-1">{user.investment_units}%</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-700 italic font-medium">尚未授權</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleAngelStatus(user)}
                        disabled={togglingId === user.id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          user.is_angel 
                          ? 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10' 
                          : 'bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20'
                        } disabled:opacity-50`}
                      >
                        {togglingId === user.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : user.is_angel ? (
                          <>
                            <ToggleRight className="h-4 w-4 text-orange-500" />
                            撤銷身份
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4" />
                            授權天使
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1c2e] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center">
              <h3 className="text-white font-extrabold flex items-center gap-2 tracking-tight">
                <Edit3 className="h-5 w-5" />
                編輯投資人資料
              </h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-1 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                <p className="text-base font-bold text-white mb-0.5">{editingUser.full_name}</p>
                <p className="text-xs text-slate-400 font-mono tracking-wider">{editingUser.email}</p>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
                    聯絡電話 (Angel Phone)
                  </label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="例如: 0912-345-678"
                      className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-2xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all group-hover:border-white/20"
                    />
                    <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
                    推廣推薦代碼 (Referral Code)
                  </label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={editReferralCode}
                      onChange={(e) => setEditReferralCode(e.target.value)}
                      placeholder="例如: BOSS-JAM"
                      className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-2xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono group-hover:border-white/20"
                    />
                    <Share2 className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 px-1 italic">
                    專屬連結: <span className="text-blue-400/80">https://kingjam.app/?ref={editReferralCode || '...'}</span>
                  </p>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
                    內部備註 (Admin Note)
                  </label>
                  <div className="relative group">
                    <textarea 
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="合約備註、特殊分紅調整..."
                      rows={3}
                      className="w-full pt-3 pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-2xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all group-hover:border-white/20 resize-none"
                    />
                    <FileText className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl text-sm font-bold hover:bg-white/10 transition-all"
                  disabled={isSavingProfile}
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveProfile}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-extrabold hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                  disabled={isSavingProfile}
                >
                  {isSavingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                  儲存更新
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
