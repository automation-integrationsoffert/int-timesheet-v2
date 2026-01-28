import {useState, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {FieldType} from '@airtable/blocks/interface/models';
import {CalendarPicker} from './CalendarPicker';
import {formatDisplayValue} from '../utils/valueFormatter';
import {getAvailableDates} from '../utils/dateUtils';
import {isRecordClosed} from '../utils/recordUtils';

/**
 * Editable cell component for inline editing of Airtable record fields
 * @param {Object} props
 * @param {Record} props.record - The Airtable record
 * @param {Field} props.field - The field to display/edit
 * @param {Function} props.onUpdate - Callback when record is updated
 * @param {Array} props.monthRecords - Array of month records for availability checking
 * @param {Field} props.monthStatusField - Status field from Month table
 * @param {Field} props.monthStartDateField - Start date field from Month table
 * @param {Field} props.monthEndDateField - End date field from Month table
 * @param {Object} props.session - Current session (for getting user email)
 * @param {Table} props.usersTable - Users table for looking up names
 * @param {Array} props.usersRecords - Users table records
 */
export function EditableCell({record, field, onUpdate, monthRecords, monthStatusField, monthStartDateField, monthEndDateField, session, usersTable, usersRecords}) {
    // Check if field exists - if not, don't render anything
    if (!field || !record) {
        return (
            <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px]">
                <span className="text-gray-gray400 dark:text-gray-gray500">Field not found</span>
            </td>
        );
    }
    
    // Verify field still exists in the table
    const fieldStillExists = record.parentTable?.getFieldIfExists(field.id);
    if (!fieldStillExists) {
        return (
            <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px]">
                <span className="text-gray-gray400 dark:text-gray-gray500">Field deleted</span>
            </td>
        );
    }
    
    const fieldName = field?.name || '';
    const fieldType = field?.config?.type;
    
    // Helper function to get current field by name (handles stale field IDs)
    const getCurrentField = () => {
        if (!field || !record) return null;
        // Try to get field by ID first, then by name
        return record.parentTable?.getFieldIfExists(field.id) || 
               record.parentTable?.fields.find(f => f.name === fieldName) ||
               field;
    };
    
    const isClosed = isRecordClosed(record, monthRecords, monthStatusField, monthStartDateField, monthEndDateField);
    
    // Fields that should be editable input fields
    const isProjectImportField = fieldName === 'Project Import';
    const isNameField = fieldName === 'Name';
    const isDateFieldEditable = fieldName === 'Date';
    const isIndividualHoursField = fieldName === 'Individual Hours';
    const isProjectFromTaskEditable = fieldName === 'Project from Task';
    const isWarningField = fieldName === 'Warning';
    const isTimesheetNotesField = fieldName === 'Timesheet Notes';
    const isTimeTaskTypeField = fieldName === 'Time Task Type';
    const isDeleteField = fieldName === 'Delete';
    
    // These fields should always be editable (unless read-only for other reasons)
    // Note: Name field is NOT editable - it's auto-populated but read-only
    const isTaskField = fieldName === 'Task';
    const shouldBeEditable = isProjectImportField || isDateFieldEditable || isIndividualHoursField || isProjectFromTaskEditable || isWarningField || isTimesheetNotesField || isTimeTaskTypeField || isDeleteField || isTaskField;
    
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
    const [savedSelectedIds, setSavedSelectedIds] = useState([]);
    const [selectedRecordDisplayName, setSelectedRecordDisplayName] = useState('');
    const [selectedMultipleSelectIds, setSelectedMultipleSelectIds] = useState([]);
    const [justSavedTaskId, setJustSavedTaskId] = useState(null); // Track if we just saved a Task selection
    const lastProcessedCellValueRef = useRef(null); // Track last processed cellValue to prevent infinite loops

    const isEmailField = fieldName === 'Email (from Name)';
    const isProjectFromTaskField = fieldName === 'Project from Task' || fieldName === 'Project from Task - Ext';
    
    // For lookup fields (Email from Name, Project from Task), use getCellValueAsString to get value directly
    // For text fields (SINGLE_LINE_TEXT, MULTILINE_TEXT), also use getCellValueAsString for better compatibility
    const cellValue = field ? (
        (isEmailField || isProjectFromTaskField) && isLookup 
            ? (record.getCellValueAsString(field) || '')
            : (fieldType === FieldType.SINGLE_LINE_TEXT || fieldType === FieldType.MULTILINE_TEXT)
            ? (record.getCellValueAsString(field) || '')
            : (record.getCellValue(field) ?? '')
    ) : '';
    
    // Calculate available dates from Month table
    const availableDates = getAvailableDates(monthRecords, monthStatusField, monthStartDateField, monthEndDateField);
    
    // Helper function to find user name from Users Table based on email
    const findUserNameByEmail = (email) => {
        if (!usersTable || !email || !usersRecords) return null;
        
        // Find Email and Name fields in Users Table
        const emailField = usersTable.fields.find(f => f.name === 'Email');
        const nameField = usersTable.fields.find(f => f.name === 'Name');
        
        if (!emailField || !nameField) return null;
        
        // Find the user record with matching email
        const userRecord = usersRecords.find(record => {
            const recordEmail = record.getCellValue(emailField);
            return recordEmail && String(recordEmail).toLowerCase() === String(email).toLowerCase();
        });
        
        if (userRecord) {
            return userRecord.getCellValue(nameField);
        }
        
        return null;
    };

    // Auto-populate Name field if empty (even though it's not editable)
    useEffect(() => {
        // Special handling for Name field: auto-populate if empty (even if not editable)
        if (isNameField && fieldType === FieldType.SINGLE_SELECT && !isFormula && !isLookup && !isClosed) {
            const currentValue = cellValue;
            const currentOptionId = currentValue?.id || null;
            
            if (!currentOptionId && session?.currentUser?.email && usersTable && usersRecords) {
                console.log('Auto-populating Name field for record:', record.id);
                const userName = findUserNameByEmail(session.currentUser.email);
                console.log('Found user name:', userName);
                
                if (userName) {
                    // Find the option that matches the user name
                    const options = field?.config?.options?.choices || [];
                    console.log('Name field options:', options.map(opt => opt.name));
                    const matchingOption = options.find(opt => opt.name === userName);
                    console.log('Matching option:', matchingOption);
                    
                    if (matchingOption) {
                        // Auto-save the Name field
                        const currentField = getCurrentField();
                        if (currentField && canEdit) {
                            console.log('Setting Name field to:', matchingOption.name);
                            record.parentTable.updateRecordAsync(record, {
                                [currentField.id]: {id: matchingOption.id}
                            }).then(() => {
                                console.log('Name field set successfully');
                                if (onUpdate) onUpdate();
                            }).catch(error => {
                                console.error('Error auto-setting Name field:', error);
                            });
                        } else {
                            console.warn('Cannot set Name field:', {
                                hasCurrentField: !!currentField,
                                canEdit: canEdit
                            });
                        }
                    } else {
                        console.warn('No matching option found for user name:', userName);
                    }
                } else {
                    console.warn('User name not found for email:', session.currentUser.email);
                }
            }
        }
    }, [isNameField, fieldType, cellValue, session, usersTable, usersRecords, field, record, isFormula, isLookup, isClosed, canEdit, onUpdate, fieldName, getCurrentField, findUserNameByEmail]);
    
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
            } else if (fieldType === FieldType.MULTIPLE_SELECTS) {
                // For multiple selects, track selected option IDs
                const currentValue = cellValue;
                const currentIds = Array.isArray(currentValue) 
                    ? currentValue.map(item => item?.id || item)
                    : [];
                // Sync selected IDs when cellValue changes
                const currentIdsStr = JSON.stringify(currentIds.sort());
                const savedIdsStr = JSON.stringify(selectedMultipleSelectIds.sort());
                if (currentIdsStr !== savedIdsStr) {
                    setSelectedMultipleSelectIds(currentIds);
                }
            } else {
                // For text fields (SINGLE_LINE_TEXT, MULTILINE_TEXT), sync when cellValue changes
                // This ensures the input reflects the current value from Airtable
                if (fieldType === FieldType.SINGLE_LINE_TEXT || fieldType === FieldType.MULTILINE_TEXT) {
                    const formattedValue = formatDisplayValue(cellValue, fieldType, fieldName);
                    // Always sync for text fields to keep them in sync with Airtable
                    if (editValue !== formattedValue) {
                        setEditValue(formattedValue);
                    }
                } else {
                    // For other fields, only update if editValue is empty (initial load) to avoid overwriting user input
                    if (editValue === '') {
                        const formattedValue = formatDisplayValue(cellValue, fieldType, fieldName);
                        setEditValue(formattedValue);
                    }
                }
            }
            
            // For linked records (MULTIPLE_RECORD_LINKS fields), fetch initial options and refresh when cellValue changes
            // Task field is handled separately, so exclude it here
            if (fieldType === FieldType.MULTIPLE_RECORD_LINKS && isEditing && !isNameField && !isTaskField) {
                const currentValue = cellValue;
                const currentIds = Array.isArray(currentValue) 
                    ? currentValue.map(item => item?.id || item)
                    : [];
                
                // Update savedSelectedIds when cellValue changes (from Airtable refresh)
                // Only update if the IDs are actually different to avoid unnecessary updates
                const currentIdsStr = JSON.stringify(currentIds.sort());
                const savedIdsStr = JSON.stringify(savedSelectedIds.sort());
                if (currentIdsStr !== savedIdsStr) {
                    setSavedSelectedIds(currentIds);
                    // Update display name from currentValue if available
                    if (currentIds.length > 0 && Array.isArray(currentValue) && currentValue.length > 0) {
                        const firstRecord = currentValue[0];
                        if (firstRecord?.displayName || firstRecord?.name) {
                            setSelectedRecordDisplayName(firstRecord.displayName || firstRecord.name);
                        }
                    } else if (currentIds.length === 0) {
                        setSelectedRecordDisplayName('');
                    }
                }
                
                // Refresh linked records when cellValue changes (after save) or when initially loading
                // Use currentIds for the fetch, but savedSelectedIds will be used for display
                record.fetchForeignRecordsAsync(field, searchTerm || '').then(result => {
                    setLinkedRecords(result.records.map(r => ({
                        ...r,
                        selected: currentIds.includes(r.id)
                    })));
                    // Update display name if we have a selected ID and don't have display name yet
                    if (currentIds.length > 0 && !selectedRecordDisplayName) {
                        const foundRecord = result.records.find(r => r.id === currentIds[0]);
                        if (foundRecord) {
                            setSelectedRecordDisplayName(foundRecord.displayName);
                        }
                    }
                });
            }
            
            // Task field - sync savedSelectedIds with cellValue when it changes
            if (fieldType === FieldType.MULTIPLE_RECORD_LINKS && isTaskField && isEditing) {
                const currentValue = cellValue;
                const currentValueStr = JSON.stringify(currentValue);
                
                // Extract current IDs from cellValue
                const currentIds = Array.isArray(currentValue) && currentValue.length > 0
                    ? [currentValue[0]?.id || currentValue[0]]
                    : [];
                
                // Only process if cellValue actually changed (prevent infinite loops)
                if (lastProcessedCellValueRef.current !== currentValueStr) {
                    // On first load (lastProcessedCellValueRef.current === null), initialize from cellValue
                    if (lastProcessedCellValueRef.current === null) {
                        if (currentIds.length > 0) {
                            // Initialize savedSelectedIds from cellValue on first load only
                            setSavedSelectedIds(currentIds);
                            // Update display name from currentValue if available
                            if (Array.isArray(currentValue) && currentValue.length > 0) {
                                const firstRecord = currentValue[0];
                                if (firstRecord?.displayName || firstRecord?.name) {
                                    setSelectedRecordDisplayName(firstRecord.displayName || firstRecord.name);
                                }
                            }
                        }
                    } else {
                        // After first load, only sync if cellValue actually changed and we didn't just save
                        // Use a ref to access current state values without adding them to dependencies
                        setSavedSelectedIds(prevSavedIds => {
                            const currentIdsStr = JSON.stringify(currentIds.sort());
                            const savedIdsStr = JSON.stringify(prevSavedIds.sort());
                            
                            // Only sync if values are actually different
                            if (currentIdsStr !== savedIdsStr) {
                                // If we just saved this Task ID, don't overwrite it even if cellValue updates
                                if (justSavedTaskId && justSavedTaskId === prevSavedIds[0]) {
                                    // Don't overwrite - keep the saved value
                                    return prevSavedIds;
                                } else if (currentIds.length === 0 && prevSavedIds.length > 0) {
                                    // cellValue is empty but we have a saved value - don't clear (might be temporary during refresh)
                                    return prevSavedIds;
                                } else if (currentIds.length > 0) {
                                    // Sync with cellValue when it has a value (and we didn't just save)
                                    return currentIds;
                                } else if (currentIds.length === 0 && prevSavedIds.length === 0) {
                                    // Both are empty, return empty
                                    return [];
                                }
                            }
                            return prevSavedIds;
                        });
                        
                        // Update display name from currentValue if available
                        if (currentIds.length > 0 && Array.isArray(currentValue) && currentValue.length > 0) {
                            const firstRecord = currentValue[0];
                            if (firstRecord?.displayName || firstRecord?.name) {
                                setSelectedRecordDisplayName(firstRecord.displayName || firstRecord.name);
                            }
                        } else if (currentIds.length === 0) {
                            setSelectedRecordDisplayName('');
                        }
                    }
                    
                    // Mark as processed
                    lastProcessedCellValueRef.current = currentValueStr;
                }
                
                // Fetch linked records from "Tasks for Timesheet" table only if not already loaded
                // fetchForeignRecordsAsync returns records with displayName set to the primary field (Name) from the linked table
                if (linkedRecords.length === 0) {
                    record.fetchForeignRecordsAsync(field, '').then(result => {
                        setLinkedRecords(result.records);
                        // Update display name if we have a selected ID and don't have display name yet
                        setSavedSelectedIds(prevSavedIds => {
                            const idsToCheck = prevSavedIds.length > 0 ? prevSavedIds : currentIds;
                            if (idsToCheck.length > 0) {
                                const foundRecord = result.records.find(r => r.id === idsToCheck[0]);
                                if (foundRecord) {
                                    setSelectedRecordDisplayName(foundRecord.displayName);
                                }
                            }
                            return prevSavedIds;
                        });
                    });
                }
            }
        }
    }, [shouldBeEditable, isFormula, isLookup, cellValue, isEditing, fieldType, fieldName, field, record, searchTerm, selectedMultipleSelectIds, isNameField, session, usersTable, usersRecords, canEdit, editValue, onUpdate]);
    
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
        setEditValue(formatDisplayValue(cellValue, fieldType, fieldName));
        
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
                const savedValue = formatDisplayValue(valueToSave, fieldType, fieldName);
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
        if (isSaving || isClosed || !field) return;
        
        // Check if field still exists before updating
        const fieldStillExists = record.parentTable?.getFieldIfExists(field.id);
        if (!fieldStillExists) {
            console.warn('Field no longer exists:', fieldName);
            return;
        }
        
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
            } else if (fieldType === FieldType.MULTIPLE_SELECTS) {
                // For multiple selects, value should be an array of option objects with id
                const options = field?.config?.options?.choices || [];
                valueToSave = selectedMultipleSelectIds
                    .map(id => options.find(opt => opt.id === id))
                    .filter(opt => opt !== undefined)
                    .map(opt => ({id: opt.id}));
            } else if (fieldType === FieldType.CHECKBOX) {
                valueToSave = editValue === 'true' || editValue === true;
            } else if (fieldType === FieldType.SINGLE_LINE_TEXT || fieldType === FieldType.MULTILINE_TEXT) {
                // For text fields (including Warning), convert empty strings to null
                valueToSave = editValue === '' ? null : editValue;
            }
            
            await record.parentTable.updateRecordAsync(record, {
                [field.id]: valueToSave
            });
            
            // Don't exit editing mode for editable fields - keep them as inputs
            if (!shouldBeEditable || isFormula || isLookup) {
                setIsEditing(false);
            } else {
                // Update editValue to reflect the saved value
                const savedValue = formatDisplayValue(valueToSave, fieldType, fieldName);
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
        // For linked record fields (MULTIPLE_RECORD_LINKS) - but not Name field (which is now SINGLE_SELECT)
        if (fieldType === FieldType.MULTIPLE_RECORD_LINKS && !isNameField) {
            const currentValue = cellValue;
            // Extract current IDs from cellValue (for initial load)
            // cellValue for MULTIPLE_RECORD_LINKS is an array of record objects like [{id: 'rec123', name: 'Task Name'}, ...]
            let currentIdsFromValue = [];
            if (Array.isArray(currentValue) && currentValue.length > 0) {
                // Extract ID from first record
                const firstRecord = currentValue[0];
                if (firstRecord) {
                    // Record object can have id property or be the ID itself
                    const recordId = firstRecord.id || firstRecord;
                    if (recordId) {
                        currentIdsFromValue = [recordId];
                    }
                }
            }
            
            // Use savedSelectedIds if available (after save), otherwise use currentValue from record
            // For single select, take the first selected ID
            // Priority: savedSelectedIds > currentValue > empty
            const selectedIds = savedSelectedIds.length > 0 
                ? savedSelectedIds 
                : currentIdsFromValue;
            const selectedId = selectedIds.length > 0 ? String(selectedIds[0]) : ''; // Ensure it's a string for select value
            
            // Debug: Log the selectedId calculation (commented out to prevent console spam)
            // Uncomment only for debugging if needed
            // if (fieldName === 'Task') {
            //     console.log('[Task selectedId calculation]', {
            //         savedSelectedIds,
            //         currentValue,
            //         currentIdsFromValue,
            //         selectedIds,
            //         selectedId,
            //         justSavedTaskId,
            //         cellValueType: Array.isArray(cellValue) ? 'array' : typeof cellValue,
            //         cellValueLength: Array.isArray(cellValue) ? cellValue.length : 'N/A',
            //         cellValueFirstItem: Array.isArray(cellValue) && cellValue.length > 0 ? cellValue[0] : 'N/A'
            //     });
            // }
            
            // Task field - simple select dropdown (not searchable)
            if (fieldName === 'Task') {
                // Fetch linked records if not already loaded (this is a fallback, main fetch happens in useEffect)
                if (linkedRecords.length === 0) {
                    record.fetchForeignRecordsAsync(field, '').then(result => {
                        setLinkedRecords(result.records);
                        // If we have a selectedId but no displayName yet, find it from the fetched records
                        if (selectedId && !selectedRecordDisplayName) {
                            const foundRecord = result.records.find(r => r.id === selectedId);
                            if (foundRecord) {
                                setSelectedRecordDisplayName(foundRecord.displayName);
                            }
                        }
                    });
                }
                
                const currentField = getCurrentField();
                if (!currentField) return null;
                
                // Ensure the selected record is in the options list
                // If selectedId exists but not in linkedRecords, add it from cellValue
                let recordsToDisplay = [...linkedRecords];
                if (selectedId && !recordsToDisplay.find(r => r.id === selectedId)) {
                    // Selected record is not in linkedRecords, try to get it from cellValue
                    if (Array.isArray(cellValue) && cellValue.length > 0) {
                        const selectedRecordFromValue = cellValue.find(r => (r.id || r) === selectedId) || cellValue[0];
                        if (selectedRecordFromValue) {
                            // Add the selected record to the options
                            recordsToDisplay.push({
                                id: selectedRecordFromValue.id || selectedRecordFromValue,
                                displayName: selectedRecordFromValue.displayName || selectedRecordFromValue.name || selectedRecordDisplayName || 'Selected Task'
                            });
                            // console.log('[Task render] Added selected record to options:', {
                            //     id: selectedRecordFromValue.id || selectedRecordFromValue,
                            //     displayName: selectedRecordFromValue.displayName || selectedRecordFromValue.name
                            // });
                        }
                    }
                }
                
                // Debug: Log the selectedId being used (commented out to reduce console noise)
                // console.log('[Task render] Select tag value:', {
                //     selectedId,
                //     savedSelectedIds,
                //     currentValue: cellValue,
                //     linkedRecordsCount: linkedRecords.length,
                //     recordsToDisplayCount: recordsToDisplay.length,
                //     selectedRecordInOptions: recordsToDisplay.find(r => r.id === selectedId) ? 'YES' : 'NO',
                //     selectedRecordDisplayName,
                //     justSavedTaskId
                // });
                
                return (
                    <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px]">
                        <select
                            value={selectedId || ''}
                            key={`task-select-${record.id}-${selectedId}`} // Force re-render when selectedId changes
                            onChange={async (e) => {
                                const newSelectedId = e.target.value;
                                const currentField = getCurrentField(); // Get fresh field reference
                                if (!currentField) {
                                    console.error('Task field not found');
                                    alert('Task field not found. Please refresh the page.');
                                    return;
                                }
                                
                                if (newSelectedId) {
                                    const selectedRecord = linkedRecords.find(r => r.id === newSelectedId);
                                    if (selectedRecord) {
                                        // Set state immediately to show selection in UI
                                        setSelectedRecordDisplayName(selectedRecord.displayName);
                                        setSavedSelectedIds([newSelectedId]);
                                        setJustSavedTaskId(newSelectedId); // Track that we just saved this ID
                                        
                                        console.log('[Task onChange] Set savedSelectedIds to:', [newSelectedId], 'selectedName:', selectedRecord.displayName);
                                        
                                        try {
                                            setIsSaving(true);
                                            console.log('Updating Task field:', {
                                                recordId: record.id,
                                                fieldId: currentField.id,
                                                fieldName: currentField.name,
                                                selectedId: newSelectedId,
                                                selectedName: selectedRecord.displayName
                                            });
                                            
                                            // Update Task field in Airtable with format [{id: recordId}]
                                            await record.parentTable.updateRecordAsync(record, {
                                                [currentField.id]: [{id: newSelectedId}]
                                            });
                                            
                                            console.log('[Task onChange] Task field updated successfully, savedSelectedIds:', [newSelectedId]);
                                            
                                            // Keep justSavedTaskId flag longer to prevent clearing during Airtable sync
                                            // Only clear it after cellValue has been updated from Airtable
                                            setTimeout(() => {
                                                // Check if cellValue now matches what we saved
                                                const updatedValue = record.getCellValue(field);
                                                const updatedIds = Array.isArray(updatedValue) && updatedValue.length > 0
                                                    ? [updatedValue[0]?.id || updatedValue[0]]
                                                    : [];
                                                if (updatedIds.length > 0 && updatedIds[0] === newSelectedId) {
                                                    console.log('[Task onChange] cellValue synced, clearing justSavedTaskId flag');
                                                    setJustSavedTaskId(null);
                                                } else {
                                                    console.log('[Task onChange] cellValue not synced yet, keeping justSavedTaskId flag');
                                                    // Try again in 2 seconds
                                                    setTimeout(() => {
                                                        setJustSavedTaskId(null);
                                                    }, 2000);
                                                }
                                            }, 2000);
                                            
                                            if (onUpdate) onUpdate();
                                        } catch (error) {
                                            console.error('Error updating Task field:', error);
                                            setJustSavedTaskId(null); // Clear flag on error
                                            // On error, don't clear savedSelectedIds - keep the selection
                                            alert('Failed to update Task field: ' + (error.message || 'Unknown error occurred. Please refresh the page.'));
                                        } finally {
                                            setIsSaving(false);
                                        }
                                    } else {
                                        console.error('Selected Task record not found:', newSelectedId);
                                        alert('Selected task not found. Please try again.');
                                    }
                                } else {
                                    // Clear selection
                                    try {
                                        setIsSaving(true);
                                        setJustSavedTaskId(null); // Clear the saved ID flag
                                        console.log('Clearing Task field:', {
                                            recordId: record.id,
                                            fieldId: currentField.id,
                                            fieldName: currentField.name
                                        });
                                        
                                        await record.parentTable.updateRecordAsync(record, {
                                            [currentField.id]: []
                                        });
                                        
                                        console.log('Task field cleared successfully');
                                        setSelectedRecordDisplayName('');
                                        setSavedSelectedIds([]);
                                        if (onUpdate) onUpdate();
                                    } catch (error) {
                                        console.error('Error clearing Task field:', error);
                                        alert('Failed to clear Task field: ' + (error.message || 'Unknown error occurred. Please refresh the page.'));
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }
                            }}
                            disabled={isClosed || isSaving}
                            className={`w-full px-2 py-1 border rounded text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800 ${isClosed || isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Select Task</option>
                            {recordsToDisplay.map(record => (
                                <option key={record.id} value={record.id}>
                                    {record.displayName || record.name || record.id}
                                </option>
                            ))}
                        </select>
                    </td>
                );
            }
            
            // Other linked record fields keep search functionality
            // Get display value for other linked record fields
            let displayValue = '';
            if (selectedRecordDisplayName) {
                displayValue = selectedRecordDisplayName;
            } else if (selectedId) {
                const selectedRecord = linkedRecords.find(r => r.id === selectedId);
                if (selectedRecord) {
                    displayValue = selectedRecord.displayName;
                    setSelectedRecordDisplayName(selectedRecord.displayName);
                } else if (Array.isArray(currentValue) && currentValue.length > 0) {
                    const currentRecord = currentValue.find(item => (item?.id || item) === selectedId);
                    if (currentRecord) {
                        displayValue = currentRecord.displayName || currentRecord.name || String(currentRecord);
                        setSelectedRecordDisplayName(displayValue);
                    } else {
                        displayValue = 'Loading...';
                        // Fetch the specific record if not found
                        record.fetchForeignRecordsAsync(field, '').then(result => {
                            const foundRecord = result.records.find(r => r.id === selectedId);
                            if (foundRecord) {
                                setSelectedRecordDisplayName(foundRecord.displayName);
                            }
                        });
                    }
                } else {
                    displayValue = 'Loading...';
                }
            }
            
            return (
                <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 relative min-w-[180px]">
                    <div className="relative">
                        <input
                            type="text"
                            value={showLinkedRecordDropdown ? searchTerm : displayValue}
                            disabled={isClosed}
                            readOnly={!showLinkedRecordDropdown}
                            onFocus={() => {
                                if (!isClosed) {
                                    setShowLinkedRecordDropdown(true);
                                    setSearchTerm('');
                                    if (linkedRecords.length === 0) {
                                        record.fetchForeignRecordsAsync(field, '').then(result => {
                                            setLinkedRecords(result.records);
                                        });
                                    }
                                }
                            }}
                            onBlur={(e) => {
                                // Delay to allow click on dropdown items
                                setTimeout(() => {
                                    setShowLinkedRecordDropdown(false);
                                }, 200);
                            }}
                            onChange={(e) => {
                                if (showLinkedRecordDropdown) {
                                    const term = e.target.value;
                                    setSearchTerm(term);
                                    handleLinkedRecordSearch(term);
                                }
                            }}
                            placeholder="Search or select..."
                            className={`w-full px-2 py-1 border rounded text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800 ${isClosed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isClosed && !showLinkedRecordDropdown) {
                                    setShowLinkedRecordDropdown(true);
                                    setSearchTerm('');
                                }
                            }}
                        />
                        {showLinkedRecordDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-gray700 border rounded shadow-lg max-h-48 overflow-y-auto">
                                {linkedRecords.length === 0 ? (
                                    <div className="px-2 py-1 text-sm text-gray-gray500 dark:text-gray-gray400">Loading...</div>
                                ) : (
                                    linkedRecords.map((linkedRecord) => (
                                        <div
                                            key={linkedRecord.id}
                                            className={`px-2 py-1 text-sm cursor-pointer hover:bg-gray-gray100 dark:hover:bg-gray-gray600 ${
                                                linkedRecord.id === selectedId ? 'bg-blue-blue bg-opacity-20' : ''
                                            }`}
                                            onMouseDown={(e) => {
                                                e.preventDefault(); // Prevent blur
                                                e.stopPropagation();
                                                if (isClosed) return;
                                                
                                                const newSelectedId = linkedRecord.id;
                                                const newDisplayName = linkedRecord.displayName;
                                                
                                                // Update savedSelectedIds and display name immediately for display
                                                setSavedSelectedIds([newSelectedId]);
                                                setSelectedRecordDisplayName(newDisplayName);
                                                
                                                // Convert to array of objects with id property (for MULTIPLE_RECORD_LINKS)
                                                const valueToSave = [{id: newSelectedId}];
                                                
                                                // Auto-save immediately
                                                setIsSaving(true);
                                                record.parentTable.updateRecordAsync(record, {
                                                    [field.id]: valueToSave
                                                }).then(() => {
                                                    setShowLinkedRecordDropdown(false);
                                                    setSearchTerm('');
                                                    if (onUpdate) onUpdate();
                                                }).catch(error => {
                                                    console.error('Error updating record:', error);
                                                    // Revert on error
                                                    const currentIds = Array.isArray(currentValue) && currentValue.length > 0
                                                        ? [currentValue[0]?.id || currentValue[0]]
                                                        : [];
                                                    setSavedSelectedIds(currentIds);
                                                    setSelectedRecordDisplayName('');
                                                    
                                                    let errorMessage = 'Failed to update record. ';
                                                    if (error.message && error.message.includes('allow record editing')) {
                                                        errorMessage += 'Please enable record editing permissions for this Interface Extension in the Airtable settings.';
                                                    } else {
                                                        errorMessage += error.message || 'Unknown error occurred.';
                                                    }
                                                    alert(errorMessage);
                                                }).finally(() => {
                                                    setIsSaving(false);
                                                });
                                            }}
                                        >
                                            {linkedRecord.displayName}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </td>
            );
        }
        
        // For single select fields, show dropdown (except Name field which is read-only)
        if (fieldType === FieldType.SINGLE_SELECT && !isNameField) {
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
                            const currentField = getCurrentField();
                            if (!currentField) {
                                alert(`The field "${fieldName}" could not be found. Please refresh the page or reconfigure the field in the properties panel.`);
                                return;
                            }
                            
                            if (selectedOption) {
                                setEditValue(selectedOption.id);
                                // Auto-save on change
                                const valueToSave = {id: selectedOption.id};
                                record.parentTable.updateRecordAsync(record, {
                                    [currentField.id]: valueToSave
                                }).then(() => {
                                    if (onUpdate) onUpdate();
                                }).catch(error => {
                                    console.error('Error updating record:', error);
                                    let errorMessage = 'Failed to update record. ';
                                    if (error.message && error.message.includes('No field with ID')) {
                                        errorMessage += `The field "${fieldName}" no longer exists in the table. Please refresh the page or reconfigure the field in the properties panel.`;
                                    } else if (error.message && error.message.includes('allow record editing')) {
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
                                    [currentField.id]: null
                                }).then(() => {
                                    if (onUpdate) onUpdate();
                                }).catch(error => {
                                    console.error('Error updating record:', error);
                                    let errorMessage = 'Failed to update record. ';
                                    if (error.message && error.message.includes('No field with ID')) {
                                        errorMessage += `The field "${fieldName}" no longer exists in the table. Please refresh the page or reconfigure the field in the properties panel.`;
                                    } else {
                                        errorMessage += error.message || 'Unknown error occurred.';
                                    }
                                    alert(errorMessage);
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
        
        // For multiple select fields, show multi-select dropdown
        if (fieldType === FieldType.MULTIPLE_SELECTS) {
            const options = field?.config?.options?.choices || [];
            const currentValue = cellValue;
            const currentIds = Array.isArray(currentValue) 
                ? currentValue.map(item => item?.id || item)
                : [];
            
            // Use selectedMultipleSelectIds if set, otherwise use currentIds
            const displayIds = selectedMultipleSelectIds.length > 0 ? selectedMultipleSelectIds : currentIds;
            
            return (
                <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px]">
                    <select
                        multiple
                        value={displayIds}
                        disabled={isClosed}
                        onChange={(e) => {
                            const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                            setSelectedMultipleSelectIds(selectedOptions);
                            
                            // Auto-save on change
                            const options = field?.config?.options?.choices || [];
                            const valueToSave = selectedOptions
                                .map(id => options.find(opt => opt.id === id))
                                .filter(opt => opt !== undefined)
                                .map(opt => ({id: opt.id}));
                            
                            setIsSaving(true);
                            record.parentTable.updateRecordAsync(record, {
                                [field.id]: valueToSave
                            }).then(() => {
                                setIsSaving(false);
                                if (onUpdate) onUpdate();
                            }).catch(error => {
                                setIsSaving(false);
                                console.error('Error updating record:', error);
                                // Revert on error
                                setSelectedMultipleSelectIds(currentIds);
                                
                                let errorMessage = 'Failed to update record. ';
                                if (error.message && error.message.includes('allow record editing')) {
                                    errorMessage += 'Please enable record editing permissions for this Interface Extension in the Airtable settings.';
                                } else {
                                    errorMessage += error.message || 'Unknown error occurred.';
                                }
                                alert(errorMessage);
                            });
                        }}
                        className={`w-full px-2 py-1 border rounded text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800 ${isClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                        size={Math.min(options.length + 1, 4)} // Show up to 4 options at once
                    >
                        {options.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                    {displayIds.length > 0 && (
                        <div className="mt-1 text-xs text-gray-gray500 dark:text-gray-gray400">
                            Selected: {displayIds.map(id => {
                                const option = options.find(opt => opt.id === id);
                                return option?.name;
                            }).filter(Boolean).join(', ')}
                        </div>
                    )}
                </td>
            );
        }
        
        // For date fields that should show calendar
        if (isDateFieldEditable && isDateField && monthRecords) {
            const currentDate = cellValue instanceof Date ? cellValue : (cellValue ? new Date(cellValue) : null);
            return (
                <>
                    {showCalendar && createPortal(
                        <CalendarPicker
                            selectedDate={currentDate}
                            onDateSelect={handleDateSelect}
                            availableDates={availableDates}
                            onClose={() => setShowCalendar(false)}
                        />,
                        document.body
                    )}
                    <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px]">
                        <input
                            type="text"
                            value={formatDisplayValue(cellValue, fieldType, fieldName)}
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
        } else if (fieldType === FieldType.SINGLE_LINE_TEXT || fieldType === FieldType.MULTILINE_TEXT || isProjectImportField || isWarningField || isTimesheetNotesField) {
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
            {showCalendar && createPortal(
                <CalendarPicker
                    selectedDate={currentDate}
                    onDateSelect={handleDateSelect}
                    availableDates={availableDates}
                    onClose={() => setShowCalendar(false)}
                />,
                document.body
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
                            : isNameField
                            ? 'cursor-default'
                            : ''
                    }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Name field is read-only, don't allow editing
                        if (!isNameField) {
                            handleClick();
                        }
                    }}
                    title={
                        isDateField && !isReadOnly 
                            ? 'Click to select date' 
                            : isNameField
                            ? 'Name field is auto-populated and read-only'
                            : ''
                    }
                >
                    {formatDisplayValue(cellValue, fieldType, fieldName)}
                </td>
            )}
        </>
    );
}

