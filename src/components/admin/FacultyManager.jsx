// FacultyManager.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const FacultyManager = ({ 
    isAdmin,
    showToast,
    refreshTrigger = 0
}) => {
    // ===== FACULTY STATES =====
    const [faculties, setFaculties] = useState([]);
    const [facultiesLoading, setFacultiesLoading] = useState(false);
    const [showFacultyModal, setShowFacultyModal] = useState(false);
    const [editingFaculty, setEditingFaculty] = useState(null);
    const [facultyError, setFacultyError] = useState("");
    const [newFaculty, setNewFaculty] = useState({
        faculty_code: "",
        faculty_name: "",
        description: "",
        dean: "",
        contact_email: "",
        contact_phone: "",
        is_active: true
    });

    // ===== FETCH FACULTIES =====
    const fetchFaculties = async () => {
        console.log("🔍 FacultyManager: fetchFaculties STARTED...");
        setFacultiesLoading(true);
        try {
            // Fetch faculties
            const { data: facultyData, error: facultyError } = await supabase
                .from("faculties")
                .select("*")
                .order("faculty_code", { ascending: true });

            if (facultyError) {
                console.error("❌ Error fetching faculties:", facultyError);
                showToast("Failed to load faculties: " + facultyError.message, "error");
                setFaculties([]);
                return;
            }

            // Fetch departments to show names
            const { data: deptData, error: deptError } = await supabase
                .from("departments")
                .select("faculty_id, department_code, department_name");

            if (deptError) {
                console.warn("⚠️ Could not fetch departments:", deptError);
            }

            // Group departments by faculty
            const departmentsByFaculty = {};
            if (deptData) {
                deptData.forEach(dept => {
                    if (dept.faculty_id) {
                        if (!departmentsByFaculty[dept.faculty_id]) {
                            departmentsByFaculty[dept.faculty_id] = [];
                        }
                        departmentsByFaculty[dept.faculty_id].push(dept);
                    }
                });
            }

            // Add departments info to each faculty
            const facultiesWithDepartments = facultyData.map(faculty => ({
                ...faculty,
                departments_list: departmentsByFaculty[faculty.id] || [],
                department_count: (departmentsByFaculty[faculty.id] || []).length
            }));

            console.log("✅ SUCCESS! Loaded faculties with departments:", facultiesWithDepartments);
            setFaculties(facultiesWithDepartments);
            showToast(`✅ Loaded ${facultiesWithDepartments.length} faculties`, "success");
            
        } catch (err) {
            console.error("❌ Error fetching faculties:", err);
            setFaculties([]);
            showToast("Failed to load faculties: " + err.message, "error");
        } finally {
            setFacultiesLoading(false);
            console.log("🔍 FacultyManager: fetchFaculties FINISHED");
        }
    };

    // ===== HANDLE SAVE FACULTY =====
    const handleSaveFaculty = async () => {
        if (!newFaculty.faculty_code.trim()) {
            setFacultyError("Faculty code is required");
            return;
        }
        if (!newFaculty.faculty_name.trim()) {
            setFacultyError("Faculty name is required");
            return;
        }

        const facultyCode = newFaculty.faculty_code.trim().toUpperCase();
        const facultyName = newFaculty.faculty_name.trim();

        setFacultiesLoading(true);
        setFacultyError("");

        try {
            if (editingFaculty) {
                const { error } = await supabase
                    .from("faculties")
                    .update({
                        faculty_code: facultyCode,
                        faculty_name: facultyName,
                        description: newFaculty.description?.trim() || null,
                        dean: newFaculty.dean?.trim() || null,
                        contact_email: newFaculty.contact_email?.trim() || null,
                        contact_phone: newFaculty.contact_phone?.trim() || null,
                        is_active: newFaculty.is_active,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", editingFaculty.id);

                if (error) {
                    if (error.code === "23505") {
                        setFacultyError("A faculty with this code already exists");
                    } else {
                        throw error;
                    }
                    return;
                }
                showToast(`Faculty "${facultyName}" updated successfully!`, "success");
            } else {
                const { error } = await supabase
                    .from("faculties")
                    .insert([{
                        faculty_code: facultyCode,
                        faculty_name: facultyName,
                        description: newFaculty.description?.trim() || null,
                        dean: newFaculty.dean?.trim() || null,
                        contact_email: newFaculty.contact_email?.trim() || null,
                        contact_phone: newFaculty.contact_phone?.trim() || null,
                        is_active: newFaculty.is_active,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }]);

                if (error) {
                    if (error.code === "23505") {
                        setFacultyError("A faculty with this code already exists");
                    } else {
                        throw error;
                    }
                    return;
                }
                showToast(`Faculty "${facultyName}" created successfully!`, "success");
            }

            // Reset and refresh
            setShowFacultyModal(false);
            setEditingFaculty(null);
            setNewFaculty({
                faculty_code: "",
                faculty_name: "",
                description: "",
                dean: "",
                contact_email: "",
                contact_phone: "",
                is_active: true
            });
            await fetchFaculties();
        } catch (err) {
            console.error("Error saving faculty:", err);
            setFacultyError(err.message || "Failed to save faculty");
        } finally {
            setFacultiesLoading(false);
        }
    };

    // ===== HANDLE DELETE FACULTY =====
    const handleDeleteFaculty = async (faculty) => {
        try {
            const { count: deptCount, error: deptError } = await supabase
                .from("departments")
                .select("id", { count: "exact", head: true })
                .eq("faculty_id", faculty.id);

            if (deptError) throw deptError;

            if (deptCount > 0) {
                const warning = [
                    "⚠️ This faculty is currently in use:",
                    `• ${deptCount} department(s) assigned`,
                    "",
                    "Deleting this faculty may cause issues with existing departments.",
                    "Consider marking it as inactive instead."
                ].join("\n");

                if (!window.confirm(warning + "\n\nDelete anyway?")) {
                    return;
                }
            } else if (!window.confirm(`Delete faculty "${faculty.faculty_name}" (${faculty.faculty_code})?\n\nThis action cannot be undone.`)) {
                return;
            }

            setFacultiesLoading(true);
            const { error } = await supabase
                .from("faculties")
                .delete()
                .eq("id", faculty.id);

            if (error) throw error;

            showToast(`Faculty "${faculty.faculty_name}" deleted successfully.`, "success");
            await fetchFaculties();
        } catch (err) {
            console.error("Error deleting faculty:", err);
            showToast("Failed to delete faculty: " + err.message, "error");
        } finally {
            setFacultiesLoading(false);
        }
    };

    // ===== TOGGLE FACULTY ACTIVE STATUS =====
    const handleToggleFacultyActive = async (faculty) => {
        try {
            const newStatus = !faculty.is_active;
            const { error } = await supabase
                .from("faculties")
                .update({
                    is_active: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq("id", faculty.id);

            if (error) throw error;

            showToast(`Faculty ${newStatus ? "activated" : "deactivated"} successfully.`, "success");
            await fetchFaculties();
        } catch (err) {
            console.error("Error toggling faculty status:", err);
            showToast("Failed to update faculty: " + err.message, "error");
        }
    };

    // ===== OPEN MODAL FUNCTIONS =====
    const openEditFaculty = (faculty) => {
        setEditingFaculty(faculty);
        setNewFaculty({
            faculty_code: faculty.faculty_code,
            faculty_name: faculty.faculty_name,
            description: faculty.description || "",
            dean: faculty.dean || "",
            contact_email: faculty.contact_email || "",
            contact_phone: faculty.contact_phone || "",
            is_active: faculty.is_active ?? true
        });
        setShowFacultyModal(true);
        setFacultyError("");
    };

    const openAddFaculty = () => {
        setEditingFaculty(null);
        setNewFaculty({
            faculty_code: "",
            faculty_name: "",
            description: "",
            dean: "",
            contact_email: "",
            contact_phone: "",
            is_active: true
        });
        setShowFacultyModal(true);
        setFacultyError("");
    };

    // ===== LOAD FACULTIES ON MOUNT =====
    useEffect(() => {
        if (isAdmin) {
            fetchFaculties();
        }
    }, [isAdmin, refreshTrigger]);

    // ===== RENDER =====
    if (!isAdmin) return null;

    return (
        <div className="tab-content">
            <div className="tab-header">
                <div>
                    <h2>🏛️ Faculty Management</h2>
                    <p>Create and manage university faculties</p>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                        className="refresh-button"
                        onClick={() => {
                            console.log("🔄 Manual refresh clicked");
                            fetchFaculties();
                        }}
                        disabled={facultiesLoading}
                    >
                        🔄 Refresh
                    </button>
                    <button
                        className="add-button"
                        onClick={openAddFaculty}
                        disabled={facultiesLoading}
                    >
                        + Add Faculty
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="faculty-stats" style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "20px",
                marginBottom: "30px"
            }}>
                <div className="stat-card" style={{ background: "#e3f2fd" }}>
                    <h3 style={{ fontSize: "28px", margin: "0", color: "#1976d2" }}>
                        {faculties.length}
                    </h3>
                    <p style={{ margin: "5px 0 0 0", color: "#555" }}>Total Faculties</p>
                </div>
                <div className="stat-card" style={{ background: "#e8f5e9" }}>
                    <h3 style={{ fontSize: "28px", margin: "0", color: "#2e7d32" }}>
                        {faculties.filter(f => f.is_active).length}
                    </h3>
                    <p style={{ margin: "5px 0 0 0", color: "#555" }}>Active</p>
                </div>
                <div className="stat-card" style={{ background: "#ffebee" }}>
                    <h3 style={{ fontSize: "28px", margin: "0", color: "#c62828" }}>
                        {faculties.filter(f => !f.is_active).length}
                    </h3>
                    <p style={{ margin: "5px 0 0 0", color: "#555" }}>Inactive</p>
                </div>
            </div>

            {/* Faculties Table */}
            {facultiesLoading ? (
                <div style={{ textAlign: "center", padding: "60px" }}>
                    <div className="spinner"></div>
                    <p>Loading faculties...</p>
                </div>
            ) : faculties.length === 0 ? (
                <div className="empty-state">
                    <div style={{ fontSize: "60px", marginBottom: "20px", opacity: 0.5 }}>🏛️</div>
                    <h3>No Faculties Found</h3>
                    <p>Create your first faculty to get started.</p>
                    <button className="add-button" onClick={openAddFaculty}>
                        + Create Faculty
                    </button>
                </div>
            ) : (
                <div className="table-container" style={{ overflowX: "auto" }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Faculty Name</th>
                                <th>Dean</th>
                                <th>Departments</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {faculties.map((faculty) => {
                                return (
                                    <tr key={faculty.id}>
                                        <td><strong>{faculty.faculty_code}</strong></td>
                                        <td>{faculty.faculty_name}</td>
                                        <td>{faculty.dean || "—"}</td>
                                        <td>
                                            {faculty.departments_list && faculty.departments_list.length > 0 ? (
                                                <div>
                                                    <span style={{ color: "#1976d2", fontWeight: "bold" }}>
                                                        {faculty.departments_list.length} department(s)
                                                    </span>
                                                    <div style={{ marginTop: "4px" }}>
                                                        {faculty.departments_list.map(dept => (
                                                            <span 
                                                                key={dept.department_code}
                                                                style={{
                                                                    display: "inline-block",
                                                                    background: "#e3f2fd",
                                                                    color: "#1976d2",
                                                                    padding: "2px 8px",
                                                                    borderRadius: "12px",
                                                                    fontSize: "12px",
                                                                    margin: "2px"
                                                                }}
                                                            >
                                                                {dept.department_code} - {dept.department_name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-muted">0 departments</span>
                                            )}
                                        </td>
                                        <td>
                                            <span
                                                className={`status-badge ${faculty.is_active ? "active" : "inactive"}`}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => handleToggleFacultyActive(faculty)}
                                                title="Click to toggle status"
                                            >
                                                {faculty.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons flat">
                                                <button
                                                    className="action-btn edit small"
                                                    onClick={() => openEditFaculty(faculty)}
                                                    title="Edit faculty"
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    className="action-btn delete small"
                                                    onClick={() => handleDeleteFaculty(faculty)}
                                                    title="Delete faculty"
                                                    disabled={facultiesLoading}
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

            {/* Faculty Modal - Add/Edit */}
            {showFacultyModal && (
                <div className="modal-overlay" onClick={() => {
                    if (!facultiesLoading) {
                        setShowFacultyModal(false);
                        setEditingFaculty(null);
                        setFacultyError("");
                    }
                }}>
                    <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{editingFaculty ? "Edit Faculty" : "Add New Faculty"}</h3>
                        
                        {facultyError && (
                            <div style={{
                                padding: "12px 16px",
                                backgroundColor: "#f8d7da",
                                color: "#721c24",
                                borderRadius: "8px",
                                marginBottom: "20px",
                                border: "1px solid #f5c6cb"
                            }}>
                                ⚠️ {facultyError}
                            </div>
                        )}

                        <div className="modal-form">
                            {/* Faculty Code */}
                            <div className="form-group">
                                <label className="form-label">Faculty Code *</label>
                                <input
                                    type="text"
                                    value={newFaculty.faculty_code}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                                        setNewFaculty({
                                            ...newFaculty,
                                            faculty_code: val
                                        });
                                        setFacultyError("");
                                    }}
                                    placeholder="e.g., ENG, SCT, BUS"
                                    className="form-input"
                                    maxLength="10"
                                    required
                                    disabled={!!editingFaculty}
                                />
                                <small style={{ color: "#6c757d" }}>
                                    {editingFaculty 
                                        ? "Faculty code cannot be changed after creation" 
                                        : "Uppercase letters only, no spaces"}
                                </small>
                            </div>

                            {/* Faculty Name */}
                            <div className="form-group">
                                <label className="form-label">Faculty Name *</label>
                                <input
                                    type="text"
                                    value={newFaculty.faculty_name}
                                    onChange={(e) => {
                                        setNewFaculty({
                                            ...newFaculty,
                                            faculty_name: e.target.value
                                        });
                                        setFacultyError("");
                                    }}
                                    placeholder="e.g., Faculty of Engineering"
                                    className="form-input"
                                    required
                                />
                            </div>

                            {/* Dean */}
                            <div className="form-group">
                                <label className="form-label">Dean</label>
                                <input
                                    type="text"
                                    value={newFaculty.dean}
                                    onChange={(e) => setNewFaculty({
                                        ...newFaculty,
                                        dean: e.target.value
                                    })}
                                    placeholder="Full name of Dean"
                                    className="form-input"
                                />
                            </div>

                            {/* Contact Info */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Contact Email</label>
                                    <input
                                        type="email"
                                        value={newFaculty.contact_email}
                                        onChange={(e) => setNewFaculty({
                                            ...newFaculty,
                                            contact_email: e.target.value
                                        })}
                                        placeholder="faculty@university.edu"
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contact Phone</label>
                                    <input
                                        type="tel"
                                        value={newFaculty.contact_phone}
                                        onChange={(e) => setNewFaculty({
                                            ...newFaculty,
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
                                    value={newFaculty.description}
                                    onChange={(e) => setNewFaculty({
                                        ...newFaculty,
                                        description: e.target.value
                                    })}
                                    placeholder="Brief description of the faculty"
                                    rows="3"
                                    className="form-textarea"
                                />
                            </div>

                            {/* Active Status */}
                            <div className="form-group" style={{ marginTop: "10px" }}>
                                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <input
                                        type="checkbox"
                                        checked={newFaculty.is_active}
                                        onChange={(e) => setNewFaculty({
                                            ...newFaculty,
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
                                        if (!facultiesLoading) {
                                            setShowFacultyModal(false);
                                            setEditingFaculty(null);
                                            setFacultyError("");
                                        }
                                    }}
                                    disabled={facultiesLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="confirm-button"
                                    onClick={handleSaveFaculty}
                                    disabled={facultiesLoading}
                                    style={{
                                        opacity: facultiesLoading ? 0.6 : 1,
                                        cursor: facultiesLoading ? "not-allowed" : "pointer"
                                    }}
                                >
                                    {facultiesLoading ? "Saving..." : (editingFaculty ? "Update Faculty" : "Create Faculty")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacultyManager;