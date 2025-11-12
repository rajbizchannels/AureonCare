import { Activity, FileText, Video, DollarSign, Users, Plug, Database, UserCheck, BarChart3, Package } from 'lucide-react';

export const getModules = (t) => [
  { id: 'practiceManagement', name: t.practiceManagement, icon: Activity, color: 'from-blue-500 to-cyan-500' },
  { id: 'ehr', name: t.ehr, icon: FileText, color: 'from-purple-500 to-pink-500' },
  { id: 'telehealth', name: t.telehealth, icon: Video, color: 'from-green-500 to-emerald-500' },
  { id: 'rcm', name: t.rcm, icon: DollarSign, color: 'from-yellow-500 to-orange-500' },
  { id: 'offerings', name: t.offerings || 'Healthcare Offerings', icon: Package, color: 'from-violet-500 to-purple-500' },
  { id: 'reports', name: t.reports || 'Reports & Analytics', icon: BarChart3, color: 'from-cyan-500 to-blue-500' },
  { id: 'crm', name: t.crm, icon: Users, color: 'from-red-500 to-rose-500' },
  { id: 'integrations', name: t.integrations, icon: Plug, color: 'from-indigo-500 to-blue-500' },
  { id: 'fhir', name: t.fhir || 'FHIR HL7', icon: Database, color: 'from-teal-500 to-cyan-500' },
  { id: 'patientPortal', name: t.patientPortal || 'Patient Portal', icon: UserCheck, color: 'from-pink-500 to-purple-500' }
];
