import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, PlusCircle, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { VisaUser, UserRole } from '../models/visa';
import { firestoreService } from '../services/firestoreService';
import { Button } from '../core/ui/button';
import { Input } from '../core/ui/input';
import { Badge } from '../core/ui/badge';
import { Modal } from '../core/ui/modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../core/ui/table';
import { ConfirmationModal } from '../core/modals/ConfirmationModal';
import { useToast } from '../core/ui/toast';
import { PageHeader, TableToolbar, PaginationBar, EmptyState } from '../components/PageShell';

export const UsersManagementView: React.FC = () => {
  const { lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();

  const [users, setUsers] = useState<VisaUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<VisaUser | null>(null);
  const [toDelete, setToDelete] = useState<VisaUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('station_clerk');
  const [assignedStation, setAssignedStation] = useState('All Stations');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    return firestoreService.subscribe<VisaUser>('visa_users', (data) => {
      setUsers(data);
      setIsLoading(false);
    });
  }, []);

  const openModal = (u?: VisaUser) => {
    if (u) {
      setEditing(u);
      setEmail(u.email);
      setFullName(u.fullName);
      setRole(u.role);
      setAssignedStation(u.assignedStations?.[0] || 'All Stations');
      setIsActive(u.isActive !== false);
    } else {
      setEditing(null);
      setEmail('');
      setFullName('');
      setRole('station_clerk');
      setAssignedStation('All Stations');
      setIsActive(true);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const user: VisaUser = {
        id: editing?.id || email.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role,
        assignedStations: [assignedStation],
        photoURL: editing?.photoURL,
        isActive,
        createdAt: editing?.createdAt || new Date().toISOString(),
      };
      await firestoreService.save('visa_users', user);
      toast(editing ? 'User updated' : 'User added', 'success');
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await firestoreService.remove('visa_users', toDelete.id);
    toast(`Removed ${toDelete.email}`, 'info');
    setToDelete(null);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const totalEntries = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(
    () => filtered.slice((validPage - 1) * pageSize, validPage * pageSize),
    [filtered, validPage, pageSize]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="User Management"
        title="User Management & RBAC"
        countLabel={`${totalEntries} ${totalEntries === 1 ? 'User' : 'Users'}`}
        subtitle={
          <>
            <ShieldCheck className="h-3 w-3 text-blue-600" />
            <span>Manage Google Auth Users, Roles & Station Assignments</span>
          </>
        }
        actions={
          <Button variant="primary" size="md" onClick={() => openModal()} className="font-bold">
            <PlusCircle className="h-4 w-4" />
            <span>Add User</span>
          </Button>
        }
      />

      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by Email, Name, Role..."
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setCurrentPage(1);
        }}
      />

      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : paginated.length === 0 ? (
        <EmptyState
          title="No Users Registered Yet"
          description="Users who sign in with Google are automatically registered here, or you can pre-assign roles."
          actionLabel="Add User"
          onAction={() => openModal()}
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Station</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((u) => (
                <TableRow
                  key={u.id}
                  onClick={() => openModal(u)}
                  className="cursor-pointer hover:bg-blue-50/40"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{u.fullName}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'warning'}>
                      {u.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-700">
                    {u.assignedStations?.join(', ') || 'All Stations'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive !== false ? 'success' : 'danger'}>
                      {u.isActive !== false ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openModal(u)}
                        className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(u)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <PaginationBar
            currentPage={validPage}
            totalPages={totalPages}
            totalEntries={totalEntries}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Edit User' : 'Add User'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Google Email Address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(editing)}
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Full Name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              >
                <option value="admin">Admin</option>
                <option value="supervisor">Supervisor</option>
                <option value="station_clerk">Station Clerk</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Assigned Station
              </label>
              <select
                value={assignedStation}
                onChange={(e) => setAssignedStation(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              >
                <option value="All Stations">All Stations</option>
                {lovs.stations.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            Account Active
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Save User
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Remove User"
        description={`Remove "${toDelete?.email}" from VISA Users?`}
        confirmText="Remove"
        variant="danger"
      />
    </div>
  );
};
