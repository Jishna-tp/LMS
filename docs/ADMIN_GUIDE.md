# Absentra Administrator Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Initial Setup](#initial-setup)
3. [Employee Management](#employee-management)
4. [Leave Policy Configuration](#leave-policy-configuration)
5. [Holiday Management](#holiday-management)
6. [Leave Balance Management](#leave-balance-management)
7. [Reporting & Analytics](#reporting--analytics)
8. [System Maintenance](#system-maintenance)
9. [Security & Compliance](#security--compliance)
10. [Troubleshooting](#troubleshooting)

## System Overview

### Administrator Responsibilities

As an Absentra administrator, you are responsible for:
- System configuration and maintenance
- Employee lifecycle management
- Leave policy creation and updates
- Holiday calendar management
- Data integrity and security
- User support and training
- Compliance reporting

### Access Levels

**Admin Role Capabilities**:
- Full system access
- Employee management
- Holiday configuration
- System settings
- All HR functions
- Complete reporting access

## Initial Setup

### 1. System Configuration

**Environment Setup**:
```bash
# Verify environment variables
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Database Verification**:
- Confirm all migrations are applied
- Verify RLS policies are active
- Test database connectivity
- Check function implementations

### 2. Create Initial Admin Account

**Step-by-Step Process**:
1. **Create Employee Record**:
   ```sql
   INSERT INTO employees (name, email, role, department, employee_id)
   VALUES ('Admin User', 'admin@company.com', 'Admin', 'IT', 'ADM001');
   ```

2. **Create User Account**:
   - Use the Sign Up interface
   - Link to the employee record created above
   - Set secure password

3. **Verify Access**:
   - Log in with admin credentials
   - Confirm all menu items are visible
   - Test core functionality

### 3. Basic Configuration

**Essential Setup Tasks**:
1. Configure company holidays
2. Create basic leave policies
3. Set up departments
4. Import employee data
5. Initialize leave balances

## Employee Management

### Adding New Employees

**Manual Addition**:
1. Navigate to **Employees** section
2. Click **Add Employee**
3. Fill required information:
   - Full Name
   - Email (unique)
   - Role (Employee/Manager/HR/Admin)
   - Department
   - Manager (if applicable)
   - Hire Date

**Bulk Import** (Future Enhancement):
- Prepare CSV with employee data
- Use import functionality
- Validate data before processing
- Initialize leave balances automatically

### Employee Roles and Permissions

**Role Hierarchy**:
```
Admin (Full Access)
├── HR (Policy & Balance Management)
├── Manager (Team Approval)
└── Employee (Basic Functions)
```

**Permission Matrix**:
| Feature | Employee | Manager | HR | Admin |
|---------|----------|---------|----|----|
| Submit Leave | ✅ | ✅ | ✅ | ✅ |
| Approve Team Leaves | ❌ | ✅ | ✅ | ✅ |
| Manage Policies | ❌ | ❌ | ✅ | ✅ |
| Manage Employees | ❌ | ❌ | ❌ | ✅ |
| System Config | ❌ | ❌ | ❌ | ✅ |

### Managing Employee Lifecycle

**New Employee Onboarding**:
1. Create employee record
2. Assign to department and manager
3. Set up user account
4. Initialize leave balances
5. Provide system training

**Role Changes**:
1. Update employee role
2. Adjust permissions automatically
3. Notify affected users
4. Update reporting relationships

**Employee Departure**:
1. Deactivate user account
2. Transfer pending approvals
3. Archive employee data
4. Generate final reports

## Leave Policy Configuration

### Creating Leave Policies

**Basic Policy Setup**:
1. Navigate to **Leave Policies**
2. Click **Add Leave Policy**
3. Configure policy parameters:

**Essential Fields**:
- **Policy Name**: Display name (e.g., "Annual Leave")
- **Policy Code**: System identifier (e.g., "ANNUAL")
- **Description**: Policy explanation
- **Annual Entitlement**: Days per year
- **Approval Workflow**: Single or Multi-level

**Advanced Configuration**:
- **Carry Forward Rules**: Allow unused days to next year
- **Encashment Rules**: Convert unused days to pay
- **Service Requirements**: Minimum months before eligibility
- **Gender Restrictions**: For maternity/paternity leave
- **Department Restrictions**: Limit to specific departments
- **Maximum Consecutive Days**: Prevent long absences
- **Advance Notice**: Required notice period

### Policy Examples

**Annual Leave Policy**:
```
Name: Annual Leave
Code: ANNUAL
Entitlement: 21 days
Carry Forward: Yes (max 5 days)
Encashment: Yes (max 10 days)
Workflow: Multi-level
Notice: 7 days
```

**Sick Leave Policy**:
```
Name: Sick Leave
Code: SICK
Entitlement: 10 days
Carry Forward: No
Encashment: No
Workflow: Single-level
Notice: 0 days (emergency)
```

**Maternity Leave Policy**:
```
Name: Maternity Leave
Code: MATERNITY
Entitlement: 90 days
Gender: Female only
Service: 12 months minimum
Workflow: Multi-level
Notice: 30 days
```

### Policy Validation Rules

**System Validations**:
- Sufficient balance checking
- Date range validation
- Policy eligibility verification
- Workflow compliance
- Holiday overlap detection

**Custom Validation Logic**:
```typescript
// Example validation function
const validateLeaveRequest = async (request) => {
  const policy = await getPolicy(request.type);
  const balance = await getEmployeeBalance(request.employeeId);
  
  // Check balance
  if (balance.available < request.days) {
    return { valid: false, error: "Insufficient balance" };
  }
  
  // Check service requirement
  if (employee.serviceMonths < policy.minServiceMonths) {
    return { valid: false, error: "Service requirement not met" };
  }
  
  return { valid: true };
};
```

## Holiday Management

### Adding Holidays

**Manual Holiday Creation**:
1. Navigate to **Holidays** section
2. Click **Add Holiday**
3. Configure holiday details:
   - Name
   - Date
   - Type (National/Religious/Company/Regional)
   - Recurring (yearly)
   - Description

**Holiday Types**:
- **National**: Government holidays
- **Religious**: Faith-based observances
- **Company**: Organization-specific days
- **Regional**: Location-based holidays

### Bulk Holiday Import

**CSV Import Process**:
1. Download template CSV
2. Fill holiday information:
   ```csv
   Holiday Name,Date (YYYY-MM-DD),Type,Recurring,Description
   New Year's Day,2024-01-01,National,true,Start of new year
   Independence Day,2024-07-04,National,true,National holiday
   ```
3. Upload and validate
4. Review and confirm import

### Recurring Holiday Management

**Automatic Generation**:
- Use "Generate Recurring" feature
- Creates next year's holidays automatically
- Maintains holiday patterns
- Prevents duplicate entries

**Best Practices**:
- Set up recurring holidays once
- Review annually for changes
- Coordinate with payroll calendar
- Communicate changes to employees

## Leave Balance Management

### Understanding Balance Components

**Balance Structure**:
```
Opening Balance: Carried from previous year
Annual Entitlement: Current year allocation
Used Balance: Days already taken
Pending Balance: Days in pending requests
Available Balance: Days available for use
Carry Forward: Days brought from previous year
Encashed Balance: Days converted to pay
```

**Calculation Formula**:
```
Available = Opening + Annual - Used - Pending
```

### Balance Initialization

**New Employee Setup**:
1. Navigate to **Leave Policies → Balances**
2. Find employee record
3. Initialize balances based on:
   - Hire date
   - Applicable policies
   - Pro-rated entitlements

**Pro-ration Calculation**:
```typescript
// Example pro-ration for mid-year hire
const monthsRemaining = 12 - hireMonth;
const proRatedEntitlement = (annualEntitlement / 12) * monthsRemaining;
```

### Manual Balance Adjustments

**When to Adjust**:
- Correction of errors
- Policy changes
- Special circumstances
- Carry forward processing
- Encashment processing

**Adjustment Process**:
1. Select employee balance
2. Click **Adjust** button
3. Modify balance components
4. Provide adjustment reason
5. Save changes

**Audit Trail**:
- All adjustments are logged
- Reason tracking required
- Administrator identification
- Timestamp recording

### Year-End Processing

**Annual Balance Rollover**:
1. **Calculate Carry Forward**:
   - Apply policy limits
   - Update opening balances
   - Reset annual entitlements

2. **Process Encashments**:
   - Calculate eligible days
   - Generate encashment reports
   - Update balances

3. **Archive Previous Year**:
   - Maintain historical data
   - Generate annual reports
   - Prepare for new year

## Reporting & Analytics

### Standard Reports

**Employee Reports**:
- Individual leave history
- Balance summaries
- Utilization rates
- Attendance patterns

**Department Reports**:
- Team leave patterns
- Coverage analysis
- Seasonal trends
- Manager workload

**Company Reports**:
- Overall utilization
- Policy effectiveness
- Cost analysis
- Compliance metrics

### Custom Report Generation

**Report Builder Features**:
- Date range selection
- Department filtering
- Employee grouping
- Leave type analysis
- Export capabilities

**Export Formats**:
- CSV for data analysis
- PDF for formal reports
- Excel for advanced processing

### Analytics Dashboard

**Key Metrics**:
- Leave utilization rates
- Approval processing times
- Popular leave periods
- Balance distribution
- Policy compliance

**Trend Analysis**:
- Monthly usage patterns
- Seasonal variations
- Department comparisons
- Year-over-year changes

## System Maintenance

### Regular Maintenance Tasks

**Daily Tasks**:
- Monitor system performance
- Check error logs
- Review pending approvals
- Respond to user issues

**Weekly Tasks**:
- Generate usage reports
- Review balance accuracy
- Update holiday calendar
- Process policy changes

**Monthly Tasks**:
- Analyze system metrics
- Review user feedback
- Update documentation
- Plan system improvements

**Annual Tasks**:
- Year-end processing
- Policy review and updates
- System backup verification
- Security audit

### Database Maintenance

**Performance Optimization**:
- Monitor query performance
- Update database statistics
- Optimize slow queries
- Manage storage growth

**Data Integrity**:
- Verify referential integrity
- Check calculation accuracy
- Validate policy compliance
- Audit user permissions

### Backup and Recovery

**Backup Strategy**:
- Automated daily backups
- Weekly full backups
- Monthly archive backups
- Disaster recovery testing

**Recovery Procedures**:
1. Identify data loss scope
2. Select appropriate backup
3. Restore to staging environment
4. Validate data integrity
5. Promote to production

## Security & Compliance

### Access Control

**User Authentication**:
- Strong password requirements
- Account lockout policies
- Session timeout settings
- Multi-factor authentication (future)

**Role-Based Security**:
- Principle of least privilege
- Regular access reviews
- Automated role assignment
- Permission auditing

### Data Protection

**Sensitive Data Handling**:
- Personal information encryption
- Secure data transmission
- Access logging
- Data retention policies

**Privacy Compliance**:
- GDPR compliance measures
- Data subject rights
- Consent management
- Data processing records

### Audit and Compliance

**Audit Logging**:
- User activity tracking
- System change logging
- Data access monitoring
- Security event recording

**Compliance Reporting**:
- Regulatory requirement tracking
- Audit trail generation
- Compliance dashboard
- Exception reporting

## Troubleshooting

### Common Issues

**User Access Problems**:
```
Issue: User cannot log in
Diagnosis: Check employee record exists, verify username/password
Resolution: Reset password or recreate user account
```

**Leave Request Errors**:
```
Issue: Leave request validation fails
Diagnosis: Check policy configuration, verify balance calculation
Resolution: Adjust policy rules or correct balance data
```

**Performance Issues**:
```
Issue: System running slowly
Diagnosis: Check database performance, review query execution
Resolution: Optimize queries, update indexes, scale resources
```

### Diagnostic Tools

**System Health Checks**:
- Database connectivity test
- API response time monitoring
- User session tracking
- Error rate analysis

**Data Validation Tools**:
- Balance calculation verification
- Policy compliance checking
- Workflow integrity testing
- Report accuracy validation

### Support Escalation

**Internal Support Process**:
1. **Level 1**: Basic user support
2. **Level 2**: Technical troubleshooting
3. **Level 3**: System administration
4. **Level 4**: Developer support

**External Support**:
- Supabase technical support
- Third-party service providers
- Security consultants
- Compliance advisors

### Emergency Procedures

**System Outage Response**:
1. Assess impact and scope
2. Communicate to stakeholders
3. Implement workaround if possible
4. Restore service
5. Conduct post-incident review

**Data Breach Response**:
1. Contain the breach
2. Assess data exposure
3. Notify relevant authorities
4. Communicate to affected users
5. Implement preventive measures

---

**Administrator Resources**:
- System documentation
- User training materials
- Policy templates
- Compliance checklists
- Emergency contact information

For technical support, contact the development team or refer to the technical documentation.