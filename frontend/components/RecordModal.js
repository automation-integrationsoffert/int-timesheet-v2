import {useState, useEffect} from 'react';
import {FieldType} from '@airtable/blocks/interface/models';
import {EditableCell} from './EditableCell';
import {createPortal} from 'react-dom';

/**
 * Custom modal for creating/editing records with only specific fields
 * @param {Object} props
 * @param {Record|null} props.record - The record to edit (null for new record)
 * @param {Table} props.table - The table
 * @param {Object} props.fields - Object with field references
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Function} props.onSave - Callback when record is saved
 * @param {Array} props.monthRecords - Month records for date availability
 * @param {Field} props.monthStatusField - Month status field
 * @param {Field} props.monthStartDateField - Month start date field
 * @param {Field} props.monthEndDateField - Month end date field
 */
export function RecordModal({
    record,
    table,
    fields,
    onClose,
    onSave,
    onRecordCreated,
    monthRecords,
    monthStatusField,
    monthStartDateField,
    monthEndDateField
}) {
    const [isSaving, setIsSaving] = useState(false);

    const handleCreate = async () => {
        if (!table) return;
        
        setIsSaving(true);
        try {
            // Create a new empty record
            const newRecordId = await table.createRecordAsync({});
            
            // Notify parent component about the new record ID
            // Parent will find the record and pass it back as the record prop
            if (onRecordCreated) {
                onRecordCreated(newRecordId);
            }
            
            // Trigger refresh to get the new record
            if (onSave) {
                onSave();
            }
            
            // Keep modal open - the record will be passed via props once it appears
            setIsSaving(false);
        } catch (error) {
            console.error('Error creating record:', error);
            setIsSaving(false);
            alert('Failed to create record: ' + (error.message || 'Unknown error occurred.'));
        }
    };

    const handleSave = async () => {
        if (!record) return;
        
        setIsSaving(true);
        try {
            // The EditableCell components handle saving individually
            // We just need to trigger a refresh
            if (onSave) {
                await onSave();
            }
            onClose();
        } catch (error) {
            console.error('Error saving record:', error);
            alert('Failed to save record: ' + (error.message || 'Unknown error occurred.'));
        } finally {
            setIsSaving(false);
        }
    };

    if (!table) return null;

    return createPortal(
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-gray900 dark:text-gray-gray100">
                        {record ? 'Edit Timeline' : 'New Timeline'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-gray500 dark:text-gray-gray400 hover:text-gray-gray700 dark:hover:text-gray-gray200"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-4">
                    {Object.entries(fields).map(([key, field]) => {
                        if (!field) return null;
                        
                        return (
                            <div key={key} className="flex items-start">
                                <label className="w-1/3 pt-2 text-sm font-medium text-gray-gray700 dark:text-gray-gray300">
                                    {key === 'projectImport' ? 'Project Import' :
                                     key === 'emailFromName' ? 'Email (from Name)' :
                                     key === 'task' ? 'Task' :
                                     key === 'createdBy2' ? 'Created By 2' :
                                     key === 'name' ? 'Name' :
                                     key === 'date' ? 'Date' :
                                     key === 'projectFromTask' ? 'Project from Task' :
                                     key === 'projectFromTaskExt' ? 'Project from Task - Ext' :
                                     key}
                                </label>
                                <div className="w-2/3">
                                    {record ? (
                                        <table className="w-full">
                                            <tbody>
                                                <tr>
                                                    <EditableCell
                                                        record={record}
                                                        field={field}
                                                        onUpdate={onSave}
                                                        monthRecords={monthRecords}
                                                        monthStatusField={monthStatusField}
                                                        monthStartDateField={monthStartDateField}
                                                        monthEndDateField={monthEndDateField}
                                                    />
                                                </tr>
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="px-2 py-1 text-sm text-gray-gray500 dark:text-gray-gray400">
                                            Create record to edit
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray900 dark:text-gray-gray100 rounded hover:bg-gray-gray300"
                    >
                        Cancel
                    </button>
                    {record ? (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm bg-blue-blue text-white rounded hover:bg-blue-blue600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm bg-blue-blue text-white rounded hover:bg-blue-blue600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Creating...' : 'Create'}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

