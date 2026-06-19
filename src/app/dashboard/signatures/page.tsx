"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, PenTool, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listSignaturesServer, addSignatureServer, deleteSignatureServer } from "@/app/actions/signatures";
import { toast } from "sonner";
import { useConfirm } from "@/components/providers/ConfirmProvider";

interface Signature {
  id: string;
  name: string;
  image_url: string;
  created_at: string;
}

export default function SignaturesPage() {
  const { confirm } = useConfirm();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImage, setNewImage] = useState("");

  const loadSignatures = async () => {
    setLoading(true);
    const res = await listSignaturesServer();
    if (res.success) {
      setSignatures(res.signatures || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSignatures();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = document.createElement("img");
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            // Signatures usually don't need to be very large
            const maxWidth = 300;
            const scaleSize = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scaleSize;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/webp", 0.8)); 
          };
          img.onerror = () => reject(new Error("فشل قراءة الصورة"));
        };
        reader.onerror = () => reject(new Error("فشل قراءة الملف"));
      });
      setNewImage(url);
    } catch (e: any) {
      console.error(e);
      toast.error("خطأ في معالجة الصورة: " + e.message);
    }
  };

  const handleAdd = async () => {
    if (!newName || !newImage) {
      toast.error("يرجى كتابة اسم التوقيع واختيار الصورة");
      return;
    }
    
    setIsAdding(true);
    try {
      const res = await addSignatureServer(newName, newImage);
      if (res.success) {
        setNewName("");
        setNewImage("");
        await loadSignatures();
        toast.success("تمت إضافة التوقيع بنجاح");
      } else {
        toast.error("فشل إضافة التوقيع");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ message: "هل أنت متأكد من حذف هذا التوقيع؟" }))) return;
    try {
      const res = await deleteSignatureServer(id);
      if (res.success) {
        setSignatures(s => s.filter(sig => sig.id !== id));
        toast.success("تم حذف التوقيع بنجاح");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-indigo-900 mb-2 flex items-center gap-3">
          <PenTool className="text-blue-600" /> إدارة التوقيعات
        </h1>
        <p className="text-gray-600 font-medium">قم برفع التوقيعات لاستخدامها لاحقاً في التقارير</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="text-blue-500" /> توقيع جديد
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم التوقيع / المنصب</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  placeholder="مثال: عميد الكلية" 
                  className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">صورة التوقيع (يفضل خلفية شفافة PNG)</label>
                {newImage ? (
                  <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50 group">
                    <img src={newImage} alt="New Signature" className="max-h-24 object-contain" />
                    <button 
                      onClick={() => setNewImage("")}
                      className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer relative">
                    <ImageIcon className="w-8 h-8 text-blue-400 mb-2" />
                    <span className="text-sm text-blue-600 font-medium">اختر صورة</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              <Button 
                onClick={handleAdd} 
                disabled={isAdding || !newName || !newImage}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6"
              >
                {isAdding ? "جاري الإضافة..." : "حفظ التوقيع"}
              </Button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : signatures.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <PenTool className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-700 mb-2">لا يوجد توقيعات</h3>
              <p className="text-gray-500">قم بإضافة التوقيع الأول من القائمة الجانبية</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {signatures.map(sig => (
                <div key={sig.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 group hover:border-blue-200 transition-colors flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-800">{sig.name}</h3>
                    <button 
                      onClick={() => handleDelete(sig.id)}
                      className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                      title="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl flex items-center justify-center p-4 border border-gray-100">
                    <img src={sig.image_url} alt={sig.name} className="max-h-20 object-contain mix-blend-multiply" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
