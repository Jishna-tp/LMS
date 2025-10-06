import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SignIn } from './components/auth/SignIn'
import { SignUp } from './components/auth/SignUp'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Dashboard } from './components/dashboard/Dashboard'
import { Profile } from './components/profile/Profile'
import { LeaveManagement } from './components/leaves/LeaveManagement'
import { LeaveCreationPage } from './components/leaves/LeaveCreationPage'
import { EmployeeManagement } from './components/employees/EmployeeManagement'
import { HolidayManagement } from './components/holidays/HolidayManagement'
import { Reports } from './components/reports/Reports'
import { IntegratedCalendar } from './components/calendar/IntegratedCalendar'
import { LeavePolicyManagement } from './components/leavePolicy/LeavePolicyManagement'
import { LeaveBalanceManagement } from './components/leavePolicy/LeaveBalanceManagement'
import { DepartmentManagement } from './components/departments/DepartmentManagement'

const AppContent: React.FC = () => {
  const { user, loading } = useAuth()
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showLeaveCreation, setShowLeaveCreation] = useState(false)
  const [leavePolicySubTab, setLeavePolicySubTab] = useState<'policies' | 'balances'>('policies')

  // Reset to dashboard when user changes (sign in/out)
  React.useEffect(() => {
    if (user) {
      setActiveTab('dashboard')
    }
  }, [user])

  // Handle navigation after form submission
  const handleLeaveSubmitted = () => {
    setActiveTab('leaves')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return authMode === 'signin' ? (
      <SignIn onToggleMode={() => setAuthMode('signup')} />
    ) : (
      <SignUp onToggleMode={() => setAuthMode('signin')} />
    )
  }

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard'
      case 'profile': return 'Profile'
      case 'leaves': return 'Leave Management'
      case 'leave-policies': return 'Leave Policies'
      case 'departments': return 'Departments'
      case 'employees': return 'Employee Management'
      case 'holidays': return 'Holiday Management'
      case 'calendar': return 'Calendar'
      case 'reports': return 'Reports'
      default: return 'Dashboard'
    }
  }

  const renderContent = () => {
    if (showLeaveCreation) {
      return (
        <LeaveCreationPage 
          onBack={() => setShowLeaveCreation(false)}
          onLeaveCreated={handleLeaveSubmitted}
        />
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'profile':
        return <Profile />
      case 'leaves':
        return (
          <LeaveManagement 
            onLeaveSubmitted={handleLeaveSubmitted}
            onCreateLeave={() => setShowLeaveCreation(true)}
          />
        )
      case 'leave-policies':
        return leavePolicySubTab === 'policies' ? (
          <LeavePolicyManagement />
        ) : (
          <LeaveBalanceManagement />
        )
      case 'departments':
        return <DepartmentManagement />
      case 'employees':
        return <EmployeeManagement />
      case 'holidays':
        return <HolidayManagement />
      case 'calendar':
        return <IntegratedCalendar />
      case 'reports':
        return <Reports />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="h-screen w-full bg-gray-50 flex overflow-hidden relative">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden lg:ml-64 xl:ml-72">
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          title={showLeaveCreation ? 'Create Leave Request' : getTabTitle(activeTab)}
          leavePolicySubTab={activeTab === 'leave-policies' ? leavePolicySubTab : undefined}
          onLeavePolicySubTabChange={setLeavePolicySubTab}
        />
        
        <main className={`flex-1 ${showLeaveCreation ? 'overflow-auto' : 'overflow-auto'}`}>
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App