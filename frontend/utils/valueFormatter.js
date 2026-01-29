import {FieldType} from '@airtable/blocks/interface/models';

/**
 * Format cell values for display based on field type and field name
 * @param {*} value - The cell value to format
 * @param {FieldType} fieldType - The type of the field
 * @param {string} fieldName - The name of the field
 * @returns {string} Formatted display value
 */
export function formatDisplayValue(value, fieldType, fieldName) {
    if (value === null || value === undefined) return '';
    
    const isEmailField = fieldName === 'Email (from Name)';
    const isProjectFromTaskField = fieldName === 'Project from Task' || fieldName === 'Project from Task - Ext';
    
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
        // For SINGLE_SELECT fields, the value is {id: string, name: string, color: string}
        if (fieldType === FieldType.SINGLE_SELECT) {
            return value.name || value.displayName || String(value);
        }
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
}

