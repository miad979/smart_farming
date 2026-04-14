import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import * as api from '../utils/api';
import { 
  Users, UserCheck, Stethoscope, Activity, Search, 
  Edit, Trash2, Eye, TrendingUp, Shield,
  Database, Clock, Settings, RefreshCw, Crown, UserCog, Download, Sparkles
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Link } from 'react-router';

export const AdminDashboard: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;
  const isPrimaryAdmin = state.user.role === 'admin';
  const isSuperUser = state.user.role === 'super_admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTargetUserId, setSettingsTargetUserId] = useState('');
  const [settingsTargetRole, setSettingsTargetRole] = useState('admin');
  const [settingsTab, setSettingsTab] = useState('access');
  const [systemHealth, setSystemHealth] = useState<any | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [editDraft, setEditDraft] = useState({
    name: '',
    location: '',
    specialty: '',
    role: 'farmer',
    verificationStatus: 'pending',
    registrationNumber: '',
  });

  const buildEditDraft = (user: any) => ({
    name: user.name || '',
    location: user.location || user.location_bn || '',
    specialty: user.specialty || user.specialty_bn || '',
    role: user.role || 'farmer',
    verificationStatus: user.verificationStatus || 'pending',
    registrationNumber: user.registrationNumber || '',
  });

  const getRoleLabel = (role?: string, roleBn?: string) => {
    if (lang === 'bn') {
      return roleBn || (role === 'super_admin' ? 'সুপার ইউজার' : role || '—');
    }
    if (role === 'super_admin') return 'Super User';
    if (role === 'admin') return 'Admin';
    if (role === 'doctor') return 'Doctor';
    if (role === 'farmer') return 'Farmer';
    return role || '—';
  };

  const closeDetailModal = () => {
    setIsDetailOpen(false);
    setSelectedUser(null);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setSelectedUser(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteOpen(false);
    setSelectedUser(null);
  };

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  };

  const refreshUsers = async () => {
    if (!state.accessToken) {
      setIsLoadingUsers(false);
      setUsersLoadError(lang === 'bn' ? 'সেশন নেই, আবার লগইন করুন' : 'No active session, please sign in again');
      return;
    }
    try {
      setIsLoadingUsers(true);
      setUsersLoadError(null);
      const res = await api.getAllUsers(state.accessToken);
      const sorted = [...(res.users || [])].sort((a, b) => {
        const ta = new Date(a?.createdAt || 0).getTime();
        const tb = new Date(b?.createdAt || 0).getTime();
        return tb - ta;
      });
      setUsers(sorted);
    } catch (error: any) {
      setUsers([]);
      const status = Number(error?.status || 0);
      const message = String(error?.message || '').toLowerCase();
      const authError = status === 401 || status === 403 || message.includes('unauthorized') || message.includes('forbidden');
      if (authError) {
        setUsersLoadError(lang === 'bn' ? 'সেশন মেয়াদ শেষ হয়েছে, আবার লগইন করুন' : 'Session expired, please sign in again');
      } else {
        setUsersLoadError(error?.message || (lang === 'bn' ? 'ইউজার লোড ব্যর্থ হয়েছে' : 'Failed to load users'));
      }
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    void refreshUsers();
  }, [state.accessToken, lang]);

  const manageableUsers = useMemo(() => {
    return users.filter((user) => {
      if (user.id === state.user.id) return false;
      if (!isPrimaryAdmin && (user.role === 'admin' || user.role === 'super_admin')) return false;
      return true;
    });
  }, [users, state.user.id, isPrimaryAdmin]);

  useEffect(() => {
    if (!isSettingsOpen || manageableUsers.length === 0) return;
    const alreadySelected = manageableUsers.some((user) => user.id === settingsTargetUserId);
    if (!alreadySelected) {
      const first = manageableUsers[0];
      setSettingsTargetUserId(first.id);
      setSettingsTargetRole((!isPrimaryAdmin && (first.role === 'admin' || first.role === 'super_admin')) ? 'farmer' : (first.role || 'admin'));
    }
  }, [isSettingsOpen, manageableUsers, settingsTargetUserId, isPrimaryAdmin]);

  const selectedSettingsUser = useMemo(
    () => manageableUsers.find((user) => user.id === settingsTargetUserId) || null,
    [manageableUsers, settingsTargetUserId],
  );

  const privilegedUsers = useMemo(
    () => users.filter((user) => user.role === 'admin' || user.role === 'super_admin'),
    [users],
  );

  useEffect(() => {
    if (selectedSettingsUser) {
      setSettingsTargetRole(selectedSettingsUser.role || 'admin');
    }
  }, [selectedSettingsUser?.id]);

  const refreshSystemHealth = async () => {
    setIsHealthLoading(true);
    try {
      const health = await api.getSystemHealth();
      setSystemHealth(health);
    } catch {
      setSystemHealth(null);
    } finally {
      setIsHealthLoading(false);
    }
  };

  const refreshAuditLogs = async () => {
    if (!state.accessToken) return;
    try {
      const payload = await api.getAuditLogs(state.accessToken);
      setAuditLogs(payload.logs || []);
    } catch {
      setAuditLogs([]);
    }
  };

  const canManageUser = (user: any) => {
    if (!user) return false;
    if (user.id === state.user.id) return false;
    if (!isPrimaryAdmin && (user.role === 'admin' || user.role === 'super_admin')) return false;
    return true;
  };

  const exportUsersCsv = () => {
    const headers = ['id', 'name', 'email', 'role', 'verificationStatus', 'location', 'createdAt', 'lastSeen'];
    const rows = users.map((user) => ([
      user.id || '',
      user.name || '',
      user.email || '',
      user.role || '',
      user.verificationStatus || '',
      user.location || user.location_bn || '',
      user.createdAt || '',
      user.lastSeen || '',
    ]));

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin-users-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openSettingsModal = () => {
    setSettingsTab('access');
    setIsSettingsOpen(true);
    void refreshSystemHealth();
    void refreshAuditLogs();
  };

  const grantAccess = async () => {
    if (!state.accessToken || !settingsTargetUserId || !settingsTargetRole) return;
    setIsActionLoading(true);
    try {
      await api.updateUser(state.accessToken, settingsTargetUserId, {
        role: settingsTargetRole,
        verificationStatus: settingsTargetRole === 'doctor' ? 'verified' : 'verified',
      });
      await refreshUsers();
    } catch (error: any) {
      window.alert(error?.message || (lang === 'bn' ? 'অ্যাক্সেস আপডেট ব্যর্থ হয়েছে' : 'Failed to update access'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    if (!state.accessToken) return;
    setIsActionLoading(true);
    try {
      await api.updateUser(state.accessToken, userId, {
        role,
        verificationStatus: role === 'doctor' ? 'verified' : 'verified',
      });
      await refreshUsers();
    } catch (error: any) {
      window.alert(error?.message || (lang === 'bn' ? 'অ্যাক্সেস আপডেট ব্যর্থ হয়েছে' : 'Failed to update access'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const viewUser = (user: any) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  }

  const editUser = (user: any) => {
    setSelectedUser(user)
    setEditDraft(buildEditDraft(user))
    setIsEditOpen(true)
  }

  const deleteUser = (user: any) => {
    setSelectedUser(user)
    setIsDeleteOpen(true)
  }

  const saveUser = async () => {
    if (!state.accessToken || !selectedUser) return

    if (!isPrimaryAdmin && (selectedUser.role === 'admin' || selectedUser.role === 'super_admin')) {
      window.alert(lang === 'bn' ? 'সুপার ইউজার অ্যাডমিন বা সুপার ইউজার অ্যাকাউন্ট সম্পাদনা করতে পারে না' : 'Super users cannot edit admin or super user accounts')
      return
    }

    if (!isPrimaryAdmin && (editDraft.role === 'admin' || editDraft.role === 'super_admin')) {
      window.alert(lang === 'bn' ? 'সুপার ইউজার অ্যাডমিন বা সুপার ইউজার অ্যাক্সেস দিতে পারে না' : 'Super users cannot grant admin or super user access')
      return
    }

    setIsActionLoading(true)
    try {
      await api.updateUser(state.accessToken, selectedUser.id, {
        name: editDraft.name.trim() || selectedUser.name,
        location: editDraft.location.trim() || selectedUser.location,
        specialty: editDraft.specialty.trim() || selectedUser.specialty,
        role: editDraft.role,
        verificationStatus: editDraft.role === 'doctor'
          ? (editDraft.verificationStatus || selectedUser.verificationStatus || 'pending')
          : 'verified',
        registrationNumber: editDraft.registrationNumber.trim() || selectedUser.registrationNumber,
      })
      await refreshUsers()
      closeEditModal()
    } catch (error: any) {
      window.alert(error?.message || (lang === 'bn' ? 'আপডেট ব্যর্থ হয়েছে' : 'Update failed'))
    } finally {
      setIsActionLoading(false)
    }
  }

  const confirmDeleteUser = async () => {
    if (!state.accessToken || !selectedUser) return

    setIsActionLoading(true)
    try {
      await api.deleteUser(state.accessToken, selectedUser.id)
      await refreshUsers()
      closeDeleteModal()
    } catch (error: any) {
      window.alert(error?.message || (lang === 'bn' ? 'মুছতে ব্যর্থ হয়েছে' : 'Delete failed'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // Filter users
  const filteredUsers = users.filter(user => {
    const hay = `${user.name || ''} ${user.email || ''}`.toLowerCase();
    const matchesSearch = hay.includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  useEffect(() => {
    if (!isLoadingUsers && users.length > 0 && selectedRole !== 'all' && filteredUsers.length === 0 && !searchTerm.trim()) {
      setSelectedRole('all');
    }
  }, [isLoadingUsers, users.length, selectedRole, filteredUsers.length, searchTerm]);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalDoctors = users.filter(u => u.role === 'doctor').length;
    const totalAdmins = users.filter(u => u.role === 'admin' || u.role === 'super_admin').length;
    const totalSuperUsers = users.filter(u => u.role === 'super_admin').length;
    const activeFarmers = users.filter(u => u.role === 'farmer').length;
    const pendingDoctors = users.filter(u => u.role === 'doctor' && u.verificationStatus === 'pending').length;
    const verifiedDoctors = users.filter(u => u.role === 'doctor' && u.verificationStatus === 'verified').length;
    return { totalUsers, totalDoctors, totalAdmins, totalSuperUsers, activeFarmers, pendingDoctors, verifiedDoctors };
  }, [users]);

  const recentUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [users]);

  // Stats for charts
  const usersByRole = [
    { id: 'farmers', name: lang === 'bn' ? 'কৃষক' : 'Farmers', value: stats.activeFarmers, color: '#10b981' },
    { id: 'doctors', name: lang === 'bn' ? 'ডাক্তার' : 'Doctors', value: stats.totalDoctors, color: '#3b82f6' },
    { id: 'admins', name: lang === 'bn' ? 'অ্যাডমিন' : 'Admins', value: stats.totalAdmins, color: '#f59e0b' },
    { id: 'super_users', name: lang === 'bn' ? 'সুপার ইউজার' : 'Super Users', value: stats.totalSuperUsers, color: '#ef4444' },
  ];

  const usersByRoleChartData = usersByRole.filter((entry) => entry.value > 0);
  const hasRoleChartData = usersByRoleChartData.length > 0;

  const weeklyActivity = [
    { day: lang === 'bn' ? 'সোম' : 'Mon', detections: 245, queries: 89 },
    { day: lang === 'bn' ? 'মঙ্গল' : 'Tue', detections: 312, queries: 102 },
    { day: lang === 'bn' ? 'বুধ' : 'Wed', detections: 289, queries: 95 },
    { day: lang === 'bn' ? 'বৃহস্পতি' : 'Thu', detections: 356, queries: 118 },
    { day: lang === 'bn' ? 'শুক্র' : 'Fri', detections: 298, queries: 87 },
    { day: lang === 'bn' ? 'শনি' : 'Sat', detections: 178, queries: 56 },
    { day: lang === 'bn' ? 'রবি' : 'Sun', detections: 145, queries: 43 },
  ];

  const detailLocation = selectedUser
    ? (lang === 'bn'
      ? (selectedUser.location_bn || selectedUser.location || '—')
      : (selectedUser.location || selectedUser.location_bn || '—'))
    : '—';

  const detailSpecialty = selectedUser
    ? (lang === 'bn'
      ? (selectedUser.specialty_bn || selectedUser.specialty || '—')
      : (selectedUser.specialty || selectedUser.specialty_bn || '—'))
    : '—';

  const detailVerificationStatus = selectedUser?.verificationStatus || '—';
  const detailDocuments = Array.from(new Set([
    ...(selectedUser?.verificationDocuments || []),
    selectedUser?.certificateDocument,
    selectedUser?.resumeDocument,
  ].filter(Boolean)));

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('adminPanel', lang)}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'bn' ? 'সিস্টেম পরিচালনা এবং পর্যবেক্ষণ' : 'System management and monitoring'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{isSuperUser ? (lang === 'bn' ? 'সুপার ইউজার' : 'Super User') : (lang === 'bn' ? 'অ্যাডমিন' : 'Admin')}</Badge>
            <Badge variant="secondary">{lang === 'bn' ? 'লাইভ কন্ট্রোল' : 'Live control'}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void refreshUsers()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
          </Button>
          <Button variant="outline" onClick={exportUsersCsv}>
            <Download className="w-4 h-4 mr-2" />
            {lang === 'bn' ? 'এক্সপোর্ট' : 'Export'}
          </Button>
          <Button className="md:self-start" onClick={openSettingsModal}>
            <Settings className="w-4 h-4 mr-2" />
            {t('settings', lang)}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-500/20 bg-blue-500/10 backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 uppercase tracking-wide">{lang === 'bn' ? 'গভর্ন্যান্স' : 'Governance'}</p>
            <p className="text-xl font-semibold mt-1">{stats.totalAdmins} {lang === 'bn' ? 'প্রিভিলেজড অ্যাকাউন্ট' : 'privileged accounts'}</p>
            <p className="text-xs text-blue-700 mt-2">{stats.totalSuperUsers} {lang === 'bn' ? 'সুপার ইউজার সক্রিয়' : 'super users active'}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/10 backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 uppercase tracking-wide">{lang === 'bn' ? 'ডাক্তার যাচাই' : 'Doctor Verification'}</p>
            <p className="text-xl font-semibold mt-1">{stats.verifiedDoctors} {lang === 'bn' ? 'ভেরিফাইড' : 'verified'}</p>
            <p className="text-xs text-emerald-700 mt-2">{stats.pendingDoctors} {lang === 'bn' ? 'পেন্ডিং রিভিউ' : 'pending review'}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/10 backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 uppercase tracking-wide">{lang === 'bn' ? 'দ্রুত অ্যাকশন' : 'Quick Action'}</p>
            <div className="flex items-center gap-2 mt-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <Link to="/admin/doctor-verification" className="text-sm text-amber-800 underline">
                {lang === 'bn' ? 'ডাক্তার ভেরিফিকেশন খুলুন' : 'Open doctor verification'}
              </Link>
            </div>
            <p className="text-xs text-amber-700 mt-2">{lang === 'bn' ? 'সেটিংস থেকে রোল এবং অ্যাক্সেস নিয়ন্ত্রণ করুন' : 'Control role and access from Settings'}</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{lang === 'bn' ? 'অ্যাডমিন সেটিংস' : 'Admin settings'}</DialogTitle>
            <DialogDescription>
              {lang === 'bn'
                ? 'এখান থেকে অ্যাডমিন এক্সেস, ইউজার ভূমিকা এবং সিস্টেম ব্যবস্থাপনা নিয়ন্ত্রণ করুন।'
                : 'Manage access, user roles, and operational controls from here.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={settingsTab} onValueChange={setSettingsTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="access">{lang === 'bn' ? 'অ্যাক্সেস' : 'Access'}</TabsTrigger>
              <TabsTrigger value="governance">{lang === 'bn' ? 'প্রিভিলেজ' : 'Privileges'}</TabsTrigger>
              <TabsTrigger value="system">{lang === 'bn' ? 'সিস্টেম' : 'System'}</TabsTrigger>
            </TabsList>

            <TabsContent value="access" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2"><UserCog className="w-4 h-4" />{lang === 'bn' ? 'অ্যাক্সেস প্রদান' : 'Grant access'}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{lang === 'bn' ? 'ইউজার নির্বাচন' : 'Select user'}</label>
                      <Select value={settingsTargetUserId} onValueChange={setSettingsTargetUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder={lang === 'bn' ? 'ইউজার নির্বাচন করুন' : 'Choose a user'} />
                        </SelectTrigger>
                        <SelectContent>
                          {manageableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">{lang === 'bn' ? 'ভূমিকা দিন' : 'Assign role'}</label>
                      <Select value={settingsTargetRole} onValueChange={setSettingsTargetRole}>
                        <SelectTrigger>
                          <SelectValue placeholder={lang === 'bn' ? 'ভূমিকা নির্বাচন করুন' : 'Choose a role'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="farmer">Farmer</SelectItem>
                          <SelectItem value="doctor">Doctor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {isPrimaryAdmin && <SelectItem value="super_admin">Super User</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={() => void grantAccess()} disabled={isActionLoading || !settingsTargetUserId} className="w-full">
                      {isActionLoading
                        ? (lang === 'bn' ? 'আপডেট হচ্ছে...' : 'Updating...')
                        : (lang === 'bn' ? 'অ্যাক্সেস আপডেট' : 'Update access')}
                    </Button>

                    {manageableUsers.length === 0 && (
                      <p className="text-xs text-gray-500">
                        {lang === 'bn' ? 'ম্যানেজ করার মতো অতিরিক্ত ইউজার নেই' : 'No additional users available for role management'}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2"><Crown className="w-4 h-4" />{lang === 'bn' ? 'নির্বাচিত ইউজার কুইক অ্যাকশন' : 'Selected user quick actions'}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {selectedSettingsUser ? (
                      <>
                        <p><span className="text-gray-500">{lang === 'bn' ? 'নাম:' : 'Name:'}</span> <span className="font-medium">{selectedSettingsUser.name}</span></p>
                        <p><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedSettingsUser.email}</span></p>
                        <p><span className="text-gray-500">{lang === 'bn' ? 'বর্তমান ভূমিকা:' : 'Current role:'}</span> <span className="font-medium">{getRoleLabel(selectedSettingsUser.role, selectedSettingsUser.role_bn)}</span></p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Button variant="outline" onClick={() => void updateUserRole(selectedSettingsUser.id, 'admin')} disabled={isActionLoading || selectedSettingsUser.role === 'admin'}>
                            {lang === 'bn' ? 'অ্যাডমিন বানান' : 'Make Admin'}
                          </Button>
                          <Button variant="outline" onClick={() => void updateUserRole(selectedSettingsUser.id, 'farmer')} disabled={isActionLoading || selectedSettingsUser.role === 'farmer'}>
                            {lang === 'bn' ? 'ফার্মার করুন' : 'Set Farmer'}
                          </Button>
                          <Button variant="outline" onClick={() => void updateUserRole(selectedSettingsUser.id, 'doctor')} disabled={isActionLoading || selectedSettingsUser.role === 'doctor'}>
                            {lang === 'bn' ? 'ডাক্তার করুন' : 'Set Doctor'}
                          </Button>
                          {isPrimaryAdmin && (
                            <Button variant="outline" onClick={() => void updateUserRole(selectedSettingsUser.id, 'super_admin')} disabled={isActionLoading || selectedSettingsUser.role === 'super_admin'}>
                              {lang === 'bn' ? 'সুপার ইউজার করুন' : 'Make Super User'}
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500">{lang === 'bn' ? 'কোনো ইউজার নির্বাচন করা হয়নি' : 'No user selected'}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="governance" className="space-y-4 mt-4">
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm">{lang === 'bn' ? 'প্রিভিলেজড অ্যাকাউন্ট' : 'Privileged accounts'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {privilegedUsers.map((user) => {
                    const canAdjust = canManageUser(user);
                    return (
                      <div key={user.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'bn' ? 'ভূমিকা:' : 'Role:'} {getRoleLabel(user.role, user.role_bn)}</p>
                        </div>
                        <div className="flex gap-2">
                          {user.role !== 'admin' && (
                            <Button variant="outline" size="sm" disabled={isActionLoading || !canAdjust} onClick={() => void updateUserRole(user.id, 'admin')}>
                              {lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}
                            </Button>
                          )}
                          {user.role !== 'farmer' && (
                            <Button variant="outline" size="sm" disabled={isActionLoading || !canAdjust} onClick={() => void updateUserRole(user.id, 'farmer')}>
                              {lang === 'bn' ? 'ডাউনগ্রেড' : 'Demote'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {privilegedUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground">{lang === 'bn' ? 'কোনো প্রিভিলেজড অ্যাকাউন্ট নেই' : 'No privileged accounts found'}</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-4 mt-4">
              <Card className="border-dashed">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">{lang === 'bn' ? 'সিস্টেম হেলথ' : 'System health'}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => { void refreshSystemHealth(); void refreshAuditLogs(); }} disabled={isHealthLoading}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {isHealthLoading ? (lang === 'bn' ? 'লোড হচ্ছে...' : 'Refreshing...') : (lang === 'bn' ? 'রিফ্রেশ' : 'Refresh')}
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</p>
                    <p className="font-semibold">{systemHealth?.status || '—'}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground">{lang === 'bn' ? 'মোড' : 'Mode'}</p>
                    <p className="font-semibold">{systemHealth?.mode || '—'}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground">{lang === 'bn' ? 'বুটস্ট্র্যাপ সোর্স' : 'Bootstrap source'}</p>
                    <p className="font-semibold">{systemHealth?.storage?.bootstrapSource || '—'}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground">SQL</p>
                    <p className="font-semibold">{systemHealth?.storage?.sqlConfigured ? (systemHealth?.storage?.sqlConnected ? 'Connected' : 'Configured (disconnected)') : 'Not configured'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm">{lang === 'bn' ? 'অডিট লগ' : 'Audit log'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                  {auditLogs.slice(0, 20).map((log) => (
                    <div key={log.id} className="rounded-md border p-3 text-xs">
                      <p className="font-semibold">{log.action || 'action'}</p>
                      <p className="text-muted-foreground">{`${log.actorEmail || 'system'} -> ${log.targetEmail || log.targetUserId || 'n/a'}`}</p>
                      {(log?.metadata?.status || log?.metadata?.reason) && (
                        <p className="text-muted-foreground">
                          {log?.metadata?.status ? `status: ${log.metadata.status}` : ''}
                          {log?.metadata?.status && log?.metadata?.reason ? ' | ' : ''}
                          {log?.metadata?.reason ? `note: ${log.metadata.reason}` : ''}
                        </p>
                      )}
                      <p className="text-muted-foreground">{formatDate(log.createdAt)}</p>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="text-sm text-muted-foreground">{lang === 'bn' ? 'এখনও কোনো অডিট লগ নেই' : 'No audit logs yet'}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm">{lang === 'bn' ? 'মেইন অ্যাডমিন পাওয়ার' : 'Main admin power'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{lang === 'bn' ? 'ইউজার অ্যাক্সেস প্রদান/বাতিল' : 'Grant/revoke user access'}</p>
                  <p>{lang === 'bn' ? 'ডাক্তার যাচাই এবং প্রিভিলেজ ম্যানেজমেন্ট' : 'Doctor verification and privilege management'}</p>
                  <p>{lang === 'bn' ? 'সিস্টেম হেলথ ট্র্যাকিং এবং দ্রুত রিফ্রেশ' : 'System health tracking and quick refresh'}</p>
                  <p>{isPrimaryAdmin
                    ? (lang === 'bn' ? 'অ্যাডমিন: সম্পূর্ণ সিস্টেম কন্ট্রোল এবং সব সার্ভিস ম্যানেজমেন্ট' : 'Admin: full system control and complete service management')
                    : (lang === 'bn' ? 'সুপার ইউজার: ইউজার ম্যানেজমেন্ট, অ্যাক্টিভিটি মনিটরিং ও কনসালটেশন তদারকি' : 'Super User: user management, activity monitoring, and consultation oversight')}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)} disabled={isActionLoading}>
              {lang === 'bn' ? 'বন্ধ' : 'Close'}
            </Button>
            <Button onClick={() => void refreshUsers()} disabled={isActionLoading || isLoadingUsers}>
              {isLoadingUsers
                ? (lang === 'bn' ? 'রিফ্রেশ হচ্ছে...' : 'Refreshing...')
                : (lang === 'bn' ? 'ইউজার রিফ্রেশ' : 'Refresh users')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('totalUsers', lang)}</p>
                <p className="text-2xl font-bold mt-1">{stats.totalUsers.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                  <TrendingUp className="w-3 h-3" />
                  +12.5%
                </div>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('activeFarmers', lang)}</p>
                <p className="text-2xl font-bold mt-1">{stats.activeFarmers.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                  <TrendingUp className="w-3 h-3" />
                  +8.3%
                </div>
              </div>
              <UserCheck className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('totalDoctors', lang)}</p>
                <p className="text-2xl font-bold mt-1">{stats.totalDoctors}</p>
                <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                  <TrendingUp className="w-3 h-3" />
                  +5.2%
                </div>
              </div>
              <Stethoscope className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('totalDetections', lang)}</p>
                <p className="text-2xl font-bold mt-1">0</p>
                <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                  <TrendingUp className="w-3 h-3" />
                  +15.7%
                </div>
              </div>
              <Activity className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="w-10 h-10 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">{lang === 'bn' ? 'সিস্টেম আপটাইম' : 'System Uptime'}</p>
                <p className="text-xl font-bold">Local</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-10 h-10 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">{lang === 'bn' ? 'গড় প্রতিক্রিয়া সময়' : 'Avg Response Time'}</p>
                <p className="text-xl font-bold">{lang === 'bn' ? 'স্থানীয়' : 'Local'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="w-10 h-10 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">{lang === 'bn' ? 'স্টোরেজ ব্যবহৃত' : 'Storage Used'}</p>
                <p className="text-xl font-bold">{lang === 'bn' ? 'লোকাল ফাইল' : 'Local file'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly Activity */}
        <Card key={`weekly-activity-card-${lang}`}>
          <CardHeader>
            <CardTitle className="text-base">
              {lang === 'bn' ? 'সাপ্তাহিক কার্যকলাপ' : 'Weekly Activity'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" key="grid" />
                <XAxis dataKey="day" key="xaxis" />
                <YAxis key="yaxis" />
                <Tooltip key="tooltip" />
                <Line type="monotone" dataKey="detections" stroke="#10b981" strokeWidth={2} name={lang === 'bn' ? 'শনাক্তকরণ' : 'Detections'} key="line-detections" />
                <Line type="monotone" dataKey="queries" stroke="#3b82f6" strokeWidth={2} name={lang === 'bn' ? 'প্রশ্ন' : 'Queries'} key="line-queries" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Users by Role */}
        <Card key={`users-by-role-card-${lang}`}>
          <CardHeader>
            <CardTitle className="text-base">
              {lang === 'bn' ? 'ভূমিকা অনুসারে ব্যবহারকারী' : 'Users by Role'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasRoleChartData ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={usersByRoleChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${Math.round((Number(percent) || 0) * 100)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {usersByRoleChartData.map((entry) => (
                      <Cell key={`cell-${entry.id}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
                {usersLoadError
                  ? (lang === 'bn' ? 'চার্ট দেখাতে ইউজার ডেটা লোড করা যাচ্ছে না' : 'Unable to load user data for chart')
                  : (lang === 'bn' ? 'চার্ট দেখানোর জন্য এখনও কোনো ইউজার নেই' : 'No users yet to render the chart')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              {usersByRole.map((entry) => (
                <div key={`legend-${entry.id}`} className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-semibold">{entry.value}</span>
                </div>
              ))}
            </div>

            <Dialog open={isDetailOpen} onOpenChange={(open) => {
              if (!open) {
                closeDetailModal();
              }
            }}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{lang === 'bn' ? 'ব্যবহারকারীর বিবরণ' : 'User details'}</DialogTitle>
                  <DialogDescription>
                    {lang === 'bn' ? 'এই রেকর্ডের সম্পূর্ণ তথ্য দেখুন' : 'Review the full profile for this record'}
                  </DialogDescription>
                </DialogHeader>

                {selectedUser && (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Card className="border-dashed">
                        <CardContent className="p-4 space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{lang === 'bn' ? 'নাম' : 'Name'}</p>
                          <p className="font-semibold">{selectedUser.name || '—'}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-dashed">
                        <CardContent className="p-4 space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{lang === 'bn' ? 'ইমেল' : 'Email'}</p>
                          <p className="font-semibold break-all">{selectedUser.email || '—'}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-dashed">
                        <CardContent className="p-4 space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{lang === 'bn' ? 'ভূমিকা' : 'Role'}</p>
                          <Badge variant={selectedUser.role === 'doctor' ? 'default' : 'secondary'} className="w-fit">
                            {getRoleLabel(selectedUser.role, selectedUser.role_bn)}
                          </Badge>
                        </CardContent>
                      </Card>
                      <Card className="border-dashed">
                        <CardContent className="p-4 space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</p>
                          <Badge
                            variant={detailVerificationStatus === 'verified'
                              ? 'default'
                              : detailVerificationStatus === 'rejected'
                                ? 'destructive'
                                : 'secondary'}
                            className="w-fit"
                          >
                            {detailVerificationStatus}
                          </Badge>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Card className="border-dashed">
                        <CardContent className="p-4 space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{lang === 'bn' ? 'অবস্থান' : 'Location'}</p>
                          <p className="font-medium">{detailLocation}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-dashed">
                        <CardContent className="p-4 space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{lang === 'bn' ? 'বিশেষত্ব' : 'Specialty'}</p>
                          <p className="font-medium">{detailSpecialty}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-dashed">
                        <CardContent className="p-4 space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{lang === 'bn' ? 'লাইসেন্স' : 'License'}</p>
                          <p className="font-medium">{selectedUser.registrationNumber || '—'}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-dashed">
                        <CardContent className="p-4 space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{lang === 'bn' ? 'আইডি' : 'User ID'}</p>
                          <p className="font-medium break-all">{selectedUser.id || '—'}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {!!detailDocuments.length && (
                      <Card className="border-dashed">
                        <CardContent className="p-4 space-y-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {lang === 'bn' ? 'ডকুমেন্ট' : 'Documents'}
                          </p>
                          <div className="space-y-2">
                            {detailDocuments.map((documentUrl: string, index: number) => (
                              <a
                                key={`${documentUrl}-${index}`}
                                href={documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-md border border-border/60 px-3 py-2 text-sm text-primary hover:bg-primary/10"
                              >
                                {lang === 'bn' ? 'নথি দেখুন' : 'Open document'} {index + 1}
                              </a>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={closeDetailModal}>{lang === 'bn' ? 'বন্ধ' : 'Close'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditOpen} onOpenChange={(open) => {
              if (!open) {
                closeEditModal();
              }
            }}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{lang === 'bn' ? 'ব্যবহারকারী সম্পাদনা করুন' : 'Edit user'}</DialogTitle>
                  <DialogDescription>
                    {lang === 'bn' ? 'প্রোফাইলের মূল ক্ষেত্রগুলো আপডেট করুন' : 'Update the main profile fields'}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{lang === 'bn' ? 'নাম' : 'Name'}</label>
                    <Input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{lang === 'bn' ? 'ইমেল' : 'Email'}</label>
                    <Input value={selectedUser?.email || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{lang === 'bn' ? 'ভূমিকা' : 'Role'}</label>
                    <Select value={editDraft.role} onValueChange={(value) => setEditDraft((current) => ({ ...current, role: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder={lang === 'bn' ? 'ভূমিকা নির্বাচন করুন' : 'Select role'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="farmer">{lang === 'bn' ? 'কৃষক' : 'Farmer'}</SelectItem>
                        <SelectItem value="doctor">{lang === 'bn' ? 'ডাক্তার' : 'Doctor'}</SelectItem>
                        <SelectItem value="admin">{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</SelectItem>
                        {isPrimaryAdmin && <SelectItem value="super_admin">{lang === 'bn' ? 'সুপার ইউজার' : 'Super User'}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{lang === 'bn' ? 'অবস্থান' : 'Location'}</label>
                    <Input value={editDraft.location} onChange={(event) => setEditDraft((current) => ({ ...current, location: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{lang === 'bn' ? 'বিশেষত্ব' : 'Specialty'}</label>
                    <Input value={editDraft.specialty} onChange={(event) => setEditDraft((current) => ({ ...current, specialty: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{lang === 'bn' ? 'রেজিস্ট্রেশন নম্বর' : 'Registration number'}</label>
                    <Input value={editDraft.registrationNumber} onChange={(event) => setEditDraft((current) => ({ ...current, registrationNumber: event.target.value }))} />
                  </div>
                  {editDraft.role === 'doctor' && (
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium">{lang === 'bn' ? 'ভেরিফিকেশন স্ট্যাটাস' : 'Verification status'}</label>
                      <Select value={editDraft.verificationStatus} onValueChange={(value) => setEditDraft((current) => ({ ...current, verificationStatus: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder={lang === 'bn' ? 'স্ট্যাটাস নির্বাচন করুন' : 'Select status'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="verified">verified</SelectItem>
                          <SelectItem value="rejected">rejected</SelectItem>
                          <SelectItem value="suspended">suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={closeEditModal} disabled={isActionLoading}>
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </Button>
                  <Button onClick={() => void saveUser()} disabled={isActionLoading}>
                    {isActionLoading ? (lang === 'bn' ? 'সংরক্ষণ করা হচ্ছে...' : 'Saving...') : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save changes')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteOpen} onOpenChange={(open) => {
              if (!open) {
                closeDeleteModal();
              }
            }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{lang === 'bn' ? 'ব্যবহারকারী মুছবেন?' : 'Delete user?'}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {lang === 'bn'
                      ? `${selectedUser?.name || 'এই ব্যবহারকারী'} স্থায়ীভাবে মুছে যাবে এবং সংশ্লিষ্ট রেকর্ডও পরিষ্কার হবে।`
                      : `${selectedUser?.name || 'This user'} will be permanently removed along with related records.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isActionLoading}>{lang === 'bn' ? 'বাতিল' : 'Cancel'}</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isActionLoading}
                    onClick={(event) => {
                      event.preventDefault();
                      void confirmDeleteUser();
                    }}
                  >
                    {isActionLoading ? (lang === 'bn' ? 'মুছছে...' : 'Deleting...') : (lang === 'bn' ? 'মুছুন' : 'Delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('userManagement', lang)}</CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoadError && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
              {usersLoadError.toLowerCase().includes('unauthorized')
                ? (lang === 'bn'
                  ? 'সেশন মেয়াদ শেষ হয়েছে বা লগইন অবৈধ। প্রোফাইল থেকে আবার সাইন ইন করুন।'
                  : 'Session expired or login is invalid. Please sign in again from Profile.')
                : usersLoadError}
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('search', lang) + '...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedRole === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRole('all')}
              >
                {lang === 'bn' ? 'সব' : 'All'}
              </Button>
              <Button
                variant={selectedRole === 'farmer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRole('farmer')}
              >
                {t('farmers', lang)}
              </Button>
              <Button
                variant={selectedRole === 'doctor' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRole('doctor')}
              >
                {t('doctors', lang)}
              </Button>
              <Button
                variant={selectedRole === 'admin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRole('admin')}
              >
                {lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}
              </Button>
              <Button
                variant={selectedRole === 'super_admin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRole('super_admin')}
              >
                {lang === 'bn' ? 'সুপার ইউজার' : 'Super'}
              </Button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-semibold">
                    {lang === 'bn' ? 'নাম' : 'Name'}
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-semibold hidden md:table-cell">
                    {lang === 'bn' ? 'ইমেল' : 'Email'}
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-semibold">
                    {lang === 'bn' ? 'ভূমিকা' : 'Role'}
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-semibold hidden md:table-cell">
                    {t('location', lang)}
                  </th>
                  <th className="text-left py-3 px-2 text-sm font-semibold hidden lg:table-cell">
                    {t('status', lang)}
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-semibold">
                    {lang === 'bn' ? 'কার্যক্রম' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/40">
                    <td className="py-3 px-2">
                      <div>
                        <p className="font-medium text-sm">{user.name}</p>
                        {user.role === 'doctor' && (
                          <p className="text-xs text-muted-foreground">
                            {lang === 'bn' ? user.specialty_bn : user.specialty}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm hidden md:table-cell">{user.email}</td>
                    <td className="py-3 px-2">
                      <Badge variant={user.role === 'super_admin' ? 'destructive' : user.role === 'doctor' ? 'default' : 'secondary'}>
                        {getRoleLabel(user.role, user.role_bn)}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-sm hidden md:table-cell">
                      {lang === 'bn' ? user.location_bn : user.location}
                    </td>
                    <td className="py-3 px-2 hidden lg:table-cell">
                      <Badge variant="default">
                        {t('activeStatus', lang)}
                      </Badge>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => viewUser(user)} disabled={isActionLoading}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => editUser(user)} disabled={isActionLoading || !canManageUser(user)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteUser(user)} disabled={isActionLoading || !canManageUser(user)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isLoadingUsers && filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {usersLoadError?.toLowerCase().includes('session')
                ? (lang === 'bn' ? 'সেশন শেষ হয়েছে। প্রোফাইল থেকে আবার লগইন করুন।' : 'Session expired. Please sign in again from Profile.')
                : (lang === 'bn' ? 'কোনো ব্যবহারকারী পাওয়া যায়নি' : 'No users found')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{lang === 'bn' ? 'সাম্প্রতিক ইউজার কার্যকলাপ' : 'Recent user activity'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{lang === 'bn' ? 'তৈরি:' : 'Created:'} {formatDate(user.createdAt)}</p>
                  <p>{lang === 'bn' ? 'সর্বশেষ:' : 'Last seen:'} {formatDate(user.lastSeen)}</p>
                </div>
              </div>
            ))}
            {recentUsers.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">{lang === 'bn' ? 'কোনো ইউজার ডেটা নেই' : 'No user activity yet'}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Doctors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('pendingDoctors', lang)}</CardTitle>
          <Link to="/admin/doctor-verification">
            <Button size="sm">
              <Eye className="w-4 h-4 mr-2" />
              {lang === 'bn' ? 'সব দেখুন' : 'View All'}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.filter(d => d.role === 'doctor' && d.verificationStatus === 'pending').slice(0, 3).map((doctor) => (
              <div key={doctor.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40">
                <div>
                  <p className="font-medium">{doctor.name}</p>
                  <p className="text-sm text-muted-foreground">{lang === 'bn' ? doctor.specialty_bn : doctor.specialty}</p>
                </div>
                <Badge variant="destructive">
                  {t('pending', lang)}
                </Badge>
              </div>
            ))}
            {stats.pendingDoctors === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {lang === 'bn' ? 'কোনো অপেক্ষমাণ ডাক্তার নেই' : 'No pending doctors'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};