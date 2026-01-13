import { useState } from 'react';
import { useStore } from '@/state/store';
import { 
  PartnerOrg, 
  PartnerContact, 
  PartnerEngagement, 
  ENGAGEMENT_TYPES,
  EngagementType,
  BlockTemplate,
  COLOR_PALETTE,
} from '@/state/types';
import { Modal, ConfirmModal } from './Modal';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Building2, User, Calendar, ChevronDown, ChevronRight, Trash2, Edit, X } from 'lucide-react';

interface PartnersPanelProps {
  onClose: () => void;
  onCreateTemplate: (template: BlockTemplate) => void;
}

export function PartnersPanel({ onClose, onCreateTemplate }: PartnersPanelProps) {
  const { state, dispatch } = useStore();
  const [activeTab, setActiveTab] = useState<'orgs' | 'engagements'>('orgs');
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showEngagementForm, setShowEngagementForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<PartnerOrg | null>(null);
  const [editingContact, setEditingContact] = useState<PartnerContact | null>(null);
  const [editingEngagement, setEditingEngagement] = useState<PartnerEngagement | null>(null);
  const [contactOrgId, setContactOrgId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'org' | 'contact' | 'engagement'; id: string } | null>(null);
  const [search, setSearch] = useState('');

  const { orgs, contacts, engagements } = state.partners;

  const filteredOrgs = orgs.filter(o => 
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredEngagements = engagements.filter(e => {
    const org = orgs.find(o => o.id === e.orgId);
    return e.title.toLowerCase().includes(search.toLowerCase()) || 
           org?.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleSaveOrg = (data: Omit<PartnerOrg, 'id'>) => {
    if (editingOrg) {
      dispatch({ type: 'UPDATE_PARTNER_ORG', payload: { ...data, id: editingOrg.id } });
    } else {
      dispatch({ type: 'ADD_PARTNER_ORG', payload: { ...data, id: uuidv4() } });
    }
    setShowOrgForm(false);
    setEditingOrg(null);
  };

  const handleSaveContact = (data: Omit<PartnerContact, 'id'>) => {
    if (editingContact) {
      dispatch({ type: 'UPDATE_PARTNER_CONTACT', payload: { ...data, id: editingContact.id } });
    } else {
      dispatch({ type: 'ADD_PARTNER_CONTACT', payload: { ...data, id: uuidv4() } });
    }
    setShowContactForm(false);
    setEditingContact(null);
    setContactOrgId(null);
  };

  const handleSaveEngagement = (data: Omit<PartnerEngagement, 'id'>) => {
    if (editingEngagement) {
      dispatch({ type: 'UPDATE_PARTNER_ENGAGEMENT', payload: { ...data, id: editingEngagement.id } });
    } else {
      const newEngagement: PartnerEngagement = { ...data, id: uuidv4() };
      dispatch({ type: 'ADD_PARTNER_ENGAGEMENT', payload: newEngagement });
      
      const engType = ENGAGEMENT_TYPES.find(t => t.value === data.type);
      if (engType) {
        const org = orgs.find(o => o.id === data.orgId);
        const template: BlockTemplate = {
          id: uuidv4(),
          title: data.title || `${org?.name || 'Partner'} - ${engType.label}`,
          category: 'Other',
          colorHex: COLOR_PALETTE[5].hex,
          defaultDurationMinutes: 120,
          countsTowardGoldenRule: true,
          goldenRuleBucketId: engType.bucketId,
          defaultLocation: data.address || 'Offsite',
          defaultNotes: data.notes,
          engagementId: newEngagement.id,
        };
        onCreateTemplate(template);
      }
    }
    setShowEngagementForm(false);
    setEditingEngagement(null);
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'org') {
      dispatch({ type: 'DELETE_PARTNER_ORG', payload: deleteConfirm.id });
    } else if (deleteConfirm.type === 'contact') {
      dispatch({ type: 'DELETE_PARTNER_CONTACT', payload: deleteConfirm.id });
    } else if (deleteConfirm.type === 'engagement') {
      dispatch({ type: 'DELETE_PARTNER_ENGAGEMENT', payload: deleteConfirm.id });
    }
    setDeleteConfirm(null);
  };

  const getOrgContacts = (orgId: string) => contacts.filter(c => c.orgId === orgId);
  const getOrgEngagements = (orgId: string) => engagements.filter(e => e.orgId === orgId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Partner Management</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('orgs')}
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'orgs' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            data-testid="tab-organizations"
          >
            <Building2 className="w-4 h-4 inline mr-1" />
            Organizations
          </button>
          <button
            onClick={() => setActiveTab('engagements')}
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'engagements' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            data-testid="tab-engagements"
          >
            <Calendar className="w-4 h-4 inline mr-1" />
            Engagements
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="flex gap-2">
            <input
              type="search"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border rounded text-sm"
              data-testid="partner-search"
            />
            {activeTab === 'orgs' && (
              <button
                onClick={() => { setEditingOrg(null); setShowOrgForm(true); }}
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm flex items-center gap-1"
                data-testid="add-org-button"
              >
                <Plus className="w-4 h-4" />
                Add Org
              </button>
            )}
            {activeTab === 'engagements' && (
              <button
                onClick={() => { setEditingEngagement(null); setShowEngagementForm(true); }}
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm flex items-center gap-1"
                disabled={orgs.length === 0}
                data-testid="add-engagement-button"
              >
                <Plus className="w-4 h-4" />
                Add Engagement
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'orgs' && (
            <div className="space-y-2">
              {filteredOrgs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No organizations yet. Add one to get started.</p>
              ) : (
                filteredOrgs.map(org => {
                  const orgContacts = getOrgContacts(org.id);
                  const orgEngagements = getOrgEngagements(org.id);
                  const isExpanded = expandedOrgId === org.id;
                  
                  return (
                    <div key={org.id} className="border rounded" data-testid={`org-${org.id}`}>
                      <div 
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedOrgId(isExpanded ? null : org.id)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{org.name}</span>
                          <span className="text-xs text-gray-400">
                            {orgContacts.length} contacts, {orgEngagements.length} engagements
                          </span>
                        </div>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => { setEditingOrg(org); setShowOrgForm(true); }}
                            className="p-1 hover:bg-gray-100 rounded"
                            data-testid={`edit-org-${org.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'org', id: org.id })}
                            className="p-1 hover:bg-red-50 text-red-600 rounded"
                            data-testid={`delete-org-${org.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="border-t p-3 bg-gray-50">
                          {org.address && (
                            <p className="text-sm text-gray-600 mb-2">{org.address}</p>
                          )}
                          
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Contacts
                              </h4>
                              <button
                                onClick={() => { setContactOrgId(org.id); setEditingContact(null); setShowContactForm(true); }}
                                className="text-xs px-2 py-1 border rounded hover:bg-white"
                                data-testid={`add-contact-${org.id}`}
                              >
                                + Add Contact
                              </button>
                            </div>
                            {orgContacts.length === 0 ? (
                              <p className="text-xs text-gray-400">No contacts</p>
                            ) : (
                              <div className="space-y-1">
                                {orgContacts.map(contact => (
                                  <div key={contact.id} className="flex items-center justify-between bg-white p-2 rounded text-sm">
                                    <div>
                                      <span className="font-medium">{contact.name}</span>
                                      {contact.role && <span className="text-gray-400 ml-1">({contact.role})</span>}
                                      {contact.email && <span className="text-gray-500 ml-2">{contact.email}</span>}
                                      {contact.phone && <span className="text-gray-500 ml-2">{contact.phone}</span>}
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => { setEditingContact(contact); setContactOrgId(org.id); setShowContactForm(true); }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirm({ type: 'contact', id: contact.id })}
                                        className="p-1 hover:bg-red-50 text-red-600 rounded"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
                              <Calendar className="w-3 h-3" />
                              Engagements
                            </h4>
                            {orgEngagements.length === 0 ? (
                              <p className="text-xs text-gray-400">No engagements</p>
                            ) : (
                              <div className="space-y-1">
                                {orgEngagements.map(eng => {
                                  const engType = ENGAGEMENT_TYPES.find(t => t.value === eng.type);
                                  return (
                                    <div key={eng.id} className="flex items-center justify-between bg-white p-2 rounded text-sm">
                                      <div>
                                        <span className="font-medium">{eng.title}</span>
                                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                                          eng.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                          eng.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                          eng.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                                          'bg-red-100 text-red-700'
                                        }`}>
                                          {eng.status}
                                        </span>
                                        <span className="text-gray-400 ml-2">{engType?.label}</span>
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => { setEditingEngagement(eng); setShowEngagementForm(true); }}
                                          className="p-1 hover:bg-gray-100 rounded"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setDeleteConfirm({ type: 'engagement', id: eng.id })}
                                          className="p-1 hover:bg-red-50 text-red-600 rounded"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'engagements' && (
            <div className="space-y-2">
              {filteredEngagements.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {orgs.length === 0 ? 'Add an organization first to create engagements.' : 'No engagements yet.'}
                </p>
              ) : (
                filteredEngagements.map(eng => {
                  const org = orgs.find(o => o.id === eng.orgId);
                  const engType = ENGAGEMENT_TYPES.find(t => t.value === eng.type);
                  const engContacts = contacts.filter(c => eng.contactIds.includes(c.id));
                  
                  return (
                    <div key={eng.id} className="border rounded p-3" data-testid={`engagement-${eng.id}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{eng.title}</h4>
                          <p className="text-sm text-gray-500">{org?.name} - {engType?.label}</p>
                          {eng.address && <p className="text-sm text-gray-400">{eng.address}</p>}
                          {engContacts.length > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                              Contacts: {engContacts.map(c => c.name).join(', ')}
                            </p>
                          )}
                          {eng.ppeRequired && (
                            <p className="text-xs text-orange-600 mt-1">PPE: {eng.ppeRequired}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            eng.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            eng.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            eng.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {eng.status}
                          </span>
                          <button
                            onClick={() => { setEditingEngagement(eng); setShowEngagementForm(true); }}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'engagement', id: eng.id })}
                            className="p-1 hover:bg-red-50 text-red-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <OrgFormModal
          open={showOrgForm}
          onClose={() => { setShowOrgForm(false); setEditingOrg(null); }}
          onSave={handleSaveOrg}
          initial={editingOrg}
        />

        <ContactFormModal
          open={showContactForm}
          onClose={() => { setShowContactForm(false); setEditingContact(null); setContactOrgId(null); }}
          onSave={handleSaveContact}
          initial={editingContact}
          orgId={contactOrgId || editingContact?.orgId || ''}
        />

        <EngagementFormModal
          open={showEngagementForm}
          onClose={() => { setShowEngagementForm(false); setEditingEngagement(null); }}
          onSave={handleSaveEngagement}
          initial={editingEngagement}
          orgs={orgs}
          contacts={contacts}
        />

        <ConfirmModal
          open={deleteConfirm !== null}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message={
            deleteConfirm?.type === 'org' 
              ? "Delete this organization? All contacts and engagements will also be removed."
              : deleteConfirm?.type === 'contact'
                ? "Delete this contact?"
                : "Delete this engagement? The associated template will also be removed."
          }
          confirmText="Delete"
        />
      </div>
    </div>
  );
}

function OrgFormModal({ 
  open, 
  onClose, 
  onSave, 
  initial 
}: { 
  open: boolean; 
  onClose: () => void; 
  onSave: (data: Omit<PartnerOrg, 'id'>) => void;
  initial: PartnerOrg | null;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useState(() => {
    if (initial) {
      setName(initial.name);
      setAddress(initial.address);
      setNotes(initial.notes);
    } else {
      setName('');
      setAddress('');
      setNotes('');
    }
  });

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Organization' : 'Add Organization'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            data-testid="org-name-input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            data-testid="org-address-input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            rows={2}
            data-testid="org-notes-input"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave({ name, address, notes })}
            disabled={!name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid="save-org-button"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ContactFormModal({ 
  open, 
  onClose, 
  onSave, 
  initial,
  orgId,
}: { 
  open: boolean; 
  onClose: () => void; 
  onSave: (data: Omit<PartnerContact, 'id'>) => void;
  initial: PartnerContact | null;
  orgId: string;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [role, setRole] = useState(initial?.role || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [email, setEmail] = useState(initial?.email || '');

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Contact' : 'Add Contact'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            data-testid="contact-name-input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            data-testid="contact-role-input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            data-testid="contact-email-input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            data-testid="contact-phone-input"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave({ name, role, phone, email, orgId })}
            disabled={!name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid="save-contact-button"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EngagementFormModal({ 
  open, 
  onClose, 
  onSave, 
  initial,
  orgs,
  contacts,
}: { 
  open: boolean; 
  onClose: () => void; 
  onSave: (data: Omit<PartnerEngagement, 'id'>) => void;
  initial: PartnerEngagement | null;
  orgs: PartnerOrg[];
  contacts: PartnerContact[];
}) {
  const [orgId, setOrgId] = useState(initial?.orgId || (orgs[0]?.id || ''));
  const [type, setType] = useState<EngagementType>(initial?.type || 'apprenticeship_tour');
  const [title, setTitle] = useState(initial?.title || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [ppeRequired, setPpeRequired] = useState(initial?.ppeRequired || '');
  const [arrivalInstructions, setArrivalInstructions] = useState(initial?.arrivalInstructions || '');
  const [parkingNotes, setParkingNotes] = useState(initial?.parkingNotes || '');
  const [studentLimit, setStudentLimit] = useState<string>(initial?.studentLimit?.toString() || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [status, setStatus] = useState<PartnerEngagement['status']>(initial?.status || 'pending');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(initial?.contactIds || []);

  const orgContacts = contacts.filter(c => c.orgId === orgId);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Engagement' : 'Add Engagement'}>
      <div className="space-y-4 max-h-[60vh] overflow-auto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Organization *</label>
            <select
              value={orgId}
              onChange={e => { setOrgId(e.target.value); setSelectedContactIds([]); }}
              className="w-full px-3 py-2 border rounded"
              data-testid="engagement-org-select"
            >
              {orgs.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as EngagementType)}
              className="w-full px-3 py-2 border rounded"
              data-testid="engagement-type-select"
            >
              {ENGAGEMENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={`${orgs.find(o => o.id === orgId)?.name || ''} - ${ENGAGEMENT_TYPES.find(t => t.value === type)?.label || ''}`}
            className="w-full px-3 py-2 border rounded"
            data-testid="engagement-title-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            data-testid="engagement-address-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as PartnerEngagement['status'])}
              className="w-full px-3 py-2 border rounded"
              data-testid="engagement-status-select"
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Student Limit</label>
            <input
              type="number"
              value={studentLimit}
              onChange={e => setStudentLimit(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              data-testid="engagement-student-limit-input"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">PPE Required</label>
          <input
            type="text"
            value={ppeRequired}
            onChange={e => setPpeRequired(e.target.value)}
            placeholder="e.g., Hard hat, steel-toe boots, safety glasses"
            className="w-full px-3 py-2 border rounded"
            data-testid="engagement-ppe-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Arrival Instructions</label>
          <textarea
            value={arrivalInstructions}
            onChange={e => setArrivalInstructions(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            rows={2}
            data-testid="engagement-arrival-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Parking Notes</label>
          <input
            type="text"
            value={parkingNotes}
            onChange={e => setParkingNotes(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            data-testid="engagement-parking-input"
          />
        </div>

        {orgContacts.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Contacts</label>
            <div className="space-y-1">
              {orgContacts.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.includes(c.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedContactIds([...selectedContactIds, c.id]);
                      } else {
                        setSelectedContactIds(selectedContactIds.filter(id => id !== c.id));
                      }
                    }}
                  />
                  {c.name} {c.role && `(${c.role})`}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            rows={2}
            data-testid="engagement-notes-input"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave({
              orgId,
              contactIds: selectedContactIds,
              type,
              title: title || `${orgs.find(o => o.id === orgId)?.name || 'Partner'} - ${ENGAGEMENT_TYPES.find(t => t.value === type)?.label || ''}`,
              address,
              ppeRequired,
              arrivalInstructions,
              parkingNotes,
              studentLimit: studentLimit ? parseInt(studentLimit) : null,
              notes,
              status,
            })}
            disabled={!orgId}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid="save-engagement-button"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
