"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  CreditCard,
  Camera,
  Loader2,
  RefreshCw,
  Flag,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface Verification {
  id: number;
  user_id: number;
  user_email: string;
  real_name: string;
  id_number_masked: string;
  status: string;
  risk_flags: string[];
  is_duplicate_id: boolean;
  created_at: string;
  reviewed_at: string | null;
}

interface Stats {
  pending: number;
  reviewing: number;
  approved: number;
  rejected: number;
}

interface VerificationDetail {
  id: number;
  user_id: number;
  user_email: string;
  user_created_at: string;
  real_name: string;
  id_number: string;
  birth_date: string | null;
  gender: string | null;
  status: string;
  id_front_image: string;
  id_back_image: string;
  selfie_image: string;
  risk_flags: string[];
  is_duplicate_id: boolean;
  duplicate_users: any[];
  auto_check_result: any;
  auto_check_score: number | null;
  review_note: string | null;
  reject_reason: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  ip_address: string | null;
}

export default function AdminVerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, reviewing: 0, approved: 0, rejected: 0 });
  const [total, setTotal] = useState(0);
  
  // 篩選
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 審核對話框
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<VerificationDetail | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [secondaryPassword, setSecondaryPassword] = useState("");
  const [reviewing, setReviewing] = useState(false);
  
  // 圖片預覽
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        status_filter: statusFilter,
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      });
      if (search) params.append("search", search);

      const response = await fetch(`${API_URL}/verification/admin/list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 403) {
          router.push("/dashboard");
          return;
        }
        throw new Error("Failed to fetch");
      }

      const data = await response.json();
      setVerifications(data.verifications);
      setStats(data.stats);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching verifications:", error);
    } finally {
      setLoading(false);
    }
  }, [API_URL, statusFilter, search, page, router]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const openReviewDialog = async (verificationId: number) => {
    setReviewLoading(true);
    setReviewDialogOpen(true);
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/verification/admin/${verificationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedVerification(data.verification);
        
        // 如果是 pending 狀態，標記為 reviewing
        if (data.verification.status === "pending") {
          await fetch(`${API_URL}/verification/admin/${verificationId}/start-review`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    } catch (error) {
      console.error("Error fetching verification detail:", error);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReview = async (action: "approve" | "reject") => {
    if (!selectedVerification) return;
    
    if (action === "reject" && !rejectReason) {
      alert("請輸入駁回原因");
      return;
    }
    
    if (!secondaryPassword) {
      alert("請輸入二次驗證密碼");
      return;
    }

    setReviewing(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/verification/admin/${selectedVerification.id}/review`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          review_note: reviewNote || null,
          reject_reason: action === "reject" ? rejectReason : null,
          secondary_password: secondaryPassword,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(data.message || "審核完成");
        setReviewDialogOpen(false);
        setSelectedVerification(null);
        setReviewNote("");
        setRejectReason("");
        setSecondaryPassword("");
        fetchVerifications();
      } else {
        alert(data.detail || "審核失敗");
      }
    } catch (error) {
      console.error("Error reviewing:", error);
      alert("審核失敗");
    } finally {
      setReviewing(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "待審核" },
      reviewing: { variant: "secondary", label: "審核中" },
      approved: { variant: "default", label: "已通過" },
      rejected: { variant: "destructive", label: "已駁回" },
    };
    const c = config[status] || { variant: "outline" as const, label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            身份認證審核
          </h1>
          <p className="text-muted-foreground mt-1">
            審核用戶提交的身份認證資料
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchVerifications()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={statusFilter === "pending" ? "border-primary" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">待審核</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 w-full"
              onClick={() => { setStatusFilter("pending"); setPage(1); }}
            >
              查看
            </Button>
          </CardContent>
        </Card>
        
        <Card className={statusFilter === "reviewing" ? "border-primary" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">審核中</p>
                <p className="text-2xl font-bold">{stats.reviewing}</p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 w-full"
              onClick={() => { setStatusFilter("reviewing"); setPage(1); }}
            >
              查看
            </Button>
          </CardContent>
        </Card>
        
        <Card className={statusFilter === "approved" ? "border-primary" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已通過</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 w-full"
              onClick={() => { setStatusFilter("approved"); setPage(1); }}
            >
              查看
            </Button>
          </CardContent>
        </Card>
        
        <Card className={statusFilter === "rejected" ? "border-primary" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已駁回</p>
                <p className="text-2xl font-bold">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 w-full"
              onClick={() => { setStatusFilter("rejected"); setPage(1); }}
            >
              查看
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 搜尋與篩選 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋 Email 或姓名..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="pending">待審核</SelectItem>
                <SelectItem value="reviewing">審核中</SelectItem>
                <SelectItem value="approved">已通過</SelectItem>
                <SelectItem value="rejected">已駁回</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <CardHeader>
          <CardTitle>認證申請列表</CardTitle>
          <CardDescription>
            共 {total} 筆記錄
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : verifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3" />
              <p>目前沒有{statusFilter === "all" ? "" : getStatusBadge(statusFilter).props.children}的認證申請</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>用戶</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>身份證</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>風險標記</TableHead>
                    <TableHead>提交時間</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifications.map((v) => (
                    <TableRow key={v.id} className={v.is_duplicate_id ? "bg-red-500/5" : ""}>
                      <TableCell>#{v.id}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">#{v.user_id}</div>
                          <div className="text-xs text-muted-foreground">{v.user_email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{v.real_name}</TableCell>
                      <TableCell className="font-mono">{v.id_number_masked}</TableCell>
                      <TableCell>{getStatusBadge(v.status)}</TableCell>
                      <TableCell>
                        {v.is_duplicate_id && (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <Flag className="h-3 w-3" />
                            重複身份證
                          </Badge>
                        )}
                        {v.risk_flags.length > 0 && !v.is_duplicate_id && (
                          <Badge variant="outline" className="text-yellow-500">
                            {v.risk_flags.length} 風險
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(v.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          onClick={() => openReviewDialog(v.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {v.status === "pending" || v.status === "reviewing" ? "審核" : "查看"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分頁 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    第 {page} / {totalPages} 頁
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 審核對話框 */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>身份認證審核</DialogTitle>
            <DialogDescription>
              仔細核對用戶提交的身份資料
            </DialogDescription>
          </DialogHeader>

          {reviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedVerification && (
            <div className="space-y-6">
              {/* 風險警告 */}
              {selectedVerification.is_duplicate_id && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <h4 className="font-semibold text-red-500 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    重複身份證警告
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    此身份證號已被其他帳號使用，請謹慎審核
                  </p>
                  {selectedVerification.duplicate_users.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">相關帳號：</p>
                      <ul className="text-sm text-muted-foreground">
                        {selectedVerification.duplicate_users.map((u: any) => (
                          <li key={u.id}>
                            用戶 #{u.id} - {u.email} (註冊於 {formatDate(u.created_at)})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 用戶資訊 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground">用戶 ID</Label>
                  <p className="font-medium">#{selectedVerification.user_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedVerification.user_email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">用戶註冊時間</Label>
                  <p className="font-medium">{formatDate(selectedVerification.user_created_at)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">提交 IP</Label>
                  <p className="font-medium font-mono">{selectedVerification.ip_address || "-"}</p>
                </div>
              </div>

              {/* 身份資料 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-muted-foreground">真實姓名</Label>
                  <p className="font-medium text-lg">{selectedVerification.real_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">身份證字號</Label>
                  <p className="font-medium text-lg font-mono">{selectedVerification.id_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">出生日期</Label>
                  <p className="font-medium">{selectedVerification.birth_date || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">性別</Label>
                  <p className="font-medium">
                    {selectedVerification.gender === "M" ? "男" : 
                     selectedVerification.gender === "F" ? "女" : "-"}
                  </p>
                </div>
              </div>

              {/* 照片 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    身份證正面
                  </Label>
                  <div 
                    className="border rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => setPreviewImage(selectedVerification.id_front_image)}
                  >
                    <img 
                      src={selectedVerification.id_front_image} 
                      alt="身份證正面"
                      className="w-full h-48 object-contain bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    身份證反面
                  </Label>
                  <div 
                    className="border rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => setPreviewImage(selectedVerification.id_back_image)}
                  >
                    <img 
                      src={selectedVerification.id_back_image} 
                      alt="身份證反面"
                      className="w-full h-48 object-contain bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    手持身份證自拍
                  </Label>
                  <div 
                    className="border rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => setPreviewImage(selectedVerification.selfie_image)}
                  >
                    <img 
                      src={selectedVerification.selfie_image} 
                      alt="手持自拍"
                      className="w-full h-48 object-contain bg-muted"
                    />
                  </div>
                </div>
              </div>

              {/* 審核操作 */}
              {(selectedVerification.status === "pending" || selectedVerification.status === "reviewing") && (
                <>
                  <div className="space-y-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label>審核備註（內部，不顯示給用戶）</Label>
                      <Textarea
                        placeholder="輸入內部備註..."
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>駁回原因（如要駁回，必填）</Label>
                      <Textarea
                        placeholder="輸入駁回原因，此內容會顯示給用戶..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-amber-500">二次驗證密碼</Label>
                      <Input
                        type="password"
                        placeholder="請輸入二次驗證密碼"
                        value={secondaryPassword}
                        onChange={(e) => setSecondaryPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        此操作需要超級管理員二次密碼驗證
                      </p>
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setReviewDialogOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReview("reject")}
                      disabled={reviewing || !secondaryPassword}
                    >
                      {reviewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                      駁回
                    </Button>
                    <Button
                      onClick={() => handleReview("approve")}
                      disabled={reviewing || !secondaryPassword}
                    >
                      {reviewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      通過
                    </Button>
                  </DialogFooter>
                </>
              )}

              {/* 已審核的記錄 */}
              {selectedVerification.status === "approved" && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <h4 className="font-semibold text-green-500 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    認證已通過
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    審核時間：{formatDate(selectedVerification.reviewed_at)}
                  </p>
                  {selectedVerification.review_note && (
                    <p className="text-sm mt-2">備註：{selectedVerification.review_note}</p>
                  )}
                </div>
              )}

              {selectedVerification.status === "rejected" && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <h4 className="font-semibold text-red-500 flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    認證已駁回
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    審核時間：{formatDate(selectedVerification.reviewed_at)}
                  </p>
                  <p className="text-sm mt-2">駁回原因：{selectedVerification.reject_reason}</p>
                  {selectedVerification.review_note && (
                    <p className="text-sm mt-1">內部備註：{selectedVerification.review_note}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 圖片預覽對話框 */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>圖片預覽</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img src={previewImage} alt="預覽" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
