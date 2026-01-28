import {useState, useEffect} from 'react';
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
 */
export function EditableCell({record, field, onUpdate, monthRecords, monthStatusField, monthStartDateField, monthEndDateField}) {
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
    
    const isClosed = isRecordClosed(record, monthRecords, monthStatusField, monthStartDateField, monthEndDateField);
    
    // Fields that should be editable input fields
    const isProjectImportField = fieldName === 'Project Import';
    const isNameField = fieldName === 'Name';
    const isDateFieldEditable = fieldName === 'Date';
    const isIndividualHoursField = fieldName === 'Individual Hours';
    const isProjectFromTaskEditable = fieldName === 'Project from Task';
    const isWarningField = fieldName === 'Warning';
    const isTimesheetNotesField = fieldName === 'Timesheet Notes';
    
    // These fields should always be editable (unless read-only for other reasons)
    const shouldBeEditable = isProjectImportField || isNameField || isDateFieldEditable || isIndividualHoursField || isProjectFromTaskEditable || isWarningField || isTimesheetNotesField;
    
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
            
            // For linked records (Name field), fetch initial options and refresh when cellValue changes
            if (fieldType === FieldType.MULTIPLE_RECORD_LINKS && isEditing) {
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
        }
    }, [shouldBeEditable, isFormula, isLookup, cellValue, isEditing, fieldType, fieldName, field, record, searchTerm]);
    
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
        // For linked record fields (MULTIPLE_RECORD_LINKS)
        if (fieldType === FieldType.MULTIPLE_RECORD_LINKS) {
            const currentValue = cellValue;
            // Use savedSelectedIds if available (after save), otherwise use currentValue from record
            // For single select, take the first selected ID
            const selectedIds = savedSelectedIds.length > 0 
                ? savedSelectedIds 
                : (Array.isArray(currentValue) && currentValue.length > 0
                    ? [currentValue[0]?.id || currentValue[0]]
                    : []);
            const selectedId = selectedIds.length > 0 ? selectedIds[0] : '';
            
            // Name field should have search functionality
            if (isNameField) {
                // Fetch linked records if not already loaded or when search term changes
                if (linkedRecords.length === 0 || (searchTerm !== '' && showLinkedRecordDropdown)) {
                    record.fetchForeignRecordsAsync(field, searchTerm || '').then(result => {
                        setLinkedRecords(result.records);
                        // Update display name if we have a selected ID
                        if (selectedId) {
                            const foundRecord = result.records.find(r => r.id === selectedId);
                            if (foundRecord) {
                                setSelectedRecordDisplayName(foundRecord.displayName);
                            }
                        }
                    });
                }
                
                // Get display value - prioritize saved display name, then find in linkedRecords, then use currentValue
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
            
            // Task field - simple select dropdown without search
            // Fetch linked records if not already loaded
            if (linkedRecords.length === 0) {
                record.fetchForeignRecordsAsync(field, '').then(result => {
                    setLinkedRecords(result.records);
                });
            }
            
            return (
                <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600 min-w-[180px]">
                    <select
                        value={selectedId}
                        disabled={isClosed}
                        onChange={async (e) => {
                            e.stopPropagation();
                            if (isClosed) return;
                            
                            const newSelectedId = e.target.value;
                            
                            if (!newSelectedId) {
                                // Clear selection
                                setSavedSelectedIds([]);
                                try {
                                    setIsSaving(true);
                                    await record.parentTable.updateRecordAsync(record, {
                                        [field.id]: []
                                    });
                                    if (onUpdate) onUpdate();
                                } catch (error) {
                                    console.error('Error updating record:', error);
                                    // Revert on error
                                    const currentIds = Array.isArray(currentValue) && currentValue.length > 0
                                        ? [currentValue[0]?.id || currentValue[0]]
                                        : [];
                                    setSavedSelectedIds(currentIds);
                                    
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
                                return;
                            }
                            
                            // Update savedSelectedIds immediately for display
                            setSavedSelectedIds([newSelectedId]);
                            
                            // Convert to array of objects with id property (for MULTIPLE_RECORD_LINKS)
                            const valueToSave = [{id: newSelectedId}];
                            
                            // Auto-save immediately
                            try {
                                setIsSaving(true);
                                await record.parentTable.updateRecordAsync(record, {
                                    [field.id]: valueToSave
                                });
                                
                                if (onUpdate) onUpdate();
                            } catch (error) {
                                console.error('Error updating record:', error);
                                // Revert on error
                                const currentIds = Array.isArray(currentValue) && currentValue.length > 0
                                    ? [currentValue[0]?.id || currentValue[0]]
                                    : [];
                                setSavedSelectedIds(currentIds);
                                
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
                        onBlur={(e) => {
                            // Close select on blur (clicking outside)
                            e.stopPropagation();
                        }}
                        className={`w-full px-2 py-1 border rounded text-gray-gray900 dark:text-gray-gray100 bg-white dark:bg-gray-gray800 ${isClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <option value="">-- Select --</option>
                        {linkedRecords.length === 0 ? (
                            <option value="" disabled>Loading...</option>
                        ) : (
                            linkedRecords.map((linkedRecord) => (
                                <option key={linkedRecord.id} value={linkedRecord.id}>
                                    {linkedRecord.displayName}
                                </option>
                            ))
                        )}
                    </select>
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
                    {formatDisplayValue(cellValue, fieldType, fieldName)}
                </td>
            )}
        </>
    );
}

