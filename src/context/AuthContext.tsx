import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, getCurrentUser, saveUser, clearUser } from '../lib/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = getCurrentUser()
    setUser(savedUser)
    setLoading(false)
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    saveUser(userData)
  }

  const logout = () => {
    setUser(null)
    clearUser()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}