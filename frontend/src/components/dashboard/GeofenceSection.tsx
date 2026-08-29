import { useState } from 'react';
import {
  useGeofences,
  useCreateGeofence,
  useDeleteGeofence,
  useUpdateGeofence,
} from '../../hooks/useGeofencing';
import { SkeletonTable } from '../ui/Skeleton';
import ConfirmDialog from '../ui/ConfirmDialog';
import type { Geofence, GeofenceInput } from '../../types/api';

interface Props {
  childId: string;
  onError: (msg: string | null) => void;
}

const ZONE_ICONS: Record<string, string> = {
  HOME: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  SCHOOL: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222',
  FRIEND: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  CUSTOM: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
};

interface EditState {
  name: string;
  latitude: string;
  longitude: string;
  radius: string;
  alertEntry: boolean;
  alertExit: boolean;
  isActive: boolean;
}

const emptyEdit = (gf: Geofence): EditState => ({
  name: gf.name,
  latitude: String(gf.latitude),
  longitude: String(gf.longitude),
  radius: String(gf.radius_meters),
  alertEntry: gf.alert_on_entry,
  alertExit: gf.alert_on_exit,
  isActive: gf.is_active,
});

export default function GeofenceSection({ childId, onError }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('500');
  const [zoneType, setZoneType] = useState<'HOME' | 'SCHOOL' | 'FRIEND' | 'CUSTOM'>('CUSTOM');
  const [alertEntry, setAlertEntry] = useState(false);
  const [alertExit, setAlertExit] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const { data: geofences, isLoading } = useGeofences(childId);
  const createGeo = useCreateGeofence(childId);
  const deleteGeo = useDeleteGeofence(childId);
  const updateGeo = useUpdateGeofence(childId);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseInt(radius, 10);
    if (isNaN(latNum) || isNaN(lngNum) || isNaN(radiusNum)) {
      onError('Please enter valid coordinates and radius');
      return;
    }
    try {
      await createGeo.mutateAsync({
        name: name || `${zoneType} Zone`,
        latitude: latNum,
        longitude: lngNum,
        radius_meters: radiusNum,
        zone_type: zoneType,
        alert_on_entry: alertEntry,
        alert_on_exit: alertExit,
      });
      setShowForm(false);
      setName(''); setLat(''); setLng(''); setRadius('500');
    } catch {
      onError('Failed to create geofence');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteGeo.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      onError('Failed to delete geofence');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await updateGeo.mutateAsync({ geofenceId: id, input: { is_active: !isActive } as Partial<GeofenceInput> });
    } catch {
      onError('Failed to update geofence');
    }
  };

  const startEdit = (gf: Geofence) => {
    setEditingId(gf.id);
    setEdit(emptyEdit(gf));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !edit) return;
    const latNum = parseFloat(edit.latitude);
    const lngNum = parseFloat(edit.longitude);
    const radiusNum = parseInt(edit.radius, 10);
    if (isNaN(latNum) || isNaN(lngNum) || isNaN(radiusNum)) {
      onError('Please enter valid coordinates and radius');
      return;
    }
    try {
      await updateGeo.mutateAsync({
        geofenceId: editingId,
        input: {
          name: edit.name,
          latitude: latNum,
          longitude: lngNum,
          radius_meters: radiusNum,
          alert_on_entry: edit.alertEntry,
          alert_on_exit: edit.alertExit,
          is_active: edit.isActive,
        } as Partial<GeofenceInput>,
      });
      cancelEdit();
    } catch {
      onError('Failed to update geofence');
    }
  };

  if (isLoading) return <SkeletonTable rows={3} />;

  const geofenceList = geofences ?? [];

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Geofencing</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {geofenceList.length} zone{geofenceList.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Zone'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {showForm && (
          <form onSubmit={handleAdd} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Zone name"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <select
                value={zoneType}
                onChange={(e) => setZoneType(e.target.value as typeof zoneType)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="HOME">Home</option>
                <option value="SCHOOL">School</option>
                <option value="FRIEND">Friend's Place</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Latitude"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="Longitude"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="number"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                placeholder="Radius (m)"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={alertEntry} onChange={(e) => setAlertEntry(e.target.checked)} className="rounded" />
                Alert on entry
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={alertExit} onChange={(e) => setAlertExit(e.target.checked)} className="rounded" />
                Alert on exit
              </label>
            </div>
            <button
              type="submit"
              disabled={createGeo.isPending}
              className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createGeo.isPending ? 'Creating...' : 'Create Zone'}
            </button>
          </form>
        )}

        {geofenceList.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No geofences configured yet.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {geofenceList.map((gf) => (
              <div
                key={gf.id}
                className={`rounded-lg border transition-colors ${
                  editingId === gf.id
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 p-4'
                    : `flex items-center justify-between p-4 ${
                        gf.is_active
                          ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700 opacity-60'
                      }`
                }`}
              >
                {editingId === gf.id && edit ? (
                  <form onSubmit={saveEdit} className="space-y-3 w-full" data-testid="geofence-edit-form">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        aria-label="Zone name"
                        value={edit.name}
                        onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                        placeholder="Zone name"
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        aria-label="Radius"
                        value={edit.radius}
                        onChange={(e) => setEdit({ ...edit, radius: e.target.value })}
                        placeholder="Radius (m)"
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="any"
                        aria-label="Latitude"
                        value={edit.latitude}
                        onChange={(e) => setEdit({ ...edit, latitude: e.target.value })}
                        placeholder="Latitude"
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        step="any"
                        aria-label="Longitude"
                        value={edit.longitude}
                        onChange={(e) => setEdit({ ...edit, longitude: e.target.value })}
                        placeholder="Longitude"
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={edit.alertEntry}
                          onChange={(e) => setEdit({ ...edit, alertEntry: e.target.checked })}
                          className="rounded"
                        />
                        Alert on entry
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={edit.alertExit}
                          onChange={(e) => setEdit({ ...edit, alertExit: e.target.checked })}
                          className="rounded"
                        />
                        Alert on exit
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={edit.isActive}
                          onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })}
                          className="rounded"
                        />
                        Active
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={updateGeo.isPending}
                        className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {updateGeo.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        gf.zone_type === 'HOME' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        gf.zone_type === 'SCHOOL' ? 'bg-purple-100 dark:bg-purple-900/30' :
                        gf.zone_type === 'FRIEND' ? 'bg-pink-100 dark:bg-pink-900/30' :
                        'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <svg className={`w-5 h-5 ${
                          gf.zone_type === 'HOME' ? 'text-blue-600 dark:text-blue-400' :
                          gf.zone_type === 'SCHOOL' ? 'text-purple-600 dark:text-purple-400' :
                          gf.zone_type === 'FRIEND' ? 'text-pink-600 dark:text-pink-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ZONE_ICONS[gf.zone_type]} />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{gf.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {gf.radius_meters}m radius &middot; {gf.zone_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {gf.alert_on_entry && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">Entry</span>
                        )}
                        {gf.alert_on_exit && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded">Exit</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggle(gf.id, gf.is_active)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${
                          gf.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          gf.is_active ? 'left-5' : 'left-0.5'
                        }`} />
                      </button>
                      <button
                        onClick={() => startEdit(gf)}
                        aria-label={`Edit ${gf.name}`}
                        className="text-blue-500 hover:text-blue-700 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteId(gf.id)}
                        aria-label={`Delete ${gf.name}`}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteId && (
        <ConfirmDialog
          title="Delete Geofence"
          message="Are you sure you want to delete this geofence zone?"
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </section>
  );
}
