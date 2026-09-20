/* bitesite/app/admin/components/merchant-form.tsx */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import {
  Save,
  Trash2,
  ChevronLeft,
  Loader2,
  Image as ImageIcon,
  MapPin,
  Phone,
  Mail,
  Globe,
  Instagram,
  Facebook,
  FileText,
  Check,
  AlertCircle,
  AlertTriangle,
  Plus,
  X,
  Copy,
  Clock,
} from 'lucide-react';
import {
  parseOperatingHoursString,
  formatOperatingHoursToString,
  type DayHours,
  type TimeSlot,
} from '@/lib/hours';
import { AMENITY_TAGS, AREAS, CUISINE_TAGS, OCCASION_TAGS, PAYMENT_METHODS } from '@/lib/presets';
import ImageUpload from './image-upload';

interface MerchantFormProps {
  merchant?: {
    id: string;
    slug: string;
    name: string;
    tagline?: string;
    description?: string;
    layout?: string;
    cuisine?: string[] | null;
    amenities?: string[] | null;
    occasion?: string[] | null;
    area?: string;
    payment_methods?: string[] | null;
    address?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    instagram?: string;
    facebook?: string;
    latitude?: number | null;
    longitude?: number | null;
    operating_hours?: Record<string, string> | null;
    is_published?: boolean;
    status?: string;
    platform_status?: string;
    business_status?: string;
    features?: Record<string, boolean> | null;
    logo_image?: string;
    cover_image?: string;
    menu_pdf_url?: string;
    grabfood_url?: string;
  } | null;
  onBack: () => void;
  onSaved: () => void;
}

