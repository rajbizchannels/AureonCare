import { Activity, FileText, Video, DollarSign, Users, Plug } from 'lucide-react';

export const getModules = (t) => [
  { id: 'practiceManagement', name: t.practiceManagement, icon: Activity, color: 'from-blue-500 to-cyan-500' },
  { id: 'ehr', name: t.ehr, icon: FileText, color: 'from-purple-500 to-pink-500' },
  { id: 'telehealth', name: t.telehealth, icon: Video, color: 'from-green-500 to-emerald-500' },
  { id: 'rcm', name: t.rcm, icon: DollarSign, color: 'from-yellow-500 to-orange-500' },
  { id: 'crm', name: t.crm, icon: Users, color: 'from-red-500 to-rose-500' },
  { id: 'integrations', name: t.integrations, icon: Plug, color: 'from-indigo-500 to-blue-500' }
];
