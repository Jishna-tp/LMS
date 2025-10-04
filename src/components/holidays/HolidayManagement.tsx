import React, { useState, useEffect } from 'react'
import { Plus, Calendar, Download, Upload, Search, Filter, CreditCard as Edit, Trash2, AlertCircle, CheckCircle, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

interface Holiday {
  id: string
  name: string
  date: string
  type: string
  is_recurring: boolean
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  creator?: { name: string }
}

export const HolidayManagement: React.FC = () => {
  const { user } = useAuth()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    type: 'Company',
    is_recurring: false,
    description: ''
  })
  const [message, setMessage] = useState({ type: '', text: '' })

  // Check if user has admin access
  if (user?.employee.role !== 'Admin') {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
          <p className="text-yellow-800">You don't have permission to access holiday management.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchHolidays()
  }, [yearFilter])

  const fetchHolidays = async () => {
    try {
      const startDate = `${yearFilter}-01-01`
      const endDate = `${yearFilter}-12-31`

      const { data, error } = await supabase
        .from('holidays')
        .select(`
          *,
          creator:created_by (name)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (error) throw error
      setHolidays(data || [])
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to fetch holidays' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      if (editingHoliday) {
        // Update existing holiday
        const { error } = await supabase
          .from('holidays')
          .update({
            name: formData.name,
            date: formData.date,
            type: formData.type,
            is_recurring: formData.is_recurring,
            description: formData.description || null
          })
          .eq('id', editingHoliday.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Holiday updated successfully' })
      } else {
        // Create new holiday
        const { error } = await supabase
          .from('holidays')
          .insert([{
            name: formData.name,
            date: formData.date,
            type: formData.type,
            is_recurring: formData.is_recurring,
            description: formData.description || null,
            created_by: user!.employee.id
          }])

        if (error) throw error
        setMessage({ type: 'success', text: 'Holiday created successfully' })
      }

      setShowForm(false)
      setEditingHoliday(null)
      setFormData({
        name: '',
        date: '',
        type: 'Company',
        is_recurring: false,
        description: ''
      })
      fetchHolidays()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Could not save holiday. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday)
    setFormData({
      name: holiday.name,
      date: holiday.date,
      type: holiday.type,
      is_recurring: holiday.is_recurring,
      description: holiday.description || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (holidayId: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return

    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', holidayId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Holiday deleted successfully' })
      fetchHolidays()
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to delete holiday' })
    }
  }

  const generateRecurringHolidays = async () => {
    if (!confirm('This will create recurring holidays for the next year. Continue?')) return

    try {
      const recurringHolidays = holidays.filter(h => h.is_recurring)
      const nextYear = parseInt(yearFilter) + 1
      const newHolidays = []

      for (const holiday of recurringHolidays) {
        // Parse the date as local date (YYYY-MM-DD format)
        const [year, month, day] = holiday.date.split('-').map(Number)
        const newDateStr = `${nextYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        
        // Check if holiday already exists for next year
        const { data: existing } = await supabase
          .from('holidays')
          .select('id')
          .eq('name', holiday.name)
          .eq('date', newDateStr)
          .single()

        if (!existing) {
          newHolidays.push({
            name: holiday.name,
            date: newDateStr,
            type: holiday.type,
            is_recurring: true,
            description: holiday.description,
            created_by: user!.employee.id
          })
        }
      }

      if (newHolidays.length > 0) {
        const { error } = await supabase
          .from('holidays')
          .insert(newHolidays)

        if (error) throw error
        setMessage({ type: 'success', text: `Created ${newHolidays.length} recurring holidays for ${nextYear}` })
      } else {
        setMessage({ type: 'info', text: 'No new recurring holidays to create' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to generate recurring holidays' })
    }
  }

  const exportSampleExcel = () => {
    const sampleData = [
      ['Holiday Name', 'Date (YYYY-MM-DD)', 'Type', 'Recurring (true/false)', 'Description'],
      ['New Year\'s Day', '2024-01-01', 'National', 'true', 'Start of the new year'],
      ['Independence Day', '2024-07-04', 'National', 'true', 'National independence celebration'],
      ['Christmas Day', '2024-12-25', 'Religious', 'true', 'Christian holiday'],
      ['Company Founding Day', '2024-03-15', 'Company', 'true', 'Anniversary of company founding']
    ]

    const csvContent = sampleData
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'holiday-template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const lines = text.split('\n').slice(1) // Skip header
      const importedHolidays = []

      for (const line of lines) {
        if (line.trim()) {
          const [name, date, type, recurring, description] = line.split(',').map(field => 
            field.replace(/^"/, '').replace(/"$/, '').trim()
          )

          if (name && date) {
            importedHolidays.push({
              name,
              date,
              type: type || 'Company',
              is_recurring: recurring?.toLowerCase() === 'true',
              description: description || null,
              created_by: user!.employee.id
            })
          }
        }
      }

      if (importedHolidays.length > 0) {
        const { error } = await supabase
          .from('holidays')
          .insert(importedHolidays)

        if (error) throw error
        setMessage({ type: 'success', text: `Imported ${importedHolidays.length} holidays successfully` })
        fetchHolidays()
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to import holidays. Please check file format.' })
    }

    // Reset file input
    event.target.value = ''
  }

  const holidayTypes = ['National', 'Religious', 'Company', 'Regional', 'Other']
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i - 2)

  const filteredHolidays = holidays.filter(holiday => {
    const matchesSearch = searchTerm === '' || 
      holiday.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (holiday.description && holiday.description.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesType = typeFilter === 'all' || holiday.type === typeFilter
    
    return matchesSearch && matchesType
  })

  if (loading && holidays.length === 0) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="bg-gray-200 h-8 w-48 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg flex items-center ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : message.type === 'info'
            ? 'bg-blue-50 border border-blue-200 text-blue-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4 mr-2" />
          ) : (
            <AlertCircle className="h-4 w-4 mr-2" />
          )}
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Holiday Management</h2>
          <p className="text-gray-600">Manage company holidays and recurring events</p>
        </div>
        
        <div className="mt-4 lg:mt-0 flex flex-wrap gap-2">
          <button
            onClick={exportSampleExcel}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors text-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Template
          </button>
          
          <label className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors cursor-pointer text-sm">
            <Upload className="h-4 w-4 mr-2" />
            Import Holidays
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
          
          <button
            onClick={generateRecurringHolidays}
            className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors text-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Recurring
          </button>
          
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Holiday
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-row flex-wrap gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search holidays..."
            className="w-full min-w-[200px] pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
          />
        </div>
        
        <div className="relative min-w-[120px]">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none text-sm"
          >
            <option value="all">All Types</option>
            {holidayTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        
        <div className="relative min-w-[100px]">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none text-sm"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Holiday Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHolidays.map((holiday) => (
          <div key={holiday.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{holiday.name}</h3>
                <p className="text-sm text-gray-500">{(() => {
                  // Parse date as local date to avoid timezone shifts
                  const [year, month, day] = holiday.date.split('-').map(Number)
                  const localDate = new Date(year, month - 1, day)
                  return localDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })
                })()}</p>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(holiday)}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit Holiday"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(holiday.id)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete Holiday"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                  holiday.type === 'National' ? 'bg-red-100 text-red-800' :
                  holiday.type === 'Religious' ? 'bg-purple-100 text-purple-800' :
                  holiday.type === 'Company' ? 'bg-blue-100 text-blue-800' :
                  holiday.type === 'Regional' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {holiday.type}
                </span>
                
                {holiday.is_recurring && (
                  <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Recurring
                  </span>
                )}
              </div>

              {holiday.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{holiday.description}</p>
              )}

              <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                Created by {holiday.creator?.name || 'Unknown'} on {new Date(holiday.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredHolidays.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No holidays found matching your criteria</p>
        </div>
      )}

      {/* Holiday Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Holiday Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  {holidayTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Recurring yearly</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={3}
                  placeholder="Holiday description..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Saving...' : (editingHoliday ? 'Update Holiday' : 'Add Holiday')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingHoliday(null)
                    setFormData({
                      name: '',
                      date: '',
                      type: 'Company',
                      is_recurring: false,
                      description: ''
                    })
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}