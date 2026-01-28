import {initializeBlock, useBase, useRecords, useCustomProperties} from '@airtable/blocks/interface/ui';
import {useCallback, useState, useEffect, useRef} from 'react';
import './style.css';
import {getCustomProperties} from './config/customProperties';
import {EditableCell} from './components/EditableCell';
import {ConfirmationModal} from './components/ConfirmationModal';

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
    const [selectedRecords, setSelectedRecords] = useState(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);

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
    const deleteField = customPropertyValueByKey.delete;
    const warning = customPropertyValueByKey.warning;
    const timesheetNotes = customPropertyValueByKey.timesheetNotes;
    const timeTaskType = customPropertyValueByKey.timeTaskType;
    
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

    const handleToggleRecordSelection = (recordId) => {
        setSelectedRecords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) {
                newSet.delete(recordId);
            } else {
                newSet.add(recordId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedRecords.size === records.length) {
            setSelectedRecords(new Set());
        } else {
            setSelectedRecords(new Set(records.map(r => r.id)));
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        // If no records selected, just close the modal
        if (selectedRecords.size === 0) {
            setShowDeleteModal(false);
            return;
        }

        if (!deleteField || !canUpdateRecords) {
            alert('Delete field is not configured or you do not have permission to update records.');
            setShowDeleteModal(false);
            return;
        }

        const recordsToUpdate = records.filter(r => selectedRecords.has(r.id));
        
        if (recordsToUpdate.length === 0) {
            setShowDeleteModal(false);
            return;
        }

        try {
            // Find the "Yes Delete" option in the Delete field
            const deleteOptions = deleteField?.config?.options?.choices || [];
            const yesDeleteOption = deleteOptions.find(opt => opt.name === 'Yes Delete');
            
            if (!yesDeleteOption) {
                alert('"Yes Delete" option not found in Delete field. Please configure the Delete field with this option.');
                setShowDeleteModal(false);
                return;
            }

            // Update records in batches of 50 (Airtable limit)
            const batchSize = 50;
            for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
                const batch = recordsToUpdate.slice(i, i + batchSize);
                await timesheetTable.updateRecordsAsync(
                    batch.map(record => ({
                        id: record.id,
                        fields: {
                            [deleteField.id]: {id: yesDeleteOption.id}
                        }
                    }))
                );
            }

            // Clear selection and close modal
            setSelectedRecords(new Set());
            setShowDeleteModal(false);
            handleRecordUpdate();
        } catch (error) {
            console.error('Error updating delete field:', error);
            alert('Failed to update records: ' + (error.message || 'Unknown error occurred.'));
            setShowDeleteModal(false);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteModal(false);
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
        {key: 'warning', label: 'Warning', field: warning},
        {key: 'timesheetNotes', label: 'Timesheet Notes', field: timesheetNotes},
        {key: 'timeTaskType', label: 'Time Task Type', field: timeTaskType},
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
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleDeleteClick}
                        disabled={!canUpdateRecords}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            canUpdateRecords
                                ? 'bg-red-red text-white hover:bg-red-red600 focus:outline-none focus:ring-2 focus:ring-red-red focus:ring-offset-2'
                                : 'bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray500 dark:text-gray-gray400 cursor-not-allowed opacity-50'
                        }`}
                    >
                        Delete
                    </button>
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
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-gray700 dark:text-gray-gray300 uppercase tracking-wider border-b border-gray-gray200 dark:border-gray-gray500 w-12">
                                    <input
                                        type="checkbox"
                                        checked={records.length > 0 && selectedRecords.size === records.length}
                                        onChange={handleSelectAll}
                                        className="rounded"
                                    />
                                </th>
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
                                        colSpan={fields.filter(f => f.field).length + 1}
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
                                        <td className="px-4 py-3 text-sm border-b border-gray-gray100 dark:border-gray-gray600">
                                            <input
                                                type="checkbox"
                                                checked={selectedRecords.has(record.id)}
                                                onChange={() => handleToggleRecordSelection(record.id)}
                                                className="rounded"
                                            />
                                        </td>
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
            <ConfirmationModal
                isOpen={showDeleteModal}
                title={selectedRecords.size === 0 ? 'No Records Selected' : 'Confirm Delete'}
                message={selectedRecords.size === 0 
                    ? 'Please select at least one record'
                    : 'Could you delete these records?'
                }
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
        </div>
    );
}

initializeBlock({interface: () => <TimesheetApp />});
