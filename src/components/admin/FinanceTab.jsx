// src/components/admin/FinanceTab.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import './FinanceTab.css';

const FinanceTab = ({
  setShowUserModal, setNewUser, setBulkMessageRole, setBulkMessageText,
  setShowBulkMessageModal, setShowFinanceModal, renderFinanceOfficersTable,
  fetchFinanceOfficers, showToast
}) => {
  const [financeStudents, setFinanceStudents] = useState([]);
  const [selectedFinanceStudent, setSelectedFinanceStudent] = useState(null);
  const [financeRecords, setFinanceRecords] = useState([]);
  const [financeSearch, setFinanceSearch] = useState("");
  const [financeLoading, setFinanceLoading] = useState(false);
  const [totalBilled, setTotalBilled] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(true);
  
  const [bypassSearch, setBypassSearch] = useState("");
  const [bypassStudent, setBypassStudent] = useState(null);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [bypassError, setBypassError] = useState("");

  const loadStudentFinance = async (studentId) => {
    setFinanceLoading(true);
    const { data, error } = await supabase
      .from("financial_records")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error:", error);
      alert("Failed to load records");
      setFinanceRecords([]);
    } else {
      setFinanceRecords(data || []);
    }
    setFinanceLoading(false);
  };

  const handleViewStudentFinance = (student) => {
    setSelectedFinanceStudent(student);
    loadStudentFinance(student.id);
  };

  const handleUpdateFinanceStatus = async (recordId, newStatus) => {
    if (!window.confirm(`Mark as ${newStatus}?`)) return;

    const updates = { status: newStatus };
    if (newStatus === "paid") {
      updates.payment_date = new Date().toISOString().split("T")[0];
    }

    const { error } = await supabase
      .from("financial_records")
      .update(updates)
      .eq("id", recordId);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Updated successfully!");
      if (selectedFinanceStudent) {
        loadStudentFinance(selectedFinanceStudent.id);
      }
    }
  };

  const searchStudentForBypass = async () => {
    if (!bypassSearch.trim()) {
      setBypassError("Enter a student ID or name");
      return;
    }

    setBypassLoading(true);
    setBypassError("");
    setBypassStudent(null);

    try {
      let query = supabase
        .from("students")
        .select("id, student_id, full_name, program, fees_clearance_bypassed, attendance_clearance_bypassed, exam_clearance_bypassed, bypass_timestamp");

      if (bypassSearch.includes("-")) {
        query = query.eq("student_id", bypassSearch.trim());
      } else {
        query = query.ilike("full_name", `%${bypassSearch.trim()}%`);
      }

      const { data, error } = await query.limit(1).single();

      if (error || !data) {
        setBypassError("Student not found");
      } else {
        let studentData = data;
        let needsUpdate = false;
        const updateData = {};
        
        if (data.bypass_timestamp) {
          const bypassTime = new Date(data.bypass_timestamp);
          const now = new Date();
          const hoursDiff = (now - bypassTime) / (1000 * 60 * 60);
          
          if (hoursDiff >= 24) {
            if (data.fees_clearance_bypassed) {
              updateData.fees_clearance_bypassed = false;
              studentData.fees_clearance_bypassed = false;
              needsUpdate = true;
            }
            if (data.attendance_clearance_bypassed) {
              updateData.attendance_clearance_bypassed = false;
              studentData.attendance_clearance_bypassed = false;
              needsUpdate = true;
            }
            if (data.exam_clearance_bypassed) {
              updateData.exam_clearance_bypassed = false;
              studentData.exam_clearance_bypassed = false;
              needsUpdate = true;
            }
            
            if (needsUpdate) {
              updateData.bypass_timestamp = null;
              studentData.bypass_timestamp = null;
              
              const { error: updateError } = await supabase
                .from("students")
                .update(updateData)
                .eq("id", data.id);
                
              if (updateError) {
                console.error("Failed to reset expired bypass:", updateError);
              }
            }
          } else {
            const remainingHours = 24 - hoursDiff;
            const remainingMinutes = (remainingHours % 1) * 60;
            studentData._bypassRemaining = `${Math.floor(remainingHours)}h ${Math.floor(remainingMinutes)}m`;
          }
        }
        
        setBypassStudent(studentData);
      }
    } catch (err) {
      setBypassError("Search failed");
    } finally {
      setBypassLoading(false);
    }
  };

  const handleToggleBypass = async (field) => {
    if (!bypassStudent) return;

    setBypassLoading(true);

    const newValue = !bypassStudent[field];
    const now = new Date().toISOString();

    const updateData = { [field]: newValue };
    
    if (newValue === true) {
      updateData.bypass_timestamp = now;
    } else {
      let allDisabled = true;
      if (field === 'fees_clearance_bypassed') {
        allDisabled = !newValue && !bypassStudent.attendance_clearance_bypassed && !bypassStudent.exam_clearance_bypassed;
      } else if (field === 'attendance_clearance_bypassed') {
        allDisabled = !newValue && !bypassStudent.fees_clearance_bypassed && !bypassStudent.exam_clearance_bypassed;
      } else if (field === 'exam_clearance_bypassed') {
        allDisabled = !newValue && !bypassStudent.fees_clearance_bypassed && !bypassStudent.attendance_clearance_bypassed;
      }
      
      if (allDisabled) {
        updateData.bypass_timestamp = null;
      }
    }

    const { error } = await supabase
      .from("students")
      .update(updateData)
      .eq("id", bypassStudent.id);

    if (error) {
      alert("Failed to update: " + error.message);
    } else {
      const fieldName = field.replace(/_/g, " ").replace("bypassed", "").trim();
      alert(`${fieldName} ${newValue ? "enabled ✅" : "disabled ❌"} successfully!\nAuto-reset after 24 hours.`);
      await searchStudentForBypass();
    }

    setBypassLoading(false);
  };

  useEffect(() => {
    const loadFinanceSummary = async () => {
      setSummaryLoading(true);
      try {
        const { data, error } = await supabase
          .from("financial_records")
          .select("amount, status");

        if (error) throw error;

        const billed = data.reduce((sum, r) => sum + r.amount, 0);
        const paid = data.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0);
        const outstanding = billed - paid;

        setTotalBilled(billed);
        setTotalPaid(paid);
        setTotalOutstanding(outstanding);
      } catch (err) {
        console.error("Error loading finance summary:", err);
        alert("Failed to load revenue summary");
      } finally {
        setSummaryLoading(false);
      }
    };

    loadFinanceSummary();
  }, []);

  useEffect(() => {
    const loadStudents = async () => {
      setFinanceLoading(true);
      let query = supabase
        .from("students")
        .select("id, student_id, full_name, email, program, academic_year")
        .order("full_name", { ascending: true });

      if (financeSearch.trim()) {
        query = query.or(`full_name.ilike.%${financeSearch}%,student_id.ilike.%${financeSearch}%,email.ilike.%${financeSearch}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading students:", error);
        alert("Failed to load students");
        setFinanceStudents([]);
      } else {
        setFinanceStudents(data || []);
      }
      setFinanceLoading(false);
    };

    loadStudents();
  }, [financeSearch]);

  return (
    <div className="finance-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>💰 Finance Dashboard</h2>
          <span className="record-count">Revenue Overview</span>
        </div>
        <div className="tab-actions">
          <button className="add-button bulk-message" onClick={() => { setBulkMessageRole('finance'); setBulkMessageText(''); setShowBulkMessageModal(true); }}>
            📨 Message All Finance
          </button>
          <button className="add-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "finance" })); setShowUserModal(true); }}>
            + Add Finance Officer
          </button>
          <button className="add-button" onClick={() => setShowFinanceModal(true)}>
            + Add Record
          </button>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="revenue-summary">
        <h3>University Revenue Summary</h3>
        {summaryLoading ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading revenue data...</p>
          </div>
        ) : (
          <div className="revenue-grid">
            <div className="revenue-card billed">
              <h4>Total Billed</h4>
              <p className="revenue-amount">${totalBilled.toFixed(2)}</p>
              <small>All fees charged to students</small>
            </div>
            <div className="revenue-card paid">
              <h4>Total Paid</h4>
              <p className="revenue-amount">${totalPaid.toFixed(2)}</p>
              <small>Successfully collected</small>
            </div>
            <div className={`revenue-card ${totalOutstanding > 0 ? 'outstanding' : 'paid'}`}>
              <h4>Outstanding Balance</h4>
              <p className="revenue-amount">${totalOutstanding.toFixed(2)}</p>
              <small>{totalOutstanding > 0 ? "Still owed by students" : "All fees collected!"}</small>
            </div>
          </div>
        )}
      </div>

      {/* Admin Override Tool */}
      <div className="bypass-tool">
        <h3>🔓 Admin Override: Bypass Fees, Attendance & Exam Clearance</h3>
        <p>Allow a student to access lectures and take exams even if fees or attendance requirements are not met.</p>

        <div className="bypass-search">
          <div className="bypass-search-input">
            <label>Search Student (by ID or Name)</label>
            <input 
              type="text" 
              placeholder="e.g. SCT-249726 or Alice" 
              value={bypassSearch} 
              onChange={(e) => setBypassSearch(e.target.value)} 
              className="search-input"
            />
          </div>
          <button className="action-btn search" onClick={searchStudentForBypass} disabled={bypassLoading}>
            {bypassLoading ? "Searching..." : "🔍 Search"}
          </button>
        </div>

        {bypassStudent && (
          <div className="bypass-result">
            <div className="bypass-student-info">
              <strong>Found:</strong> {bypassStudent.full_name} ({bypassStudent.student_id}) — {bypassStudent.program}
            </div>
            <div className="bypass-status">
              <strong>Current Override Status:</strong>
              <div className="status-row">
                <span>Fees Bypass: {bypassStudent.fees_clearance_bypassed ? <span className="enabled">✓ Enabled</span> : <span className="disabled">✗ Disabled</span>}</span>
                <span>Attendance Bypass: {bypassStudent.attendance_clearance_bypassed ? <span className="enabled">✓ Enabled</span> : <span className="disabled">✗ Disabled</span>}</span>
                <span>Exam Bypass: {bypassStudent.exam_clearance_bypassed ? <span className="enabled">✓ Enabled</span> : <span className="disabled">✗ Disabled</span>}</span>
              </div>
              {bypassStudent.bypass_timestamp && (
                <div className="expiry-info">
                  ⏰ Expires in: {bypassStudent._bypassRemaining || "Calculating..."}
                  <br />
                  <span className="expiry-date">Enabled: {new Date(bypassStudent.bypass_timestamp).toLocaleString()}</span>
                  <br />
                  <span className="expiry-note">Auto-reset after 24 hours</span>
                </div>
              )}
            </div>
            <div className="bypass-actions">
              <button className="action-btn toggle" onClick={() => handleToggleBypass("fees_clearance_bypassed")} disabled={bypassLoading}>
                {bypassStudent.fees_clearance_bypassed ? "Disable" : "Enable"} Fees Bypass
              </button>
              <button className="action-btn toggle" onClick={() => handleToggleBypass("attendance_clearance_bypassed")} disabled={bypassLoading}>
                {bypassStudent.attendance_clearance_bypassed ? "Disable" : "Enable"} Attendance Bypass
              </button>
              <button className="action-btn toggle" onClick={() => handleToggleBypass("exam_clearance_bypassed")} disabled={bypassLoading}>
                {bypassStudent.exam_clearance_bypassed ? "Disable" : "Enable"} Exam Bypass
              </button>
            </div>
            <p className="warning">Warning: These overrides allow access to lectures and exams regardless of actual fees or attendance.</p>
          </div>
        )}
        {bypassError && <p className="error">{bypassError}</p>}
      </div>

      {/* Finance Officers */}
      <div className="finance-officers-section">
        <h3>👤 Finance Officers</h3>
        {renderFinanceOfficersTable()}
      </div>

      {/* Student Financial Records */}
      <div className="student-finance-section">
        {!selectedFinanceStudent ? (
          <>
            <h3>📊 Student Financial Records</h3>
            <div className="student-search">
              <input 
                type="text" 
                placeholder="Search students by name, ID, or email..." 
                value={financeSearch} 
                onChange={(e) => setFinanceSearch(e.target.value)} 
                className="search-input"
              />
            </div>

            {financeLoading ? (
              <div className="loading-content">
                <div className="spinner"></div>
                <p>Loading student list...</p>
              </div>
            ) : financeStudents.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📊</span>
                <p>No students found matching your search.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr><th>Student ID</th><th>Name</th><th>Email</th><th>Program</th><th>Academic Year</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {financeStudents.map((s) => (
                      <tr key={s.id}>
                        <td><strong className="student-id">{s.student_id}</strong></td>
                        <td>{s.full_name}</td>
                        <td className="student-email">{s.email}</td>
                        <td>{s.program || "N/A"}</td>
                        <td>{s.academic_year || "N/A"}</td>
                        <td><button className="action-btn view" onClick={() => handleViewStudentFinance(s)}>View Finance</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="back-button-container">
              <button className="back-button" onClick={() => { setSelectedFinanceStudent(null); setFinanceRecords([]); }}>← Back to Student List</button>
            </div>

            <h3>Financial Records — {selectedFinanceStudent.full_name} <span className="student-id-label">({selectedFinanceStudent.student_id})</span></h3>

            {(() => {
              const totalBilled = financeRecords.reduce((sum, r) => sum + r.amount, 0);
              const totalPaid = financeRecords.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0);
              const balance = totalBilled - totalPaid;

              return (
                <div className="student-summary">
                  <div className="summary-card">
                    <h4>Total Billed</h4>
                    <p className="amount">${totalBilled.toFixed(2)}</p>
                  </div>
                  <div className="summary-card success">
                    <h4>Total Paid</h4>
                    <p className="amount">${totalPaid.toFixed(2)}</p>
                  </div>
                  <div className={`summary-card ${balance > 0 ? 'warning' : 'success'}`}>
                    <h4>Outstanding</h4>
                    <p className="amount">${balance.toFixed(2)}</p>
                  </div>
                </div>
              );
            })()}

            <div className="table-container">
              {financeLoading ? (
                <p>Loading records...</p>
              ) : financeRecords.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📊</span>
                  <p>No financial records found for this student.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th><th>Receipt #</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {financeRecords.map((r) => (
                      <tr key={r.id}>
                        <td>{r.payment_date ? new Date(r.payment_date).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}</td>
                        <td>{r.description}</td>
                        <td>${r.amount.toFixed(2)}</td>
                        <td><span className={`status-badge ${r.status}`}>{r.status.toUpperCase()}</span></td>
                        <td>{r.receipt_number || "—"}</td>
                        <td>
                          {r.status === "pending" && (
                            <button className="action-btn success small" onClick={() => handleUpdateFinanceStatus(r.id, "paid")}>Mark Paid</button>
                          )}
                          {r.status === "paid" && (
                            <button className="action-btn warning small" onClick={() => handleUpdateFinanceStatus(r.id, "pending")}>Revert</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FinanceTab;