const LAYOUTS = [
  { value: 'classic', label: 'Classic', desc: 'Warm cafe / bakery' },
  { value: 'elegant', label: 'Elegant', desc: 'Dark luxury fine-dining' },
  { value: 'minimal', label: 'Minimal', desc: 'Clean zen / Japanese' },
  { value: 'modern', label: 'Modern', desc: 'Contemporary urban' },
  { value: 'rustic', label: 'Rustic', desc: 'Earthy farm-to-table' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const FEATURES = [
  { key: 'hero', label: 'Hero', desc: 'Full-bleed cover image' },
  { key: 'about', label: 'About', desc: 'Brand story text' },
  { key: 'menu', label: 'Menu', desc: 'Menu section with categories' },
  { key: 'contact', label: 'Contact', desc: 'Contact info + WhatsApp CTA' },
  { key: 'related', label: 'Related', desc: '"You May Also Like" merchants' },
  { key: 'events', label: 'Events', desc: 'Events/promotions carousel' },
  { key: 'video', label: 'Video', desc: 'Video player section' },
  { key: 'gallery', label: 'Gallery', desc: 'Photo gallery' },
  { key: 'testimonials', label: 'Testimonials', desc: 'Customer reviews' },
];

/* ── URL validation helpers ── */
function isLikelyImageUrl(url: string): boolean {
  if (!url.trim()) return true;
  const clean = url.split('?')[0].toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/.test(clean);
}

function isLikelyPdfUrl(url: string): boolean {
  if (!url.trim()) return true;
  const clean = url.split('?')[0].toLowerCase();
  return /\.pdf$/.test(clean);
}

function isValidHttpUrl(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidEmail(email: string): boolean {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ── Toast type ── */
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

const DEFAULT_DAY_HOURS: DayHours = { slots: [{ start: '', end: '' }], isClosed: false };

export default function MerchantForm({ merchant, onBack, onSaved }: MerchantFormProps) {
  const { token } = useAuth();
  const isEditing = !!merchant;
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [dirty, setDirty] = useState(false);

  /* Toast state */
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const [form, setForm] = useState({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    layout: 'classic',
    cuisine: [] as string[],
    amenities: [] as string[],
    occasion: [] as string[],
    area: '',
    payment_methods: '',
    address: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    instagram: '',
    facebook: '',
    latitude: '',
    longitude: '',
    operating_hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
      saturday: '',
      sunday: '',
    },
    is_published: false,
    status: 'active',
    platform_status: 'DRAFT',
    business_status: 'OPEN',
    features: {
      hero: true,
      about: true,
      menu: true,
      contact: true,
      related: true,
      events: false,
      video: false,
      gallery: false,
      testimonials: false,
    },
    logo_image: '',
    cover_image: '',
    menu_pdf_url: '',
    grabfood_url: '',
  });

  /* Structured hours state for Admin editing */
  const [hoursSlots, setHoursSlots] = useState<Record<string, DayHours>>(() =>
    Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_DAY_HOURS }]))
  );

  /* Image preview error states */
  const [logoError, setLogoError] = useState(false);
  const [coverError, setCoverError] = useState(false);

  /* Payment methods custom input state */
  const [paymentMethodInput, setPaymentMethodInput] = useState('');

  /* Derived selected payment methods array */
  const selectedPaymentMethods = form.payment_methods
    ? form.payment_methods.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const togglePaymentMethod = (pm: string) => {
    const exists = selectedPaymentMethods.includes(pm);
    const next = exists
      ? selectedPaymentMethods.filter((t) => t !== pm)
      : [...selectedPaymentMethods, pm];
    updateField('payment_methods', next.join(', '));
  };

  const addCustomPaymentMethod = () => {
    const raw = paymentMethodInput.trim();
    if (!raw) return;
    const newMethods = raw.split(',').map((t) => t.trim()).filter(Boolean);
    const combined = [...new Set([...selectedPaymentMethods, ...newMethods])];
    updateField('payment_methods', combined.join(', '));
    setPaymentMethodInput('');
  };

  const removePaymentMethod = (pm: string) => {
    const next = selectedPaymentMethods.filter((t) => t !== pm);
    updateField('payment_methods', next.join(', '));
  };

  useEffect(() => {
    if (merchant) {
      setForm({
        name: merchant.name || '',
        slug: merchant.slug || '',
        tagline: merchant.tagline || '',
        description: merchant.description || '',
        layout: merchant.layout || 'classic',
        cuisine: merchant.cuisine || [],
        amenities: merchant.amenities || [],
        occasion: merchant.occasion || [],
        area: merchant.area || '',
        payment_methods: merchant.payment_methods?.join(', ') || '',
        address: merchant.address || '',
        phone: merchant.phone || '',
        whatsapp: merchant.whatsapp || '',
        email: merchant.email || '',
        website: merchant.website || '',
        instagram: merchant.instagram || '',
        facebook: merchant.facebook || '',
        latitude: merchant.latitude?.toString() || '',
        longitude: merchant.longitude?.toString() || '',
        operating_hours: {
          monday: merchant.operating_hours?.monday || '',
          tuesday: merchant.operating_hours?.tuesday || '',
          wednesday: merchant.operating_hours?.wednesday || '',
          thursday: merchant.operating_hours?.thursday || '',
          friday: merchant.operating_hours?.friday || '',
          saturday: merchant.operating_hours?.saturday || '',
          sunday: merchant.operating_hours?.sunday || '',
        },
        is_published: merchant.is_published ?? false,
        status: merchant.status || 'active',
        platform_status: merchant.platform_status || (merchant.is_published ? 'PUBLISHED' : 'DRAFT'),
        business_status: merchant.business_status || (merchant.status === 'inactive' ? 'TEMPORARILY_CLOSED' : 'OPEN'),
        features: {
          hero: merchant.features?.hero ?? true,
          about: merchant.features?.about ?? true,
          menu: merchant.features?.menu ?? true,
          contact: merchant.features?.contact ?? true,
          related: merchant.features?.related ?? true,
          events: merchant.features?.events ?? false,
          video: merchant.features?.video ?? false,
          gallery: merchant.features?.gallery ?? false,
          testimonials: merchant.features?.testimonials ?? false,
        },
        logo_image: merchant.logo_image || '',
        cover_image: merchant.cover_image || '',
        menu_pdf_url: merchant.menu_pdf_url || '',
        grabfood_url: merchant.grabfood_url || '',
      });

      /* Parse operating_hours into structured slots */
      const parsed: Record<string, DayHours> = {};
      for (const day of DAYS) {
        parsed[day] = parseOperatingHoursString(merchant.operating_hours?.[day]);
      }
      setHoursSlots(parsed);

      setLogoError(false);
      setCoverError(false);
      setPaymentMethodInput('');
    }
  }, [merchant]);

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    /* Reset image errors when URL changes */
    if (field === 'logo_image') setLogoError(false);
    if (field === 'cover_image') setCoverError(false);
  };

  const updateFeature = (key: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: checked },
    }));
    setDirty(true);
  };

  const toggleControlledTag = (
    field: 'cuisine' | 'amenities' | 'occasion',
    tag: string,
    max: number,
  ) => {
    const selected = form[field];
    if (selected.includes(tag)) {
      updateField(field, selected.filter((value) => value !== tag));
      return;
    }
    if (selected.length < max) updateField(field, [...selected, tag]);
  };

  /* ── Hours slot helpers ── */
  const addSlot = (day: string) => {
    setHoursSlots((prev) => ({
      ...prev,
      [day]: { ...prev[day], slots: [...prev[day].slots, { start: '', end: '' }] },
    }));
    setDirty(true);
  };

  const removeSlot = (day: string, idx: number) => {
    setHoursSlots((prev) => ({
      ...prev,
      [day]: { ...prev[day], slots: prev[day].slots.filter((_, i) => i !== idx) },
    }));
    setDirty(true);
  };

  const updateSlot = (day: string, idx: number, field: keyof TimeSlot, value: string) => {
    setHoursSlots((prev) => {
      const newSlots = [...prev[day].slots];
      newSlots[idx] = { ...newSlots[idx], [field]: value };
      return { ...prev, [day]: { ...prev[day], slots: newSlots } };
    });
    setDirty(true);
  };

  const setDayClosed = (day: string, closed: boolean) => {
    setHoursSlots((prev) => ({
      ...prev,
      [day]: { slots: closed ? [] : [{ start: '', end: '' }], isClosed: closed },
    }));
    setDirty(true);
  };

  const copyMondayToAll = () => {
    const monday = hoursSlots.monday;
    setHoursSlots((prev) => {
      const next = { ...prev };
      for (const day of DAYS) {
        if (day !== 'monday') {
          next[day] = { slots: monday.slots.map((s) => ({ ...s })), isClosed: monday.isClosed };
        }
      }
      return next;
    });
    setDirty(true);
    showToast('Monday hours copied to all days', 'success');
  };

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.slug.trim()) newErrors.slug = 'Slug is required';
    else if (!/^[a-z0-9-]+$/.test(form.slug)) {
      newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }
    if (!form.whatsapp.trim()) newErrors.whatsapp = 'WhatsApp is required';
    if (form.cuisine.length > 3) newErrors.cuisine = 'Choose at most 3 cuisine tags';
    if (form.amenities.length > 5) newErrors.amenities = 'Choose at most 5 amenity tags';
    if (form.occasion.length > 3) newErrors.occasion = 'Choose at most 3 occasion tags';
    if (!isValidEmail(form.email)) newErrors.email = 'Enter a valid email address';

    const urlFields: Array<[keyof typeof form, string]> = [
      ['grabfood_url', 'GrabFood URL'],
      ['website', 'Website URL'],
      ['instagram', 'Instagram URL'],
      ['facebook', 'Facebook URL'],
      ['logo_image', 'Logo image URL'],
      ['cover_image', 'Cover image URL'],
      ['menu_pdf_url', 'Menu PDF URL'],
    ];
    for (const [field, label] of urlFields) {
      const value = form[field];
      if (typeof value === 'string' && value.trim() && !isValidHttpUrl(value)) {
        newErrors[field] = `${label} must start with http:// or https://`;
      }
    }

    const latitude = form.latitude.trim();
    if (latitude && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) {
      newErrors.latitude = 'Latitude must be between -90 and 90';
    }
    const longitude = form.longitude.trim();
    if (longitude && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) {
      newErrors.longitude = 'Longitude must be between -180 and 180';
    }
    setErrors(newErrors);
    const firstError = Object.keys(newErrors)[0];
    if (firstError) {
      const errorTab = new Set(['name', 'slug', 'cuisine', 'amenities', 'occasion', 'area', 'payment_methods']).has(firstError)
        ? 0
        : new Set(['whatsapp', 'phone', 'email', 'website', 'instagram', 'facebook', 'grabfood_url', 'latitude', 'longitude']).has(firstError)
          ? 1
          : new Set(['logo_image', 'cover_image', 'menu_pdf_url']).has(firstError)
            ? 4
            : 0;
      setActiveTab(errorTab);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');

    /* Build operating_hours from structured slots */
    const operatingHoursPayload: Record<string, string> = {};
    for (const day of DAYS) {
      const str = formatOperatingHoursToString(hoursSlots[day]);
      if (str) operatingHoursPayload[day] = str;
    }

    const payload: Record<string, unknown> = {
      name: form.name,
      slug: form.slug,
      tagline: form.tagline || null,
      description: form.description || null,
      layout: form.layout,
      cuisine: form.cuisine,
      amenities: form.amenities,
      occasion: form.occasion,
      area: form.area || null,
      payment_methods: form.payment_methods ? form.payment_methods.split(',').map((t) => t.trim()).filter(Boolean) : null,
      address: form.address || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp,
      email: form.email || null,
      website: form.website || null,
      instagram: form.instagram || null,
      facebook: form.facebook || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      operating_hours: operatingHoursPayload,
      is_published: form.is_published,
      status: form.status,
      platform_status: form.platform_status,
      business_status: form.business_status,
      features: form.features,
      logo_image: form.logo_image || null,
      cover_image: form.cover_image || null,
      menu_pdf_url: form.menu_pdf_url || null,
      grabfood_url: form.grabfood_url || null,
    };

    if (isEditing) {
      payload.id = merchant!.id;
    }

    try {
      const res = await fetch('/api/admin/merchants-crud', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token || '',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }
      showToast(isEditing ? 'Merchant updated successfully' : 'Merchant created successfully', 'success');
      setDirty(false);
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setSaveError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    onBack();
  };

  const handleDelete = async () => {
    if (!merchant) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/merchants-crud?id=${merchant.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token || '' },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      showToast('Merchant deleted successfully', 'success');
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setSaveError(msg);
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const tabs = [
    { label: 'Basic Info', icon: FileText },
    { label: 'Contact', icon: Phone },
    { label: 'Hours', icon: MapPin },
    { label: 'Settings', icon: Globe },
    { label: 'Images', icon: ImageIcon },
  ];

  /* URL warning helpers */
  const websiteWarning = form.website && !isValidHttpUrl(form.website);
  const instagramWarning = form.instagram && !isValidHttpUrl(form.instagram);
  const facebookWarning = form.facebook && !isValidHttpUrl(form.facebook);
  const logoWarning = form.logo_image && !isLikelyImageUrl(form.logo_image);
  const coverWarning = form.cover_image && !isLikelyImageUrl(form.cover_image);
  const pdfWarning = form.menu_pdf_url && !isLikelyPdfUrl(form.menu_pdf_url);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEditing ? 'Edit Merchant' : 'New Merchant'}
          </h1>
          <p className="text-slate-400 text-sm">
            {isEditing ? `Editing ${merchant?.name}` : 'Create a new restaurant partner'}
          </p>
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {saveError}
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Please fix the highlighted fields before saving:{' '}
            {Object.keys(errors).map((field) => field.replace(/_/g, ' ')).join(', ')}.
          </p>
        </div>
      )}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all animate-in slide-in-from-right ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400'
                : 'bg-red-950/90 border-red-500/30 text-red-400'
            }`}
          >
            {t.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {t.message}
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeTab === idx;
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        {/* Tab 1: Basic Info */}
        {activeTab === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Restaurant Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  updateField('name', e.target.value);
                  if (!isEditing && !form.slug) {
                    updateField('slug', generateSlug(e.target.value));
                  }
                }}
                placeholder="e.g. The Hearth Bakery"
                className={`w-full px-4 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors ${
                  errors.name ? 'border-red-500/50' : 'border-slate-700'
                }`}
              />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Slug <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm shrink-0">/store/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => updateField('slug', e.target.value)}
                  placeholder="the-hearth-bakery"
                  className={`flex-1 px-4 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors ${
                    errors.slug ? 'border-red-500/50' : 'border-slate-700'
                  }`}
                />
              </div>
              {errors.slug ? (
                <p className="mt-1 text-xs text-red-400">{errors.slug}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  URL-friendly name. Auto-generated from name. Use only lowercase letters, numbers, and hyphens.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tagline</label>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => updateField('tagline', e.target.value)}
                placeholder="Short catchy phrase"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Full description of the restaurant..."
                rows={4}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Layout</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => updateField('layout', l.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      form.layout === l.value
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium text-sm">{l.label}</div>
                    <div className="text-xs mt-0.5 opacity-70">{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Area */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Area</label>
              <select
                value={AREAS.includes(form.area as (typeof AREAS)[number]) ? form.area : 'Other'}
                onChange={(e) => updateField('area', e.target.value === 'Other' ? '' : e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none transition-colors mb-2"
              >
                <option value="" disabled>Select area...</option>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                <option value="Other">Other (custom)</option>
              </select>
              {(!form.area || !AREAS.includes(form.area as (typeof AREAS)[number])) && (
                <input
                  type="text"
                  value={form.area}
                  onChange={(e) => updateField('area', e.target.value)}
                  placeholder="Enter custom area"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
              )}
            </div>

            {([
              { field: 'cuisine' as const, label: 'Cuisine', help: 'Choose up to 3', values: CUISINE_TAGS, max: 3 },
              { field: 'amenities' as const, label: 'Amenities', help: 'Choose up to 5', values: AMENITY_TAGS, max: 5 },
              { field: 'occasion' as const, label: 'Occasion', help: 'Choose up to 3', values: OCCASION_TAGS, max: 3 },
            ]).map(({ field, label, help, values, max }) => (
              <div key={field}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium text-slate-300">{label}</label>
                  <span className={form[field].length >= max ? 'text-xs text-amber-400' : 'text-xs text-slate-500'}>
                    {form[field].length >= max ? `Maximum ${max}` : `${form[field].length}/${max} · ${help}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {values.map((tag) => {
                    const active = form[field].includes(tag);
                    const disabled = !active && form[field].length >= max;
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleControlledTag(field, tag, max)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : disabled
                              ? 'bg-slate-950 border-slate-800 text-slate-700 cursor-not-allowed'
                              : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                        {tag}
                      </button>
                    );
                  })}
                </div>
                {errors[field] && <p className="mt-2 text-xs text-red-400">{errors[field]}</p>}
              </div>
            ))}

            {/* Payment Methods */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Payment Methods</label>
              
              {/* Preset payment method pills */}
              <div className="flex flex-wrap gap-2 mb-3">
                {PAYMENT_METHODS.map((pm) => {
                  const active = selectedPaymentMethods.includes(pm);
                  return (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => togglePaymentMethod(pm)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      {pm}
                    </button>
                  );
                })}
              </div>

              {/* Custom payment method input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={paymentMethodInput}
                  onChange={(e) => setPaymentMethodInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomPaymentMethod();
                    }
                  }}
                  placeholder="Add custom payment method (press Enter or click +)"
                  className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={addCustomPaymentMethod}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  title="Add payment method"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Selected payment methods display */}
              {selectedPaymentMethods.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedPaymentMethods.map((pm) => (
                    <span
                      key={pm}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400"
                    >
                      {pm}
                      <button
                        type="button"
                        onClick={() => removePaymentMethod(pm)}
                        className="hover:text-emerald-300 transition-colors"
                        title="Remove payment method"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Contact */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Address</label>
              <textarea
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Full address"
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="Display phone number"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  WhatsApp <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => updateField('whatsapp', e.target.value)}
                  placeholder="60123456789"
                  className={`w-full px-4 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors ${
                    errors.whatsapp ? 'border-red-500/50' : 'border-slate-700'
                  }`}
                />
                {errors.whatsapp && <p className="mt-1 text-xs text-red-400">{errors.whatsapp}</p>}
                <p className="mt-1 text-xs text-slate-500">Digits only, no + or spaces. Used for booking form.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="hello@restaurant.com"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">GrabFood URL</label>
              <input
                type="url"
                value={form.grabfood_url}
                onChange={(e) => updateField('grabfood_url', e.target.value)}
                placeholder="https://food.grab.com/..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
              />
              <p className="mt-1 text-xs text-slate-500">Optional. This opens the merchant&apos;s own GrabFood store; BiteSite never processes an order or payment.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Website</label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://restaurant.com"
                className={`w-full px-4 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors ${
                  websiteWarning ? 'border-yellow-500/50' : 'border-slate-700'
                }`}
              />
              {websiteWarning && (
                <p className="mt-1 text-xs text-yellow-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  URL should start with https://
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Instagram</label>
                <input
                  type="text"
                  value={form.instagram}
                  onChange={(e) => updateField('instagram', e.target.value)}
                  placeholder="https://instagram.com/..."
                  className={`w-full px-4 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors ${
                    instagramWarning ? 'border-yellow-500/50' : 'border-slate-700'
                  }`}
                />
                {instagramWarning && (
                  <p className="mt-1 text-xs text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    URL should start with https://
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Facebook</label>
                <input
                  type="text"
                  value={form.facebook}
                  onChange={(e) => updateField('facebook', e.target.value)}
                  placeholder="https://facebook.com/..."
                  className={`w-full px-4 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors ${
                    facebookWarning ? 'border-yellow-500/50' : 'border-slate-700'
                  }`}
                />
                {facebookWarning && (
                  <p className="mt-1 text-xs text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    URL should start with https://
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Latitude</label>
                <input
                  type="text"
                  value={form.latitude}
                  onChange={(e) => updateField('latitude', e.target.value)}
                  placeholder="3.1489"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Longitude</label>
                <input
                  type="text"
                  value={form.longitude}
                  onChange={(e) => updateField('longitude', e.target.value)}
                  placeholder="101.7103"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Hours — Structured */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Add time slots for each day. Click <strong className="text-slate-300">Closed</strong> if not open.
              </p>
              <button
                onClick={copyMondayToAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy Monday to all
              </button>
            </div>

            <div className="grid gap-3">
              {DAYS.map((day) => {
                const dayData = hoursSlots[day];
                const isClosed = dayData.isClosed;

                return (
                  <div
                    key={day}
                    className={`p-4 rounded-lg border transition-colors ${
                      isClosed
                        ? 'bg-slate-950/50 border-slate-800'
                        : 'bg-slate-950 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-300 capitalize">{day}</span>
                      <button
                        onClick={() => setDayClosed(day, !isClosed)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                          isClosed
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                        }`}
                      >
                        {isClosed ? 'Set as Open' : 'Set as Closed'}
                      </button>
                    </div>

                    {isClosed ? (
                      <p className="text-sm text-slate-500 italic">Closed</p>
                    ) : (
                      <div className="space-y-2">
                        {dayData.slots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <input
                              type="text"
                              value={slot.start}
                              onChange={(e) => updateSlot(day, idx, 'start', e.target.value)}
                              placeholder="9:00 AM"
                              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
                            />
                            <span className="text-slate-500 text-sm">-</span>
                            <input
                              type="text"
                              value={slot.end}
                              onChange={(e) => updateSlot(day, idx, 'end', e.target.value)}
                              placeholder="10:00 PM"
                              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
                            />
                            {dayData.slots.length > 1 && (
                              <button
                                onClick={() => removeSlot(day, idx)}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                title="Remove slot"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => addSlot(day)}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors mt-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add time slot
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Settings */}
        {activeTab === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-700 rounded-lg">
              <div>
                <div className="text-sm font-medium text-slate-300">Published</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {form.is_published
                    ? 'Merchant page is visible on the website'
                    : 'Merchant page is hidden (draft mode)'}
                </div>
              </div>
              <button
                onClick={() => updateField('is_published', !form.is_published)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.is_published ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.is_published ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Status</label>
              <div className="flex gap-3">
                {['active', 'inactive'].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateField('status', s)}
                    className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      form.status === s
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Inactive merchants show a friendly &quot;Unavailable&quot; page instead of their menu.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-300">Platform status
                <select value={form.platform_status} onChange={(e) => updateField('platform_status', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="DRAFT">Draft</option><option value="PENDING_REVIEW">Pending review</option><option value="PUBLISHED">Published</option><option value="SUSPENDED">Suspended</option><option value="ARCHIVED">Archived</option>
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">Controls BiteSite listing visibility.</span>
              </label>
              <label className="block text-sm font-medium text-slate-300">Business status
                <select value={form.business_status} onChange={(e) => updateField('business_status', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="OPEN">Open</option><option value="TEMPORARILY_CLOSED">Temporarily closed</option><option value="MOVED">Moved</option><option value="PERMANENTLY_CLOSED">Permanently closed</option>
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">Describes the merchant in the real world.</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Page Sections</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {FEATURES.map((f) => (
                  <label
                    key={f.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.features[f.key as keyof typeof form.features]
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-slate-950 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="mt-0.5">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          form.features[f.key as keyof typeof form.features]
                            ? 'bg-amber-500 border-amber-500'
                            : 'border-slate-600'
                        }`}
                      >
                        {form.features[f.key as keyof typeof form.features] && (
                          <Check className="w-3 h-3 text-slate-950" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-300">{f.label}</div>
                      <div className="text-xs text-slate-500">{f.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.features[f.key as keyof typeof form.features]}
                      onChange={(e) => updateFeature(f.key, e.target.checked)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Images */}
        {activeTab === 4 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Logo Image URL</label>
              <input
                type="text"
                value={form.logo_image}
                onChange={(e) => updateField('logo_image', e.target.value)}
                placeholder="https://..."
                className={`w-full px-4 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors ${
                  logoWarning ? 'border-yellow-500/50' : 'border-slate-700'
                }`}
              />
              {logoWarning && (
                <p className="mt-1 text-xs text-yellow-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  This doesn&apos;t look like a direct image URL. Make sure it ends with .jpg, .png, etc.
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Paste the direct image URL (ends with .jpg or .png). Right-click image &rarr; Copy image address.
              </p>
              {form.logo_image && (
                <div className="mt-3">
                  {!logoError ? (
                    <img
                      src={form.logo_image}
                      alt="Logo preview"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-700"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <span className="text-xs text-slate-500 text-center px-1">Failed to load</span>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3"><ImageUpload kind="merchant" value={form.logo_image} onChange={(value) => updateField('logo_image', value)} label="Or upload logo" help="JPG, PNG, or WebP; compressed to 1200px and max 5MB." /></div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Cover Image URL</label>
              <input
                type="text"
                value={form.cover_image}
                onChange={(e) => updateField('cover_image', e.target.value)}
                placeholder="https://..."
                className={`w-full px-4 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors ${
                  coverWarning ? 'border-yellow-500/50' : 'border-slate-700'
                }`}
              />
              {coverWarning && (
                <p className="mt-1 text-xs text-yellow-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  This doesn&apos;t look like a direct image URL. Make sure it ends with .jpg, .png, etc.
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Paste the direct image URL (ends with .jpg or .png). Right-click image &rarr; Copy image address.
              </p>
              {form.cover_image && (
                <div className="mt-3">
                  {!coverError ? (
                    <img
                      src={form.cover_image}
                      alt="Cover preview"
                      className="w-full h-32 rounded-lg object-cover border border-slate-700"
                      onError={() => setCoverError(true)}
                    />
                  ) : (
                    <div className="w-full h-32 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <span className="text-sm text-slate-500">Failed to load image. Check the URL.</span>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3"><ImageUpload kind="merchant" value={form.cover_image} onChange={(value) => updateField('cover_image', value)} label="Or upload cover" help="JPG, PNG, or WebP; compressed to 1200px and max 5MB." /></div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Menu PDF URL</label>
              <input
                type="text"
                value={form.menu_pdf_url}
                onChange={(e) => updateField('menu_pdf_url', e.target.value)}
                placeholder="https://..."
                className={`w-full px-4 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors ${
                  pdfWarning ? 'border-yellow-500/50' : 'border-slate-700'
                }`}
              />
              {pdfWarning && (
                <p className="mt-1 text-xs text-yellow-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  This doesn&apos;t look like a PDF URL. Make sure it ends with .pdf.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          {isEditing && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="px-4 py-2.5 text-slate-400 hover:text-white text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Update' : 'Create'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Merchant?</h3>
            <p className="text-slate-400 text-sm mb-6">
              This will permanently delete <strong className="text-white">{merchant?.name}</strong> and all its menu items, categories, and videos. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
