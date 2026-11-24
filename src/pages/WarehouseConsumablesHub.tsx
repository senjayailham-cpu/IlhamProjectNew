import React from 'react';
import {
  MaterialItem,
  MaterialRequest,
  MaterialRequestStatus,
  MaterialConsumptionLog,
  WireLog,
  Project,
  Employee,
  TimesheetEntry,
  User,
  OrgSettings,
} from '../types';
import MaterialsView from '../components/MaterialsView';
import ConsumableView from '../components/ConsumableView';
import KPIView from '../components/KPIView';
import { can } from '../utils/permissions';
import { useUIStore } from '../store';
import { Package, Droplets, BarChart2, ShoppingCart } from 'lucide-react';

interface WarehouseConsumablesHubProps {
  subTab: 'materials' | 'consumable' | 'kpi';
  onSubTabChange: (tab: 'materials' | 'consumable' | 'kpi') => void;
  orgSettings?: OrgSettings;
  materials: MaterialItem[];
  materialRequests: MaterialRequest[];
  consumptionLogs: MaterialConsumptionLog[];
  wireLogs: WireLog[];
  projects: Project[];
  employees: Employee[];
  timesheets: TimesheetEntry[];
  currentUser: User;
  onAddMaterial: (mat: Omit<MaterialItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateMaterialStock: (id: string, newStock: number) => void;
  onUpdateMaterial: (id: string, updates: Partial<MaterialItem>) => void;
  onDeleteMaterial: (id: string) => void;
  onAddMaterialRequest: (req: Omit<MaterialRequest, 'id' | 'mrNo'>) => void;
  onUpdateMaterialRequestStatus: (
    id: string,
    status: MaterialRequestStatus,
    extra?: { approvedBy?: string; rejectedReason?: string; issuedBy?: string }
  ) => void;
  onDeleteMaterialRequest: (id: string) => void;
  onAddConsumptionLog: (log: Omit<MaterialConsumptionLog, 'id'>) => Promise<void>;
  onDeleteWireLog: (id: string) => void;
  setDeleteConfirm?: (confirm: any) => void;
}

export default function WarehouseConsumablesHub({
  subTab,
  onSubTabChange,
  orgSettings,
  materials,
  materialRequests,
  consumptionLogs,
  wireLogs,
  projects,
  employees,
  timesheets,
  currentUser,
  onAddMaterial,
  onUpdateMaterialStock,
  onUpdateMaterial,
  onDeleteMaterial,
  onAddMaterialRequest,
  onUpdateMaterialRequestStatus,
  onDeleteMaterialRequest,
  onAddConsumptionLog,
  onDeleteWireLog,
  setDeleteConfirm,
}: WarehouseConsumablesHubProps) {
  const consumableLabel = orgSettings?.terminology?.wireConsumableLabel || 'Consumables & Wire';
  const openQuickOrder = useUIStore((s) => s.openQuickOrder);
  const canRequestMaterial = can(currentUser, 'requestMaterial');

  return (
    <div className="space-y-4">
      {/* Unified Warehouse & Consumables Sub-Navigation */}
      <div className="bg-base-surface border border-base-border rounded-xl p-2 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 bg-base-surface2 border border-base-border p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onSubTabChange('materials')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'materials'
                ? 'bg-[#9b1c2e] text-white shadow-xs'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface/60'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Stok & Material Request</span>
          </button>
          <button
            type="button"
            onClick={() => onSubTabChange('consumable')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'consumable'
                ? 'bg-[#9b1c2e] text-white shadow-xs'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface/60'
            }`}
          >
            <Droplets className="h-3.5 w-3.5" />
            <span>{consumableLabel} & PPE</span>
          </button>
          <button
            type="button"
            onClick={() => onSubTabChange('kpi')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'kpi'
                ? 'bg-[#9b1c2e] text-white shadow-xs'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface/60'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            <span>KPI Pemakaian</span>
          </button>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[11px] text-base-muted font-sans hidden xl:inline">
            Pengelolaan stok gudang, permintaan material, log pemakaian kawat las/PPE, &amp; analisis KPI.
          </span>
          {canRequestMaterial && (
            <button
              type="button"
              onClick={() =>
                openQuickOrder({
                  category: subTab === 'consumable' ? 'consumable' : 'all',
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-base-accent hover:bg-base-accent/90 text-white text-xs font-condensed font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Order Cepat</span>
            </button>
          )}
        </div>
      </div>

      {subTab === 'materials' && (
        <MaterialsView
          materials={materials}
          materialRequests={materialRequests}
          consumptionLogs={consumptionLogs}
          projects={projects}
          currentUser={currentUser}
          onAddMaterial={onAddMaterial}
          onUpdateMaterialStock={onUpdateMaterialStock}
          onUpdateMaterial={onUpdateMaterial}
          onDeleteMaterial={onDeleteMaterial}
          onAddMaterialRequest={onAddMaterialRequest}
          onUpdateMaterialRequestStatus={onUpdateMaterialRequestStatus}
          onDeleteMaterialRequest={onDeleteMaterialRequest}
          onAddConsumptionLog={onAddConsumptionLog}
          setDeleteConfirm={setDeleteConfirm}
        />
      )}

      {subTab === 'consumable' && (
        <ConsumableView
          orgSettings={orgSettings}
          wireLogs={wireLogs}
          consumptionLogs={consumptionLogs}
          materials={materials}
          projects={projects}
          employees={employees}
          currentUser={currentUser}
          materialRequests={materialRequests}
          onDeleteWireLog={onDeleteWireLog}
          onAddMaterialRequest={onAddMaterialRequest}
          onUpdateMaterialRequestStatus={onUpdateMaterialRequestStatus}
          onNavigateToKPI={() => onSubTabChange('kpi')}
          onNavigateToMaterials={() => onSubTabChange('materials')}
          onAddMaterial={onAddMaterial}
          onUpdateMaterial={onUpdateMaterial}
          onDeleteMaterial={onDeleteMaterial}
          setDeleteConfirm={setDeleteConfirm}
        />
      )}

      {subTab === 'kpi' && (
        <KPIView
          wireLogs={wireLogs}
          consumptionLogs={consumptionLogs}
          projects={projects}
          employees={employees}
          currentUser={currentUser}
          timesheets={timesheets}
        />
      )}
    </div>
  );
}
