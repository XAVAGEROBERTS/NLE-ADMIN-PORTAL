// src/components/admin/FinanceRecordModal.jsx
import React from 'react';

const FinanceRecordModal = ({
  showFinanceModal,
  setShowFinanceModal,
  newFinanceRecord,
  setNewFinanceRecord,
  handleAddFinanceRecord
}) => {
  return (
    <>
      <div className="modal-overlay" onClick={() => setShowFinanceModal(false)}>
        <div className="modal finance-record-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>💰 Add Financial Record</h3>
            <button className="close-btn" onClick={() => setShowFinanceModal(false)}>✕</button>
          </div>

          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Student ID *</label>
              <input
                type="text"
                value={newFinanceRecord.student_id}
                onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, student_id: e.target.value })}
                placeholder="Enter student ID"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <input
                type="text"
                value={newFinanceRecord.description}
                onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, description: e.target.value })}
                placeholder="e.g., Tuition Fee, Library Fine"
                className="form-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount ($) *</label>
                <input
                  type="number"
                  value={newFinanceRecord.amount}
                  onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, amount: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input
                  type="date"
                  value={newFinanceRecord.payment_date}
                  onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, payment_date: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                value={newFinanceRecord.status}
                onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, status: e.target.value })}
                className="form-select"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button className="cancel-button" onClick={() => setShowFinanceModal(false)}>
              Cancel
            </button>
            <button className="confirm-button" onClick={handleAddFinanceRecord}>
              Add Record
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          backdrop-filter: blur(5px);
        }

        .modal {
          background: white;
          border-radius: 20px;
          padding: 35px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.15);
          animation: modalSlideUp 0.4s ease-out;
        }

        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #e8ecf1;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .modal-header h3 {
          margin: 0;
          color: #1a1a2e;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.2s;
          padding: 5px;
        }

        .close-btn:hover {
          color: #dc3545;
          transform: scale(1.1);
        }

        .modal-body {
          max-height: 60vh;
          overflow-y: auto;
          padding-right: 5px;
        }

        .modal-body::-webkit-scrollbar {
          width: 6px;
        }

        .modal-body::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .modal-body::-webkit-scrollbar-thumb {
          background: #667eea;
          border-radius: 3px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }

        .form-label {
          font-weight: 600;
          color: #1a1a2e;
          font-size: 14px;
        }

        .form-input,
        .form-select {
          padding: 12px 16px;
          border: 2px solid #e8ecf1;
          border-radius: 10px;
          font-size: 14px;
          transition: all 0.3s;
          background: #fafbfc;
          font-family: inherit;
          width: 100%;
        }

        .form-input:focus,
        .form-select:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .modal-actions {
          display: flex;
          gap: 15px;
          justify-content: flex-end;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e8ecf1;
        }

        .cancel-button {
          padding: 12px 25px;
          background: transparent;
          border: 2px solid #e8ecf1;
          border-radius: 10px;
          color: #6b7280;
          font-weight: 600;
          transition: all 0.3s;
          cursor: pointer;
        }

        .cancel-button:hover {
          background: #f8fafc;
          border-color: #d1d5db;
        }

        .confirm-button {
          padding: 12px 30px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          transition: all 0.3s;
          cursor: pointer;
        }

        .confirm-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
        }

        @media (max-width: 768px) {
          .modal {
            padding: 25px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .modal-actions {
            flex-direction: column;
          }

          .modal-actions button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
};

export default FinanceRecordModal;