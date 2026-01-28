/**
 * Confirmation modal component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message
 * @param {Function} props.onConfirm - Callback when confirmed
 * @param {Function} props.onCancel - Callback when cancelled
 */
export function ConfirmationModal({isOpen, title, message, onConfirm, onCancel}) {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onCancel}>
            <div className="bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4 text-gray-gray900 dark:text-gray-gray100">
                    {title}
                </h3>
                <p className="text-sm text-gray-gray700 dark:text-gray-gray300 mb-6">
                    {message}
                </p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray900 dark:text-gray-gray100 hover:bg-gray-gray300 dark:hover:bg-gray-gray500 transition-colors"
                    >
                        No
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-red-red text-white hover:bg-red-red600 focus:outline-none focus:ring-2 focus:ring-red-red focus:ring-offset-2 transition-colors"
                    >
                        Yes
                    </button>
                </div>
            </div>
        </div>
    );
}

