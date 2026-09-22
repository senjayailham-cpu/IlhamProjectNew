import React, { useState, useMemo } from 'react';
import { User, UserSessionLog, UserRoleType } from '../../types';
import { useUserSessions } from '../../hooks/useUserSessions';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Clock, 
  Users, 
  CheckCircle, 
  Laptop, 
  Smartphone, 
  Trash2, 
  Calendar,
  AlertCircle,
  Eye,
  Shield,
  Activity,
  X
} from 'lucide-react';

interface UserSessionAuditViewProps {
  currentUser: User | null;
  users: User[];
}

export default function UserSessionAuditView({ currentUser, users }: UserSessionAuditViewProps) {
  const { 
    sessions, 
    isLoading, 
    deleteSessionLog, 
    exportSessionsToCSV 
  } = useUserSessions();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | '30days' | 'all'>('all');
  const [selectedSessionForDetail, setSelectedSessionForDetail] = useState<UserSessionLog | null>(null);

  // Helper date filters
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.userName.toLowerCase().includes(q);
        const matchesId = s.userId.toLowerCase().includes(q);
        const matchesDevice = s.deviceInfo?.toLowerCase().includes(q) || false;
        const matchesRole = s.userRole.toLowerCase().includes(q);
        const matchesSessionId = s.sessionId?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesId && !matchesDevice && !matchesRole && !matchesSessionId) {
          return false;
        }
      }

      // Role filter
      if (roleFilter !== 'all' && s.userRole !== roleFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && s.status !== statusFilter) {
        return false;
      }

      // Date filter
      if (dateFilter === 'today') {
        if (!s.loginTs.startsWith(todayStr)) return false;
      } else if (dateFilter === '7days') {
        if (new Date(s.loginTs) < sevenDaysAgo) return false;
      } else if (dateFilter === '30days') {
        if (new Date(s.loginTs) < thirtyDaysAgo) return false;
      }

      return true;
    });
  }, [sessions, searchQuery, roleFilter, statusFilter, dateFilter, todayStr, sevenDaysAgo, thirtyDaysAgo]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const activeCount = sessions.filter(s => s.status === 'active').length;
    const todaySessions = sessions.filter(s => s.loginTs.startsWith(todayStr)).length;
    const uniqueUsersCount = new Set(sessions.map(s => s.userId)).size;

    const completedWithDuration = sessions.filter(s => s.status === 'logged_out' && typeof s.durationMinutes === 'number');
    const totalMinutes = completedWithDuration.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
    const avgDuration = completedWithDuration.length > 0 ? Math.round(totalMinutes / completedWithDuration.length) : 0;

    return {
      activeCount,
      todaySessions,
      uniqueUsersCount,
      avgDuration
    };
  }, [sessions, todayStr]);

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return '-';
    try {
      const d = new Date(ts);
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return ts;
    }
  };

  const formatRelativeTime = (ts: string) => {
    try {
      const diffMs = Date.now() - new Date(ts).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} mnt lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} jam lalu`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} hari lalu`;
    } catch {
      return '';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-0.5 text-xxs font-condensed font-bold uppercase rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">Admin</span>;
      case 'manager':
        return <span className="px-2 py-0.5 text-xxs font-condensed font-bold uppercase rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">Manager</span>;
      case 'coordinator':
        return <span className="px-2 py-0.5 text-xxs font-condensed font-bold uppercase rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Coordinator</span>;
      case 'quality_control':
      case 'quality control':
        return <span className="px-2 py-0.5 text-xxs font-condensed font-bold uppercase rounded bg-teal-500/10 text-teal-500 border border-teal-500/20">Quality Control</span>;
      case 'safety':
        return <span className="px-2 py-0.5 text-xxs font-condensed font-bold uppercase rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Safety HSE</span>;
      case 'facility maintanance':
      case 'facility':
        return <span className="px-2 py-0.5 text-xxs font-condensed font-bold uppercase rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">Facility</span>;
      case 'project control':
        return <span className="px-2 py-0.5 text-xxs font-condensed font-bold uppercase rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">Project Control</span>;
      default:
        return <span className="px-2 py-0.5 text-xxs font-condensed font-bold uppercase rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">{role}</span>;
    }
  };

  const getDeviceIcon = (deviceInfo?: string) => {
    if (!deviceInfo) return <Laptop className="w-3.5 h-3.5 text-base-muted" />;
    if (deviceInfo.includes('Mobile') || deviceInfo.includes('Android') || deviceInfo.includes('iOS')) {
      return <Smartphone className="w-3.5 h-3.5 text-amber-500" />;
    }
    return <Laptop className="w-3.5 h-3.5 text-sky-500" />;
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xxs font-condensed uppercase font-bold text-base-muted tracking-wider">User Sedang Online</div>
            <div className="text-2xl font-black font-condensed text-emerald-500 mt-1 flex items-center gap-1.5">
              <span>{kpis.activeCount}</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="text-[10px] text-base-muted mt-0.5">Sesi aktif saat ini</div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xxs font-condensed uppercase font-bold text-base-muted tracking-wider">Total Sesi Hari Ini</div>
            <div className="text-2xl font-black font-condensed text-base-text mt-1">
              {kpis.todaySessions}
            </div>
            <div className="text-[10px] text-base-muted mt-0.5">Catatan login {todayStr}</div>
          </div>
          <div className="p-3 bg-sky-500/10 rounded-xl text-sky-500">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xxs font-condensed uppercase font-bold text-base-muted tracking-wider">User Unik Terdaftar</div>
            <div className="text-2xl font-black font-condensed text-base-text mt-1">
              {kpis.uniqueUsersCount}
            </div>
            <div className="text-[10px] text-base-muted mt-0.5">Dari {users.length} total akun</div>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xxs font-condensed uppercase font-bold text-base-muted tracking-wider">Rata-rata Durasi Sesi</div>
            <div className="text-2xl font-black font-condensed text-base-text mt-1">
              {kpis.avgDuration > 0 ? `${kpis.avgDuration} mnt` : '-'}
            </div>
            <div className="text-[10px] text-base-muted mt-0.5">Waktu aktif per sesi</div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-muted" />
            <input
              type="text"
              placeholder="Cari nama pengguna, ID user, atau perangkat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-base-surface2 border border-base-border rounded-lg text-base-text placeholder:text-base-muted focus:outline-none focus:border-base-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-base-muted hover:text-base-text"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-base-surface2 border border-base-border rounded-lg text-base-text focus:outline-none focus:border-base-accent font-condensed uppercase font-semibold"
          >
            <option value="all">Semua Role</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="coordinator">Coordinator</option>
            <option value="quality_control">Quality Control</option>
            <option value="safety">Safety HSE</option>
            <option value="facility maintanance">Facility</option>
            <option value="project control">Project Control</option>
            <option value="viewer">Viewer</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-base-surface2 border border-base-border rounded-lg text-base-text focus:outline-none focus:border-base-accent font-condensed uppercase font-semibold"
          >
            <option value="all">Semua Status</option>
            <option value="active">● Sedang Online (Aktif)</option>
            <option value="logged_out">Logged Out</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs bg-base-surface2 border border-base-border rounded-lg text-base-text focus:outline-none focus:border-base-accent font-condensed uppercase font-semibold"
          >
            <option value="all">Semua Tanggal</option>
            <option value="today">Hari Ini</option>
            <option value="7days">7 Hari Terakhir</option>
            <option value="30days">30 Hari Terakhir</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <button
            onClick={() => exportSessionsToCSV(filteredSessions)}
            disabled={filteredSessions.length === 0}
            className="px-3 py-1.5 bg-base-surface2 hover:bg-base-surface3 border border-base-border text-base-text font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download audit catatan login & logout format CSV"
          >
            <Download className="w-3.5 h-3.5 text-base-accent" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* SESSIONS AUDIT TABLE */}
      <div className="bg-base-surface border border-base-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-3.5 bg-base-surface2 border-b border-base-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#9b1c2e]" />
            <h3 className="text-xs font-condensed font-extrabold uppercase tracking-wider text-base-text">
              Riwayat Sesi Login & Logout ({filteredSessions.length} Rekaman)
            </h3>
          </div>
          <span className="text-[10px] text-base-muted font-mono flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Real-time Audit Trail
          </span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="py-16 text-center text-base-muted flex flex-col items-center justify-center gap-2">
            <History className="w-10 h-10 text-base-border animate-pulse" />
            <div className="text-xs font-bold uppercase font-condensed tracking-wider">Tidak Ada Catatan Sesi</div>
            <p className="text-xxs text-base-muted/80 max-w-sm">
              Tidak ada riwayat login/logout yang sesuai dengan filter pencarian yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-base-border bg-base-surface/50 text-[11px] font-condensed uppercase font-bold text-base-muted tracking-wider">
                  <th className="py-2.5 px-3.5">Pengguna / User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Waktu Login</th>
                  <th className="py-2.5 px-3">Waktu Logout</th>
                  <th className="py-2.5 px-3">Durasi</th>
                  <th className="py-2.5 px-3">Perangkat / Client</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border/50">
                {filteredSessions.map((sess) => {
                  const isOnline = sess.status === 'active';
                  return (
                    <tr 
                      key={sess.id}
                      className="hover:bg-base-surface2/60 transition-colors group"
                    >
                      {/* User Info */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xxs border ${
                            isOnline 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                              : 'bg-base-surface3 border-base-border text-base-muted'
                          }`}>
                            {sess.userName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-base-text font-condensed text-xs flex items-center gap-1.5">
                              {sess.userName}
                              {currentUser && currentUser.id === sess.userId && (
                                <span className="text-[9px] font-condensed uppercase px-1 py-0.2 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-base-muted font-mono">
                              ID: {sess.userId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3">
                        {getRoleBadge(sess.userRole)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xxs font-condensed font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            ONLINE / AKTIF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xxs font-condensed font-bold uppercase bg-base-surface3 text-base-muted border border-base-border">
                            LOGGED OUT
                          </span>
                        )}
                      </td>

                      {/* Login Timestamp */}
                      <td className="py-3 px-3">
                        <div className="font-mono text-xs text-base-text">
                          {formatTimestamp(sess.loginTs)}
                        </div>
                        <div className="text-[10px] text-base-muted">
                          {formatRelativeTime(sess.loginTs)}
                        </div>
                      </td>

                      {/* Logout Timestamp */}
                      <td className="py-3 px-3">
                        {sess.logoutTs ? (
                          <>
                            <div className="font-mono text-xs text-base-text">
                              {formatTimestamp(sess.logoutTs)}
                            </div>
                            <div className="text-[10px] text-base-muted">
                              {formatRelativeTime(sess.logoutTs)}
                            </div>
                          </>
                        ) : (
                          <span className="text-[11px] text-emerald-500 italic font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Sesi Berjalan...
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-3 font-mono text-xs">
                        {isOnline ? (
                          <span className="text-emerald-500 font-bold">Sedang Aktif</span>
                        ) : sess.durationMinutes !== null && sess.durationMinutes !== undefined ? (
                          <span className="text-base-text font-medium">
                            {sess.durationMinutes >= 60 
                              ? `${Math.floor(sess.durationMinutes / 60)}j ${sess.durationMinutes % 60}m` 
                              : `${sess.durationMinutes} mnt`}
                          </span>
                        ) : (
                          <span className="text-base-muted">-</span>
                        )}
                      </td>

                      {/* Device / Client */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 text-xs text-base-muted">
                          {getDeviceIcon(sess.deviceInfo)}
                          <span className="truncate max-w-[150px]" title={sess.deviceInfo}>
                            {sess.deviceInfo || 'Web Portal'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedSessionForDetail(sess)}
                            className="p-1 text-base-muted hover:text-base-accent hover:bg-base-surface3 rounded transition-colors cursor-pointer"
                            title="Lihat Detail Sesi"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {currentUser?.role === 'admin' && (
                            <button
                              onClick={() => deleteSessionLog(sess.id)}
                              className="p-1 text-base-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                              title="Hapus Catatan Ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedSessionForDetail && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] z-50 animate-fade-in">
          <div className="bg-base-surface border border-base-border shadow-modal rounded-xl w-full max-w-md overflow-hidden p-6 space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-base-border">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-base-accent" />
                <h4 className="text-sm font-bold text-base-text uppercase font-condensed tracking-wider">
                  Detail Audit Sesi Pengguna
                </h4>
              </div>
              <button
                onClick={() => setSelectedSessionForDetail(null)}
                className="p-1 text-base-muted hover:text-base-text rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-base-border/50">
                <span className="text-base-muted">Nama Pengguna:</span>
                <span className="font-bold text-base-text">{selectedSessionForDetail.userName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-base-border/50">
                <span className="text-base-muted">User ID:</span>
                <span className="font-mono text-base-text">{selectedSessionForDetail.userId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-base-border/50">
                <span className="text-base-muted">Role / Akses:</span>
                <span>{getRoleBadge(selectedSessionForDetail.userRole)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-base-border/50">
                <span className="text-base-muted">Status Sesi:</span>
                <span className={selectedSessionForDetail.status === 'active' ? 'text-emerald-500 font-bold' : 'text-base-muted'}>
                  {selectedSessionForDetail.status === 'active' ? '● AKTIF / ONLINE' : 'LOGGED OUT'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-base-border/50">
                <span className="text-base-muted">Waktu Login:</span>
                <span className="font-mono text-base-text">{formatTimestamp(selectedSessionForDetail.loginTs)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-base-border/50">
                <span className="text-base-muted">Waktu Logout:</span>
                <span className="font-mono text-base-text">
                  {selectedSessionForDetail.logoutTs ? formatTimestamp(selectedSessionForDetail.logoutTs) : 'Sesi masih aktif'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-base-border/50">
                <span className="text-base-muted">Durasi Total:</span>
                <span className="font-bold text-base-text">
                  {selectedSessionForDetail.durationMinutes 
                    ? `${selectedSessionForDetail.durationMinutes} Menit` 
                    : (selectedSessionForDetail.status === 'active' ? 'Sedang Berlangsung' : '-')}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-base-border/50">
                <span className="text-base-muted">Perangkat / Browser:</span>
                <span className="text-base-text">{selectedSessionForDetail.deviceInfo || 'Web Browser'}</span>
              </div>
              <div className="flex flex-col py-1.5 border-b border-base-border/50">
                <span className="text-base-muted mb-1">Session ID Hash:</span>
                <span className="font-mono text-[10px] text-base-muted break-all bg-base-surface2 p-1.5 rounded">
                  {selectedSessionForDetail.sessionId || selectedSessionForDetail.id}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSessionForDetail(null)}
                className="px-4 py-2 bg-base-surface2 hover:bg-base-surface3 border border-base-border text-base-text font-condensed font-bold uppercase tracking-wider rounded-lg text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
