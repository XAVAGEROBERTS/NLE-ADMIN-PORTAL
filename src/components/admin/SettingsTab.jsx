// src/components/admin/SettingsTab.jsx
import React from 'react';
import './SettingsTab.css';

const SettingsTab = () => {
  return (
    <div className="settings-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>⚙ System Settings</h2>
          <span className="record-count">Preferences</span>
        </div>
      </div>

      <div className="settings-grid">
        <div className="setting-card">
          <h3>📚 Academic Settings</h3>
          <div className="setting-item">
            <label className="setting-label">Academic Year</label>
            <select className="setting-select" defaultValue="2024/2025">
              <option>2023/2024</option>
              <option>2024/2025</option>
              <option>2025/2026</option>
            </select>
          </div>
          <div className="setting-item">
            <label className="setting-label">Semester</label>
            <select className="setting-select" defaultValue="1">
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
          <button className="save-button">💾 Save Changes</button>
        </div>

        <div className="setting-card">
          <h3>🔔 System Preferences</h3>
          <div className="setting-item">
            <label className="setting-label">
              <input type="checkbox" defaultChecked className="setting-checkbox" /> 
              Email Notifications
            </label>
          </div>
          <div className="setting-item">
            <label className="setting-label">
              <input type="checkbox" defaultChecked className="setting-checkbox" /> 
              Auto Backup
            </label>
          </div>
          <div className="setting-item">
            <label className="setting-label">
              <input type="checkbox" className="setting-checkbox" /> 
              Maintenance Mode
            </label>
          </div>
          <button className="save-button">💾 Update Preferences</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;