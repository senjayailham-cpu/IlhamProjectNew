import React, { useState, useEffect, useMemo } from 'react';
import { OrgSettings, INDUSTRY_TEMPLATES, User } from '../types';
import { can } from '../utils/permissions';
import { Settings, Plus, Trash2, ArrowUp, ArrowDown, Save, RefreshCw, CheckCircle2, AlertCircle, Image as ImageIcon, Upload, RotateCcw, Eye } from 'lucide-react';
import { useUIStore } from '../store';

interface OrgSettingsPageProps {
  orgSettings: OrgSettings;
  currentUser?: User | null;
  onSave: (settings: Partial<OrgSettings>) => Promise<void>;
  onApplyTemplate: (templateKey: string) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export function OrgSettingsPage({
  orgSettings,
  currentUser,
  onSave,
  onApplyTemplate,
  showToast,
}: OrgSettingsPageProps) {
  const [formData, setFormData] = useState<OrgSettings>(orgSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [templateConfirm, setTemplateConfirm] = useState<string | null>(null);

  const {
    backgroundImage,
    backgroundOpacity,
    setBackgroundImage,
    setBackgroundOpacity,
    resetBackground
  } = useUIStore();
  const bgFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify('Ukuran gambar maksimal 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setBackgroundImage(res);
        notify('Background web app berhasil diubah!', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const hasAccess = useMemo(() => {
    return can(currentUser ?? null, 'manageOrgSettings') || currentUser?.role === 'admin';
  }, [currentUser]);

  useEffect(() => {
    setFormData(orgSettings);
  }, [orgSettings]);

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (showToast) {
      showToast(msg, type);
    } else {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: msg, type },
        })
      );
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(formData);
      notify('Organization settings saved successfully!', 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to save organization settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setFormData(prev => ({ ...prev, industryTemplate: 'custom' }));
      return;
    }
    setTemplateConfirm(val);
  };

