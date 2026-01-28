import {useState, useEffect} from 'react';
import {formatDateToString, getDaysInMonth, getFirstDayOfMonth, isDateAvailable, isDateSelected} from '../utils/dateUtils';

/**
 * Calendar picker component for date selection with availability highlighting
 * @param {Object} props
 * @param {Date|string} props.selectedDate - Currently selected date
 * @param {Function} props.onDateSelect - Callback when a date is selected
 * @param {Set<string>} props.availableDates - Set of available date strings (YYYY-MM-DD format)
 * @param {Function} props.onClose - Callback to close the calendar
 */
export function CalendarPicker({selectedDate, onDateSelect, availableDates, onClose}) {
    // Initialize currentMonth with selectedDate if available, otherwise use current date
    const getInitialMonth = () => {
        if (selectedDate) {
            const date = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
            if (!isNaN(date.getTime())) {
                return new Date(date.getFullYear(), date.getMonth(), 1);
            }
        }
        return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    };
    
    const [currentMonth, setCurrentMonth] = useState(getInitialMonth());
    
    // Update currentMonth when selectedDate changes
    useEffect(() => {
        if (selectedDate) {
            const date = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
            if (!isNaN(date.getTime())) {
                setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
            }
        }
    }, [selectedDate]);
    
    const handleDateClick = (day) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        if (isDateAvailable(date, availableDates)) {
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
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
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
                        const available = isDateAvailable(date, availableDates);
                        const selected = isDateSelected(date, selectedDate);
                        
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

