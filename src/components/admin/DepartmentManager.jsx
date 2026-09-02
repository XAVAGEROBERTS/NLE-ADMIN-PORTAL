// DepartmentManager.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const DepartmentManager = ({ 
    isAdmin,
    showToast,
    faculties = [],
    facultiesLoading = false,
    refreshTrigger = 0
}) => {
    // ===== DEPARTMENT STATES =====
    const [departments, setDepartments] = useState([]);
    const [deptLoading, setDeptLoading] = useState(false);
    const [showDepartmentModal, setShowDepartmentModal] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [deptError, setDeptError] = useState("");
    const [localFaculties, setLocalFaculties] = useState([]);
    const [localFacultiesLoading, setLocalFacultiesLoading] = useState(false);
    const [newDepartment, setNewDepartment] = useState({
        department_code: "",
        department_name: "",
        description: "",
        faculty_id: "",
        faculty: "",
        head_of_department: "",
        contact_email: "",
        contact_phone: "",
        is_active: true
    });

    // Use either prop faculties or local faculties
    const availableFaculties = faculties.length > 0 ? faculties : localFaculties;
    const isFacultiesLoading = facultiesLoading || localFacultiesLoading;

    // ===== FETCH FACULTIES LOCALLY IF NOT PROVIDED =====
    const fetchFacultiesLocally = async () => {
        if (faculties.length > 0) {
            console.log("✅ Using faculties from props:", faculties.length);
            return;
        }
        
        console.log("🔍 Fetching faculties locally for DepartmentManager...");
        setLocalFacultiesLoading(true);
        try {
            const { data, error } = await supabase
                .from("faculties")
                .select("*")
                .order("faculty_code", { ascending: true });
            
            if (error) {
                console.error("❌ Error fetching faculties locally:", error);
            } else {
                console.log("✅ Loaded faculties locally:", data);
                setLocalFaculties(data);
            }
        } catch (err) {
            console.error("❌ Error:", err);
        } finally {
            setLocalFacultiesLoading(false);
        }
    };

    // ===== FETCH DEPARTMENTS =====
    const fetchDepartments = async () => {
        console.log("🔍 DepartmentManager: fetchDepartments STARTED...");
        setDeptLoading(true);
        try {
            const { data, error } = await supabase
                .from("departments")
                .select("*")
                .order("department_code", { ascending: true });

            console.log("📊 DepartmentManager response:", { 
                data, 
                error,
                dataLength: data?.length || 0
            });

            if (error) {
                console.error("❌ Error fetching departments:", error);
                showToast("Failed to load departments: " + error.message, "error");
                setDepartments([]);
            } else if (data && data.length > 0) {
                console.log("✅ SUCCESS! Loaded departments:", data);
                setDepartments(data);
                showToast(`✅ Loaded ${data.length} departments`, "success");
            } else {
                console.warn("⚠️ No departments found");
                setDepartments([]);
                showToast("No departments found", "info");
            }
        } catch (err) {
            console.error("❌ Unexpected error:", err);
            setDepartments([]);
            showToast("Failed to load departments: " + err.message, "error");
        } finally {
            setDeptLoading(false);
            console.log("🔍 DepartmentManager: fetchDepartments FINISHED");
        }
    };

    // ===== HANDLE SAVE DEPARTMENT =====
    const handleSaveDepartment = async () => {
        if (!newDepartment.department_code.trim()) {
            setDeptError("Department code is required");
            return;
        }
        if (!newDepartment.department_name.trim()) {
            setDeptError("Department name is required");
            return;
        }
        if (!newDepartment.faculty_id) {
            setDeptError("Please select a faculty");
            return;
        }

        const deptCode = newDepartment.department_code.trim().toUpperCase();
        const deptName = newDepartment.department_name.trim();
        const selectedFaculty = availableFaculties.find(f => f.id === newDepartment.faculty_id);

        setDeptLoading(true);
        setDeptError("");

        try {
            if (editingDept) {
                const { error } = await supabase
                    .from("departments")
                    .update({
                        department_code: deptCode,
                        department_name: deptName,
                        faculty_id: newDepartment.faculty_id,
                        faculty: selectedFaculty?.faculty_name || newDepartment.faculty,
                        description: newDepartment.description?.trim() || null,
                        head_of_department: newDepartment.head_of_department?.trim() || null,
                        contact_email: newDepartment.contact_email?.trim() || null,
                        contact_phone: newDepartment.contact_phone?.trim() || null,
                        is_active: newDepartment.is_active,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", editingDept.id);

                if (error) {
                    if (error.code === "23505") {
                        setDeptError("A department with this code already exists");
                    } else {
                        throw error;
                    }
                    return;
                }
                showToast(`Department "${deptName}" updated successfully!`, "success");
            } else {
                const { error } = await supabase
                    .from("departments")
                    .insert([{
                        department_code: deptCode,
                        department_name: deptName,
                        faculty_id: newDepartment.faculty_id,
                        faculty: selectedFaculty?.faculty_name || null,
                        description: newDepartment.description?.trim() || null,
                        head_of_department: newDepartment.head_of_department?.trim() || null,
                        contact_email: newDepartment.contact_email?.trim() || null,
                        contact_phone: newDepartment.contact_phone?.trim() || null,
                        is_active: newDepartment.is_active,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }]);

                if (error) {
                    if (error.code === "23505") {
                        setDeptError("A department with this code already exists");
                    } else {
                        throw error;
                    }
                    return;
                }
                showToast(`Department "${deptName}" created successfully!`, "success");
            }

            // Reset and refresh
            setShowDepartmentModal(false);
            setEditingDept(null);
            setNewDepartment({
                department_code: "",
                department_name: "",
                description: "",
                faculty_id: "",
                faculty: "",
                head_of_department: "",
                contact_email: "",
                contact_phone: "",
                is_active: true
            });
            await fetchDepartments();
        } catch (err) {
            console.error("Error saving department:", err);
            setDeptError(err.message || "Failed to save department");
        } finally {
            setDeptLoading(false);
        }
    };

    // ===== HANDLE DELETE DEPARTMENT =====
    const handleDeleteDepartment = async (department) => {
        try {
            const { count: lecturerCount, error: lecturerError } = await supabase
                .from("lecturer_departments")
                .select("id", { count: "exact", head: true })
                .eq("department_code", department.department_code);

            if (lecturerError) throw lecturerError;

            const { count: courseCount, error: courseError } = await supabase
                .from("courses")
                .select("id", { count: "exact", head: true })
                .eq("department_code", department.department_code);

            if (courseError) throw courseError;

            if (lecturerCount > 0 || courseCount > 0) {
                const warning = [
                    "⚠️ This department is currently in use:",
                    lecturerCount > 0 ? `• ${lecturerCount} lecturer(s) assigned` : "",
                    courseCount > 0 ? `• ${courseCount} course(s) using this department` : "",
                    "",
                    "Deleting this department may cause issues with existing records.",
                    "Consider marking it as inactive instead."
                ].filter(Boolean).join("\n");

                if (!window.confirm(warning + "\n\nDelete anyway?")) {
                    return;
                }
            } else if (!window.confirm(`Delete department "${department.department_name}" (${department.department_code})?\n\nThis action cannot be undone.`)) {
                return;
            }

            setDeptLoading(true);
            const { error } = await supabase
                .from("departments")
                .delete()
                .eq("id", department.id);

            if (error) throw error;

            showToast(`Department "${department.department_name}" deleted successfully.`, "success");
            await fetchDepartments();
        } catch (err) {
            console.error("Error deleting department:", err);
            showToast("Failed to delete department: " + err.message, "error");
        } finally {
            setDeptLoading(false);
        }
    };

    // ===== TOGGLE DEPARTMENT ACTIVE STATUS =====
    const handleToggleDepartmentActive = async (department) => {
        try {
            const newStatus = !department.is_active;
            const { error } = await supabase
                .from("departments")
                .update({
                    is_active: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq("id", department.id);

            if (error) throw error;

            showToast(`Department ${newStatus ? "activated" : "deactivated"} successfully.`, "success");
            await fetchDepartments();
        } catch (err) {
            console.error("Error toggling department status:", err);
            showToast("Failed to update department: " + err.message, "error");
        }
    };

    // ===== OPEN MODAL FUNCTIONS =====
    const openEditDepartment = (department) => {
        setEditingDept(department);
        setNewDepartment({
            department_code: department.department_code,
            department_name: department.department_name,
            description: department.description || "",
            faculty_id: department.faculty_id || "",
            faculty: department.faculty || "",
            head_of_department: department.head_of_department || "",
            contact_email: department.contact_email || "",
            contact_phone: department.contact_phone || "",
            is_active: department.is_active ?? true
        });
        setShowDepartmentModal(true);
        setDeptError("");
        
        // Fetch faculties if we don't have them
        if (availableFaculties.length === 0) {
            fetchFacultiesLocally();
        }
    };

    const openAddDepartment = () => {
        setEditingDept(null);
        setNewDepartment({
            department_code: "",
            department_name: "",
            description: "",
            faculty_id: "",
            faculty: "",
            head_of_department: "",
            contact_email: "",
            contact_phone: "",
            is_active: true
        });
        setShowDepartmentModal(true);
        setDeptError("");
        
        // Fetch faculties if we don't have them
        if (availableFaculties.length === 0) {
            fetchFacultiesLocally();
        }
    };

    // ===== LOAD DEPARTMENTS ON MOUNT =====
    useEffect(() => {
        if (isAdmin) {
            fetchDepartments();
            fetchFacultiesLocally();
        }
    }, [isAdmin, refreshTrigger]);

    // ===== RENDER =====
    if (!isAdmin) return null;

    return (
        <div className="tab-content">
            <div className="tab-header">
                <div>
                    <h2>🏢 Department Management</h2>
                    <p>Create and manage academic departments</p>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                        className="refresh-button"
                        onClick={() => {
                            console.log("🔄 Manual refresh clicked");
                            fetchDepartments();
                            fetchFacultiesLocally();
                        }}
                        disabled={deptLoading}
                    >
                        🔄 Refresh
                    </button>
                    <button
                        className="add-button"
                        onClick={openAddDepartment}
                        disabled={deptLoading}
                    >
                        + Add Department
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="dept-stats" style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "20px",
                marginBottom: "30px"
            }}>
                <div className="stat-card" style={{ background: "#e3f2fd" }}>
                    <h3 style={{ fontSize: "28px", margin: "0", color: "#1976d2" }}>
                        {departments.length}
                    </h3>
                    <p style={{ margin: "5px 0 0 0", color: "#555" }}>Total Departments</p>
                </div>
                <div className="stat-card" style={{ background: "#e8f5e9" }}>
                    <h3 style={{ fontSize: "28px", margin: "0", color: "#2e7d32" }}>
                        {departments.filter(d => d.is_active).length}
                    </h3>
                    <p style={{ margin: "5px 0 0 0", color: "#555" }}>Active</p>
                </div>
                <div className="stat-card" style={{ background: "#ffebee" }}>
                    <h3 style={{ fontSize: "28px", margin: "0", color: "#c62828" }}>
                        {departments.filter(d => !d.is_active).length}
                    </h3>
                    <p style={{ margin: "5px 0 0 0", color: "#555" }}>Inactive</p>
                </div>
            </div>

            {/* Departments Table */}
            {deptLoading ? (
                <div style={{ textAlign: "center", padding: "60px" }}>
                    <div className="spinner"></div>
                    <p>Loading departments...</p>
                </div>
            ) : departments.length === 0 ? (
                <div className="empty-state">
                    <div style={{ fontSize: "60px", marginBottom: "20px", opacity: 0.5 }}>🏢</div>
                    <h3>No Departments Found</h3>
                    <p>Create your first academic department to get started.</p>
                    <button className="add-button" onClick={openAddDepartment}>
                        + Create Department
                    </button>
                </div>
            ) : (
                <div className="table-container" style={{ overflowX: "auto" }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Department Name</th>
                                <th>Faculty</th>
                                <th>Head of Department</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.map((dept) => {
                                return (
                                    <tr key={dept.id}>
                                        <td><strong>{dept.department_code}</strong></td>
                                        <td>{dept.department_name}</td>
                                        <td>
                                            <span style={{ color: "#1976d2" }}>
                                                {dept.faculty || "—"}
                                            </span>
                                        </td>
                                        <td>{dept.head_of_department || "—"}</td>
                                        <td>
                                            <span
                                                className={`status-badge ${dept.is_active ? "active" : "inactive"}`}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => handleToggleDepartmentActive(dept)}
                                                title="Click to toggle status"
                                            >
                                                {dept.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons flat">
                                                <button
                                                    className="action-btn edit small"
                                                    onClick={() => openEditDepartment(dept)}
                                                    title="Edit department"
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    className="action-btn delete small"
                                                    onClick={() => handleDeleteDepartment(dept)}
                                                    title="Delete department"
                                                    disabled={deptLoading}
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Department Modal - Add/Edit */}
            {showDepartmentModal && (
                <div className="modal-overlay" onClick={() => {
                    if (!deptLoading) {
                        setShowDepartmentModal(false);
                        setEditingDept(null);
                        setDeptError("");
                    }
                }}>
                    <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{editingDept ? "Edit Department" : "Add New Department"}</h3>
                        
                        {deptError && (
                            <div style={{
                                padding: "12px 16px",
                                backgroundColor: "#f8d7da",
                                color: "#721c24",
                                borderRadius: "8px",
                                marginBottom: "20px",
                                border: "1px solid #f5c6cb"
                            }}>
                                ⚠️ {deptError}
                            </div>
                        )}

                        <div className="modal-form">
                            {/* Department Code */}
                            <div className="form-group">
                                <label className="form-label">Department Code *</label>
                                <input
                                    type="text"
                                    value={newDepartment.department_code}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                                        setNewDepartment({
                                            ...newDepartment,
                                            department_code: val
                                        });
                                        setDeptError("");
                                    }}
                                    placeholder="e.g., ENG, SCT, BUS"
                                    className="form-input"
                                    maxLength="10"
                                    required
                                    disabled={!!editingDept}
                                />
                                <small style={{ color: "#6c757d" }}>
                                    {editingDept 
                                        ? "Department code cannot be changed after creation" 
                                        : "Uppercase letters only, no spaces"}
                                </small>
                            </div>

                            {/* Department Name */}
                            <div className="form-group">
                                <label className="form-label">Department Name *</label>
                                <input
                                    type="text"
                                    value={newDepartment.department_name}
                                    onChange={(e) => {
                                        setNewDepartment({
                                            ...newDepartment,
                                            department_name: e.target.value
                                        });
                                        setDeptError("");
                                    }}
                                    placeholder="e.g., Engineering"
                                    className="form-input"
                                    required
                                />
                            </div>

                            {/* Faculty Dropdown */}
                            <div className="form-group">
                                <label className="form-label">Faculty *</label>
                                {isFacultiesLoading ? (
                                    <p>Loading faculties...</p>
                                ) : availableFaculties.length === 0 ? (
                                    <p style={{ color: "#dc3545" }}>
                                        No faculties found. Please create a faculty first.
                                    </p>
                                ) : (
                                    <>
                                        <select
                                            value={newDepartment.faculty_id || ""}
                                            onChange={(e) => {
                                                const facultyId = e.target.value;
                                                const selectedFaculty = availableFaculties.find(f => f.id === facultyId);
                                                setNewDepartment({
                                                    ...newDepartment,
                                                    faculty_id: facultyId,
                                                    faculty: selectedFaculty?.faculty_name || ""
                                                });
                                                setDeptError("");
                                            }}
                                            className="form-select"
                                            required
                                        >
                                            <option value="">Select Faculty</option>
                                            {availableFaculties
                                                .filter(f => f.is_active)
                                                .map(f => (
                                                    <option key={f.id} value={f.id}>
                                                        {f.faculty_code} - {f.faculty_name}
                                                    </option>
                                                ))}
                                        </select>
                                        <small style={{ color: '#6c757d' }}>
                                            {newDepartment.faculty ? 
                                                `✅ Selected: ${newDepartment.faculty}` : 
                                                'Select a faculty for this department'}
                                        </small>
                                    </>
                                )}
                            </div>

                            {/* Head of Department */}
                            <div className="form-group">
                                <label className="form-label">Head of Department</label>
                                <input
                                    type="text"
                                    value={newDepartment.head_of_department}
                                    onChange={(e) => setNewDepartment({
                                        ...newDepartment,
                                        head_of_department: e.target.value
                                    })}
                                    placeholder="Full name of HOD"
                                    className="form-input"
                                />
                            </div>

                            {/* Contact Info */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Contact Email</label>
                                    <input
                                        type="email"
                                        value={newDepartment.contact_email}
                                        onChange={(e) => setNewDepartment({
                                            ...newDepartment,
                                            contact_email: e.target.value
                                        })}
                                        placeholder="dept@university.edu"
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contact Phone</label>
                                    <input
                                        type="tel"
                                        value={newDepartment.contact_phone}
                                        onChange={(e) => setNewDepartment({
                                            ...newDepartment,
                                            contact_phone: e.target.value
                                        })}
                                        placeholder="+256 XXX XXX XXX"
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    value={newDepartment.description}
                                    onChange={(e) => setNewDepartment({
                                        ...newDepartment,
                                        description: e.target.value
                                    })}
                                    placeholder="Brief description of the department"
                                    rows="3"
                                    className="form-textarea"
                                />
                            </div>

                            {/* Active Status */}
                            <div className="form-group" style={{ marginTop: "10px" }}>
                                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <input
                                        type="checkbox"
                                        checked={newDepartment.is_active}
                                        onChange={(e) => setNewDepartment({
                                            ...newDepartment,
                                            is_active: e.target.checked
                                        })}
                                        style={{ width: "20px", height: "20px" }}
                                    />
                                    <span>Active (visible to lecturers and students)</span>
                                </label>
                            </div>

                            {/* Modal Actions */}
                            <div className="modal-actions" style={{ marginTop: "30px" }}>
                                <button
                                    className="cancel-button"
                                    onClick={() => {
                                        if (!deptLoading) {
                                            setShowDepartmentModal(false);
                                            setEditingDept(null);
                                            setDeptError("");
                                        }
                                    }}
                                    disabled={deptLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="confirm-button"
                                    onClick={handleSaveDepartment}
                                    disabled={deptLoading}
                                >
                                    {deptLoading ? "Saving..." : (editingDept ? "Update Department" : "Create Department")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentManager;