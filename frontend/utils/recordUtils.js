import {FieldType} from '@airtable/blocks/interface/models';

/**
 * Check if a record's date falls within a "Closed" month period
 * @param {Record} record - The record to check
 * @param {Array} monthRecords - Array of month records
 * @param {Field} monthStatusField - Status field from Month table
 * @param {Field} monthStartDateField - Start date field from Month table
 * @param {Field} monthEndDateField - End date field from Month table
 * @returns {boolean} True if record is in a closed period
 */
export function isRecordClosed(record, monthRecords, monthStatusField, monthStartDateField, monthEndDateField) {
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
}

