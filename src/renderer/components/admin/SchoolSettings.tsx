import React, { useState, useEffect } from 'react';
import { Save, Upload, Image, AlertCircle, X } from 'lucide-react';
import { settingsAPI } from '../../lib/api';

interface Settings {
  school_name: string;
  tagline: string;
  phone_number: string;
  logo_url: string | null;
  academic_session: string;
  address: string;
}

const SchoolSettings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({ school_name: '', tagline: '', phone_number: '', logo_url: null, academic_session: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    settingsAPI.get().then((data) => {
      if (data) {
        setSettings(data);
        setLogoPreview(data.logo_url || null);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      await settingsAPI.save(settings);
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
      {/* Error Modal */}
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

      {/* Receipt Preview Card */}
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
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Image className="w-8 h-8 text-gray-300" />
              </div>
            )}
            <div className="font-bold text-sm">{settings.school_name || 'School Name'}</div>
            <div className="text-gray-500 text-xs mt-0.5">{settings.tagline || 'School Motto'}</div>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="text-gray-500">{settings.academic_session || '2025/2026'}</div>
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

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h2 className="font-bold text-gray-900">School Information</h2>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">School Logo</label>
          <p className="text-xs text-gray-400 mb-2">Upload a logo to appear on receipts. Max 200KB, PNG/JPG.</p>
          <div className="flex items-center gap-3">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-14 h-14 object-contain rounded-lg border border-gray-200" />
            ) : (
              <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                <Image className="w-6 h-6 text-gray-400" />
              </div>
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

        {field('School Name', 'school_name', 'e.g. St. Mary\'s Secondary School')}
        {field('Motto / Tagline / Slogan', 'tagline', 'e.g. Excellence in Education', 'Displayed on the receipt under the school name')}
        {field('Academic Session', 'academic_session', 'e.g. 2025/2026', 'Used as the default session when creating new fees')}

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Receipt Footer</h3>
          <p className="text-xs text-gray-400 mb-3">This information appears at the bottom of every receipt.</p>
          <div className="space-y-4">
            {field('Address', 'address', 'e.g. 12 School Road, Lagos, Nigeria')}
            {field('Phone / Complaint Number', 'phone_number', 'e.g. 08012345678', 'Printed at the bottom of every receipt for queries and complaints')}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
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
