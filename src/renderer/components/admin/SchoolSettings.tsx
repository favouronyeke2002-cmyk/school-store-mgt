import React, { useState, useEffect } from 'react';
import { Save, Upload, Image, AlertCircle, X, Plus, Trash2, GraduationCap } from 'lucide-react';
import { settingsAPI } from '../../lib/api';

interface Settings {
  school_name: string;
  tagline: string;
  phone_number: string;
  logo_url: string | null;
  academic_session: string;
  address: string;
  min_partial_payment_floor: number;
  min_acceptance_partial_floor: number;
  current_term: string;
  class_list: string;
}

const TERMS = ['1st Term', '2nd Term', '3rd Term'];

const DEFAULT_CLASSES = ['JSS1A', 'JSS1B', 'JSS2A', 'JSS2B', 'JSS3A', 'JSS3B', 'SS1A', 'SS1B', 'SS2A', 'SS2B', 'SS3A', 'SS3B'];

const SchoolSettings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    school_name: '', tagline: '', phone_number: '', logo_url: null, academic_session: '',
    address: '', min_partial_payment_floor: 30000, min_acceptance_partial_floor: 5000,
    current_term: '1st Term', class_list: JSON.stringify(DEFAULT_CLASSES),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [classList, setClassList] = useState<string[]>(DEFAULT_CLASSES);
  const [newClassName, setNewClassName] = useState('');
  const [newArmName, setNewArmName] = useState('');
  const [selectedBase, setSelectedBase] = useState('');

  useEffect(() => {
    settingsAPI.get().then((data) => {
      if (data) {
        setSettings({ ...data, current_term: data.current_term || '1st Term', class_list: data.class_list || JSON.stringify(DEFAULT_CLASSES) });
        setLogoPreview(data.logo_url || null);
        try {
          const parsed = JSON.parse(data.class_list || JSON.stringify(DEFAULT_CLASSES));
          setClassList(Array.isArray(parsed) ? parsed : DEFAULT_CLASSES);
        } catch {
          setClassList(DEFAULT_CLASSES);
        }
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErrorMsg('Please select an image file.'); return; }
    if (file.size > 200 * 1024) { setErrorMsg('Image must be under 200KB for receipt printing.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      setSettings((prev) => ({ ...prev, logo_url: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const addClass = () => {
    const name = newClassName.trim().toUpperCase();
    if (!name) return;
    if (classList.includes(name)) { setErrorMsg('Class already exists.'); return; }
    const updated = [...classList, name].sort();
    setClassList(updated);
    setNewClassName('');
  };

  const addArm = () => {
    if (!selectedBase || !newArmName.trim()) return;
    const armName = (selectedBase + newArmName.trim()).toUpperCase();
    if (classList.includes(armName)) { setErrorMsg('Arm already exists.'); return; }
    const updated = [...classList, armName].sort();
    setClassList(updated);
    setNewArmName('');
  };

  const removeClass = (cls: string) => {
    setClassList((prev) => prev.filter((c) => c !== cls));
  };

  const baseClasses = [...new Set(classList.map((c) => c.replace(/[A-Z]$/, '')))].filter(Boolean);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const classListStr = JSON.stringify(classList);
      await settingsAPI.save({ ...settings, class_list: classListStr });
      setSettings((prev) => ({ ...prev, class_list: classListStr }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setErrorMsg('Failed to save: ' + (err as Error).message);
    }
    setSaving(false);
  };

  const field = (label: string, key: keyof Settings, placeholder: string, hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input
        type="text"
        value={(settings[key] as string) || ''}
        onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      {errorMsg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-7 h-7 text-danger-600" /></div>
            <h2 className="text-lg font-bold mb-2">Error</h2>
            <p className="text-gray-600 text-sm mb-5">{errorMsg}</p>
            <button onClick={() => setErrorMsg('')} className="w-full py-2.5 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 font-medium">OK</button>
          </div>
        </div>
      )}

      {/* Receipt Preview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Receipt Preview</h2>
          <p className="text-xs text-gray-400 mt-0.5">This is how your receipt header will appear when printed</p>
        </div>
        <div className="p-6">
          <div className="w-64 mx-auto bg-white border border-gray-200 rounded-lg p-4 font-mono text-xs text-center shadow-sm">
            {logoPreview ? (
              <img src={logoPreview} alt="School Logo" className="w-16 h-16 object-contain mx-auto mb-2" />
            ) : (
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2"><Image className="w-8 h-8 text-gray-300" /></div>
            )}
            <div className="font-bold text-sm">{settings.school_name || 'School Name'}</div>
            <div className="text-gray-500 text-xs mt-0.5">{settings.tagline || 'School Motto'}</div>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="text-gray-500">{settings.academic_session || '2025/2026'} · {settings.current_term || '1st Term'}</div>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="text-gray-400">
              <div>Item Name .......... ₦0.00</div>
              <div className="border-t border-gray-300 mt-1 pt-1 font-bold">TOTAL: ₦0.00</div>
            </div>
            <div className="border-t border-dashed border-gray-300 my-2" />
            {settings.address && <div className="text-gray-400">{settings.address}</div>}
            {settings.phone_number && <div className="text-gray-400">Tel: {settings.phone_number}</div>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* School Information */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h2 className="font-bold text-gray-900">School Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Logo</label>
            <p className="text-xs text-gray-400 mb-2">Upload a logo to appear on receipts. Max 200KB, PNG/JPG.</p>
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-14 h-14 object-contain rounded-lg border border-gray-200" />
              ) : (
                <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300"><Image className="w-6 h-6 text-gray-400" /></div>
              )}
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                  <Upload className="w-4 h-4" /> Upload Logo
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </label>
                {logoPreview && (
                  <button type="button" onClick={() => { setLogoPreview(null); setSettings((p) => ({ ...p, logo_url: null })); }} className="ml-2 text-xs text-danger-500 hover:text-danger-700">Remove</button>
                )}
              </div>
            </div>
          </div>

          {field('School Name', 'school_name', "e.g. St. Mary's Secondary School")}
          {field('Motto / Tagline / Slogan', 'tagline', 'e.g. Excellence in Education', 'Displayed on the receipt under the school name')}
          {field('Academic Session', 'academic_session', 'e.g. 2025/2026', 'Used as the default session when creating new fees')}
        </div>

        {/* Term Management */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-1">Active Term</h2>
          <p className="text-xs text-gray-400 mb-4">Toggle which term is currently active. This affects fee assignment and filtering.</p>
          <div className="grid grid-cols-3 gap-2">
            {TERMS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, current_term: term }))}
                className={`py-3 rounded-xl font-semibold border-2 transition-all text-sm ${settings.current_term === term ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}
              >
                {term}
              </button>
            ))}
          </div>
          <p className="text-xs text-primary-600 font-medium mt-3">Currently active: <strong>{settings.current_term || '1st Term'}</strong></p>
        </div>

        {/* Class Management */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="w-5 h-5 text-primary-600" />
            <h2 className="font-bold text-gray-900">Class Management</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">Define school classes and their arms (e.g. JSS1 with arms JSS1A, JSS1B). These classes are used across the system.</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Add New Class / Arm</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addClass())}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="e.g. JSS1A"
                />
                <button type="button" onClick={addClass} className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-semibold"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Add Arm to Existing Base</label>
              <div className="flex gap-2">
                <select value={selectedBase} onChange={(e) => setSelectedBase(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">Base class…</option>
                  {baseClasses.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <input
                  type="text"
                  value={newArmName}
                  onChange={(e) => setNewArmName(e.target.value)}
                  className="w-14 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="C"
                  maxLength={2}
                />
                <button type="button" onClick={addArm} className="px-3 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 text-sm font-semibold"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {classList.sort().map((cls) => (
              <div key={cls} className="flex items-center gap-1 bg-primary-50 text-primary-800 border border-primary-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                {cls}
                <button type="button" onClick={() => removeClass(cls)} className="ml-1 text-primary-400 hover:text-danger-600 transition-colors"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {classList.length === 0 && <p className="text-sm text-gray-400 italic">No classes defined. Add classes above.</p>}
          </div>
        </div>

        {/* Partial Payment Floors */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-1">Partial Payment Floors</h2>
          <p className="text-xs text-gray-400 mb-4">Minimum amounts allowed for partial payments. Cashier cannot accept less than these amounts.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Registration Partial Payment (₦)</label>
              <p className="text-xs text-gray-400 mb-1">Floor for Registration Fee Bundle and School Fees. Default: ₦30,000</p>
              <input type="number" min="0" step="1000" value={(settings.min_partial_payment_floor || 0)} onChange={(e) => setSettings((p) => ({ ...p, min_partial_payment_floor: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Acceptance Partial Payment (₦)</label>
              <p className="text-xs text-gray-400 mb-1">Floor for Acceptance Fee Bundle. Default: ₦5,000</p>
              <input type="number" min="0" step="1000" value={(settings.min_acceptance_partial_floor || 0)} onChange={(e) => setSettings((p) => ({ ...p, min_acceptance_partial_floor: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          </div>
        </div>

        {/* Receipt Footer */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-900">Receipt Footer</h2>
          <p className="text-xs text-gray-400">This information appears at the bottom of every receipt.</p>
          {field('Address', 'address', 'e.g. 12 School Road, Lagos, Nigeria')}
          {field('Phone / Complaint Number', 'phone_number', 'e.g. 08012345678', 'Printed at the bottom of every receipt for queries and complaints')}
        </div>

        <div className="flex items-center justify-between">
          {saved && (
            <div className="flex items-center gap-2 text-success-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              Settings saved successfully!
            </div>
          )}
          <div className="ml-auto">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SchoolSettings;
