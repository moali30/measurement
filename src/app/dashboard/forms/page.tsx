"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, FileText, MoreHorizontal, Trash2, Share2, BarChart2, Eye, EyeOff, Clock, CheckCircle, Edit3, Grid, List, ArrowUpDown, CalendarDays, FolderOpen, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { listFormsServer, deleteFormServer, toggleFormStatusServer, duplicateFormServer } from "@/app/actions/dashboard";

interface Form { $id: string; title: string; description: string; status: string; responsesCount: number; createdAt: string; slug: string; }

type SortMode = "date_desc" | "date_asc" | "name_asc" | "name_desc";

export default function FormsListPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid"|"list">("grid");
  const [openMenuId, setOpenMenuId] = useState<string|null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("date_desc");
  const [groupByYear, setGroupByYear] = useState(false);
  const { user } = useAuth();

  useEffect(() => { if(user) loadForms(); }, [user]);

  const loadForms = async () => {
    setLoading(true);
    try {
      const result = await listFormsServer();
      if (result.success) {
        setForms(result.forms as Form[]);
      }
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const deleteForm = async (id: string) => {
    if(!confirm("هل أنت متأكد من حذف هذا الاستبيان؟")) return;
    try {
      const result = await deleteFormServer(id);
      if (result.success) {
        setForms(f => f.filter(x => x.$id !== id));
      }
    } catch(e) { console.error(e); }
    setOpenMenuId(null);
  };

  const toggleStatus = async (form: Form) => {
    const s = form.status==="active"?"draft":"active";
    try {
      const result = await toggleFormStatusServer(form.$id, s);
      if (result.success) {
        setForms(f => f.map(x => x.$id===form.$id ? {...x, status: s} : x));
      }
    } catch(e) { console.error(e); }
    setOpenMenuId(null);
  };

  const duplicateForm = async (id: string) => {
    setLoading(true);
    try {
      const result = await duplicateFormServer(id);
      if (result.success) {
        await loadForms();
      } else {
        alert("حدث خطأ أثناء نسخ الاستبيان");
      }
    } catch(e) { console.error(e); } finally { setLoading(false); setOpenMenuId(null); }
  };

  const filtered = useMemo(() => {
    let result = forms.filter(f => f.title.toLowerCase().includes(search.toLowerCase()) && (statusFilter==="all"||f.status===statusFilter));
    
    // Sort
    result = [...result].sort((a, b) => {
      switch (sortMode) {
        case "date_desc": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "date_asc": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name_asc": return a.title.localeCompare(b.title, "ar");
        case "name_desc": return b.title.localeCompare(a.title, "ar");
        default: return 0;
      }
    });
    
    return result;
  }, [forms, search, statusFilter, sortMode]);

  // Group forms by year
  const groupedForms = useMemo(() => {
    if (!groupByYear) return null;
    const groups: Record<string, Form[]> = {};
    filtered.forEach(f => {
      const year = new Date(f.createdAt).getFullYear().toString();
      if (!groups[year]) groups[year] = [];
      groups[year].push(f);
    });
    // Sort years descending
    return Object.entries(groups).sort(([a], [b]) => parseInt(b) - parseInt(a));
  }, [filtered, groupByYear]);

  const stats = { total:forms.length, active:forms.filter(f=>f.status==="active").length, draft:forms.filter(f=>f.status==="draft").length, responses:forms.reduce((s,f)=>s+(f.responsesCount||0),0) };
  
  const badge = (s:string) => {
    if(s==="active") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle size={12}/>نشط</span>;
    if(s==="draft") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200"><Edit3 size={12}/>مؤرشف</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{s}</span>;
  };

  const fmtDate = (d:string) => { try{return new Date(d).toLocaleDateString("ar-SA",{year:"numeric",month:"short",day:"numeric"});}catch{return d;} };

  const sortLabel = (mode: SortMode) => {
    switch (mode) {
      case "date_desc": return "الأحدث أولاً";
      case "date_asc": return "الأقدم أولاً";
      case "name_asc": return "الاسم أ-ي";
      case "name_desc": return "الاسم ي-أ";
    }
  };

  const renderFormCard = (form: Form) => (
    <div key={form.$id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all">
      <div className={`h-1.5 rounded-t-2xl ${form.status==='active'?'bg-gradient-to-l from-emerald-400 to-emerald-500':'bg-gradient-to-l from-gray-300 to-gray-400'}`}/>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          {badge(form.status)}
          <div className="relative">
            <button onClick={()=>setOpenMenuId(openMenuId===form.$id?null:form.$id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"><MoreHorizontal size={16}/></button>
            {openMenuId===form.$id&&(
              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 z-50">
                <a href={`/f/${form.slug}`} target="_blank" rel="noopener" className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-blue-50 text-gray-700"><Eye size={14} className="text-blue-500"/>معاينة الاستبيان</a>
                <button onClick={()=>toggleStatus(form)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700">{form.status==='active'?<><EyeOff size={14} className="text-gray-500"/>أرشفة</>:<><Eye size={14} className="text-emerald-500"/>تفعيل</>}</button>
                <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`);setOpenMenuId(null);}} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700"><Share2 size={14} className="text-gray-400"/>نسخ الرابط</button>
                <button onClick={()=>duplicateForm(form.$id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-blue-50 text-blue-600"><Copy size={14}/>إنشاء نسخة (Duplicate)</button>
                <hr className="my-1.5 border-gray-100"/>
                <button onClick={()=>deleteForm(form.$id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-red-50 text-red-600"><Trash2 size={14}/>حذف</button>
              </div>
            )}
          </div>
        </div>
        <Link href={`/dashboard/forms/${form.$id}`}><h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 hover:text-blue-600 cursor-pointer transition-colors">{form.title}</h3></Link>
        {form.description&&<p className="text-xs text-gray-400 line-clamp-2 mb-3">{form.description}</p>}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1 text-xs text-gray-400"><Clock size={12}/>{fmtDate(form.createdAt)}</div>
          <div className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1 rounded-lg"><BarChart2 size={12}/>{form.responsesCount||0} رد</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">الاستبيانات</h1><p className="text-sm text-gray-500 mt-1">إدارة جميع الاستبيانات والنماذج</p></div>
        <Link href="/dashboard/forms/create"><Button className="bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl flex gap-2 px-5 shadow-md shadow-blue-200 h-11"><Plus size={18}/>استبيان جديد</Button></Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{l:"إجمالي",v:stats.total,c:"bg-blue-50 text-blue-500"},{l:"نشط",v:stats.active,c:"bg-emerald-50 text-emerald-500"},{l:"مؤرشف",v:stats.draft,c:"bg-gray-100 text-gray-500"},{l:"الردود",v:stats.responses,c:"bg-purple-50 text-purple-500"}].map((s,i)=>(
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.c.split(" ")[0]}`}><FileText size={20} className={s.c.split(" ")[1]}/></div>
            <div><p className="text-2xl font-bold text-gray-900">{s.v}</p><p className="text-xs text-gray-500">{s.l}</p></div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث..." className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"/>
        </div>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
          {[{k:"all",l:"الكل"},{k:"active",l:"نشط"},{k:"draft",l:"مؤرشف"}].map(f=>(
            <button key={f.k} onClick={()=>setStatusFilter(f.k)} className={`px-4 py-2.5 text-xs font-medium transition-colors ${statusFilter===f.k?'bg-blue-50 text-blue-600':'text-gray-500 hover:bg-gray-50'}`}>{f.l}</button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <ArrowUpDown size={14}/>
            {sortLabel(sortMode)}
          </button>
          <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 hidden group-hover:block">
            {(["date_desc", "date_asc", "name_asc", "name_desc"] as SortMode[]).map(mode => (
              <button key={mode} onClick={() => setSortMode(mode)} className={`w-full text-right px-4 py-2 text-xs hover:bg-blue-50 transition-colors ${sortMode === mode ? "text-blue-600 font-semibold bg-blue-50/50" : "text-gray-600"}`}>
                {sortLabel(mode)}
              </button>
            ))}
          </div>
        </div>

        {/* Group by year toggle */}
        <button onClick={() => setGroupByYear(!groupByYear)} className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl text-xs font-medium transition-colors ${groupByYear ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <FolderOpen size={14}/>
          تجميع بالسنة
        </button>

        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
          <button onClick={()=>setViewMode("grid")} className={`p-2.5 ${viewMode==='grid'?'bg-blue-50 text-blue-600':'text-gray-400'}`}><Grid size={16}/></button>
          <button onClick={()=>setViewMode("list")} className={`p-2.5 ${viewMode==='list'?'bg-blue-50 text-blue-600':'text-gray-400'}`}><List size={16}/></button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"/></div>
      ) : filtered.length===0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center"><FileText size={28} className="text-blue-400"/></div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">{search?"لا توجد نتائج":"لا توجد استبيانات"}</h3>
          <p className="text-sm text-gray-400 mb-6">{search?"جرب تغيير البحث":"ابدأ بإنشاء أول استبيان"}</p>
          {!search&&<Link href="/dashboard/forms/create"><Button className="bg-blue-600 hover:bg-blue-700 rounded-xl"><Plus size={16} className="ml-2"/>إنشاء استبيان</Button></Link>}
        </div>
      ) : groupByYear && groupedForms ? (
        // Grouped by year view
        <div className="space-y-8">
          {groupedForms.map(([year, yearForms]) => (
            <div key={year}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 bg-gradient-to-l from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl shadow-sm">
                  <CalendarDays size={16}/>
                  <span className="text-sm font-bold">{year}</span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">{yearForms.length} استبيان</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {yearForms.map(form => renderFormCard(form))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/80"><tr>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500">العنوان</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500">الحالة</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500">الردود</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500">التاريخ</th>
                      <th className="px-6 py-3.5 w-24"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {yearForms.map(form=>(
                        <tr key={form.$id} className="hover:bg-blue-50/30 group">
                          <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><FileText size={18} className="text-blue-500"/></div><Link href={`/dashboard/forms/${form.$id}`}><p className="font-medium text-gray-900 text-sm hover:text-blue-600 transition-colors">{form.title}</p></Link></div></td>
                          <td className="px-6 py-4">{badge(form.status)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-medium">{form.responsesCount||0}</td>
                          <td className="px-6 py-4 text-sm text-gray-400">{fmtDate(form.createdAt)}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                              <button onClick={()=>toggleStatus(form)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" title={form.status==='active'?'أرشفة':'تفعيل'}>{form.status==='active'?<EyeOff size={16}/>:<Eye size={16}/>}</button>
                              <button onClick={()=>duplicateForm(form.$id)} className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500" title="إنشاء نسخة"><Copy size={16}/></button>
                              <button onClick={()=>deleteForm(form.$id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : viewMode==="grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(form => renderFormCard(form))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/80"><tr>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500">العنوان</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500">الحالة</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500">الردود</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500">التاريخ</th>
              <th className="px-6 py-3.5 w-24"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(form=>(
                <tr key={form.$id} className="hover:bg-blue-50/30 group">
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><FileText size={18} className="text-blue-500"/></div><Link href={`/dashboard/forms/${form.$id}`}><p className="font-medium text-gray-900 text-sm hover:text-blue-600 transition-colors">{form.title}</p></Link></div></td>
                  <td className="px-6 py-4">{badge(form.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-medium">{form.responsesCount||0}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{fmtDate(form.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={()=>toggleStatus(form)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" title={form.status==='active'?'أرشفة':'تفعيل'}>{form.status==='active'?<EyeOff size={16}/>:<Eye size={16}/>}</button>
                      <button onClick={()=>duplicateForm(form.$id)} className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500" title="إنشاء نسخة"><Copy size={16}/></button>
                      <button onClick={()=>deleteForm(form.$id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
