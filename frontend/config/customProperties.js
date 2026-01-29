import {FieldType} from '@airtable/blocks/interface/models';

/**
 * Get custom properties configuration for the Interface Extension
 * @param {Base} base - The Airtable base
 * @returns {Array} Array of custom property definitions
 */
export function getCustomProperties(base) {
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
                field.config.type === FieldType.SINGLE_SELECT,
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
            key: 'yearWeek',
            label: 'Year-Week',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.FORMULA,
            defaultValue: findField(timesheetTable, 'Year-Week'),
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
        {
            key: 'delete',
            label: 'Delete',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.SINGLE_SELECT,
            defaultValue: findField(timesheetTable, 'Delete'),
        },
        {
            key: 'warning',
            label: 'Warning',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.SINGLE_LINE_TEXT ||
                field.config.type === FieldType.MULTILINE_TEXT,
            defaultValue: findField(timesheetTable, 'Warning'),
        },
        {
            key: 'timesheetNotes',
            label: 'Timesheet Notes',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.SINGLE_LINE_TEXT ||
                field.config.type === FieldType.MULTILINE_TEXT,
            defaultValue: findField(timesheetTable, 'Timesheet Notes'),
        },
        {
            key: 'timeTaskType',
            label: 'Time Task Type',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.SINGLE_SELECT,
            defaultValue: findField(timesheetTable, 'Time Task Type'),
        },
        {
            key: 'userEmail',
            label: 'Email of the logged in user',
            type: 'field',
            table: timesheetTable,
            shouldFieldBeAllowed: (field) => 
                field.config.type === FieldType.SINGLE_LINE_TEXT || 
                field.config.type === FieldType.EMAIL,
            defaultValue: findField(timesheetTable, 'Email of the logged in user'),
        },
    ];
}

