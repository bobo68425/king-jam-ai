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
  X
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
  };

  const handleSaveProfile = async () => {
    if (!editingUser) return;
    try {
      setIsSavingProfile(true);
      const response = await api.post(`/admin/users/${editingUser.id}/set-angel-profile`, {
        phone: editPhone,
        note: editNote
      });
      
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id ? { ...u, angel_phone: editPhone, angel_note: editNote } : u
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="text-blue-600 h-8 w-8" />
            天使投資人管理
          </h1>
          <p className="text-gray-500 mt-2">僅超級管理員可見，負責管理天使權限、持股單位與聯絡資料。</p>
        </div>
      </div>

      {/* 篩選與搜尋 */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <form onSubmit={handleSearch} className="relative flex-grow w-full">
            <input
              type="text"
              placeholder="搜尋 Email 或 姓名..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 text-gray-400 h-5 w-5" />
          </form>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsAngelFilter(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isAngelFilter === null 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setIsAngelFilter(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isAngelFilter === true 
                ? 'bg-orange-500 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              僅天使
            </button>
          </div>
        </div>
      </div>

      {/* 用戶列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">用戶</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">投資人資料 / 權限</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">投資單位</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{user.full_name || '未填寫姓名'}</span>
                        <span className="text-sm text-gray-500">{user.email}</span>
                        <span className="text-[10px] text-gray-400 mt-1 uppercase">
                          ID: {user.id} | 加入: {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          {user.is_admin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 uppercase">
                              ADMIN
                            </span>
                          )}
                          {user.is_angel && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 uppercase">
                              ANGEL
                            </span>
                          )}
                        </div>
                        {user.is_angel && (
                          <div className="space-y-1">
                            {user.angel_phone && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                <Phone className="h-3 w-3" />
                                {user.angel_phone}
                              </div>
                            )}
                            {user.angel_note && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-400 italic bg-gray-50 p-1 rounded border border-gray-100">
                                <FileText className="h-3 w-3" />
                                {user.angel_note.length > 30 ? user.angel_note.substring(0, 30) + '...' : user.angel_note}
                              </div>
                            )}
                            <button 
                              onClick={() => handleOpenEdit(user)}
                              className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 mt-1"
                            >
                              <Edit3 className="h-3 w-3" /> 編輯投資人資料
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.is_angel ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            className="w-16 px-2 py-1 border border-gray-200 rounded text-sm font-mono outline-none focus:ring-2 focus:ring-orange-500"
                            defaultValue={user.investment_units}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val !== user.investment_units) {
                                handleUpdateUnits(user.id, val);
                              }
                            }}
                            disabled={updatingUnitsId === user.id}
                          />
                          <span className="text-xs text-slate-500 font-bold">單位</span>
                          <span className="text-[10px] text-slate-400">({user.investment_units}%)</span>
                          {updatingUnitsId === user.id && <Loader2 className="h-3 w-3 animate-spin text-orange-500" />}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">尚未授權</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleAngelStatus(user)}
                        disabled={togglingId === user.id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          user.is_angel 
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200' 
                          : 'bg-orange-600 text-white hover:bg-orange-500 shadow-sm'
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                編輯投資人資料
              </h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">{editingUser.full_name}</p>
                <p className="text-xs text-gray-500 font-mono">{editingUser.email}</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    聯絡電話 (Angel Phone)
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="例如: 0912-345-678"
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    內部備註 (Admin Note)
                  </label>
                  <div className="relative">
                    <textarea 
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="合約備註、特殊分紅調整..."
                      rows={4}
                      className="w-full pt-2 pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <FileText className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50"
                  disabled={isSavingProfile}
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveProfile}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 flex items-center justify-center gap-2"
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
