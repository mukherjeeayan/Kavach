import { useState } from 'react';
import { useActionsError, useContactActions, useContacts } from '../../hooks/usePhase1Data';

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
      // The backend keeps phone_number immutable; name and rule update.
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

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add contact'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg p-4 border mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            {editingId ? 'Edit contact' : 'New contact rule'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-600">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Grandma"
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Phone number</span>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm text-gray-600">Rule</span>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as 'ALLOW' | 'BLOCK')}
              className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="BLOCK">Block calls from this number</option>
              <option value="ALLOW">Always allow this number</option>
            </select>
          </label>
          <button
            onClick={handleSave}
            disabled={actions.create.isPending || actions.update.isPending || number === ''}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {editingId ? 'Update contact' : 'Save contact'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {(contacts.data ?? []).map((contact) => (
          <div
            key={contact.id}
            className="bg-white rounded-lg p-4 border flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-medium">{contact.contact_name ?? contact.phone_number}</p>
              <p className="text-sm text-gray-500 font-mono">{contact.phone_number}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  contact.rule_type === 'BLOCK'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {contact.rule_type}
              </span>
              <button
                onClick={() => openEdit(contact)}
                disabled={actions.update.isPending}
                className="px-3 py-2 border rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
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
                className="px-3 py-2 border rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Switch
              </button>
              <button
                onClick={() => actions.remove.mutate(contact.id)}
                disabled={actions.remove.isPending}
                className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {(contacts.data ?? []).length === 0 && (
          <p className="text-sm text-gray-400">
            No contact rules yet. Blocked numbers are rejected on the child's device.
          </p>
        )}
      </div>
    </section>
  );
}