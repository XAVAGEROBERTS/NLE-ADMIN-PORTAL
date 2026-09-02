// src/components/admin/ProgramsTab.jsx
import React from 'react';
import './ProgramsTab.css';

const ProgramsTab = ({
  programs, programsLoading, setShowProgramModal, setEditingProgram,
  setNewProgram, handleDeleteProgram
}) => {
  return (
    <div className="programs-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>🎓 Program Management</h2>
          <span className="record-count">{programs.length} programs</span>
        </div>
        <button className="add-button" onClick={() => { setEditingProgram(null); setNewProgram({ name: "", code: "" }); setShowProgramModal(true); }}>
          + Add Program
        </button>
      </div>

      <div className="table-container">
        {programs.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🎓</span>
            <p>No programs defined yet</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Program Name</th>
                <th>Code</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <tr key={program.id}>
                  <td className="program-name"><strong>{program.name}</strong></td>
                  <td><span className="dept-badge">{program.code}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit small" onClick={() => { setEditingProgram(program); setNewProgram({ name: program.name, code: program.code }); setShowProgramModal(true); }}>✏️</button>
                      <button className="action-btn delete small" onClick={() => handleDeleteProgram(program.id, program.name)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ProgramsTab;