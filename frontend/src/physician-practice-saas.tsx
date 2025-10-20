import React, { useState } from 'react';
import { Shield, Activity, Video, DollarSign, Users, Plug, Settings, Bell, Search, Globe, Lock, Bot, Menu, X, ChevronRight, Calendar, FileText, Stethoscope, BarChart3, MessageSquare, Clock, UserCheck, CreditCard, Database, Zap } from 'lucide-react';

const MedFlowApp = () => {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [language, setLanguage] = useState('en');
  const [planTier, setPlanTier] = useState('professional');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user] = useState({
    name: 'Dr. Sarah Chen',
    role: 'admin',
    practice: 'Central Medical Group',
    avatar: 'SC'
  });

  const translations = {
    en: {
      dashboard: 'Dashboard',
      practiceManagement: 'Practice Management',
      ehr: 'Electronic Health Records',
      telehealth: 'Telehealth',
      rcm: 'Revenue Cycle Management',
      crm: 'Patient CRM',
      integrations: 'Integrations',
      settings: 'Settings',
      logout: 'Logout',
      welcome: 'Welcome back',
      todaysAppointments: "Today's Appointments",
      pendingTasks: 'Pending Tasks',
      revenue: 'Revenue This Month',
      activePatients: 'Active Patients',
      aiInsights: 'AI Insights',
      scheduledCalls: 'Scheduled Video Calls',
      claimsPending: 'Claims Pending Review',
      upcomingFollowups: 'Upcoming Follow-ups'
    },
    de: {
      dashboard: 'Dashboard',
      practiceManagement: 'Praxisverwaltung',
      ehr: 'Elektronische Patientenakte',
      telehealth: 'Telemedizin',
      rcm: 'Umsatzzyklusmanagement',
      crm: 'Patienten-CRM',
      integrations: 'Integrationen',
      settings: 'Einstellungen',
      logout: 'Abmelden',
      welcome: 'Willkommen zurück',
      todaysAppointments: 'Heutige Termine',
      pendingTasks: 'Ausstehende Aufgaben',
      revenue: 'Umsatz diesen Monat',
      activePatients: 'Aktive Patienten',
      aiInsights: 'KI-Einblicke',
      scheduledCalls: 'Geplante Videoanrufe',
      claimsPending: 'Ansprüche in Prüfung',
      upcomingFollowups: 'Bevorstehende Nachuntersuchungen'
    },
    fr: {
      dashboard: 'Tableau de bord',
      practiceManagement: 'Gestion de cabinet',
      ehr: 'Dossiers de santé électroniques',
      telehealth: 'Télésanté',
      rcm: 'Gestion du cycle de revenus',
      crm: 'CRM patients',
      integrations: 'Intégrations',
      settings: 'Paramètres',
      logout: 'Déconnexion',
      welcome: 'Bon retour',
      todaysAppointments: "Rendez-vous d'aujourd'hui",
      pendingTasks: 'Tâches en attente',
      revenue: 'Revenus ce mois',
      activePatients: 'Patients actifs',
      aiInsights: "Aperçus de l'IA",
      scheduledCalls: 'Appels vidéo programmés',
      claimsPending: 'Réclamations en attente',
      upcomingFollowups: 'Suivis à venir'
    },
    ar: {
      dashboard: 'لوحة التحكم',
      practiceManagement: 'إدارة العيادة',
      ehr: 'السجلات الصحية الإلكترونية',
      telehealth: 'الرعاية الصحية عن بعد',
      rcm: 'إدارة دورة الإيرادات',
      crm: 'إدارة علاقات المرضى',
      integrations: 'التكاملات',
      settings: 'الإعدادات',
      logout: 'تسجيل الخروج',
      welcome: 'مرحباً بعودتك',
      todaysAppointments: 'مواعيد اليوم',
      pendingTasks: 'المهام المعلقة',
      revenue: 'الإيرادات هذا الشهر',
      activePatients: 'المرضى النشطون',
      aiInsights: 'رؤى الذكاء الاصطناعي',
      scheduledCalls: 'المكالمات المجدولة',
      claimsPending: 'المطالبات قيد المراجعة',
      upcomingFollowups: 'المتابعات القادمة'
    },
    es: {
      dashboard: 'Panel de control',
      practiceManagement: 'Gestión de consultas',
      ehr: 'Historias clínicas electrónicas',
      telehealth: 'Telesalud',
      rcm: 'Gestión del ciclo de ingresos',
      crm: 'CRM de pacientes',
      integrations: 'Integraciones',
      settings: 'Configuración',
      logout: 'Cerrar sesión',
      welcome: 'Bienvenido de nuevo',
      todaysAppointments: 'Citas de hoy',
      pendingTasks: 'Tareas pendientes',
      revenue: 'Ingresos este mes',
      activePatients: 'Pacientes activos',
      aiInsights: 'Conocimientos de IA',
      scheduledCalls: 'Llamadas programadas',
      claimsPending: 'Reclamaciones pendientes',
      upcomingFollowups: 'Seguimientos próximos'
    }
  };

  const t = translations[language];

  const modules = [
    { 
      id: 'practiceManagement', 
      name: t.practiceManagement, 
      icon: Activity, 
      color: 'from-blue-500 to-cyan-500',
      plans: ['starter', 'professional', 'enterprise']
    },
    { 
      id: 'ehr', 
      name: t.ehr, 
      icon: FileText, 
      color: 'from-purple-500 to-pink-500',
      plans: ['professional', 'enterprise']
    },
    { 
      id: 'telehealth', 
      name: t.telehealth, 
      icon: Video, 
      color: 'from-green-500 to-emerald-500',
      plans: ['professional', 'enterprise']
    },
    { 
      id: 'rcm', 
      name: t.rcm, 
      icon: DollarSign, 
      color: 'from-yellow-500 to-orange-500',
      plans: ['starter', 'professional', 'enterprise']
    },
    { 
      id: 'crm', 
      name: t.crm, 
      icon: Users, 
      color: 'from-red-500 to-rose-500',
      plans: ['professional', 'enterprise']
    },
    { 
      id: 'integrations', 
      name: t.integrations, 
      icon: Plug, 
      color: 'from-indigo-500 to-blue-500',
      plans: ['enterprise']
    }
  ];

  const planFeatures = {
    starter: ['practiceManagement', 'rcm'],
    professional: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm'],
    enterprise: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'integrations']
  };

  const hasAccess = (moduleId) => planFeatures[planTier]?.includes(moduleId);

  const StatCard = ({ title, value, icon: Icon, trend, color }) => (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-2">{title}</p>
          <p className="text-3xl font-bold text-white mb-2">{value}</p>
          {trend && (
            <p className="text-sm text-green-400 flex items-center">
              <ChevronRight className="w-4 h-4" />
              {trend}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const ModuleCard = ({ module, onClick }) => {
    const Icon = module.icon;
    const locked = !hasAccess(module.id);
    
    return (
      <button
        onClick={() => !locked && onClick(module.id)}
        disabled={locked}
        className={`relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 transition-all duration-300 text-left w-full group ${
          locked 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer'
        }`}
      >
        {locked && (
          <div className="absolute top-3 right-3">
            <Lock className="w-5 h-5 text-slate-500" />
          </div>
        )}
        <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{module.name}</h3>
        <p className="text-sm text-slate-400">
          {locked ? 'Upgrade to access' : 'Click to open module'}
        </p>
      </button>
    );
  };

  const FeatureItem = ({ icon: Icon, text }) => (
    <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
      <Icon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
      <span className="text-slate-300 text-sm">{text}</span>
    </div>
  );

  const ComplianceBadge = ({ icon: Icon, text }) => (
    <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
      <Icon className="w-4 h-4 text-green-400" />
      <span className="text-slate-300 text-sm">{text}</span>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.welcome}, {user.name}</h1>
          <p className="text-slate-400">{user.practice}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-400" />
              <span className="text-sm text-cyan-400 font-medium">AI Enabled</span>
            </div>
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-400 font-medium">HIPAA Compliant</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={t.todaysAppointments}
          value="24"
          icon={Calendar}
          trend="+12% from yesterday"
          color="from-blue-500 to-cyan-500"
        />
        <StatCard 
          title={t.pendingTasks}
          value="8"
          icon={Clock}
          trend="3 urgent"
          color="from-purple-500 to-pink-500"
        />
        <StatCard 
          title={t.revenue}
          value="$48.2K"
          icon={DollarSign}
          trend="+18% vs last month"
          color="from-green-500 to-emerald-500"
        />
        <StatCard 
          title={t.activePatients}
          value="1,247"
          icon={Users}
          trend="+45 this week"
          color="from-yellow-500 to-orange-500"
        />
      </div>

      <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">{t.aiInsights}</h3>
            <p className="text-slate-300 mb-4">Your AI assistant has analyzed schedule and identified optimization opportunities:</p>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>3 appointments can be consolidated to reduce patient wait time by 25 minutes</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>5 prior authorizations are likely to be approved based on historical patterns</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>Coding suggestions for 7 encounters could increase revenue by $1,240</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Available Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map(module => (
            <ModuleCard key={module.id} module={module} onClick={setCurrentModule} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <Video className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">{t.scheduledCalls}</h3>
          </div>
          <div className="space-y-3">
            {['John Smith - 10:00 AM', 'Maria Garcia - 2:30 PM', 'Ahmed Hassan - 4:00 PM'].map((call, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300 text-sm">{call}</span>
                <button className="text-green-400 hover:text-green-300 transition-colors">
                  <Video className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-6 h-6 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">{t.claimsPending}</h3>
          </div>
          <div className="space-y-3">
            {['Claim #A1234 - $850', 'Claim #A1235 - $1,240', 'Claim #A1236 - $620'].map((claim, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300 text-sm">{claim}</span>
                <button className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm">
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <UserCheck className="w-6 h-6 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">{t.upcomingFollowups}</h3>
          </div>
          <div className="space-y-3">
            {['Sarah Johnson - Oct 18', 'Michael Brown - Oct 19', 'Lisa Wang - Oct 20'].map((followup, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300 text-sm">{followup}</span>
                <button className="text-purple-400 hover:text-purple-300 transition-colors text-sm">
                  Contact
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderModule = () => {
    const module = modules.find(m => m.id === currentModule);
    if (!module) return renderDashboard();

    const Icon = module.icon;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setCurrentModule('dashboard')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">{module.name}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700/50">
            <h2 className="text-xl font-semibold text-white mb-6">Module Features</h2>
            <div className="space-y-4">
              {currentModule === 'practiceManagement' && (
                <>
                  <FeatureItem icon={Calendar} text="Advanced appointment scheduling with AI-powered optimization" />
                  <FeatureItem icon={Users} text="Multi-provider support with role-based access control" />
                  <FeatureItem icon={BarChart3} text="Real-time practice analytics and performance metrics" />
                  <FeatureItem icon={Bot} text="AI assistant for workflow automation and suggestions" />
                </>
              )}
              {currentModule === 'ehr' && (
                <>
                  <FeatureItem icon={FileText} text="Comprehensive patient records with version control" />
                  <FeatureItem icon={Stethoscope} text="Clinical decision support with AI recommendations" />
                  <FeatureItem icon={Database} text="Secure, encrypted data storage (HIPAA/GDPR compliant)" />
                  <FeatureItem icon={Bot} text="Smart charting with voice-to-text and auto-coding" />
                </>
              )}
              {currentModule === 'telehealth' && (
                <>
                  <FeatureItem icon={Video} text="HD video consultations with screen sharing" />
                  <FeatureItem icon={MessageSquare} text="Secure messaging and chat functionality" />
                  <FeatureItem icon={FileText} text="Digital prescription and documentation" />
                  <FeatureItem icon={Shield} text="End-to-end encrypted communications" />
                </>
              )}
              {currentModule === 'rcm' && (
                <>
                  <FeatureItem icon={DollarSign} text="Automated claims submission and tracking" />
                  <FeatureItem icon={CreditCard} text="Patient billing and payment processing" />
                  <FeatureItem icon={BarChart3} text="Revenue analytics and forecasting" />
                  <FeatureItem icon={Bot} text="AI-powered coding suggestions and denial prevention" />
                </>
              )}
              {currentModule === 'crm' && (
                <>
                  <FeatureItem icon={Users} text="360-degree patient relationship management" />
                  <FeatureItem icon={MessageSquare} text="Multi-channel communication hub" />
                  <FeatureItem icon={BarChart3} text="Patient engagement analytics" />
                  <FeatureItem icon={Bot} text="Automated follow-up and recall campaigns" />
                </>
              )}
              {currentModule === 'integrations' && (
                <>
                  <FeatureItem icon={Plug} text="RESTful API with comprehensive documentation" />
                  <FeatureItem icon={Zap} text="Pre-built integrations with major EHR systems" />
                  <FeatureItem icon={Database} text="Real-time data synchronization" />
                  <FeatureItem icon={Settings} text="Custom webhooks and automation rules" />
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4">Security & Compliance</h3>
              <div className="space-y-3">
                <ComplianceBadge icon={Shield} text="HIPAA Compliant" />
                <ComplianceBadge icon={Shield} text="GDPR Compliant" />
                <ComplianceBadge icon={Lock} text="2FA Enabled" />
                <ComplianceBadge icon={UserCheck} text="RBAC Active" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/30">
              <div className="flex items-center gap-3 mb-3">
                <Bot className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
              </div>
              <p className="text-slate-300 text-sm">
                Your AI assistant is analyzing this module and will provide personalized insights and recommendations.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden text-slate-400 hover:text-white"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">MedFlow</h1>
                  <p className="text-xs text-slate-400 capitalize">{planTier} Plan</p>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors w-64"
                />
              </div>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="es">Español</option>
              </select>

              <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user.role}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {user.avatar}
                </div>
              </div>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-md">
            <div className="px-4 py-4 space-y-3">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300"
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="es">Español</option>
              </select>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {user.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{user.role}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentModule === 'dashboard' ? renderDashboard() : renderModule()}
      </main>

      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <button className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-110">
          <Bot className="w-6 h-6 text-white" />
        </button>
        <button 
          onClick={() => {
            const plans = ['starter', 'professional', 'enterprise'];
            const currentIndex = plans.indexOf(planTier);
            const nextIndex = (currentIndex + 1) % plans.length;
            setPlanTier(plans[nextIndex]);
          }}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white text-sm font-medium shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105"
        >
          Switch Plan
        </button>
      </div>
    </div>
  );
};

export default MedFlowApp;