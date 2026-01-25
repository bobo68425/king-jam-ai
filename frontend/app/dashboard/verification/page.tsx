"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Upload,
  Camera,
  Shield,
  FileText,
  User,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Info,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface VerificationStatus {
  has_verification: boolean;
  status: string | null;
  real_name: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  can_resubmit: boolean;
  is_verified: boolean;
  verified_at: string | null;
}

export default function VerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [showForm, setShowForm] = useState(false);

  // 表單資料
  const [realName, setRealName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [showIdNumber, setShowIdNumber] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  
  // 圖片
  const [idFrontImage, setIdFrontImage] = useState<string | null>(null);
  const [idBackImage, setIdBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  
  // 圖片預覽
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/verification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // API 返回的結構是 { identity: { status, is_verified, ... } }
        const identity = data.identity || {};
        const mappedStatus: VerificationStatus = {
          has_verification: !!identity.status,
          status: identity.status || null,
          real_name: identity.real_name || null,
          submitted_at: identity.submitted_at || null,
          reviewed_at: identity.reviewed_at || null,
          reject_reason: identity.rejection_reason || null,
          can_resubmit: identity.status === "rejected" || identity.status === "supplement_required",
          is_verified: identity.is_verified || false,
          verified_at: identity.verified_at || null,
        };
        setStatus(mappedStatus);
        
        // 如果沒有認證記錄或被駁回，顯示表單
        if (!mappedStatus.has_verification || mappedStatus.can_resubmit) {
          setShowForm(true);
        }
      }
    } catch (error) {
      console.error("Error fetching status:", error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert("圖片大小不能超過 5MB");
      return;
    }

    // 檢查檔案類型
    if (!file.type.startsWith("image/")) {
      alert("請上傳圖片檔案");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setter(base64);
    };
    reader.readAsDataURL(file);
  };

  const validateIdNumber = (id: string): boolean => {
    if (!id || id.length !== 10) return false;
    
    const upper = id.toUpperCase();
    if (!/^[A-Z][12]\d{8}$/.test(upper)) return false;
    
    const letterMap: Record<string, number> = {
      'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15,
      'G': 16, 'H': 17, 'I': 34, 'J': 18, 'K': 19, 'L': 20,
      'M': 21, 'N': 22, 'O': 35, 'P': 23, 'Q': 24, 'R': 25,
      'S': 26, 'T': 27, 'U': 28, 'V': 29, 'W': 32, 'X': 30,
      'Y': 31, 'Z': 33
    };
    
    const letterNum = letterMap[upper[0]];
    const n1 = Math.floor(letterNum / 10);
    const n2 = letterNum % 10;
    
    const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    let total = n1 + n2 * 9;
    
    for (let i = 1; i < upper.length; i++) {
      total += parseInt(upper[i]) * weights[i];
    }
    
    return total % 10 === 0;
  };

  const handleSubmit = async () => {
    // 驗證
    if (!realName.trim()) {
      alert("請輸入真實姓名");
      return;
    }
    
    if (!validateIdNumber(idNumber)) {
      alert("身份證字號格式不正確");
      return;
    }
    
    if (!idFrontImage) {
      alert("請上傳身份證正面照片");
      return;
    }
    
    if (!idBackImage) {
      alert("請上傳身份證反面照片");
      return;
    }
    
    if (!selfieImage) {
      alert("請上傳手持身份證自拍照");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/verification/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          real_name: realName,
          id_number: idNumber.toUpperCase(),
          birth_date: birthDate || null,
          gender: gender || null,
          id_front_image: idFrontImage,
          id_back_image: idBackImage,
          selfie_image: selfieImage,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(data.message || "提交成功");
        fetchStatus();
        setShowForm(false);
      } else {
        alert(data.detail || "提交失敗");
      }
    } catch (error) {
      console.error("Error submitting:", error);
      alert("提交失敗，請稍後再試");
    } finally {
      setSubmitting(false);
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

  const getStatusIcon = (s: string | null) => {
    switch (s) {
      case "approved":
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case "pending":
      case "reviewing":
        return <Clock className="h-6 w-6 text-yellow-500" />;
      case "rejected":
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <AlertCircle className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (s: string | null) => {
    switch (s) {
      case "approved":
        return { label: "已通過", variant: "default" as const };
      case "pending":
        return { label: "待審核", variant: "outline" as const };
      case "reviewing":
        return { label: "審核中", variant: "secondary" as const };
      case "rejected":
        return { label: "已駁回", variant: "destructive" as const };
      default:
        return { label: "未認證", variant: "outline" as const };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          身份認證
        </h1>
        <p className="text-muted-foreground mt-1">
          完成身份認證後可進行提領等操作
        </p>
      </div>

      {/* 認證狀態卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(status?.status || null)}
              認證狀態
            </CardTitle>
            <Badge variant={getStatusLabel(status?.status || null).variant}>
              {getStatusLabel(status?.status || null).label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.is_verified ? (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <div>
                  <h3 className="font-semibold text-green-500">身份認證已通過</h3>
                  <p className="text-sm text-muted-foreground">
                    認證通過時間：{formatDate(status.verified_at)}
                  </p>
                </div>
              </div>
            </div>
          ) : status?.status === "pending" || status?.status === "reviewing" ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="h-10 w-10 text-yellow-500" />
                <div>
                  <h3 className="font-semibold text-yellow-500">
                    {status.status === "reviewing" ? "審核中" : "等待審核"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    提交時間：{formatDate(status.submitted_at)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    通常在 1-3 個工作天內完成審核
                  </p>
                </div>
              </div>
            </div>
          ) : status?.status === "rejected" ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="h-10 w-10 text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-500">認證未通過</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    駁回原因：{status.reject_reason || "未提供"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    審核時間：{formatDate(status.reviewed_at)}
                  </p>
                  <Button 
                    className="mt-3" 
                    onClick={() => setShowForm(true)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新提交
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-10 w-10 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">尚未完成身份認證</h3>
                  <p className="text-sm text-muted-foreground">
                    完成身份認證後可進行提領、退款等操作
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 認證表單 */}
      {showForm && !status?.is_verified && (
        <Card>
          <CardHeader>
            <CardTitle>提交身份認證</CardTitle>
            <CardDescription>
              請準備身份證正反面照片及手持身份證自拍照
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 注意事項 */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-semibold flex items-center gap-2 text-blue-500">
                <Info className="h-4 w-4" />
                認證須知
              </h4>
              <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>請確保照片清晰、完整，四角可見</li>
                <li>手持照需露出完整臉部及身份證正面</li>
                <li>照片大小不超過 5MB</li>
                <li>認證資料僅用於身份驗證，絕不外洩</li>
              </ul>
            </div>

            <Separator />

            {/* 基本資料 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="realName">
                  真實姓名 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="realName"
                  placeholder="請輸入與身份證相同的姓名"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="idNumber">
                  身份證字號 <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="idNumber"
                    type={showIdNumber ? "text" : "password"}
                    placeholder="例如：A123456789"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                    maxLength={10}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShowIdNumber(!showIdNumber)}
                  >
                    {showIdNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {idNumber && !validateIdNumber(idNumber) && (
                  <p className="text-xs text-red-500">身份證字號格式不正確</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">出生日期（選填）</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>性別（選填）</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={gender === "M" ? "default" : "outline"}
                    onClick={() => setGender("M")}
                  >
                    男
                  </Button>
                  <Button
                    type="button"
                    variant={gender === "F" ? "default" : "outline"}
                    onClick={() => setGender("F")}
                  >
                    女
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* 照片上傳 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 身份證正面 */}
              <div className="space-y-2">
                <Label>
                  身份證正面 <span className="text-red-500">*</span>
                </Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    idFrontImage ? "border-green-500 bg-green-500/5" : "border-muted-foreground/25 hover:border-primary"
                  }`}
                  onClick={() => idFrontRef.current?.click()}
                >
                  {idFrontImage ? (
                    <div className="relative">
                      <img 
                        src={idFrontImage} 
                        alt="身份證正面" 
                        className="max-h-32 mx-auto rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(idFrontImage);
                        }}
                      />
                      <CheckCircle className="absolute top-1 right-1 h-5 w-5 text-green-500" />
                    </div>
                  ) : (
                    <div className="py-4">
                      <CreditCard className="h-10 w-10 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">點擊上傳</p>
                    </div>
                  )}
                </div>
                <input
                  ref={idFrontRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, setIdFrontImage)}
                />
              </div>

              {/* 身份證反面 */}
              <div className="space-y-2">
                <Label>
                  身份證反面 <span className="text-red-500">*</span>
                </Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    idBackImage ? "border-green-500 bg-green-500/5" : "border-muted-foreground/25 hover:border-primary"
                  }`}
                  onClick={() => idBackRef.current?.click()}
                >
                  {idBackImage ? (
                    <div className="relative">
                      <img 
                        src={idBackImage} 
                        alt="身份證反面" 
                        className="max-h-32 mx-auto rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(idBackImage);
                        }}
                      />
                      <CheckCircle className="absolute top-1 right-1 h-5 w-5 text-green-500" />
                    </div>
                  ) : (
                    <div className="py-4">
                      <CreditCard className="h-10 w-10 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">點擊上傳</p>
                    </div>
                  )}
                </div>
                <input
                  ref={idBackRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, setIdBackImage)}
                />
              </div>

              {/* 手持自拍照 */}
              <div className="space-y-2">
                <Label>
                  手持身份證自拍 <span className="text-red-500">*</span>
                </Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    selfieImage ? "border-green-500 bg-green-500/5" : "border-muted-foreground/25 hover:border-primary"
                  }`}
                  onClick={() => selfieRef.current?.click()}
                >
                  {selfieImage ? (
                    <div className="relative">
                      <img 
                        src={selfieImage} 
                        alt="手持自拍照" 
                        className="max-h-32 mx-auto rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(selfieImage);
                        }}
                      />
                      <CheckCircle className="absolute top-1 right-1 h-5 w-5 text-green-500" />
                    </div>
                  ) : (
                    <div className="py-4">
                      <Camera className="h-10 w-10 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">點擊上傳</p>
                    </div>
                  )}
                </div>
                <input
                  ref={selfieRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, setSelfieImage)}
                />
              </div>
            </div>

            {/* 隱私聲明 */}
            <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                您的個人資料將受到嚴格保護，僅用於身份驗證目的。我們承諾不會將您的資料用於其他用途或分享給第三方。
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            {status?.has_verification && (
              <Button variant="outline" onClick={() => setShowForm(false)}>
                取消
              </Button>
            )}
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !realName || !validateIdNumber(idNumber) || !idFrontImage || !idBackImage || !selfieImage}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  提交認證
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* 圖片預覽對話框 */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl">
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
