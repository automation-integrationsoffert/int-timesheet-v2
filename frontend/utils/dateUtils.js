/**
 * Date utility functions for formatting and date calculations
 */

/**
 * Format date as YYYY-MM-DD using local date components to avoid timezone issues
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatDateToString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get the number of days in a month
 * @param {Date} date - The date to get days for
 * @returns {number} Number of days in the month
 */
export function getDaysInMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of the week for the first day of a month (0 = Monday, 6 = Sunday)
 * @param {Date} date - The date to get first day for
 * @returns {number} Day of the week (0-6, where 0 = Monday, 6 = Sunday)
 */
export function getFirstDayOfMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const dayOfWeek = new Date(year, month, 1).getDay();
    // Convert from JavaScript's Sunday=0 to Monday=0 format
    // Sunday (0) -> 6, Monday (1) -> 0, Tuesday (2) -> 1, etc.
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
}

/**
 * Check if a date is available based on Month table records
 * @param {Date} date - The date to check
 * @param {Set<string>} availableDates - Set of available date strings (YYYY-MM-DD format)
 * @returns {boolean} True if date is available
 */
export function isDateAvailable(date, availableDates) {
    const dateStr = formatDateToString(date);
    return availableDates.has(dateStr);
}

/**
 * Check if a date is selected
 * @param {Date} date - The date to check
 * @param {Date|string} selectedDate - The selected date (can be Date object or string)
 * @returns {boolean} True if date is selected
 */
export function isDateSelected(date, selectedDate) {
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
}

/**
 * Calculate available dates from Month table records
 * @param {Array} monthRecords - Array of month records
 * @param {Field} monthStatusField - Status field from Month table
 * @param {Field} monthStartDateField - Start date field from Month table
 * @param {Field} monthEndDateField - End date field from Month table
 * @returns {Set<string>} Set of available date strings (YYYY-MM-DD format)
 */
export function getAvailableDates(monthRecords, monthStatusField, monthStartDateField, monthEndDateField) {
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
}

