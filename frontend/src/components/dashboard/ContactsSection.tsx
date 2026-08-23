import { useState } from 'react';
import { useActionsError, useContactActions, useContacts } from '../../hooks/usePhase1Data';
import { SkeletonList } from '../ui/Skeleton';
import ConfirmDialog from '../ui/ConfirmDialog';

interface ContactsSectionProps {
  childId: string | null;
  onError: (message: string | null) => void;
}

export default function ContactsSection({ childId, onError }: ContactsSectionProps) {
  const contacts = useContacts(childId);
  const actions = useContactActions(childId);
  useActionsError([actions.create, actions.update, actions.remove], onError);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [ruleType, setRuleType] = useState<'ALLOW' | 'BLOCK'>('BLOCK');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setNumber('');
    setRuleType('BLOCK');
    setShowForm(true);
  };

  const openEdit = (contact: {
    id: string;
    contact_name: string | null;
    phone_number: string;
    rule_type: 'ALLOW' | 'BLOCK';
  }) => {
    setEditingId(contact.id);
    setName(contact.contact_name ?? '');
    setNumber(contact.phone_number);
    setRuleType(contact.rule_type);
    setShowForm(true);
  };

  const handleSave = () => {
    if (editingId) {
      actions.update.mutate({
        contactId: editingId,
        input: { contact_name: name, rule_type: ruleType },
      });
    } else {
      actions.create.mutate({ contact_name: name, phone_number: number, rule_type: ruleType });
    }
    setShowForm(false);
    setEditingId(null);
    setName('');
    setNumber('');
  };

  const handleDelete = () => {
    if (deleteId) {
      actions.remove.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Contacts</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add contact'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {editingId ? 'Edit contact' : 'New contact rule'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Grandma"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Phone number</span>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">Rule</span>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as 'ALLOW' | 'BLOCK')}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
            >
              <option value="BLOCK">Block calls from this number</option>
              <option value="ALLOW">Always allow this number</option>
            </select>
          </label>
          <button
            onClick={handleSave}
            disabled={actions.create.isPending || actions.update.isPending || number === ''}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {editingId ? 'Update contact' : 'Save contact'}
          </button>
        </div>
      )}

      {contacts.isLoading && <SkeletonList items={2} />}

      {contacts.isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load contacts.</p>
        </div>
      )}

      {!contacts.isLoading && !contacts.isError && (
        <div className="space-y-3">
          {(contacts.data ?? []).map((contact) => (
            <div
              key={contact.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{contact.contact_name ?? contact.phone_number}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{contact.phone_number}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    contact.rule_type === 'BLOCK'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}
                >
                  {contact.rule_type}
                </span>
                <button
                  onClick={() => openEdit(contact)}
                  disabled={actions.update.isPending}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() =>
                    actions.update.mutate({
                      contactId: contact.id,
                      input: {
                        phone_number: contact.phone_number,
                        contact_name: contact.contact_name ?? undefined,
                        rule_type: contact.rule_type === 'BLOCK' ? 'ALLOW' : 'BLOCK',
                      },
                    })
                  }
                  disabled={actions.update.isPending}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Switch
                </button>
                <button
                  onClick={() => setDeleteId(contact.id)}
                  disabled={actions.remove.isPending}
                  className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {(contacts.data ?? []).length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No contact rules yet. Blocked numbers are rejected on the child's device.
              </p>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Remove Contact"
          message="Are you sure you want to remove this contact rule?"
          confirmLabel="Remove"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </section>
  );
}