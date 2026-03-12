// frontend/src/components/Toast.tsx

interface Toast {
  id: string
  type: string
  message: string
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}
