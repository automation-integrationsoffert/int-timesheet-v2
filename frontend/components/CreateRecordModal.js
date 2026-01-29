import {useState, useEffect, useCallback, useRef} from 'react';
import {createPortal} from 'react-dom';
import {FieldType} from '@airtable/blocks/interface/models';
import {CalendarPicker} from './CalendarPicker';
import {getAvailableDates} from '../utils/dateUtils';

/**
 * Modal component for creating new records
 */
export function CreateRecordModal({
    isOpen,
    onClose,
    timesheetTable,
    fields,
    onRecordCreated,
    session,
    usersTable,
    usersRecords,
    monthRecords,
    monthStatusField,
    monthStartDateField,
    monthEndDateField,
    taskRecords = [] // Pre-fetched Task records from parent component
}) {
    const [formValues, setFormValues] = useState({});
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarField, setCalendarField] = useState(null);
    const [linkedRecords, setLinkedRecords] = useState({});
    const [searchTerms, setSearchTerms] = useState({});
    const [showDropdowns, setShowDropdowns] = useState({});
    const [isFetchingTaskRecords, setIsFetchingTaskRecords] = useState(false);
    const hasTriggeredTaskFetch = useRef(false);

    // Helper function to find user name from Users Table based on email
    const findUserNameByEmail = useCallback((email) => {
        if (!usersTable || !email || !usersRecords) return null;
        
        const emailField = usersTable.fields.find(f => f.name === 'Email');
        const nameField = usersTable.fields.find(f => f.name === 'Name');
        
        if (!emailField || !nameField) return null;
        
        const userRecord = usersRecords.find(record => {
            const recordEmail = record.getCellValue(emailField);
            return recordEmail && String(recordEmail).toLowerCase() === String(email).toLowerCase();
        });
        
        if (userRecord) {
            return userRecord.getCellValue(nameField);
        }
        
        return null;
    }, [usersTable, usersRecords]);

    const handleLinkedRecordSearch = useCallback(async (fieldKey, field, term) => {
        // For Task field, use pre-fetched records from parent component (no temporary record needed)
        if (fieldKey === 'task' && taskRecords.length > 0 && !term) {
            console.log('[Modal] Using pre-fetched Task records:', taskRecords.length);
            setLinkedRecords(prev => ({
                ...prev,
                [fieldKey]: taskRecords
            }));
            return;
        }
        
        // Check if records are already loaded for this field (unless searching)
        const existingRecords = linkedRecords[fieldKey];
        if (existingRecords && existingRecords.length > 0 && !term) {
            console.log('Records already loaded, skipping fetch');
            return; // Already have records and not searching
        }
        
        // Prevent multiple simultaneous fetches for the same field
        if (fieldKey === 'task' && isFetchingTaskRecords) {
            console.log('Task fetch already in progress, skipping');
            return;
        }
        
        if (fieldKey === 'task') {
            setIsFetchingTaskRecords(true);
        }
        
        setSearchTerms(prev => ({...prev, [fieldKey]: term}));
        
        let tempRecordId = null;
        
        try {
            console.log('Fetching linked records...', { fieldKey, term });
            // For linked records, we need to create a temporary record to use fetchForeignRecordsAsync
            // This is because fetchForeignRecordsAsync is a method on Record, not Table
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
            tempRecordId = await timesheetTable.createRecordAsync({});
            console.log('Created temporary record:', tempRecordId);
            const tempRecord = timesheetTable.getRecordByIdIfExists(tempRecordId);
            
            if (tempRecord) {
                // Use empty string for term to get all available records (same as table)
                // fetchForeignRecordsAsync fetches records from "Tasks for Timesheet" table
                // and returns them with displayName set to the primary field (Name) from that table
                const result = await tempRecord.fetchForeignRecordsAsync(field, term || '');
                console.log('Fetched linked records:', result.records.length, result.records);
                
                // Store records the same way as table - preserve full record structure
                // displayName contains the Name field value from the linked table
                setLinkedRecords(prev => {
                    const newRecords = result.records.map(r => ({
                        id: r.id,
                        displayName: r.displayName || r.name || r.id,
                        ...r // Preserve all properties from the record
                    }));
                    console.log('Setting linked records for', fieldKey, ':', newRecords.length, 'records with names:', newRecords.map(r => r.displayName));
                    return {
                        ...prev,
                        [fieldKey]: newRecords
                    };
                });
            }
        } catch (error) {
            console.error('Error fetching linked records:', error);
            // If rate limited, don't throw - just log
            if (error.message && error.message.includes('15 mutations')) {
                console.warn('Rate limit hit, skipping fetch');
            }
        } finally {
            // Always clean up: delete the temporary record
            if (tempRecordId) {
                try {
                    // Add delay before deletion to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 150));
                    await timesheetTable.deleteRecordAsync(tempRecordId);
                    console.log('Deleted temporary record:', tempRecordId);
                } catch (deleteError) {
                    console.error('Failed to delete temporary record:', deleteError);
                    // Try again after a longer delay
                    setTimeout(async () => {
                        try {
                            await timesheetTable.deleteRecordAsync(tempRecordId);
                            console.log('Deleted temporary record on retry:', tempRecordId);
                        } catch (retryError) {
                            console.error('Failed to delete temporary record on retry:', retryError);
                        }
                    }, 500);
                }
            }
            
            if (fieldKey === 'task') {
                setIsFetchingTaskRecords(false);
            }
        }
    }, [timesheetTable, linkedRecords, isFetchingTaskRecords, taskRecords]);

    // Auto-populate Name and Created By 2 fields when modal opens
    useEffect(() => {
        if (!isOpen) return;
        
        // Auto-populate Name and Created By 2 fields with logged-in user's name
        // Priority: 1. Get email from session.currentUser.email
        //           2. Find Name in Users Table using that email
        //           3. Set that Name in Name field and Created By 2 field
        let userName = null;
        
        // Get email from logged-in user
        if (session?.currentUser?.email) {
            const userEmail = session.currentUser.email;
            console.log('[Modal] Logged-in user email:', userEmail);
            
            // Find Name in Users Table using the email
            userName = findUserNameByEmail(userEmail);
            if (userName) {
                console.log('[Modal] Found Name in Users Table:', userName);
            } else {
                console.warn('[Modal] Name not found in Users Table for email:', userEmail);
                // Fallback to session name if Users Table lookup fails
                if (session.currentUser.name) {
                    userName = session.currentUser.name;
                    console.log('[Modal] Using fallback session.currentUser.name:', userName);
                }
            }
        } else if (session?.currentUser?.name) {
            // If no email available, use session name as last resort
            userName = session.currentUser.name;
            console.log('[Modal] No email available, using session.currentUser.name:', userName);
        }
        
        if (userName) {
            // Set Name field - use the name from Users Table
            const nameField = fields.find(f => f.key === 'name')?.field;
            if (nameField && nameField.config.type === FieldType.SINGLE_SELECT) {
                const nameOptions = nameField.config?.options?.choices || [];
                // Try exact match first
                let matchingNameOption = nameOptions.find(opt => opt.name === userName);
                // If no exact match, try case-insensitive match
                if (!matchingNameOption) {
                    matchingNameOption = nameOptions.find(opt => 
                        opt.name && opt.name.toLowerCase() === userName.toLowerCase()
                    );
                }
                if (matchingNameOption) {
                    setFormValues(prev => ({
                        ...prev,
                        name: {id: matchingNameOption.id}
                    }));
                    console.log('[Modal] Set Name field to:', matchingNameOption.name);
                } else {
                    console.warn('[Modal] Name field option not found for:', userName, 'Available options:', nameOptions.map(opt => opt.name));
                }
            }
            
            // Set Created By 2 field - use the same name from Users Table
            const createdBy2Field = fields.find(f => f.key === 'createdBy2')?.field;
            if (createdBy2Field) {
                const createdBy2FieldType = createdBy2Field.config.type;
                if (createdBy2FieldType === FieldType.SINGLE_SELECT) {
                    const createdBy2Options = createdBy2Field.config?.options?.choices || [];
                    // Try exact match first
                    let matchingCreatedBy2Option = createdBy2Options.find(opt => opt.name === userName);
                    // If no exact match, try case-insensitive match
                    if (!matchingCreatedBy2Option) {
                        matchingCreatedBy2Option = createdBy2Options.find(opt => 
                            opt.name && opt.name.toLowerCase() === userName.toLowerCase()
                        );
                    }
                    if (matchingCreatedBy2Option) {
                        setFormValues(prev => ({
                            ...prev,
                            createdBy2: {id: matchingCreatedBy2Option.id}
                        }));
                        console.log('[Modal] Set Created By 2 field to:', matchingCreatedBy2Option.name);
                    } else {
                        console.warn('[Modal] Created By 2 field option not found for:', userName);
                    }
                } else if (createdBy2FieldType === FieldType.SINGLE_LINE_TEXT || createdBy2FieldType === FieldType.MULTILINE_TEXT) {
                    // If it's a text field, set the name directly
                    setFormValues(prev => ({
                        ...prev,
                        createdBy2: userName
                    }));
                    console.log('[Modal] Set Created By 2 field (text) to:', userName);
                }
            }
        } else {
            console.warn('[Modal] Could not determine user name. Session:', session?.currentUser);
        }
        
        // Don't fetch Task records automatically when modal opens
        // Wait until user interacts with the Task field to avoid creating temporary records unnecessarily
        // Task records will be fetched when the user clicks on the Task dropdown
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]); // Only depend on isOpen to run once when modal opens

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setFormValues({});
            setShowCalendar(false);
            setCalendarField(null);
            setLinkedRecords({});
            setSearchTerms({});
            setShowDropdowns({});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFieldChange = (fieldKey, value) => {
        setFormValues(prev => ({
            ...prev,
            [fieldKey]: value
        }));
    };

    const handleDateSelect = (date, fieldKey) => {
        handleFieldChange(fieldKey, date);
        setShowCalendar(false);
        setCalendarField(null);
    };

    const handleCreate = async () => {
        if (!timesheetTable) {
            alert('Timesheet table is not configured.');
            return;
        }

        try {
            const fieldsToSet = {};
            
            // Convert form values to Airtable field format
            fields.forEach(({key, field}) => {
                if (!field) return;
                
                const value = formValues[key];
                if (value === undefined || value === null || value === '') return;
                
                const fieldType = field.config.type;
                const fieldName = field.name || '';
                const isEmailFromNameField = fieldName === 'Email (from Name)';
                
                // Skip Email (from Name) field - it's a computed/lookup field and cannot be set directly
                if (isEmailFromNameField) return;
                
                if (fieldType === FieldType.SINGLE_SELECT || fieldType === FieldType.MULTIPLE_SELECTS) {
                    // For select fields, value should be {id: optionId} or array of {id: optionId}
                    if (fieldType === FieldType.SINGLE_SELECT && value.id) {
                        fieldsToSet[field.id] = {id: value.id};
                    } else if (fieldType === FieldType.MULTIPLE_SELECTS && Array.isArray(value)) {
                        fieldsToSet[field.id] = value.map(v => ({id: v.id}));
                    }
                } else if (fieldType === FieldType.MULTIPLE_RECORD_LINKS) {
                    // For linked records (Task field), value should be array of objects with {id: recordId}
                    // Same format as table: [{id: recordId}]
                    if (Array.isArray(value)) {
                        fieldsToSet[field.id] = value.map(v => typeof v === 'string' ? {id: v} : {id: v.id});
                    } else if (value && value.id) {
                        // Task field stores a single record object, convert to array format
                        fieldsToSet[field.id] = [{id: value.id}];
                        console.log('Setting Task field:', {
                            fieldId: field.id,
                            fieldName: field.name,
                            taskId: value.id,
                            taskName: value.displayName || value.name
                        });
                    }
                } else if (fieldType === FieldType.DATE || fieldType === FieldType.DATE_TIME) {
                    // For date fields, value should be a Date object or ISO string
                    if (value instanceof Date) {
                        fieldsToSet[field.id] = value.toISOString().split('T')[0];
                    } else if (typeof value === 'string') {
                        fieldsToSet[field.id] = value;
                    }
                } else if (fieldType === FieldType.NUMBER || fieldType === FieldType.CURRENCY || fieldType === FieldType.PERCENT) {
                    // For number fields, convert to number
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        fieldsToSet[field.id] = numValue;
                    }
                } else if (fieldType === FieldType.CHECKBOX) {
                    // For checkbox, value should be boolean
                    fieldsToSet[field.id] = Boolean(value);
                } else {
                    // For text fields, use string value
                    fieldsToSet[field.id] = String(value);
                }
            });
            
            // Always set Name field programmatically from logged-in user's email
            // This ensures the Name field is always set, even if not in form values
            const nameField = fields.find(f => f.key === 'name' || f.field?.name === 'Name')?.field;
            if (nameField && nameField.config.type === FieldType.SINGLE_SELECT) {
                // Get logged-in user's email
                const userEmail = session?.currentUser?.email;
                if (userEmail) {
                    // Get Name from Users Table based on email
                    const userName = findUserNameByEmail(userEmail);
                    if (userName) {
                        // Find matching option in Name field
                        const nameOptions = nameField.config?.options?.choices || [];
                        const matchingNameOption = nameOptions.find(opt => 
                            opt.name && opt.name.toLowerCase() === userName.toLowerCase()
                        );
                        if (matchingNameOption) {
                            // Set Name field programmatically
                            fieldsToSet[nameField.id] = {id: matchingNameOption.id};
                            console.log('[Modal] Name field set programmatically:', matchingNameOption.name);
                        } else {
                            console.warn('[Modal] Name field option not found for:', userName);
                        }
                    } else {
                        console.warn('[Modal] User name not found in Users Table for email:', userEmail);
                    }
                } else {
                    console.warn('[Modal] No logged-in user email available');
                }
            }
            
            await timesheetTable.createRecordAsync(fieldsToSet);
            onRecordCreated();
            onClose();
        } catch (error) {
            console.error('Error creating record:', error);
            alert('Failed to create record: ' + (error.message || 'Unknown error occurred.'));
        }
    };

    const renderFieldInput = ({key, label, field}) => {
        if (!field) return null;
        
        const fieldName = field.name || '';
        const fieldType = field.config.type;
        const value = formValues[key];
        const isNameField = fieldName === 'Name';
        const isCreatedBy2Field = fieldName === 'Created By 2';
        const isEmailFromNameField = fieldName === 'Email (from Name)';
        const isProjectImportField = fieldName === 'Project Import';
        const isDateFieldEditable = fieldName === 'Date';
        const isIndividualHoursField = fieldName === 'Individual Hours';
        const isProjectFromTaskEditable = fieldName === 'Project from Task';
        const isWarningField = fieldName === 'Warning';
        const isTimesheetNotesField = fieldName === 'Timesheet Notes';
        const isTimeTaskTypeField = fieldName === 'Time Task Type';
        const isDeleteField = fieldName === 'Delete';
        const isTaskField = fieldName === 'Task';
        
        // Don't show Delete and Project Import fields in modal
        if (isDeleteField || isProjectImportField) return null;
        
        // Only show editable fields
        const isEditable = isDateFieldEditable || isIndividualHoursField || 
                          isProjectFromTaskEditable || isWarningField || isTimesheetNotesField || 
                          isTimeTaskTypeField || isTaskField || isNameField || isCreatedBy2Field || isEmailFromNameField;
        
        if (!isEditable) return null;
        
        // Name field - editable select that becomes read-only after value is set
        if (isNameField && fieldType === FieldType.SINGLE_SELECT) {
            const options = field.config?.options?.choices || [];
            const selectedOption = value?.id ? options.find(opt => opt.id === value.id) : null;
            const hasValue = selectedOption !== null;
            
            return (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                        {label}
                    </label>
                    <select
                        value={selectedOption?.id || ''}
                        onChange={(e) => {
                            const optionId = e.target.value;
                            const option = options.find(opt => opt.id === optionId);
                            handleFieldChange(key, option ? {id: option.id} : null);
                        }}
                        disabled={hasValue} // Disable after value is set (read-only)
                        className={`w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md ${
                            hasValue 
                                ? 'bg-gray-gray100 dark:bg-gray-gray700 text-gray-gray500 dark:text-gray-gray400 cursor-not-allowed' 
                                : 'bg-white dark:bg-gray-gray800 text-gray-gray900 dark:text-gray-gray100'
                        }`}
                    >
                        <option value="">Select {label}</option>
                        {options.map(option => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }
        
        // Email (from Name) field - select dropdown with emails from Users Table
        if (isEmailFromNameField) {
            // Get all emails from Users Table
            const emailOptions = [];
            if (usersTable && usersRecords) {
                const emailField = usersTable.fields.find(f => f.name === 'Email');
                const nameField = usersTable.fields.find(f => f.name === 'Name');
                if (emailField && nameField) {
                    usersRecords.forEach(record => {
                        const email = record.getCellValue(emailField);
                        const name = record.getCellValue(nameField);
                        if (email) {
                            emailOptions.push({
                                email: String(email),
                                name: name ? String(name) : String(email),
                                id: record.id
                            });
                        }
                    });
                }
            }
            
            return (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                        {label}
                    </label>
                    <select
                        value={value || ''}
                        onChange={(e) => {
                            const selectedEmail = e.target.value;
                            handleFieldChange(key, selectedEmail);
                            
                            // Optionally update Name field when email is selected
                            if (selectedEmail && usersTable && usersRecords) {
                                const emailField = usersTable.fields.find(f => f.name === 'Email');
                                const nameField = usersTable.fields.find(f => f.name === 'Name');
                                if (emailField && nameField) {
                                    const userRecord = usersRecords.find(record => {
                                        const recordEmail = record.getCellValue(emailField);
                                        return recordEmail && String(recordEmail).toLowerCase() === selectedEmail.toLowerCase();
                                    });
                                    if (userRecord) {
                                        const userName = userRecord.getCellValue(nameField);
                                        // Update Name field if it matches
                                        const nameFieldConfig = fields.find(f => f.key === 'name')?.field;
                                        if (nameFieldConfig && nameFieldConfig.config.type === FieldType.SINGLE_SELECT) {
                                            const nameOptions = nameFieldConfig.config?.options?.choices || [];
                                            const matchingNameOption = nameOptions.find(opt => 
                                                opt.name && opt.name.toLowerCase() === String(userName).toLowerCase()
                                            );
                                            if (matchingNameOption) {
                                                setFormValues(prev => ({
                                                    ...prev,
                                                    name: {id: matchingNameOption.id}
                                                }));
                                            }
                                        }
                                    }
                                }
                            }
                        }}
                        className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray900 dark:text-gray-gray100"
                    >
                        <option value="">Select Email</option>
                        {emailOptions.map((option, index) => (
                            <option key={option.id || index} value={option.email}>
                                {option.email} {option.name !== option.email ? `(${option.name})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }
        
        // Created By 2 field is read-only (auto-populated)
        if (isCreatedBy2Field) {
            if (fieldType === FieldType.SINGLE_SELECT) {
                const options = field.config?.options?.choices || [];
                const selectedOption = value?.id ? options.find(opt => opt.id === value.id) : null;
                
                return (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                            {label}
                        </label>
                        <input
                            type="text"
                            value={selectedOption?.name || value || ''}
                            readOnly
                            disabled
                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-gray-gray100 dark:bg-gray-gray700 text-gray-gray500 dark:text-gray-gray400 cursor-not-allowed"
                        />
                    </div>
                );
            } else if (fieldType === FieldType.SINGLE_LINE_TEXT || fieldType === FieldType.MULTILINE_TEXT) {
                return (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                            {label}
                        </label>
                        <input
                            type="text"
                            value={value || ''}
                            readOnly
                            disabled
                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-gray-gray100 dark:bg-gray-gray700 text-gray-gray500 dark:text-gray-gray400 cursor-not-allowed"
                        />
                    </div>
                );
            }
        }
        
        // Date field
        if (isDateFieldEditable && (fieldType === FieldType.DATE || fieldType === FieldType.DATE_TIME)) {
            const availableDates = getAvailableDates(monthRecords, monthStatusField, monthStartDateField, monthEndDateField);
            const dateValue = value instanceof Date ? value : (value ? new Date(value) : null);
            
            return (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                        {label}
                    </label>
                    <input
                        type="text"
                        value={dateValue ? dateValue.toLocaleDateString() : ''}
                        readOnly
                        onClick={() => {
                            setCalendarField(key);
                            setShowCalendar(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray900 dark:text-gray-gray100 cursor-pointer"
                        placeholder="Click to select date"
                    />
                    {showCalendar && calendarField === key && createPortal(
                        <CalendarPicker
                            selectedDate={dateValue}
                            onDateSelect={(date) => handleDateSelect(date, key)}
                            availableDates={availableDates}
                            onClose={() => {
                                setShowCalendar(false);
                                setCalendarField(null);
                            }}
                        />,
                        document.body
                    )}
                </div>
            );
        }
        
        // Single select fields (Time Task Type, Delete) - Note: Task is MULTIPLE_RECORD_LINKS, not SINGLE_SELECT
        if (fieldType === FieldType.SINGLE_SELECT && (isTimeTaskTypeField || isDeleteField)) {
            const options = field.config?.options?.choices || [];
            const selectedOption = value?.id ? options.find(opt => opt.id === value.id) : null;
            
            return (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                        {label}
                    </label>
                    <select
                        value={selectedOption?.id || ''}
                        onChange={(e) => {
                            const optionId = e.target.value;
                            const option = options.find(opt => opt.id === optionId);
                            handleFieldChange(key, option ? {id: option.id} : null);
                        }}
                        className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray900 dark:text-gray-gray100"
                    >
                        <option value="">Select {label}</option>
                        {options.map(option => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }
        
        // Linked record field (Task) - simple select dropdown (same as table)
        // Fetches records from "Tasks for Timesheet" table and displays Names
        if (fieldType === FieldType.MULTIPLE_RECORD_LINKS && isTaskField) {
            const records = linkedRecords[key] || [];
            const selectedRecord = value;
            const selectedId = selectedRecord?.id || '';
            
            // Debug logging
            console.log('[Modal] Task field render:', {
                key,
                recordsCount: records.length,
                selectedId,
                selectedRecord,
                isFetchingTaskRecords,
                linkedRecords: linkedRecords[key],
                recordsSample: records.slice(0, 3).map(r => ({id: r.id, name: r.displayName})) // Show first 3 records for debugging
            });
            
            return (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                        {label}
                    </label>
                    <select
                        value={selectedId}
                        onFocus={() => {
                            // Fetch Task records when user clicks on the dropdown (lazy loading)
                            // This prevents creating a temporary record when modal opens
                            if (records.length === 0 && !isFetchingTaskRecords) {
                                const taskField = fields.find(f => f.key === 'task')?.field;
                                if (taskField) {
                                    console.log('[Modal] Fetching Task records on focus (lazy loading)...');
                                    handleLinkedRecordSearch('task', taskField, '').catch(error => {
                                        console.error('[Modal] Error fetching Task records:', error);
                                    });
                                }
                            }
                        }}
                        onChange={(e) => {
                            const recordId = e.target.value;
                            console.log('[Modal] Task select onChange:', { recordId, recordsCount: records.length });
                            if (recordId) {
                                const record = records.find(r => r.id === recordId);
                                console.log('[Modal] Found Task record:', {
                                    id: record?.id,
                                    name: record?.displayName || record?.name
                                });
                                if (record) {
                                    // Store the full record object (same as table)
                                    // This will be formatted as [{id: record.id}] when creating the record
                                    handleFieldChange(key, record);
                                    console.log('[Modal] Task selected and stored:', record.displayName || record.name);
                                } else {
                                    console.error('[Modal] Task record not found for ID:', recordId);
                                }
                            } else {
                                // Clear selection
                                handleFieldChange(key, null);
                                console.log('[Modal] Task selection cleared');
                            }
                        }}
                        disabled={isFetchingTaskRecords && records.length === 0}
                        className={`w-full px-2 py-1 border rounded text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800 ${isFetchingTaskRecords && records.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <option value="">Select Task</option>
                        {records.length === 0 ? (
                            <option value="" disabled>{isFetchingTaskRecords ? 'Loading tasks...' : 'No tasks available'}</option>
                        ) : (
                            records.map(record => (
                                <option key={record.id} value={record.id}>
                                    {record.displayName || record.name || record.id}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            );
        }
        
        // Text input fields (Project Import, Warning, Timesheet Notes)
        if ((fieldType === FieldType.SINGLE_LINE_TEXT || fieldType === FieldType.MULTILINE_TEXT) && 
            (isProjectImportField || isWarningField || isTimesheetNotesField)) {
            return (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                        {label}
                    </label>
                    {fieldType === FieldType.MULTILINE_TEXT ? (
                        <textarea
                            value={value || ''}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray900 dark:text-gray-gray100"
                            rows={3}
                        />
                    ) : (
                        <input
                            type="text"
                            value={value || ''}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray900 dark:text-gray-gray100"
                        />
                    )}
                </div>
            );
        }
        
        // Number field (Individual Hours)
        if (fieldType === FieldType.NUMBER && isIndividualHoursField) {
            return (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                        {label}
                    </label>
                    <input
                        type="number"
                        value={value || ''}
                        onChange={(e) => handleFieldChange(key, e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray900 dark:text-gray-gray100"
                        step="0.01"
                    />
                </div>
            );
        }
        
        // Linked record field (Project from Task)
        if (fieldType === FieldType.MULTIPLE_RECORD_LINKS && isProjectFromTaskEditable) {
            const records = linkedRecords[key] || [];
            const searchTerm = searchTerms[key] || '';
            const showDropdown = showDropdowns[key] || false;
            const selectedRecord = value;
            
            return (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-gray900 dark:text-gray-gray100 mb-1">
                        {label}
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={showDropdown ? searchTerm : (selectedRecord?.displayName || '')}
                            onChange={(e) => {
                                const term = e.target.value;
                                setSearchTerms(prev => ({...prev, [key]: term}));
                                setShowDropdowns(prev => ({...prev, [key]: true}));
                                handleLinkedRecordSearch(key, field, term);
                            }}
                            onFocus={() => {
                                setShowDropdowns(prev => ({...prev, [key]: true}));
                                if (records.length === 0) {
                                    handleLinkedRecordSearch(key, field, '');
                                }
                            }}
                            onBlur={() => {
                                setTimeout(() => {
                                    setShowDropdowns(prev => ({...prev, [key]: false}));
                                }, 200);
                            }}
                            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray900 dark:text-gray-gray100"
                            placeholder="Search and select..."
                        />
                        {showDropdown && records.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-gray800 border border-gray-gray300 dark:border-gray-gray600 rounded-md shadow-lg max-h-60 overflow-auto">
                                {records.map(record => (
                                    <div
                                        key={record.id}
                                        onClick={() => {
                                            handleFieldChange(key, record);
                                            setShowDropdowns(prev => ({...prev, [key]: false}));
                                        }}
                                        className="px-3 py-2 hover:bg-gray-gray50 dark:hover:bg-gray-gray700 cursor-pointer"
                                    >
                                        {record.displayName}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        
        return null;
    };

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-gray800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-gray900 dark:text-gray-gray100">
                            Create New Record
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-gray500 dark:text-gray-gray400 hover:text-gray-gray900 dark:hover:text-gray-gray100"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {fields.map(fieldConfig => renderFieldInput(fieldConfig))}
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-gray700 dark:text-gray-gray300 bg-gray-gray200 dark:bg-gray-gray600 rounded-md hover:bg-gray-gray300 dark:hover:bg-gray-gray500"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-blue rounded-md hover:bg-blue-blue600"
                        >
                            Create
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

