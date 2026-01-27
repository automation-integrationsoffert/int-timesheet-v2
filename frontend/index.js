import {initializeBlock, useBase, useRecords, useCustomProperties, expandRecord} from '@airtable/blocks/interface/ui';
import {FieldType} from '@airtable/blocks/interface/models';
import {useCallback, useState, useEffect, useMemo} from 'react';
import './style.css';

function getCustomProperties(base) {
    const timesheetTable = base.getTableByNameIfExists('Timesheet') || base.tables[0];
    const usersTable = base.getTableByNameIfExists('Users Table') || base.getTableByNameIfExists('Users') || null;
    const tasksTable = base.getTableByNameIfExists('Tasks for Timesheet') || base.getTableByNameIfExists('Tasks') || base.getTableByNameIfExists('Project from Task') || null;
    const monthTable = base.getTableByNameIfExists('Month') || null;
    
    // Helper to find a field by name
    const findField = (table, fieldName) => {
        if (!table) return undefined;
        return table.fields.find(field => field.name === fieldName);
    };

    return [
        {
            key: 'timesheetTable',
            label: 'Timesheet Table',
            type: 'table',
            defaultValue: timesheetTable,
        },
        {
            key: 'usersTable',
            label: 'Users Table',
            type: 'table',
            defaultValue: usersTable,
        },
        {
            key: 'tasksTable',
            label: 'Tasks for Timesheet Table',
            type: 'table',
            defaultValue: tasksTable,
        },
        {
            key: 'monthTable',
            label: 'Month Table',
            type: 'table',
            defaultValue: monthTable,
        },
        {
            key: 'monthStatus',
            label: 'Status (Month Table)',
            type: 'field',
            table: monthTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.SINGLE_SELECT,
            defaultValue: findField(monthTable, 'Status'),
        },
        {
            key: 'monthStartDate',
            label: 'Start Date (Month Table)',
            type: 'field',
            table: monthTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.DATE || 
                field.config.type === FieldType.DATE_TIME,
            defaultValue: findField(monthTable, 'Start Date'),
        },
        {
            key: 'monthEndDate',
            label: 'End Date (Month Table)',
            type: 'field',
            table: monthTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.DATE || 
                field.config.type === FieldType.DATE_TIME,
            defaultValue: findField(monthTable, 'End Date'),
        },
        {
            key: 'projectImport',
            label: 'Project Import',
            type: 'field',
            table: timesheetTable,
            defaultValue: findField(timesheetTable, 'Project Import'),
        },
        {
            key: 'emailFromName',
            label: 'Email (from Name)',
            type: 'field',
            table: timesheetTable,
            defaultValue: findField(timesheetTable, 'Email (from Name)'),
        },
        {
            key: 'task',
            label: 'Task',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.MULTIPLE_RECORD_LINKS,
            defaultValue: findField(timesheetTable, 'Task'),
        },
        {
            key: 'createdBy2',
            label: 'Created By 2',
            type: 'field',
            table: timesheetTable,
            defaultValue: findField(timesheetTable, 'Created By 2'),
        },
        {
            key: 'name',
            label: 'Name',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.MULTIPLE_RECORD_LINKS,
            defaultValue: findField(timesheetTable, 'Name'),
        },
        {
            key: 'date',
            label: 'Date',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.DATE || 
                field.config.type === FieldType.DATE_TIME,
            defaultValue: findField(timesheetTable, 'Date'),
        },
        {
            key: 'individualHours',
            label: 'Individual Hours',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.NUMBER || 
                field.config.type === FieldType.CURRENCY,
            defaultValue: findField(timesheetTable, 'Individual Hours'),
        },
        {
            key: 'weekday',
            label: 'Weekday',
            type: 'field',
            table: timesheetTable,
            defaultValue: findField(timesheetTable, 'Weekday'),
        },
        {
            key: 'projectFromTask',
            label: 'Project from Task',
            type: 'field',
            table: timesheetTable,
            defaultValue: findField(timesheetTable, 'Project from Task'),
        },
        {
            key: 'projectFromTaskExt',
            label: 'Project from Task - Ext',
            type: 'field',
            table: timesheetTable,
            defaultValue: findField(timesheetTable, 'Project from Task - Ext'),
        },
    ];
}

