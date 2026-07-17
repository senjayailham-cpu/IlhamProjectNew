import React, { useState, useMemo } from 'react';
import { useMasterData } from '../hooks/useMasterData';
import { MasterDataEntry, User } from '../types';
import { Database, Search, Trash2, GitMerge, AlertTriangle, Check, X } from 'lucide-react';

interface MasterDataViewProps {
  currentUser: User;
}

const CATEGORIES: { key: MasterDataEntry['category']; label: string }[] = [
  { key: 'gaNumber', label: 'GA Number' },
  { key: 'material', label: 'Material' },
  { key: 'partNo', label: 'Part No' },
  { key: 'subAssembly', label: 'Sub-Assembly' },
];

export function MasterDataView({ currentUser }: MasterDataViewProps) {
  const { entries, loading, deleteEntry, mergeEntries } = useMasterData(!!currentUser);
  const [activeTab, setActiveTab] = useState<MasterDataEntry['category']>('gaNumber');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Merge dialog states
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [primaryEntryId, setPrimaryEntryId] = useState<string>('');

  // Access check
  const hasAccess = useMemo(() => {
    return currentUser?.role === 'admin' || currentUser?.role === 'manager';
  }, [currentUser]);

  // Filter items
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchCategory = e.category === activeTab;
      const matchSearch = searchQuery.trim()
        ? e.value.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
          (e.gaNumber && e.gaNumber.toLowerCase().includes(searchQuery.toLowerCase().trim()))
        : true;
      return matchCategory && matchSearch;
    });
  }, [entries, activeTab, searchQuery]);

  // Handle category switch
  const handleTabChange = (category: MasterDataEntry['category']) => {
    setActiveTab(category);
    setSelectedIds([]);
    setSearchQuery('');
  };

  // Toggle single selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle select all on current filtered view
  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredEntries.map((e) => e.id);
    const areAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.includes(id));

    if (areAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const next = [...prev];
        allFilteredIds.forEach((id) => {
          if (!next.includes(id)) {
            next.push(id);
          }
        });
        return next;
      });
    }
  };

  const isAllSelected = useMemo(() => {
    if (filteredEntries.length === 0) return false;
    return filteredEntries.every((e) => selectedIds.includes(e.id));
  }, [filteredEntries, selectedIds]);

  // Open merge confirmation modal
  const handleOpenMergeModal = () => {
    if (selectedIds.length < 2) {
      alert('Pilih minimal 2 item untuk digabungkan.');
      return;
    }
    // Set first item as default primary/main entry
    setPrimaryEntryId(selectedIds[0]);
    setIsMergeModalOpen(true);
  };

  // Confirm and execute merging
  const handleConfirmMerge = async () => {
    if (!primaryEntryId) return;
    const mergeFromIds = selectedIds.filter((id) => id !== primaryEntryId);
    
    await mergeEntries(primaryEntryId, mergeFromIds);
    
    // Reset states
    setSelectedIds([]);
    setIsMergeModalOpen(false);
  };

  // Delete handler
  const handleDelete = async (id: string, value: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus "${value}" dari Master Data?`)) {
      await deleteEntry(id);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // Find detailed objects for selected items for the merge selection dropdown/radio list
  const selectedEntries = useMemo(() => {
    return entries.filter((e) => selectedIds.includes(e.id));
  }, [entries, selectedIds]);

  if (!hasAccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-base-surface border border-base-border rounded-xl my-6">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="font-condensed font-extrabold text-red-500 text-xl uppercase tracking-wider">
          Access Denied
        </h2>
        <p className="text-sm text-base-muted max-w-md mt-2">
          Halaman Master Data hanya dapat diakses oleh Admin atau Manager.
        </p>
      </div>
    );
  }

  return (
    <div id="master-data-view-root" className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-border pb-5">
        <div>
          <h2 className="text-xl font-condensed font-black uppercase tracking-tight text-base-text flex items-center gap-2">
            <Database className="h-5 w-5 text-base-accent" />
            <span>Master Data Referensi</span>
          </h2>
          <p className="text-xs text-base-muted font-sans font-medium mt-1">
            Kelola data master untuk item-item yang sering berulang agar konsisten, kurangi duplikasi desain & material.
          </p>
        </div>

        {/* TABS CONTROLLER */}
        <div className="flex bg-base-surface2 border border-base-border p-1 rounded-xl shadow-xs self-start">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleTabChange(cat.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase transition-all cursor-pointer ${
                activeTab === cat.key
                  ? 'bg-base-accent text-white shadow-xs'
                  : 'text-base-muted hover:text-base-text'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* FILTER & ACTIONS BAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari referensi ${CATEGORIES.find((c) => c.key === activeTab)?.label || ''}...`}
            className="input-field pl-9 w-full text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-base-muted hover:text-base-text"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Bulk Action: Merge */}
        {selectedIds.length >= 2 && (
          <button
            onClick={handleOpenMergeModal}
            className="px-4 py-2 bg-base-accent-dim/15 border border-base-accent/30 text-base-accent rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-base-accent-dim/25 transition-all cursor-pointer animate-in fade-in slide-in-from-right-1 duration-150"
          >
            <GitMerge className="h-4 w-4" />
            <span>Gabungkan {selectedIds.length} Data Terpilih</span>
          </button>
        )}
      </div>

      {/* TABLE VIEW */}
      <div className="overflow-x-auto rounded-xl border border-base-border bg-base-surface shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-base-muted font-sans">
            Menghubungkan ke database master data...
          </div>
        ) : (
          <table className="w-full border-collapse text-left min-w-[800px]">
            <thead>
              <tr className="bg-base-surface2 border-b border-base-border text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted sticky top-0 z-10">
                <th className="py-2.5 px-3 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-base-border text-base-accent focus:ring-base-accent"
                  />
                </th>
                <th className="py-2.5 px-3">Value / Nama Item</th>
                {activeTab === 'material' && <th className="py-2.5 px-3 w-40">GA Number</th>}
                <th className="py-2.5 px-3 w-32 text-center">Frekuensi Pakai</th>
                <th className="py-2.5 px-3 w-48">Terakhir Digunakan</th>
                <th className="py-2.5 px-3 w-48">Dibuat Pada</th>
                <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-border/40 text-xs">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'material' ? 7 : 6} className="py-12 text-center text-base-muted">
                    Tidak ada data master ditemukan di kategori ini.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item) => {
                  const isChecked = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-base-surface2/25 transition-colors h-11 ${
                        isChecked ? 'bg-base-accent-dim/5' : ''
                      }`}
                    >
                      {/* Checkbox select */}
                      <td className="py-1 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(item.id)}
                          className="h-3.5 w-3.5 rounded border-base-border text-base-accent focus:ring-base-accent"
                        />
                      </td>

                      {/* Value / Nama Item */}
                      <td className="py-1 px-3">
                        <div className="font-bold text-base-text line-clamp-1" title={item.value}>
                          {item.value}
                        </div>
                        {item.createdBy && (
                          <div className="text-[9px] text-base-muted mt-0.5">
                            Oleh: {item.createdBy}
                          </div>
                        )}
                      </td>

                      {/* GA Number (khusus material) */}
                      {activeTab === 'material' && (
                        <td className="py-1 px-3">
                          {item.gaNumber ? (
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-base-surface3 border border-base-border text-base-accent rounded-md">
                              {item.gaNumber}
                            </span>
                          ) : (
                            <span className="text-base-muted italic text-[11px]">—</span>
                          )}
                        </td>
                      )}

                      {/* Usage Count */}
                      <td className="py-1 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-base-surface3 text-base-text border border-base-border/50">
                          {item.usageCount || 0}x
                        </span>
                      </td>

                      {/* Last Used Date */}
                      <td className="py-1 px-3 text-base-muted font-mono text-[10px]">
                        {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '—'}
                      </td>

                      {/* Created At */}
                      <td className="py-1 px-3 text-base-muted font-mono text-[10px]">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-1 px-3 text-center">
                        <button
                          onClick={() => handleDelete(item.id, item.value)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-base-muted hover:text-red-500 transition-colors cursor-pointer"
                          title="Hapus data referensi"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MERGE CONFIRMATION DIALOG MODAL */}
      {isMergeModalOpen && (
        <div id="md-merge-modal" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2">
              <h3 className="font-condensed font-black uppercase text-base text-base-text flex items-center gap-2">
                <GitMerge className="h-5 w-5 text-base-accent" />
                <span>Gabungkan Data Referensi</span>
              </h3>
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="p-1 rounded-full hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg text-amber-500 text-xs">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Perhatian Penggabungan Data</p>
                  <p className="mt-1 leading-relaxed text-base-muted">
                    Proses ini akan melebur semua item terpilih menjadi satu item utama. Total frekuensi penggunaan akan digabungkan, dan item sekunder lainnya akan dihapus permanen.
                  </p>
                </div>
              </div>

              {/* Select Primary/Master Item */}
              <div className="space-y-2">
                <label className="text-xs font-condensed font-bold uppercase text-base-muted block">
                  Pilih Data Utama yang Ingin Dipertahankan:
                </label>
                <div className="border border-base-border rounded-lg bg-base-surface2 divide-y divide-base-border max-h-52 overflow-y-auto">
                  {selectedEntries.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-start gap-3 p-3 hover:bg-base-surface3/50 transition-colors cursor-pointer select-none"
                    >
                      <input
                        type="radio"
                        name="primaryEntry"
                        checked={primaryEntryId === e.id}
                        onChange={() => setPrimaryEntryId(e.id)}
                        className="mt-0.5 h-4 w-4 text-base-accent focus:ring-base-accent border-base-border"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-base-text block truncate">{e.value}</span>
                        <div className="flex items-center gap-3 text-[10px] text-base-muted mt-0.5 font-mono">
                          <span>Usage: {e.usageCount || 0}x</span>
                          {e.gaNumber && <span className="text-base-accent font-bold">GA: {e.gaNumber}</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-base-border flex items-center justify-end gap-3 bg-base-surface2">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2 bg-base-surface border border-base-border hover:bg-base-surface3 text-base-text text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                className="px-4 py-2 bg-base-accent hover:bg-base-accent-dim text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>Gabungkan Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterDataView;
