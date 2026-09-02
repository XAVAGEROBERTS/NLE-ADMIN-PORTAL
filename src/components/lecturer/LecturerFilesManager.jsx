// LecturerFilesManager.jsx - COMPLETE WORKING VERSION WITH RECURSIVE FILE FETCHING
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const LecturerFilesManager = ({ profile, showToast }) => {
  const [bucketFiles, setBucketFiles] = useState({
    lecturerbucket: [],
    Tutorials: [],
    "Lecturer exam": [],
    Notes: [],
  });
  const [activeBucketTab, setActiveBucketTab] = useState("lecturerbucket");
  const [bucketLoading, setBucketLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState(null);
  const [selectedBucketFiles, setSelectedBucketFiles] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchBucketFiles();
    }
  }, [profile?.id]);

  useEffect(() => {
    setSelectedBucketFiles([]);
  }, [activeBucketTab]);

  // ==================== FETCH FILES WITH RECURSIVE TRAVERSAL ====================
  
  const fetchBucketFiles = async () => {
    if (!profile?.id) {
      console.warn("No profile.id - skipping file fetch");
      return;
    }

    setBucketLoading(true);
    try {
      const results = {
        lecturerbucket: [],
        Tutorials: [],
        "Lecturer exam": [],
        Notes: [],
      };

      console.log("🔍 Starting private file fetch for lecturer:", profile.id);

      // ================================================
      // 1. Assignment Files - Private per lecturer
      // ================================================
      {
        const prefix = `assignments/${profile.id}`;
        console.log("📁 Fetching Assignment Files from:", prefix);

        const { data, error } = await supabase.storage
          .from("lecturerbucket")
          .list(prefix, { limit: 1000 });

        if (error) {
          console.error("❌ Assignment Files error:", error);
        } else if (data) {
          results.lecturerbucket = data
            .filter((f) => f.name && f.name !== ".emptyFolderPlaceholder")
            .map((f) => {
              const fullPath = `${prefix}/${f.name}`;
              const { data: urlData } = supabase.storage
                .from("lecturerbucket")
                .getPublicUrl(fullPath);
              return {
                ...f,
                fullPath,
                publicUrl: urlData.publicUrl,
                size: f.metadata?.size || 0,
                bucket: "lecturerbucket",
              };
            });
          console.log(`✅ Found ${results.lecturerbucket.length} assignment files`);
        }
      }

      // ================================================
      // 2. Tutorials - Private per lecturer + Recursive
      // ================================================
      {
        const allFiles = [];
        const lecturerPrefix = `tutorials/${profile.id}`;
        console.log("📁 Fetching Tutorials from private folder:", lecturerPrefix);

        const recurse = async (path = lecturerPrefix) => {
          const { data: items, error } = await supabase.storage
            .from("Tutorials")
            .list(path, { limit: 1000 });

          if (error) {
            console.error(`❌ Tutorials list error at "${path}":`, error);
            return;
          }

          if (!items || items.length === 0) return;

          for (const item of items) {
            if (!item.name || item.name === ".emptyFolderPlaceholder") continue;

            const fullPath = path === lecturerPrefix 
              ? `${path}/${item.name}` 
              : `${path}/${item.name}`;

            // Check if it's a file (has id) or folder (no id)
            if (item.id) {
              // It's a real file
              const { data: urlData } = supabase.storage
                .from("Tutorials")
                .getPublicUrl(fullPath);
              allFiles.push({
                ...item,
                fullPath,
                publicUrl: urlData.publicUrl,
                size: item.metadata?.size || 0,
                bucket: "Tutorials",
              });
            } else {
              // It's a folder → go deeper
              await recurse(fullPath);
            }
          }
        };

        await recurse();
        results.Tutorials = allFiles;
        console.log(`✅ Found ${results.Tutorials.length} tutorial files`);
      }

      // ================================================
      // 3. Exam Papers - Private per lecturer
      // ================================================
      {
        const prefix = `exams/${profile.id}`;
        console.log("📁 Fetching Exam Papers from:", prefix);

        const { data, error } = await supabase.storage
          .from("Lecturer exam")
          .list(prefix, { limit: 1000 });

        if (error) {
          console.error("❌ Exam Papers error:", error);
        } else if (data) {
          results["Lecturer exam"] = data
            .filter((f) => f.name && f.name !== ".emptyFolderPlaceholder")
            .map((f) => {
              const fullPath = `${prefix}/${f.name}`;
              const { data: urlData } = supabase.storage
                .from("Lecturer exam")
                .getPublicUrl(fullPath);
              return {
                ...f,
                fullPath,
                publicUrl: urlData.publicUrl,
                size: f.metadata?.size || 0,
                bucket: "Lecturer exam",
              };
            });
          console.log(`✅ Found ${results["Lecturer exam"].length} exam papers`);
        }
      }

      // ================================================
      // 4. Notes - Private per lecturer + Recursive
      // ================================================
      {
        const allFiles = [];
        const lecturerPrefix = `notes/${profile.id}`;
        console.log("📁 Fetching Notes from private folder:", lecturerPrefix);

        const recurse = async (path = lecturerPrefix) => {
          const { data: items, error } = await supabase.storage
            .from("Notes")
            .list(path, { limit: 1000 });

          if (error) {
            console.error(`❌ Notes list error at "${path}":`, error);
            return;
          }

          if (!items || items.length === 0) return;

          for (const item of items) {
            if (!item.name || item.name === ".emptyFolderPlaceholder") continue;

            const fullPath = path ? `${path}/${item.name}` : item.name;

            // Check if it's a file (has id/metadata) or folder
            const isFolder = item.id === null || (item.metadata === null && !item.name.includes("."));

            if (item.metadata || item.id) {
              // It's a file
              const { data: urlData } = supabase.storage
                .from("Notes")
                .getPublicUrl(fullPath);
              allFiles.push({
                ...item,
                fullPath,
                publicUrl: urlData.publicUrl,
                size: item.metadata?.size || 0,
                bucket: "Notes",
              });
            } else {
              // It's a folder → go deeper
              await recurse(fullPath);
            }
          }
        };

        await recurse();
        results.Notes = allFiles;
        console.log(`✅ Found ${results.Notes.length} note files`);
      }

      // Update state
      setBucketFiles(results);

      console.log("✅ SUCCESS - PRIVATE FILE COUNTS:", {
        "Assignment Files": results.lecturerbucket.length,
        Tutorials: results.Tutorials.length,
        "Exam Papers": results["Lecturer exam"].length,
        Notes: results.Notes.length,
      });

    } catch (err) {
      console.error("❌ Unexpected error in fetchBucketFiles:", err);
      showToast("Failed to load files: " + err.message, 'error');
    } finally {
      setBucketLoading(false);
    }
  };

  // ==================== DELETE FILE ====================
  
  const handleDeleteFile = async (bucket, filePath) => {
    if (!window.confirm(`Delete "${filePath.split("/").pop()}" permanently?\nThis cannot be undone.`)) {
      return;
    }

    setDeletingFile(`${bucket}-${filePath}`);
    try {
      const { error } = await supabase.storage.from(bucket).remove([filePath]);

      if (error) throw error;

      showToast("✅ File deleted successfully!", 'success');
      fetchBucketFiles();
    } catch (err) {
      console.error("❌ Delete error:", err);
      showToast("Failed to delete file: " + err.message, 'error');
    } finally {
      setDeletingFile(null);
    }
  };

  // ==================== BULK SELECTION ====================
  
  const toggleSelectBucketFile = (fullPath) => {
    setSelectedBucketFiles((prev) =>
      prev.includes(fullPath)
        ? prev.filter((p) => p !== fullPath)
        : [...prev, fullPath]
    );
  };

  const toggleSelectAllBucketFiles = () => {
    const files = bucketFiles[activeBucketTab] || [];
    const allPaths = files.map((f) => f.fullPath);
    if (selectedBucketFiles.length === allPaths.length && allPaths.length > 0) {
      setSelectedBucketFiles([]);
    } else {
      setSelectedBucketFiles(allPaths);
    }
  };

  const handleBulkDeleteFiles = async () => {
    if (selectedBucketFiles.length === 0) {
      showToast("Select at least one file", 'error');
      return;
    }

    if (!window.confirm(`Delete ${selectedBucketFiles.length} selected file(s) permanently?\nThis cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      const { error } = await supabase.storage
        .from(activeBucketTab)
        .remove(selectedBucketFiles);

      if (error) throw error;

      showToast(`✅ Deleted ${selectedBucketFiles.length} file(s)`, 'success');
      setSelectedBucketFiles([]);
      fetchBucketFiles();
    } catch (err) {
      console.error("❌ Bulk delete error:", err);
      showToast("Failed to delete files: " + err.message, 'error');
      fetchBucketFiles();
    } finally {
      setBulkDeleting(false);
    }
  };

  // ==================== BUCKET TABS ====================
  
  const bucketTabs = [
    { key: "lecturerbucket", label: "Assignment Files" },
    { key: "Tutorials", label: "Tutorials / Videos" },
    { key: "Notes", label: "Notes" },
    { key: "Lecturer exam", label: "Exam Papers" },
  ];

  // ==================== RENDER ====================
  
  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <h2>📁 My Uploaded Files</h2>
        <button 
          className="lecturer-refresh-btn" 
          onClick={fetchBucketFiles} 
          disabled={bucketLoading}
        >
          🔄 {bucketLoading ? "Refreshing..." : "Refresh Files"}
        </button>
      </div>

      {/* Bucket Tabs */}
      <div 
        style={{ 
          display: "flex", 
          gap: "0", 
          marginBottom: "24px", 
          borderBottom: "3px solid #e3e6ea", 
          overflowX: "auto",
          paddingBottom: "4px",
        }}
      >
        {bucketTabs.map(({ key, label }) => {
          const count = bucketFiles[key]?.length || 0;
          const isActive = activeBucketTab === key;

          return (
            <button
              key={key}
              onClick={() => {
                setActiveBucketTab(key);
                setSelectedBucketFiles([]);
              }}
              style={{
                flex: "1 1 0",
                minWidth: "150px",
                padding: "14px 20px",
                border: "none",
                borderBottom: isActive ? "5px solid #1976d2" : "5px solid transparent",
                background: isActive ? "#e3f2fd" : "transparent",
                color: isActive ? "#1976d2" : "#555",
                fontWeight: isActive ? "700" : "600",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                whiteSpace: "nowrap",
              }}
            >
              {label}
              <span
                style={{
                  marginLeft: "10px",
                  padding: "4px 12px",
                  background: isActive ? "#1976d2" : "#e0e0e0",
                  color: isActive ? "white" : "#333",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                {bucketLoading && isActive ? "..." : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {bucketLoading ? (
        <div className="lecturer-loading-content" style={{ padding: "60px", textAlign: "center" }}>
          <div className="lecturer-spinner"></div>
          <p style={{ marginTop: "16px" }}>Loading files...</p>
        </div>
      ) : bucketFiles[activeBucketTab]?.length === 0 ? (
        <div className="lecturer-empty-state" style={{ background: "white", padding: "60px", borderRadius: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px", opacity: 0.4 }}>📂</div>
          <h3>No files uploaded yet</h3>
          <p style={{ color: "#777" }}>
            You haven't uploaded any files to{" "}
            <strong>
              {bucketTabs.find(t => t.key === activeBucketTab)?.label || activeBucketTab}
            </strong>
            {" "}yet.
          </p>
        </div>
      ) : (
        <>
          {/* Bulk Actions */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: "12px", 
            flexWrap: "wrap", 
            gap: "8px" 
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={
                  (bucketFiles[activeBucketTab]?.length || 0) > 0 &&
                  selectedBucketFiles.length === bucketFiles[activeBucketTab].length
                }
                onChange={toggleSelectAllBucketFiles}
              />
              <span>Select all ({bucketFiles[activeBucketTab]?.length || 0})</span>
            </label>

            {selectedBucketFiles.length > 0 && (
              <button
                className="lecturer-course-btn"
                onClick={handleBulkDeleteFiles}
                disabled={bulkDeleting}
                style={{ background: "#dc3545", color: "white", border: "none" }}
              >
                {bulkDeleting ? "Deleting..." : `🗑️ Delete selected (${selectedBucketFiles.length})`}
              </button>
            )}
          </div>

          {/* Files Table */}
          <div className="lecturer-table-container" style={{ overflowX: "auto" }}>
            <table className="lecturer-data-table" style={{ minWidth: "900px", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={
                        (bucketFiles[activeBucketTab]?.length || 0) > 0 &&
                        selectedBucketFiles.length === bucketFiles[activeBucketTab].length
                      }
                      onChange={toggleSelectAllBucketFiles}
                    />
                  </th>
                  <th style={{ minWidth: "180px" }}>File Name</th>
                  <th style={{ width: "100px" }}>Size</th>
                  <th style={{ width: "140px" }}>Uploaded</th>
                  <th style={{ minWidth: "200px" }}>Path</th>
                  <th style={{ width: "120px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bucketFiles[activeBucketTab].map((file, index) => (
                  <tr key={file.id || file.fullPath || index}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedBucketFiles.includes(file.fullPath)}
                        onChange={() => toggleSelectBucketFile(file.fullPath)}
                      />
                    </td>
                    <td>
                      <strong style={{ wordBreak: "break-word" }}>{file.name}</strong>
                    </td>
                    <td>
                      {file.metadata?.size 
                        ? `${(file.metadata.size / 1024 / 1024).toFixed(2)} MB` 
                        : file.size 
                          ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                          : "—"}
                    </td>
                    <td>
                      {file.created_at 
                        ? new Date(file.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td style={{ fontSize: "12px", color: "#666", wordBreak: "break-all" }}>
                      📁 {file.fullPath}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <a
                          href={file.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="lecturer-course-btn"
                          style={{ 
                            padding: "4px 12px", 
                            fontSize: "12px", 
                            background: "#1976d2", 
                            color: "white",
                            textDecoration: "none",
                            borderRadius: "4px",
                          }}
                        >
                          👁️ View
                        </a>
                        <button
                          className="lecturer-course-btn"
                          onClick={() => handleDeleteFile(activeBucketTab, file.fullPath)}
                          disabled={deletingFile === `${activeBucketTab}-${file.fullPath}`}
                          style={{ 
                            padding: "4px 12px", 
                            fontSize: "12px", 
                            background: "#dc3545", 
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: deletingFile === `${activeBucketTab}-${file.fullPath}` ? "not-allowed" : "pointer",
                          }}
                        >
                          {deletingFile === `${activeBucketTab}-${file.fullPath}` ? "..." : "🗑️ Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Info */}
          <div style={{ 
            marginTop: "24px", 
            padding: "16px 20px", 
            background: "linear-gradient(135deg, #e3f2fd 0%, #f0f8ff 100%)", 
            borderRadius: "12px", 
            border: "1px solid #bbdefb", 
            textAlign: "center", 
            color: "#1565c0", 
            fontSize: "14px" 
          }}>
            <strong>💡 All files are private and secure</strong>
            <br />
            Only you can view and manage them.
          </div>
        </>
      )}
    </div>
  );
};

export default LecturerFilesManager;