function CalendarPicker({selectedDate, onDateSelect, availableDates, onClose}) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };
    
    const getFirstDayOfMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month, 1).getDay();
    };
    
    const formatDateToString = (date) => {
        // Format date as YYYY-MM-DD using local date components to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const isDateAvailable = (date) => {
        const dateStr = formatDateToString(date);
        return availableDates.has(dateStr);
    };
    
    const isDateSelected = (date) => {
        if (!selectedDate) return false;
        const dateStr = formatDateToString(date);
        let selectedDateObj;
        if (selectedDate instanceof Date) {
            selectedDateObj = selectedDate;
        } else {
            selectedDateObj = new Date(selectedDate);
        }
        const selectedStr = formatDateToString(selectedDateObj);
        return dateStr === selectedStr;
    };
    
    const handleDateClick = (day) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        if (isDateAvailable(date)) {
            onDateSelect(date);
        }
    };
    
    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };
    
    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };
    
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const days = [];
    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        days.push(day);
    }
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={prevMonth}
                        className="px-3 py-1 text-sm text-gray-gray700 dark:text-gray-gray300 hover:bg-gray-gray100 dark:hover:bg-gray-gray600 rounded"
                    >
                        ←
                    </button>
                    <h3 className="text-lg font-semibold text-gray-gray900 dark:text-gray-gray100">
                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </h3>
                    <button
                        onClick={nextMonth}
                        className="px-3 py-1 text-sm text-gray-gray700 dark:text-gray-gray300 hover:bg-gray-gray100 dark:hover:bg-gray-gray600 rounded"
                    >
                        →
                    </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayNames.map(day => (
                        <div key={day} className="text-center text-xs font-semibold text-gray-gray600 dark:text-gray-gray400 py-2">
                            {day}
                        </div>
                    ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => {
                        if (day === null) {
                            return <div key={index} className="aspect-square" />;
                        }
                        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                        const available = isDateAvailable(date);
                        const selected = isDateSelected(date);
                        
                        return (
                            <button
                                key={day}
                                onClick={() => handleDateClick(day)}
                                disabled={!available}
                                className={`aspect-square rounded text-sm transition-colors ${
                                    selected
                                        ? 'bg-blue-blue text-white'
                                        : available
                                        ? 'bg-gray-gray100 dark:bg-gray-gray600 text-gray-gray900 dark:text-gray-gray100 hover:bg-blue-blue hover:text-white'
                                        : 'bg-gray-gray50 dark:bg-gray-gray800 text-gray-gray400 dark:text-gray-gray500 cursor-not-allowed opacity-50'
                                }`}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
                
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray900 dark:text-gray-gray100 rounded hover:bg-gray-gray300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditableCell({record, field, onUpdate, monthRecords, monthStatusField, monthStartDateField, monthEndDateField}) {
    const fieldName = field?.name || '';
    const fieldType = field?.config?.type;
    
    // Check if the record's date falls within a "Closed" month period
    const isRecordClosed = () => {
        if (!monthRecords || !monthStatusField || !monthStartDateField || !monthEndDateField) {
            return false;
        }
        
        // Get the record's date field
        const dateField = record.parentTable.fields.find(f => 
            f.name === 'Date' && (f.config.type === FieldType.DATE || f.config.type === FieldType.DATE_TIME)
        );
        if (!dateField) return false;
        
        const recordDate = record.getCellValue(dateField);
        if (!recordDate) return false;
        
        // Normalize record date to local date (remove time component)
        const recordDateObj = new Date(recordDate);
        const recordDateLocal = new Date(recordDateObj.getFullYear(), recordDateObj.getMonth(), recordDateObj.getDate());
        
        // Check if record date falls within any "Closed" month period
        for (const monthRecord of monthRecords) {
            const status = monthRecord.getCellValue(monthStatusField);
            // Check if status is "Closed"
            if (status && (status.name === 'Closed' || status === 'Closed')) {
                const startDate = monthRecord.getCellValue(monthStartDateField);
                const endDate = monthRecord.getCellValue(monthEndDateField);
                
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    
                    // Normalize to local date
                    const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                    const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
                    
                    // Check if record date is within this closed period
                    if (recordDateLocal >= startLocal && recordDateLocal <= endLocal) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    };
    
    const isClosed = isRecordClosed();
    
    // Fields that should be editable input fields
    const isProjectImportField = fieldName === 'Project Import';
    const isNameField = fieldName === 'Name';
    const isDateFieldEditable = fieldName === 'Date';
    const isIndividualHoursField = fieldName === 'Individual Hours';
    const isProjectFromTaskEditable = fieldName === 'Project from Task';
    
    // These fields should always be editable (unless read-only for other reasons)
    const shouldBeEditable = isProjectImportField || isNameField || isDateFieldEditable || isIndividualHoursField || isProjectFromTaskEditable;
    
    const canEdit = record?.parentTable?.hasPermissionToUpdateRecords?.([{id: record.id, fields: {[field.id]: null}}]) ?? false;
    const isFormula = fieldType === FieldType.FORMULA;
    const isLookup = fieldType === FieldType.MULTIPLE_LOOKUP_VALUES || fieldType === FieldType.ROLLUP;
    // Record is read-only if it's in a closed period, or if it's a formula/lookup field, or if user doesn't have edit permission
    const isReadOnly = isClosed || isFormula || isLookup || !canEdit;
    const isDateField = fieldType === FieldType.DATE || fieldType === FieldType.DATE_TIME;
    
    // Initialize as editing for editable fields (but not if closed)
    const [isEditing, setIsEditing] = useState(shouldBeEditable && !isFormula && !isLookup && !isClosed);
    const [showCalendar, setShowCalendar] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [linkedRecords, setLinkedRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showLinkedRecordDropdown, setShowLinkedRecordDropdown] = useState(false);

    const isEmailField = fieldName === 'Email (from Name)';
    const isProjectFromTaskField = fieldName === 'Project from Task' || fieldName === 'Project from Task - Ext';
    
    // For lookup fields (Email from Name, Project from Task), use getCellValueAsString to get value directly
    const cellValue = field ? (
        (isEmailField || isProjectFromTaskField) && isLookup 
            ? (record.getCellValueAsString(field) || '')
            : (record.getCellValue(field) ?? '')
    ) : '';
    
    const formatDisplayValue = (value) => {
        if (value === null || value === undefined) return '';
        
        // For Email (from Name) field, prioritize email display
        if (isEmailField) {
            // If we used getCellValueAsString, value is already a string (email)
            if (typeof value === 'string') return value;
            
            // Handle arrays (lookup fields can return arrays)
            if (Array.isArray(value)) {
                return value.map(item => {
                    // If it's already a string (email), return it
                    if (typeof item === 'string') return item;
                    // If it's an object with email property, return email
                    if (item?.email) return item.email;
                    // Otherwise try to get string representation
                    return String(item);
                }).join(', ');
            }
            
            // If it's an object, try to get email
            if (value && typeof value === 'object') {
                if (value.email) return value.email;
                // Fallback to string representation
                return String(value);
            }
        }
        
        // For Project from Task lookup field, prioritize Project name/number display
        if (isProjectFromTaskField) {
            // If we used getCellValueAsString, value is already a string (Project name/number)
            if (typeof value === 'string') return value;
            
            // Handle arrays (lookup fields can return arrays)
            if (Array.isArray(value)) {
                return value.map(item => {
                    // If it's already a string (Project name/number), return it
                    if (typeof item === 'string') return item;
                    // If it's an object, get name or displayName
                    return item?.name || item?.displayName || String(item);
                }).join(', ');
            }
            
            // If it's an object, get Project name
            if (value && typeof value === 'object') {
                return value.name || value.displayName || String(value);
            }
        }
        
        // For other fields, handle normally
        // Handle arrays (for lookup fields, multiple selects, linked records, etc.)
        if (Array.isArray(value)) {
            return value.map(item => {
                if (typeof item === 'string') return item;
                // For CREATED_BY, LAST_MODIFIED_BY, SINGLE_COLLABORATOR - never show email
                if (fieldType === FieldType.CREATED_BY || fieldType === FieldType.LAST_MODIFIED_BY || 
                    fieldType === FieldType.SINGLE_COLLABORATOR) {
                    return item?.name || item?.displayName || String(item);
                }
                // For other fields, show name/displayName, not email
                return item?.name || item?.displayName || String(item);
            }).join(', ');
        }
        
        // Handle objects (single select, single linked record, etc.)
        if (value && typeof value === 'object') {
            // For CREATED_BY and LAST_MODIFIED_BY fields, show name, NEVER email
            if (fieldType === FieldType.CREATED_BY || fieldType === FieldType.LAST_MODIFIED_BY || 
                fieldType === FieldType.SINGLE_COLLABORATOR) {
                return value.name || value.displayName || String(value);
            }
            // For other fields (except Email field), show name/displayName, not email
            if ('name' in value) return value.name;
            if ('displayName' in value) return value.displayName;
            // Only show email as last resort for non-collaborator fields, but Email (from Name) is already handled above
            return String(value);
        }
        
        // Handle dates
        if (value instanceof Date) {
            // For DATE_TIME, include time; for DATE, just date
            if (fieldType === FieldType.DATE_TIME) {
                // Format as datetime-local input expects: YYYY-MM-DDTHH:mm
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, '0');
                const day = String(value.getDate()).padStart(2, '0');
                const hours = String(value.getHours()).padStart(2, '0');
                const minutes = String(value.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            }
            return value.toISOString().split('T')[0];
        }
        
        return String(value);
    };

    // Calculate available dates from Month table
    const getAvailableDates = () => {
        const availableDates = new Set();
        
        if (!monthRecords || !monthStatusField || !monthStartDateField || !monthEndDateField) {
            return availableDates;
        }
        
        monthRecords.forEach(monthRecord => {
            const status = monthRecord.getCellValue(monthStatusField);
            // Check if status is "Open"
            if (status && (status.name === 'Open' || status === 'Open')) {
                const startDate = monthRecord.getCellValue(monthStartDateField);
                const endDate = monthRecord.getCellValue(monthEndDateField);
                
                if (startDate && endDate) {
                    // Create dates using local time to avoid timezone issues
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    
                    // Normalize to local date (remove time component)
                    const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                    const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
                    
                    // Add all dates from start to end (inclusive)
                    const currentDate = new Date(startLocal);
                    while (currentDate <= endLocal) {
                        // Format as YYYY-MM-DD using local date components
                        const year = currentDate.getFullYear();
                        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                        const day = String(currentDate.getDate()).padStart(2, '0');
                        const dateStr = `${year}-${month}-${day}`;
                        availableDates.add(dateStr);
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                }
            }
        });
        
        return availableDates;
    };
    
    const availableDates = getAvailableDates();
    
    // Initialize editing state and value for editable fields - show as input from start
    useEffect(() => {
        if (shouldBeEditable && !isFormula && !isLookup && !isClosed) {
            // Set initial edit value based on field type
            if (fieldType === FieldType.SINGLE_SELECT) {
                // For single select, use the option ID
                const currentValue = cellValue;
                const currentOptionId = currentValue?.id || null;
                if (editValue === '' && currentOptionId) {
                    setEditValue(currentOptionId);
                } else if (!currentOptionId && editValue !== '') {
                    // Clear if no value
                    setEditValue('');
                }
            } else {
                // For other fields, use formatted display value
                // Only update if editValue is empty (initial load) to avoid overwriting user input
                if (editValue === '') {
                    const formattedValue = formatDisplayValue(cellValue);
                    setEditValue(formattedValue);
                }
            }
            
            // For linked records (Name field), fetch initial options
            if (fieldType === FieldType.MULTIPLE_RECORD_LINKS && linkedRecords.length === 0 && isEditing) {
                const currentValue = cellValue;
                const currentIds = Array.isArray(currentValue) 
                    ? currentValue.map(item => item?.id || item)
                    : [];
                
                record.fetchForeignRecordsAsync(field, '').then(result => {
                    setLinkedRecords(result.records.map(r => ({
                        ...r,
                        selected: currentIds.includes(r.id)
                    })));
                });
            }
        }
    }, [shouldBeEditable, isFormula, isLookup, cellValue, isEditing, fieldType]);
    
    const handleClick = () => {
        // For editable input fields, always allow editing (unless it's a lookup/formula or closed)
        if (shouldBeEditable && !isFormula && !isLookup && !isClosed) {
            // For date fields, show calendar
            if (isDateFieldEditable && isDateField && monthRecords) {
                setShowCalendar(true);
                return;
            }
            return;
        }
        
        // For other fields, check read-only status
        if (isReadOnly) return;
        
        // For date fields, show calendar
        if (isDateField && monthRecords) {
            setShowCalendar(true);
            return;
        }
        
        setIsEditing(true);
        setEditValue(formatDisplayValue(cellValue));
        
        // For linked records, fetch initial options and mark currently selected ones
        if (fieldType === FieldType.MULTIPLE_RECORD_LINKS) {
            const currentValue = cellValue;
            const currentIds = Array.isArray(currentValue) 
                ? currentValue.map(item => item?.id || item)
                : [];
            
            record.fetchForeignRecordsAsync(field, '').then(result => {
                setLinkedRecords(result.records.map(r => ({
                    ...r,
                    selected: currentIds.includes(r.id)
                })));
            });
        }
    };
    
    const handleDateSelect = async (date) => {
        setShowCalendar(false);
        
        // Check permissions before attempting to save
        if (!canEdit) {
            alert('You do not have permission to edit this record. Please enable record editing permissions for this Interface Extension.');
            return;
        }
        
        setIsSaving(true);
        
        try {
            let valueToSave;
            if (fieldType === FieldType.DATE) {
                valueToSave = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            } else if (fieldType === FieldType.DATE_TIME) {
                valueToSave = date;
            }
            
            await record.parentTable.updateRecordAsync(record, {
                [field.id]: valueToSave
            });
            
            // Don't exit editing mode for editable fields - keep them as inputs (unless closed)
            // For date fields, update the editValue to reflect the saved value
            if (shouldBeEditable && !isFormula && !isLookup && !isClosed) {
                const savedValue = formatDisplayValue(valueToSave);
                setEditValue(savedValue);
            }
            
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error updating record:', error);
            let errorMessage = 'Failed to update record. ';
            if (error.message && error.message.includes('allow record editing')) {
                errorMessage += 'Please enable record editing permissions for this Interface Extension in the Airtable settings.';
            } else {
                errorMessage += error.message || 'Unknown error occurred.';
            }
            alert(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (isSaving || isClosed) return;
        setIsSaving(true);
        
        try {
            let valueToSave = editValue;
            
            // Convert value based on field type
            if (fieldType === FieldType.NUMBER || fieldType === FieldType.CURRENCY || fieldType === FieldType.PERCENT) {
                valueToSave = editValue === '' ? null : parseFloat(editValue);
            } else if (fieldType === FieldType.DATE) {
                valueToSave = editValue === '' ? null : new Date(editValue + 'T00:00:00');
            } else if (fieldType === FieldType.DATE_TIME) {
                valueToSave = editValue === '' ? null : new Date(editValue);
            } else if (fieldType === FieldType.MULTIPLE_RECORD_LINKS) {
                // For linked records, we need to pass array of objects with id property
                const selectedIds = linkedRecords
                    .filter(r => r.selected)
                    .map(r => ({id: r.id}));
                valueToSave = selectedIds;
            } else if (fieldType === FieldType.SINGLE_SELECT) {
                // For single select, value should be the option object with id
                const options = field?.config?.options?.choices || [];
                const selectedOption = options.find(opt => opt.id === editValue);
                valueToSave = selectedOption ? {id: selectedOption.id} : null;
            } else if (fieldType === FieldType.CHECKBOX) {
                valueToSave = editValue === 'true' || editValue === true;
            }
            
            await record.parentTable.updateRecordAsync(record, {
                [field.id]: valueToSave
            });
            
            // Don't exit editing mode for editable fields - keep them as inputs
            if (!shouldBeEditable || isFormula || isLookup) {
                setIsEditing(false);
            } else {
                // Update editValue to reflect the saved value
                const savedValue = formatDisplayValue(valueToSave);
                setEditValue(savedValue);
            }
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error updating record:', error);
            alert('Failed to update record: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue('');
        setLinkedRecords([]);
        setSearchTerm('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    // Handle linked record search
    const handleLinkedRecordSearch = async (term) => {
        setSearchTerm(term);
        try {
            const currentValue = cellValue;
            const currentIds = Array.isArray(currentValue) 
                ? currentValue.map(item => item?.id || item)
                : [];
            
            const result = await record.fetchForeignRecordsAsync(field, term);
            // Preserve selection state for records that are already in the list
            const existingIds = new Set(linkedRecords.map(r => r.id));
            setLinkedRecords(result.records.map(r => {
                const wasSelected = existingIds.has(r.id) 
                    ? linkedRecords.find(lr => lr.id === r.id)?.selected
                    : currentIds.includes(r.id);
                return {
                    ...r,
                    selected: wasSelected || false
                };
            }));
        } catch (error) {
            console.error('Error fetching linked records:', error);
        }
    };

    if (isEditing) {
        // For linked record fields (Name field - MULTIPLE_RECORD_LINKS), show dropdown with search
        if (fieldType === FieldType.MULTIPLE_RECORD_LINKS) {
            const currentValue = cellValue;
            const selectedIds = Array.isArray(currentValue) 
                ? currentValue.map(item => item?.id || item)
                : [];
            const selectedRecords = linkedRecords.filter(r => selectedIds.includes(r.id));
            
            return (
                <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 relative min-w-[180px]">
                    <div className="relative linked-record-dropdown">
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isClosed) return;
                                const newShowState = !showLinkedRecordDropdown;
                                setShowLinkedRecordDropdown(newShowState);
                                if (newShowState && linkedRecords.length === 0) {
                                    record.fetchForeignRecordsAsync(field, '').then(result => {
                                        setLinkedRecords(result.records.map(r => ({
                                            ...r,
                                            selected: selectedIds.includes(r.id)
                                        })));
                                    });
                                }
                            }}
                            className={`w-full px-2 py-1 border rounded text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800 flex items-center justify-between ${isClosed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <span className="truncate">
                                {selectedRecords.length > 0 
                                    ? selectedRecords.map(r => r.displayName).join(', ')
                                    : 'Select...'
                                }
                            </span>
                            <span className="ml-2">▼</span>
                        </div>
                        {showLinkedRecordDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-gray700 border rounded shadow-lg max-h-48 overflow-y-auto">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        handleLinkedRecordSearch(e.target.value);
                                    }}
                                    placeholder="Search..."
                                    className="w-full px-2 py-1 border-b text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                />
                                <div className="py-1">
                                    {linkedRecords.map((linkedRecord) => (
                                        <label 
                                            key={linkedRecord.id} 
                                            className="flex items-center space-x-2 px-2 py-1 hover:bg-gray-gray100 dark:hover:bg-gray-gray600 cursor-pointer"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (isClosed) return;
                                                
                                                // Toggle selection
                                                const newSelected = !linkedRecord.selected;
                                                const updatedRecords = linkedRecords.map(r => 
                                                    r.id === linkedRecord.id 
                                                        ? {...r, selected: newSelected}
                                                        : r
                                                );
                                                setLinkedRecords(updatedRecords);
                                                
                                                // Get selected IDs as array of objects with id property
                                                const selectedIds = updatedRecords
                                                    .filter(r => r.selected)
                                                    .map(r => ({id: r.id}));
                                                
                                                // Auto-save immediately
                                                try {
                                                    setIsSaving(true);
                                                    await record.parentTable.updateRecordAsync(record, {
                                                        [field.id]: selectedIds
                                                    });
                                                    setShowLinkedRecordDropdown(false);
                                                    if (onUpdate) onUpdate();
                                                } catch (error) {
                                                    console.error('Error updating record:', error);
                                                    // Revert selection on error
                                                    setLinkedRecords(linkedRecords);
                                                    let errorMessage = 'Failed to update record. ';
                                                    if (error.message && error.message.includes('allow record editing')) {
                                                        errorMessage += 'Please enable record editing permissions for this Interface Extension in the Airtable settings.';
                                                    } else {
                                                        errorMessage += error.message || 'Unknown error occurred.';
                                                    }
                                                    alert(errorMessage);
                                                } finally {
                                                    setIsSaving(false);
                                                }
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={linkedRecord.selected || false}
                                                readOnly
                                                className="rounded pointer-events-none"
                                            />
                                            <span className="text-sm flex-1">{linkedRecord.displayName}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </td>
            );
        }
        
        // For single select fields, show dropdown
        if (fieldType === FieldType.SINGLE_SELECT) {
            const options = field?.config?.options?.choices || [];
            const currentValue = cellValue;
            const currentOptionId = currentValue?.id || null;
            
            // Use editValue if set, otherwise use current value
            const displayValue = editValue || currentOptionId || '';
            
            return (
                <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px]">
                    <select
                        value={displayValue}
                        disabled={isClosed}
                        onChange={(e) => {
                            const selectedOption = options.find(opt => opt.id === e.target.value);
                            if (selectedOption) {
                                setEditValue(selectedOption.id);
                                // Auto-save on change
                                const valueToSave = {id: selectedOption.id};
                                record.parentTable.updateRecordAsync(record, {
                                    [field.id]: valueToSave
                                }).then(() => {
                                    if (onUpdate) onUpdate();
                                }).catch(error => {
                                    console.error('Error updating record:', error);
                                    let errorMessage = 'Failed to update record. ';
                                    if (error.message && error.message.includes('allow record editing')) {
                                        errorMessage += 'Please enable record editing permissions for this Interface Extension in the Airtable settings.';
                                    } else {
                                        errorMessage += error.message || 'Unknown error occurred.';
                                    }
                                    alert(errorMessage);
                                });
                            } else {
                                // Clear selection
                                setEditValue('');
                                record.parentTable.updateRecordAsync(record, {
                                    [field.id]: null
                                }).then(() => {
                                    if (onUpdate) onUpdate();
                                }).catch(error => {
                                    console.error('Error updating record:', error);
                                });
                            }
                        }}
                        className={`w-full px-2 py-1 border rounded text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800 ${isClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <option value="">-- Select --</option>
                        {options.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </td>
            );
        }
        
        // For date fields that should show calendar
        if (isDateFieldEditable && isDateField && monthRecords) {
            const currentDate = cellValue instanceof Date ? cellValue : (cellValue ? new Date(cellValue) : null);
            return (
                <>
                    {showCalendar && (
                        <CalendarPicker
                            selectedDate={currentDate}
                            onDateSelect={handleDateSelect}
                            availableDates={availableDates}
                            onClose={() => setShowCalendar(false)}
                        />
                    )}
                    <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px]">
                        <input
                            type="text"
                            value={formatDisplayValue(cellValue)}
                            readOnly
                            disabled={isClosed}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isClosed) return;
                                setShowCalendar(true);
                            }}
                            className={`w-full px-2 py-1 border rounded text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800 ${isClosed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            placeholder="Click to select date"
                        />
                    </td>
                </>
            );
        }
        
        let inputType = 'text';
        // Set input type based on field type
        if (fieldType === FieldType.NUMBER || fieldType === FieldType.CURRENCY || fieldType === FieldType.PERCENT) {
            inputType = 'number';
        } else if (fieldType === FieldType.DATE) {
            inputType = 'date';
        } else if (fieldType === FieldType.DATE_TIME) {
            inputType = 'datetime-local';
        } else if (fieldType === FieldType.CHECKBOX) {
            inputType = 'checkbox';
        } else if (fieldType === FieldType.SINGLE_LINE_TEXT || fieldType === FieldType.MULTILINE_TEXT || isProjectImportField) {
            inputType = 'text';
        } else if (fieldType === FieldType.EMAIL || fieldType === FieldType.URL || fieldType === FieldType.PHONE_NUMBER) {
            inputType = 'text';
        }

        return (
            <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px]">
                <div className="flex items-center space-x-2">
                    {fieldType === FieldType.CHECKBOX ? (
                        <input
                            type="checkbox"
                            checked={editValue === 'true' || editValue === true}
                            onChange={(e) => setEditValue(e.target.checked)}
                            onBlur={handleSave}
                            disabled={isClosed}
                            className="rounded"
                        />
                    ) : (
                        <input
                            type={inputType}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSave}
                            disabled={isClosed}
                            className={`flex-1 px-2 py-1 border rounded text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800 ${isClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>
            </td>
        );
    }

    const currentDate = cellValue instanceof Date ? cellValue : (cellValue ? new Date(cellValue) : null);
    
    return (
        <>
            {showCalendar && (
                <CalendarPicker
                    selectedDate={currentDate}
                    onDateSelect={handleDateSelect}
                    availableDates={availableDates}
                    onClose={() => setShowCalendar(false)}
                />
            )}
            {/* For editable fields, always show input. For others, show value */}
            {shouldBeEditable && !isFormula && !isLookup && !isClosed ? (
                // This will be handled by the editing section above (isEditing is always true for editable fields)
                null
            ) : (
                <td
                    className={`px-4 py-3 text-sm text-gray-gray900 dark:text-gray-gray100 border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px] ${
                        (isDateField && !isReadOnly) 
                            ? 'cursor-pointer hover:bg-gray-gray50 dark:hover:bg-gray-gray600' 
                            : ''
                    }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleClick();
                    }}
                    title={
                        isDateField && !isReadOnly 
                            ? 'Click to select date' 
                            : ''
                    }
                >
                    {formatDisplayValue(cellValue)}
                </td>
            )}
        </>
    );
}

function TimesheetApp() {
    const base = useBase();
    const getCustomPropertiesMemo = useCallback((base) => getCustomProperties(base), []);
    const {customPropertyValueByKey, errorState} = useCustomProperties(getCustomPropertiesMemo);
    
    const timesheetTable = customPropertyValueByKey.timesheetTable;
    const usersTable = customPropertyValueByKey.usersTable;
    const monthTable = customPropertyValueByKey.monthTable;
    const records = useRecords(timesheetTable || null);
    const monthRecords = useRecords(monthTable || null);
    const [updateTrigger, setUpdateTrigger] = useState(0);

    // Get all field references
    const projectImport = customPropertyValueByKey.projectImport;
    const emailFromName = customPropertyValueByKey.emailFromName;
    const task = customPropertyValueByKey.task;
    const createdBy2 = customPropertyValueByKey.createdBy2;
    const name = customPropertyValueByKey.name;
    const date = customPropertyValueByKey.date;
    const individualHours = customPropertyValueByKey.individualHours;
    const weekday = customPropertyValueByKey.weekday;
    const projectFromTask = customPropertyValueByKey.projectFromTask;
    const projectFromTaskExt = customPropertyValueByKey.projectFromTaskExt;
    
    // Month table fields
    const monthStatusField = customPropertyValueByKey.monthStatus;
    const monthStartDateField = customPropertyValueByKey.monthStartDate;
    const monthEndDateField = customPropertyValueByKey.monthEndDate;

    // Check if we can expand records
    const canExpandRecords = timesheetTable?.hasPermissionToExpandRecords() ?? false;
    const canUpdateRecords = timesheetTable?.hasPermissionToUpdateRecords?.() ?? false;
    const canCreateRecords = timesheetTable?.hasPermissionToCreateRecords?.() ?? false;
    
    // Show warning if record editing is not enabled
    const showEditWarning = !canUpdateRecords;

    const handleRecordUpdate = () => {
        setUpdateTrigger(prev => prev + 1);
    };

    const handleAddTimeline = async () => {
        if (!canCreateRecords) {
            alert('You do not have permission to create records. Please enable record creation permissions for this Interface Extension.');
            return;
        }

        if (!timesheetTable) {
            alert('Timesheet table is not configured.');
            return;
        }

        try {
            // Create a new empty record
            await timesheetTable.createRecordAsync({});
            // Trigger update to refresh the records list
            handleRecordUpdate();
        } catch (error) {
            console.error('Error creating record:', error);
            let errorMessage = 'Failed to create record. ';
            if (error.message && error.message.includes('allow record')) {
                errorMessage += 'Please enable record creation permissions for this Interface Extension in the Airtable settings.';
            } else {
                errorMessage += error.message || 'Unknown error occurred.';
            }
            alert(errorMessage);
        }
    };

    // Show configuration message if table or fields are not set
    if (errorState || !timesheetTable) {
        return (
            <div className="p-4 sm:p-8 min-h-screen bg-gray-gray50 dark:bg-gray-gray800">
                <div className="rounded-lg p-6 bg-white dark:bg-gray-gray700 shadow-sm">
                    <h2 className="text-lg font-semibold mb-2 text-gray-gray900 dark:text-gray-gray100">
                        Configuration Required
                    </h2>
                    <p className="text-sm text-gray-gray700 dark:text-gray-gray300">
                        Please configure the Timesheet table and fields in the properties panel.
                    </p>
                </div>
            </div>
        );
    }

    const fields = [
        {key: 'projectImport', label: 'Project Import', field: projectImport},
        {key: 'emailFromName', label: 'Email (from Name)', field: emailFromName},
        {key: 'task', label: 'Task', field: task},
        {key: 'createdBy2', label: 'Created By 2', field: createdBy2},
        {key: 'name', label: 'Name', field: name},
        {key: 'date', label: 'Date', field: date},
        {key: 'individualHours', label: 'Individual Hours', field: individualHours},
        {key: 'weekday', label: 'Weekday', field: weekday},
        {key: 'projectFromTask', label: 'Project from Task', field: projectFromTask},
        {key: 'projectFromTaskExt', label: 'Project from Task - Ext', field: projectFromTaskExt},
    ];

    return (
        <div className="w-full h-full bg-gray-gray50 dark:bg-gray-gray800 p-4 sm:p-6 overflow-auto">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-gray900 dark:text-gray-gray100">
                        Timesheet
                    </h1>
                    <p className="text-sm text-gray-gray600 dark:text-gray-gray400 mt-1">
                        {records.length} record{records.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={handleAddTimeline}
                    disabled={!canCreateRecords}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        canCreateRecords
                            ? 'bg-blue-blue text-white hover:bg-blue-blue600 focus:outline-none focus:ring-2 focus:ring-blue-blue focus:ring-offset-2'
                            : 'bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray500 dark:text-gray-gray400 cursor-not-allowed opacity-50'
                    }`}
                >
                    Add Timeline
                </button>
            </div>
            {showEditWarning && (
                <div className="mb-4 p-3 bg-yellow-yellow bg-opacity-20 border border-yellow-yellow rounded text-sm text-gray-gray900 dark:text-gray-gray100">
                    <strong>Note:</strong> Record editing is not enabled for this Interface Extension. 
                    To enable editing, go to the Interface Extension settings and enable "Allow record editing" 
                    for the Timesheet table.
                </div>
            )}
            
            <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse table-auto">
                        <thead className="bg-gray-gray100 dark:bg-gray-gray600">
                            <tr>
                                {fields.map(({key, label, field}) => (
                                    field && (
                                        <th
                                            key={key}
                                            className="px-4 py-3 text-left text-xs font-semibold text-gray-gray700 dark:text-gray-gray300 uppercase tracking-wider border-b border-gray-gray200 dark:border-gray-gray500 min-w-[180px]"
                                        >
                                            {label}
                                        </th>
                                    )
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-gray200 dark:divide-gray-gray600">
                            {records.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={fields.filter(f => f.field).length}
                                        className="px-4 py-8 text-center text-sm text-gray-gray500 dark:text-gray-gray400"
                                    >
                                        No records found
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr
                                        key={record.id}
                                        className="hover:bg-gray-gray50 dark:hover:bg-gray-gray600 transition-colors"
                                    >
                                        {fields.map(({key, field}) => (
                                            field && (
                                                <EditableCell
                                                    key={key}
                                                    record={record}
                                                    field={field}
                                                    onUpdate={handleRecordUpdate}
                                                    monthRecords={monthRecords}
                                                    monthStatusField={monthStatusField}
                                                    monthStartDateField={monthStartDateField}
                                                    monthEndDateField={monthEndDateField}
                                                />
                                            )
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

initializeBlock({interface: () => <TimesheetApp />});
