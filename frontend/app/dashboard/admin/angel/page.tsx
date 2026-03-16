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
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_angel: boolean;
  created_at: string;
}

export default function AngelManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAngelFilter, setIsAngelFilter] = useState<boolean | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

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
        u.id === user.id ? { ...u, is_angel: data.is_angel } : u
      ));
      
      toast.success(data.message);
    } catch (error) {
      console.error(error);
      toast.error('更換天使身份失敗');
    } finally {
      setTogglingId(null);
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
          <p className="text-gray-500 mt-2">僅超級管理員可見，用於管理天使投資人帳戶權限</p>
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
            <button
              onClick={() => setIsAngelFilter(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isAngelFilter === false 
                ? 'bg-gray-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              非天使
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
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">身份</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">加入時間</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{user.full_name || '未填寫姓名'}</span>
                        <span className="text-sm text-gray-500">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {user.is_admin && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            <ShieldAlert className="h-3 w-3 mr-1" />
                            管理員
                          </span>
                        )}
                        {user.is_angel ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            天使投資人
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            一般用戶
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleAngelStatus(user)}
                        disabled={togglingId === user.id}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          user.is_angel 
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200' 
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        } disabled:opacity-50`}
                      >
                        {togglingId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : user.is_angel ? (
                          <>
                            <ToggleRight className="h-4 w-4 text-orange-500" />
                            取消天使
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4" />
                            設為天使
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
    </div>
  );
}