  const confirmApplyTemplate = async (templateKey: string) => {
    try {
      setIsSaving(true);
      await onApplyTemplate(templateKey);
      setTemplateConfirm(null);
      notify(`Applied ${templateKey.toUpperCase()} template defaults.`, 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to apply template.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Processing Stages helpers
  const handleStageChange = (idx: number, field: string, val: any) => {
    setFormData(prev => {
      const stages = [...prev.processingStages];
      stages[idx] = { ...stages[idx], [field]: val };
      return { ...prev, processingStages: stages, industryTemplate: 'custom' };
    });
  };

  const addStage = () => {
    setFormData(prev => {
      const nextKey = `stage_${prev.processingStages.length + 1}`;
      const stages = [
        ...prev.processingStages,
        {
          key: nextKey,
          label: `Stage ${prev.processingStages.length + 1}`,
          color: '#3b82f6',
          order: prev.processingStages.length + 1,
        },
      ];
      return { ...prev, processingStages: stages, industryTemplate: 'custom' };
    });
  };

  const removeStage = (idx: number) => {
    setFormData(prev => {
      const stages = prev.processingStages.filter((_, i) => i !== idx);
      return { ...prev, processingStages: stages, industryTemplate: 'custom' };
    });
  };

  const moveStage = (idx: number, dir: -1 | 1) => {
    setFormData(prev => {
      const stages = [...prev.processingStages];
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= stages.length) return prev;
      const temp = stages[idx];
      stages[idx] = stages[targetIdx];
      stages[targetIdx] = temp;
      // update order
      stages.forEach((s, i) => (s.order = i + 1));
      return { ...prev, processingStages: stages, industryTemplate: 'custom' };
    });
  };

  // Trade Positions helpers
  const handleTradeChange = (idx: number, field: string, val: any) => {
    setFormData(prev => {
      const trades = [...prev.tradePositions];
      trades[idx] = { ...trades[idx], [field]: val };
      return { ...prev, tradePositions: trades, industryTemplate: 'custom' };
    });
  };

  const addTrade = () => {
    setFormData(prev => {
      const nextKey = `trade_${prev.tradePositions.length + 1}`;
      const trades = [
        ...prev.tradePositions,
        { key: nextKey, label: 'New Role', color: '#10b981' },
      ];
      return { ...prev, tradePositions: trades, industryTemplate: 'custom' };
    });
  };

  const removeTrade = (idx: number) => {
    setFormData(prev => {
      const trades = prev.tradePositions.filter((_, i) => i !== idx);
      return { ...prev, tradePositions: trades, industryTemplate: 'custom' };
    });
  };

  // String List Helper Component
  const renderStringListEditor = (
    title: string,
    description: string,
    list: string[],
    onUpdate: (newList: string[]) => void
  ) => {
    return (
      <div className="bg-base-surface border border-base-border rounded-xl p-5 space-y-4 shadow-sm">
        <div>
          <h3 className="font-condensed font-extrabold text-base text-base-text uppercase tracking-wide">
            {title}
          </h3>
          <p className="text-xs text-base-muted">{description}</p>
        </div>

        <div className="space-y-2">
          {list.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                onChange={e => {
                  const copy = [...list];
                  copy[idx] = e.target.value;
                  onUpdate(copy);
                }}
                className="flex-1 bg-base-bg border border-base-border text-base-text px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:border-base-accent"
              />
              <button
                type="button"
                onClick={() => onUpdate(list.filter((_, i) => i !== idx))}
                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onUpdate([...list, 'New Item'])}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-base-surface2 hover:bg-base-surface3 text-base-text rounded-lg text-xs font-bold transition-all border border-base-border cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Item</span>
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-surface p-6 rounded-2xl border border-base-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-base-accent/10 text-base-accent rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-condensed font-extrabold text-2xl text-base-text uppercase tracking-wider">
              Organization Settings
            </h1>
            <p className="text-xs text-base-muted">
              Customize workflows, processing stages, trade positions, and terminology for your industry.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-base-accent hover:bg-base-accent/90 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Template Preset Selector */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 space-y-3 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-condensed font-extrabold text-lg text-base-text uppercase tracking-wide">
              Industry Template Preset
            </h2>
            <p className="text-xs text-base-muted">
              Select an industry template to load pre-configured stages, roles, inspection types, and terminology.
            </p>
          </div>

          <select
            value={formData.industryTemplate || 'custom'}
            onChange={handleTemplateChange}
            className="bg-base-bg border border-base-border text-base-text px-4 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-base-accent cursor-pointer min-w-[200px]"
          >
            <option value="fabrication">Fabrication & Manufacturing</option>
            <option value="construction">Construction & Building</option>
            <option value="it">IT & Software Development</option>
            <option value="general">General Project Management</option>
            <option value="custom">Custom Configuration</option>
          </select>
        </div>
      </div>

      {/* Template Confirmation Modal */}
      {templateConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-base-surface border border-base-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-condensed font-extrabold text-lg text-base-text uppercase tracking-wider">
                Apply Template Defaults?
              </h3>
            </div>
            <p className="text-xs text-base-muted leading-relaxed">
              This will replace your current processing stages, trade lists, inspection types, categories, and terminology with the{' '}
              <strong className="text-base-text uppercase">{templateConfirm}</strong> template defaults. Continue?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTemplateConfirm(null)}
                className="px-4 py-2 bg-base-surface2 hover:bg-base-surface3 text-base-text text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmApplyTemplate(templateConfirm)}
                className="px-4 py-2 bg-base-accent text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Yes, Apply Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section: Web App Background & Wallpaper */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-base-border/50 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-base-accent" />
              <h2 className="font-condensed font-extrabold text-lg text-base-text uppercase tracking-wide">
                Background Web App (Wallpaper)
              </h2>
            </div>
            <p className="text-xs text-base-muted mt-0.5">
              Tema visual wallpaper latar belakang untuk layar login dan workspace seluruh aplikasi.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={bgFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleBgFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => bgFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-base-surface2 hover:bg-base-accent/20 border border-base-border hover:border-base-accent/50 text-xs font-condensed font-bold text-base-text hover:text-base-accent rounded-lg transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Ganti / Upload Gambar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                resetBackground();
                notify('Background dikembalikan ke default truk tambang!', 'success');
              }}
              title="Reset ke gambar truk tambang default"
              className="flex items-center gap-1 px-3 py-1.5 bg-base-surface2 hover:bg-base-surface border border-base-border text-xs font-condensed font-bold text-base-muted hover:text-base-text rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Visual Preview */}
          <div className="md:col-span-1 relative h-36 rounded-xl overflow-hidden border border-base-border bg-black/50 group">
            <img
              src={backgroundImage || '/images/mining_truck_bg.svg'}
              alt="Mining Truck Background Preview"
              className="w-full h-full object-cover"
              style={{ opacity: Math.max(0.35, backgroundOpacity / 100) }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-2.5">
              <span className="text-xs font-condensed font-bold text-white tracking-wider uppercase">
                Heavy Mining Haul Truck
              </span>
              <span className="text-[10px] text-white/70 font-mono">
                Aktif di Login & Workspace ({backgroundOpacity}% opacity)
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="md:col-span-2 space-y-3 bg-base-surface2/60 p-4 rounded-xl border border-base-border/60">
            <div>
              <div className="flex items-center justify-between text-xs font-condensed mb-1.5">
                <span className="font-bold text-base-text flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-base-accent" />
                  Tingkat Transparansi di Workspace
                </span>
                <span className="font-mono font-bold text-sm text-base-accent bg-base-surface px-2 py-0.5 rounded border border-base-border">
                  {backgroundOpacity}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="2"
                value={backgroundOpacity}
                onChange={(e) => setBackgroundOpacity(Number(e.target.value))}
                className="w-full accent-base-accent cursor-pointer h-2 bg-base-surface rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-base-muted font-mono mt-1">
                <span>0% (Polos)</span>
                <span className="text-base-accent font-semibold">18% - 25% (Rekomendasi)</span>
                <span>50%</span>
                <span>80% (Pekat)</span>
              </div>
            </div>

            <p className="text-[11px] text-base-muted leading-relaxed">
              💡 <em>Di halaman login, gambar ini otomatis tampil penuh dengan efek pencahayaan sinematik. Di dalam ruang kerja (*workspace*), transparansi dapat diatur agar seluruh kartu, tabel, dan data tetap terbaca jelas.</em>
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Processing Stages */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-condensed font-extrabold text-lg text-base-text uppercase tracking-wide">
              Work Processing Stages
            </h2>
            <p className="text-xs text-base-muted">
              Configure the pipeline stages for items (e.g. Nesting, CNC, Bending, Machining or Foundation, Structure, MEP).
            </p>
          </div>
          <button
            type="button"
            onClick={addStage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-base-accent text-white rounded-lg text-xs font-bold hover:bg-base-accent/90 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stage</span>
          </button>
        </div>

        <div className="space-y-3">
          {formData.processingStages.map((stage, idx) => (
            <div
              key={stage.key || idx}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-base-bg/60 border border-base-border rounded-xl"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveStage(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 text-base-muted hover:text-base-text disabled:opacity-20 cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStage(idx, 1)}
                  disabled={idx === formData.processingStages.length - 1}
                  className="p-1 text-base-muted hover:text-base-text disabled:opacity-20 cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-base-muted block mb-0.5">Stage Slug/Key</label>
                  <input
                    type="text"
                    value={stage.key}
                    onChange={e => handleStageChange(idx, 'key', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    className="w-full bg-base-surface border border-base-border text-base-text px-3 py-1.5 rounded-lg text-xs font-mono"
                    placeholder="key_name"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-base-muted block mb-0.5">Display Label</label>
                  <input
                    type="text"
                    value={stage.label}
                    onChange={e => handleStageChange(idx, 'label', e.target.value)}
                    className="w-full bg-base-surface border border-base-border text-base-text px-3 py-1.5 rounded-lg text-xs font-semibold"
                    placeholder="Display Name"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-base-muted block mb-0.5">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={stage.color.startsWith('#') ? stage.color : '#3b82f6'}
                      onChange={e => handleStageChange(idx, 'color', e.target.value)}
                      className="w-8 h-8 rounded border border-base-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={stage.color}
                      onChange={e => handleStageChange(idx, 'color', e.target.value)}
                      className="flex-1 bg-base-surface border border-base-border text-base-text px-2 py-1.5 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeStage(idx)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all self-center sm:self-auto cursor-pointer"
                title="Remove Stage"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Trade / Position List */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-condensed font-extrabold text-lg text-base-text uppercase tracking-wide">
              Trade & Position Roles
            </h2>
            <p className="text-xs text-base-muted">
              Configure personnel positions and trade categories (e.g. Welder, Fitter, Mason, Electrician, Frontend Dev).
            </p>
          </div>
          <button
            type="button"
            onClick={addTrade}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-base-accent text-white rounded-lg text-xs font-bold hover:bg-base-accent/90 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Trade</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {formData.tradePositions.map((trade, idx) => (
            <div
              key={trade.key || idx}
              className="flex items-center gap-3 p-3 bg-base-bg/60 border border-base-border rounded-xl"
            >
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-base-muted block mb-0.5">Role Key</label>
                  <input
                    type="text"
                    value={trade.key}
                    onChange={e => handleTradeChange(idx, 'key', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    className="w-full bg-base-surface border border-base-border text-base-text px-3 py-1.5 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-base-muted block mb-0.5">Display Label</label>
                  <input
                    type="text"
                    value={trade.label}
                    onChange={e => handleTradeChange(idx, 'label', e.target.value)}
                    className="w-full bg-base-surface border border-base-border text-base-text px-3 py-1.5 rounded-lg text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-base-muted block mb-0.5">Color</label>
                <input
                  type="color"
                  value={trade.color.startsWith('#') ? trade.color : '#2c6eb3'}
                  onChange={e => handleTradeChange(idx, 'color', e.target.value)}
                  className="w-8 h-8 rounded border border-base-border cursor-pointer bg-transparent block"
                />
              </div>

              <button
                type="button"
                onClick={() => removeTrade(idx)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                title="Remove Role"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Grid of 4 Configurable Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderStringListEditor(
          'Inspection & Quality Types',
          'Configure inspection options available in Quality Control requests.',
          formData.inspectionTypes,
          list => setFormData(prev => ({ ...prev, inspectionTypes: list, industryTemplate: 'custom' }))
        )}

        {renderStringListEditor(
          'Project Categories',
          'Categories for grouping projects in list views and filters.',
          formData.projectCategories,
          list => setFormData(prev => ({ ...prev, projectCategories: list, industryTemplate: 'custom' }))
        )}

        {renderStringListEditor(
          'Project Locations & Worksites',
          'Worksite, workshop, or site location options.',
          formData.projectLocations,
          list => setFormData(prev => ({ ...prev, projectLocations: list, industryTemplate: 'custom' }))
        )}

        {renderStringListEditor(
          'Problem / Issue Categories',
          'Categories for field problem reports and safety/quality logs.',
          formData.issueCategories,
          list => setFormData(prev => ({ ...prev, issueCategories: list, industryTemplate: 'custom' }))
        )}
      </div>

      {/* Terminology Overrides */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 space-y-4 shadow-sm">
        <div>
          <h2 className="font-condensed font-extrabold text-lg text-base-text uppercase tracking-wide">
            Domain Terminology Labels
          </h2>
          <p className="text-xs text-base-muted">
            Relabel core domain concepts across forms, headers, and navigation items.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-base-text uppercase tracking-wider block mb-1">
              GA Number Label
            </label>
            <input
              type="text"
              value={formData.terminology.gaNumberLabel}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  industryTemplate: 'custom',
                  terminology: { ...prev.terminology, gaNumberLabel: e.target.value },
                }))
              }
              className="w-full bg-base-bg border border-base-border text-base-text px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-base-accent"
              placeholder="e.g. Design Reference"
            />
            <p className="text-[10px] text-base-muted mt-1">Default: "GA Number"</p>
          </div>

          <div>
            <label className="text-xs font-bold text-base-text uppercase tracking-wider block mb-1">
              Material Processing Label
            </label>
            <input
              type="text"
              value={formData.terminology.materialProcessingLabel}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  industryTemplate: 'custom',
                  terminology: { ...prev.terminology, materialProcessingLabel: e.target.value },
                }))
              }
              className="w-full bg-base-bg border border-base-border text-base-text px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-base-accent"
              placeholder="e.g. Work Stages"
            />
            <p className="text-[10px] text-base-muted mt-1">Default: "Material Processing"</p>
          </div>

          <div>
            <label className="text-xs font-bold text-base-text uppercase tracking-wider block mb-1">
              Consumable Label
            </label>
            <input
              type="text"
              value={formData.terminology.wireConsumableLabel}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  industryTemplate: 'custom',
                  terminology: { ...prev.terminology, wireConsumableLabel: e.target.value },
                }))
              }
              className="w-full bg-base-bg border border-base-border text-base-text px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-base-accent"
              placeholder="e.g. Consumables"
            />
            <p className="text-[10px] text-base-muted mt-1">Default: "Consumable"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
