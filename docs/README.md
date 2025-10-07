# Absentra - Employee Leave Management System

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Getting Started](#getting-started)
5. [User Roles & Permissions](#user-roles--permissions)
6. [Core Modules](#core-modules)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

## Overview

Absentra is a comprehensive employee leave management system built with React, TypeScript, and Supabase. It provides a complete solution for managing employee leave requests, approvals, policies, and reporting with role-based access control.

### Key Technologies
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Authentication**: Custom implementation with bcrypt

## Features

### Core Features
- ✅ Employee leave request management
- ✅ Multi-level approval workflows (Manager → HR)
- ✅ Leave policy configuration and management
- ✅ Leave balance tracking and adjustments
- ✅ Holiday management with recurring events
- ✅ Integrated calendar view
- ✅ Real-time notifications
- ✅ Comprehensive reporting and analytics
- ✅ Employee management (Admin only)
- ✅ Role-based access control
- ✅ Responsive design for all devices

### Advanced Features
- ✅ Leave validation against policies
- ✅ Automatic leave balance calculations
- ✅ Holiday overlap detection
- ✅ Workflow history tracking
- ✅ CSV export functionality
- ✅ Leave policy templates
- ✅ Department-based restrictions
- ✅ Gender-based leave policies
- ✅ Carry forward and encashment rules

## Architecture

### Frontend Architecture
```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── calendar/       # Calendar integration
│   ├── dashboard/      # Dashboard views
│   ├── employees/      # Employee management
│   ├── holidays/       # Holiday management
│   ├── layout/         # Layout components
│   ├── leavePolicy/    # Leave policy management
│   ├── leaves/         # Leave request management
│   ├── profile/        # User profile
│   └── reports/        # Reporting and analytics
├── context/            # React context providers
├── lib/                # Utility libraries
│   ├── auth.ts         # Authentication logic
│   ├── leavePolicy.ts  # Leave policy operations
│   ├── notifications.ts # Notification system
│   └── supabase.ts     # Supabase client
└── App.tsx             # Main application component
```

### Database Architecture
The application uses PostgreSQL through Supabase with the following key tables:
- `employees` - Employee information
- `users` - Authentication data
- `leave_requests` - Leave applications
- `leave_policies` - Leave type configurations
- `employee_leave_balances` - Leave balance tracking
- `holidays` - Company holidays
- `notifications` - System notifications
- `leave_workflow_history` - Approval workflow tracking

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd absentra
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**
   - Create a new Supabase project
   - Run the migration files in `supabase/migrations/`
   - Configure environment variables

4. **Environment Setup**
Create a `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. **Start the development server**
```bash
npm run dev
```

### Initial Setup

1. **Create Admin User**
   - First, create an employee record with role 'Admin'
   - Then create a user account linked to that employee

2. **Configure Leave Policies**
   - Navigate to Leave Policies section
   - Create basic leave types (Annual, Sick, Personal, etc.)

3. **Add Employees**
   - Use Employee Management to add team members
   - Assign appropriate roles and departments

4. **Set Up Holidays**
   - Add company holidays for the current year
   - Configure recurring holidays

## User Roles & Permissions

### Employee
- Submit leave requests
- View own leave history
- Check leave balances
- View calendar with own leaves
- Receive notifications

### Manager
- All Employee permissions
- Approve/reject team member leave requests
- View team leave calendar
- Access team reports

### HR
- All Manager permissions
- Final approval for leave requests
- Manage leave policies
- Manage leave balances
- Access all reports
- View all employee leaves

### Admin
- All HR permissions
- Manage employees
- Manage holidays
- System configuration
- Full access to all features

## Core Modules

### 1. Authentication System

**Location**: `src/lib/auth.ts`, `src/components/auth/`

**Features**:
- Custom authentication with bcrypt password hashing
- Role-based access control
- Session management with localStorage
- Password change functionality

**Key Functions**:
```typescript
signUp(employeeId: string, username: string, password: string)
signIn(username: string, password: string)
changePassword(userId: string, currentPassword: string, newPassword: string)
```

### 2. Leave Management

**Location**: `src/components/leaves/`

**Features**:
- Leave request creation and editing
- Multi-level approval workflow
- Leave validation against policies
- Workflow history tracking

**Workflow Process**:
1. Employee submits leave request
2. Manager approval (if applicable)
3. HR approval (final)
4. Notifications sent at each step

### 3. Leave Policy Engine

**Location**: `src/lib/leavePolicy.ts`, `src/components/leavePolicy/`

**Features**:
- Policy configuration with complex rules
- Leave balance calculations
- Validation engine
- Department and gender restrictions

**Policy Configuration**:
- Annual entitlement
- Carry forward rules
- Encashment policies
- Approval workflows
- Service requirements

### 4. Calendar Integration

**Location**: `src/components/calendar/`

**Features**:
- Monthly calendar view
- Holiday and leave visualization
- Interactive date selection
- Event tooltips

### 5. Notification System

**Location**: `src/lib/notifications.ts`

**Features**:
- Real-time notifications
- Email-style notification panel
- Automatic status updates
- Notification history

### 6. Reporting & Analytics

**Location**: `src/components/reports/`

**Features**:
- Comprehensive leave reports
- Department-wise analytics
- Employee utilization reports
- CSV export functionality

## Database Schema

### Core Tables

#### employees
```sql
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text CHECK (role IN ('Employee', 'Manager', 'HR', 'Admin')),
  department text NOT NULL,
  manager_id uuid REFERENCES employees(id),
  hire_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### leave_requests
```sql
CREATE TABLE leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text REFERENCES employees(employee_id) ON DELETE CASCADE,
  type text CHECK (type IN ('Annual', 'Sick', 'Personal', 'Maternity', 'Paternity', 'Emergency')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested integer NOT NULL,
  reason text,
  status text DEFAULT 'Pending' CHECK (status IN ('Submitted', 'Pending', 'Approved', 'Rejected')),
  manager_notes text,
  hr_notes text,
  approved_by_manager uuid REFERENCES employees(id),
  approved_by_hr uuid REFERENCES employees(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### leave_policies
```sql
CREATE TABLE leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  annual_entitlement integer DEFAULT 0,
  carry_forward_allowed boolean DEFAULT false,
  max_carry_forward_days integer,
  encashment_allowed boolean DEFAULT false,
  max_encashment_days integer,
  approval_workflow text DEFAULT 'multi' CHECK (approval_workflow IN ('single', 'multi')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Security (Row Level Security)

All tables have RLS enabled with appropriate policies:

```sql
-- Example: Leave requests policy
CREATE POLICY "Users can read own leave requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (employee_id = (SELECT employee_id FROM employees WHERE id = auth.uid()));
```

## API Reference

### Authentication Endpoints

#### Sign Up
```typescript
POST /auth/signup
Body: {
  employeeId: string,
  username: string,
  password: string
}
Response: { success: boolean, user?: User }
```

#### Sign In
```typescript
POST /auth/signin
Body: {
  username: string,
  password: string
}
Response: { success: boolean, user?: User }
```

### Leave Management Endpoints

#### Create Leave Request
```typescript
POST /leave-requests
Body: {
  type: string,
  start_date: string,
  end_date: string,
  days_requested: number,
  reason?: string
}
```

#### Approve/Reject Leave
```typescript
PATCH /leave-requests/:id
Body: {
  status: 'Approved' | 'Rejected',
  notes?: string
}
```

### Policy Management Endpoints

#### Get Leave Policies
```typescript
GET /leave-policies
Query: { active?: boolean }
Response: LeavePolicy[]
```

#### Validate Leave Request
```typescript
POST /leave-policies/validate
Body: {
  employeeId: string,
  policyCode: string,
  startDate: string,
  endDate: string,
  daysRequested: number
}
Response: { valid: boolean, errors: string[] }
```

## Deployment

### Production Deployment

1. **Build the application**
```bash
npm run build
```

2. **Deploy to hosting platform**
   - Vercel (recommended)
   - Netlify
   - AWS S3 + CloudFront

3. **Configure environment variables**
   - Set production Supabase credentials
   - Configure domain settings

### Supabase Configuration

1. **Database Setup**
   - Run all migration files
   - Configure RLS policies
   - Set up database functions

2. **Authentication**
   - Disable email confirmation (using custom auth)
   - Configure JWT settings

3. **Storage** (if needed)
   - Set up file storage buckets
   - Configure access policies

## Troubleshooting

### Common Issues

#### Authentication Problems
```
Error: Invalid credentials
Solution: Check username/password, verify employee exists
```

#### Leave Validation Errors
```
Error: Insufficient leave balance
Solution: Check leave policies and employee balances
```

#### Database Connection Issues
```
Error: Supabase not configured
Solution: Verify environment variables and Supabase setup
```

### Debug Mode

Enable debug logging:
```typescript
// In supabase.ts
export const DEBUG = process.env.NODE_ENV === 'development'
```

### Performance Optimization

1. **Database Indexes**
   - Ensure proper indexing on frequently queried columns
   - Monitor query performance

2. **Frontend Optimization**
   - Implement lazy loading for large datasets
   - Use React.memo for expensive components
   - Optimize bundle size

### Monitoring

1. **Error Tracking**
   - Implement error boundary components
   - Use Sentry or similar service

2. **Performance Monitoring**
   - Monitor API response times
   - Track user interactions

## Contributing

### Development Guidelines

1. **Code Style**
   - Use TypeScript strictly
   - Follow ESLint configuration
   - Use Prettier for formatting

2. **Component Structure**
   - Keep components under 200 lines
   - Use proper prop typing
   - Implement error boundaries

3. **Testing**
   - Write unit tests for utilities
   - Test critical user flows
   - Use React Testing Library

### Pull Request Process

1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Submit PR with detailed description

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Maintainer**: Development Team