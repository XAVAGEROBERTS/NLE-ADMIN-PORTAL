// LecturerAssignmentsManager.jsx - COMPLETE WITH DELETE AND STATUS FEATURES
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

const LecturerAssignmentsManager = ({ profile, courses, stats, showToast, mode = "create" }) => {
  // ==================== STATE ====================
  
  const [myAssignments, setMyAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Assignment creation
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentFiles, setAssignmentFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  const [newAssignment, setNewAssignment] = useState({
    course_id: "",
    title: "",
    description: "",
    instructions: "",
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    total_marks: 100,
    submission_type: "file",
    max_file_size: 10,
    allowed_formats: ["pdf", "doc", "docx", "zip"],
    file_urls: [],
  });

  const [selectedCohort, setSelectedCohort] = useState({
    academic_year: "",
    year_of_study: 1,
    semester: 1,
  });
  const [cohortError, setCohortError] = useState("");

  // ===== GRADING STATES =====
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState([]);
  const [gradeForm, setGradeForm] = useState({});
  const [gradingInProgress, setGradingInProgress] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState([]);
  const [bulkGrading, setBulkGrading] = useState(false);
  
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // ==================== EFFECTS ====================
  
  useEffect(() => {
    if (profile?.id) {
      fetchMyAssignments();
    }
  }, [profile?.id]);

  // ==================== FETCH ASSIGNMENTS ====================
  
  const fetchMyAssignments = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          id,
          title,
          description,
          due_date,
          total_marks,
          status,
          course_id,
          academic_year,
          year_of_study,
          semester,
          courses!inner (
            course_code,
            course_name,
            department_code
          )
        `)
        .eq("lecturer_id", profile.id)
        .order("due_date", { ascending: false });

      if (error) throw error;

      const assignmentsWithStats = await Promise.all(
        (data || []).map(async (assignment) => {
          const { data: subs, error: subsError } = await supabase
            .from("assignment_submissions")
            .select("id, status")
            .eq("assignment_id", assignment.id);

          if (subsError) {
            console.error("Error fetching submissions:", subsError);
            return {
              ...assignment,
              submitted_count: 0,
              graded_count: 0,
              pending_count: 0,
            };
          }

          const submitted = subs?.filter(s => s.status === "submitted" || s.status === "graded").length || 0;
          const graded = subs?.filter(s => s.status === "graded").length || 0;
          const pending = submitted - graded;

          return {
            ...assignment,
            submitted_count: submitted,
            graded_count: graded,
            pending_count: pending,
          };
        })
      );

      setMyAssignments(assignmentsWithStats);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      showToast("Failed to load assignments", 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== FETCH SUBMISSIONS ====================
  
  const fetchAssignmentSubmissions = async (assignmentId) => {
    if (!assignmentId) {
      setAssignmentSubmissions([]);
      return;
    }

    try {
      console.log("📝 Fetching submissions for assignment:", assignmentId);

      const { data: submissions, error } = await supabase
        .from("assignment_submissions")
        .select(`
          id, 
          assignment_id, 
          student_id, 
          submission_date, 
          status, 
          file_urls, 
          marks_obtained, 
          feedback, 
          graded_at, 
          graded_by
        `)
        .eq("assignment_id", assignmentId)
        .order("submission_date", { ascending: false });

      if (error) throw error;

      if (!submissions || submissions.length === 0) {
        setAssignmentSubmissions([]);
        setGradeForm({});
        return;
      }

      const studentUuids = [...new Set(submissions.map((s) => s.student_id))];
      const { data: students, error: studentError } = await supabase
        .from("students")
        .select("id, full_name, email, student_id")
        .in("id", studentUuids);

      if (studentError) {
        console.error("Error fetching students:", studentError);
      }

      const studentMap = {};
      students?.forEach((stu) => {
        studentMap[String(stu.id)] = {
          name: stu.full_name || "Unknown Student",
          email: stu.email || "No email",
          reg: stu.student_id || "N/A",
        };
      });

      const projectRef = supabase.supabaseUrl.split("//")[1].split(".")[0];

      const processedSubmissions = submissions.map((sub) => {
        const studentInfo = studentMap[String(sub.student_id)] || {
          name: "Unknown Student",
          email: "No email",
          reg: "N/A",
        };

        const fileDownloadUrls = (sub.file_urls || [])
          .map((filePath) => {
            if (!filePath) return "";
            if (filePath.startsWith("http")) return filePath;

            const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
            return `https://${projectRef}.supabase.co/storage/v1/object/public/assignments/${cleanPath}`;
          })
          .filter((url) => url);

        return {
          submission_id: sub.id,
          student_id: sub.student_id,
          student_name: studentInfo.name,
          student_email: studentInfo.email,
          registration_number: studentInfo.reg,
          submission_date: sub.submission_date,
          status: sub.status || "submitted",
          file_urls: sub.file_urls || [],
          file_download_urls: fileDownloadUrls,
          marks_obtained: sub.marks_obtained,
          feedback: sub.feedback,
          graded_at: sub.graded_at,
        };
      });

      setAssignmentSubmissions(processedSubmissions);

      const initialForm = {};
      processedSubmissions.forEach((sub) => {
        initialForm[sub.submission_id] = {
          marks: sub.marks_obtained?.toString() || "",
          feedback: sub.feedback || "",
        };
      });
      setGradeForm(initialForm);
      
    } catch (err) {
      console.error("Error in fetchAssignmentSubmissions:", err);
      showToast("Failed to load submissions: " + err.message, 'error');
      setAssignmentSubmissions([]);
      setGradeForm({});
    }
  };

  // ==================== FILE DOWNLOAD ====================
  
  const downloadFile = async (fileUrl, fileName, submissionId = null) => {
    try {
      const downloadKey = submissionId ? `${submissionId}_${fileName}` : fileName;
      setDownloadingFile(downloadKey);

      console.log("📥 Download attempt:", { fileUrl, fileName, submissionId });

      if (fileUrl.startsWith("http")) {
        window.open(fileUrl, "_blank");
        setDownloadingFile(null);
        return;
      }

      let bucketName = "assignments";
      let filePath = fileUrl;

      if (fileUrl.includes("/storage/v1/object/public/assignments/")) {
        const match = fileUrl.match(/\/storage\/v1\/object\/public\/assignments\/(.+)/);
        if (match && match[1]) filePath = match[1];
      } else if (fileUrl.includes("assignments/")) {
        const match = fileUrl.match(/assignments\/(.*)/);
        if (match && match[1]) filePath = match[1];
      }

      filePath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

      if (!filePath || filePath.length < 3) {
        console.error("❌ Invalid file path:", filePath);
        if (fileUrl.startsWith("http")) {
          window.open(fileUrl, "_blank");
          setDownloadingFile(null);
          return;
        }
        showToast("Invalid file path", 'error');
        setDownloadingFile(null);
        return;
      }

      console.log(`📂 Bucket: ${bucketName}, Path: ${filePath}`);

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      try {
        const response = await fetch(publicUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName || filePath.split("/").pop() || "download";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          console.log("✅ Download successful");
          setDownloadingFile(null);
          return;
        }
      } catch (fetchError) {
        console.warn("⚠️ Fetch error:", fetchError.message);
        try {
          const { data, error: downloadError } = await supabase.storage
            .from(bucketName)
            .download(filePath);

          if (downloadError) {
            console.error("❌ Storage API error:", downloadError);
            window.open(publicUrl, "_blank");
          } else {
            const url = window.URL.createObjectURL(data);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName || filePath.split("/").pop() || "download";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            console.log("✅ Storage API download successful");
          }
        } catch (storageError) {
          console.error("❌ Storage error:", storageError);
          window.open(publicUrl, "_blank");
        }
      }
    } catch (error) {
      console.error("❌ Download error:", error);
      showToast("Error downloading file: " + error.message, 'error');
    } finally {
      setDownloadingFile(null);
    }
  };

  const downloadAllFilesForSubmission = async (submission) => {
    if (!submission.file_download_urls || submission.file_download_urls.length === 0) {
      showToast("No files to download", 'info');
      return;
    }

    setBatchDownloading(true);
    setBatchProgress({
      current: 0,
      total: submission.file_download_urls.length,
    });

    try {
      for (let i = 0; i < submission.file_download_urls.length; i++) {
        const url = submission.file_download_urls[i];
        const fileExt = getFileExtension(submission.file_urls?.[i] || url);
        const fileName = `${submission.student_name}_${selectedAssignment?.title || "assignment"}_file${i + 1}.${fileExt}`.replace(/[^a-zA-Z0-9._-]/g, "_");

        setBatchProgress({
          current: i + 1,
          total: submission.file_download_urls.length,
        });

        await downloadFile(url, fileName, submission.submission_id);

        if (i < submission.file_download_urls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      showToast(`All ${submission.file_download_urls.length} files downloaded!`, 'success');
    } catch (error) {
      console.error("Batch download error:", error);
      showToast("Error downloading files: " + error.message, 'error');
    } finally {
      setBatchDownloading(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  const downloadAllSubmissions = async () => {
    if (assignmentSubmissions.length === 0) {
      showToast("No submissions to download", 'info');
      return;
    }

    const submissionsWithFiles = assignmentSubmissions.filter(
      (sub) => sub.file_download_urls && sub.file_download_urls.length > 0
    );

    if (submissionsWithFiles.length === 0) {
      showToast("No files found in submissions", 'info');
      return;
    }

    setBatchDownloading(true);
    setBatchProgress({ current: 0, total: submissionsWithFiles.length });

    try {
      for (let i = 0; i < submissionsWithFiles.length; i++) {
        const submission = submissionsWithFiles[i];
        setBatchProgress({
          current: i + 1,
          total: submissionsWithFiles.length,
        });

        for (let j = 0; j < submission.file_download_urls.length; j++) {
          const url = submission.file_download_urls[j];
          const fileExt = getFileExtension(submission.file_urls?.[j] || url);
          const fileName = `${submission.student_name}_${selectedAssignment?.title || "assignment"}_${i + 1}_${j + 1}.${fileExt}`.replace(/[^a-zA-Z0-9._-]/g, "_");

          await downloadFile(url, fileName, submission.submission_id);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      showToast(`All files from ${submissionsWithFiles.length} submissions downloaded!`, 'success');
    } catch (error) {
      console.error("All submissions download error:", error);
      showToast("Error downloading submissions: " + error.message, 'error');
    } finally {
      setBatchDownloading(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  const getFileExtension = (url) => {
    if (!url) return "txt";
    const urlWithoutParams = url.split("?")[0];
    const parts = urlWithoutParams.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "txt";
  };

  // ==================== GRADING FUNCTIONS ====================
  
  const handleViewSubmissions = (assignment) => {
    console.log("→ Opening submissions for assignment:", assignment.id, assignment.title);

    setSelectedAssignment(assignment);
    setAssignmentSubmissions([]);
    setSelectedSubmissions([]);
    setGradeForm({});
    fetchAssignmentSubmissions(assignment.id);
  };

  const handleGradeSubmission = async (submissionId, marks, feedback) => {
    try {
      setGradingInProgress(true);

      const { error } = await supabase
        .from("assignment_submissions")
        .update({
          marks_obtained: marks,
          feedback: feedback,
          status: "graded",
          graded_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      showToast("✅ Graded successfully!", 'success');
      fetchAssignmentSubmissions(selectedAssignment.id);
      fetchMyAssignments();
      
      setGradeForm(prev => ({
        ...prev,
        [submissionId]: { marks: "", feedback: "" },
      }));

    } catch (error) {
      console.error("Error grading submission:", error);
      showToast("Failed to grade: " + error.message, 'error');
    } finally {
      setGradingInProgress(false);
    }
  };

  const handleBulkGrade = async () => {
    if (selectedSubmissions.length === 0) {
      showToast("Please select submissions to grade", 'error');
      return;
    }

    const updates = selectedSubmissions
      .map((submissionId) => {
        const gradeData = gradeForm[submissionId];
        if (gradeData && gradeData.marks !== "") {
          return {
            id: submissionId,
            marks_obtained: parseFloat(gradeData.marks),
            feedback: gradeData.feedback || "",
            status: "graded",
            graded_at: new Date().toISOString(),
          };
        }
        return null;
      })
      .filter((update) => update !== null);

    if (updates.length === 0) {
      showToast("Please enter marks for selected submissions", 'error');
      return;
    }

    if (!window.confirm(`Grade ${updates.length} selected submissions?`)) return;

    setGradingInProgress(true);
    try {
      for (const update of updates) {
        const { error } = await supabase
          .from("assignment_submissions")
          .update({
            marks_obtained: update.marks_obtained,
            feedback: update.feedback,
            status: "graded",
            graded_at: update.graded_at,
          })
          .eq("id", update.id);

        if (error) {
          console.error("Error grading submission:", update.id, error);
        }
      }

      showToast(`${updates.length} submissions graded successfully!`, 'success');
      fetchAssignmentSubmissions(selectedAssignment.id);
      fetchMyAssignments();

      setSelectedSubmissions([]);
      setBulkGrading(false);
    } catch (error) {
      console.error("Error bulk grading:", error);
      showToast("Error grading submissions: " + error.message, 'error');
    } finally {
      setGradingInProgress(false);
    }
  };

  const handleToggleSubmissionSelection = (submissionId) => {
    setSelectedSubmissions((prev) => {
      if (prev.includes(submissionId)) {
        return prev.filter((id) => id !== submissionId);
      } else {
        return [...prev, submissionId];
      }
    });
  };

  const handleSelectAllSubmissions = () => {
    const allIds = assignmentSubmissions
      .filter((sub) => sub.status === "submitted")
      .map((sub) => sub.submission_id);

    if (selectedSubmissions.length === allIds.length && allIds.length > 0) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(allIds);
    }
  };

  const downloadSubmissionsCSV = () => {
    if (assignmentSubmissions.length === 0) {
      showToast("No submissions to download", 'info');
      return;
    }

    const headers = [
      "Student Name",
      "Student Email",
      "Registration",
      "Submission Date",
      "Status",
      "Marks",
      "Feedback",
    ];

    const csvData = assignmentSubmissions.map((sub) => [
      sub.student_name,
      sub.student_email,
      sub.registration_number || "N/A",
      sub.submission_date ? new Date(sub.submission_date).toLocaleString() : "Not Submitted",
      sub.status,
      sub.marks_obtained || "Not Graded",
      sub.feedback || "No feedback",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submissions_${selectedAssignment?.title || "assignment"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // ==================== ASSIGNMENT CRUD ====================
  
  const uploadAssignmentFiles = async (files) => {
    if (!files || files.length === 0) return [];
    const uploadedPaths = [];
    setUploadingFiles(true);
    setUploadProgress(0);

    try {
      const lecturerFolder = `assignments/${profile.id}`;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const originalName = file.name;
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const safeName = originalName.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `${timestamp}_${randomStr}_${safeName}`;
        const filePath = `${lecturerFolder}/${fileName}`;

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));

        const { error } = await supabase.storage
          .from("assignments")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) {
          console.error(`Failed to upload ${originalName}:`, error);
          showToast(`Failed to upload "${originalName}"`, 'error');
          continue;
        }

        uploadedPaths.push(filePath);
      }

      showToast(`✅ Successfully uploaded ${uploadedPaths.length} file(s)!`, 'success');
      return uploadedPaths;
    } catch (error) {
      console.error("Upload error:", error);
      showToast("Upload failed: " + error.message, 'error');
      return [];
    } finally {
      setUploadingFiles(false);
      setUploadProgress(0);
    }
  };

  const handleCreateAssignment = async () => {
    try {
      if (!newAssignment.course_id) {
        showToast("Please select a course", 'error');
        return;
      }
      if (!newAssignment.title.trim()) {
        showToast("Please enter a title", 'error');
        return;
      }
      if (!selectedCohort.academic_year?.trim()) {
        showToast("Please enter Academic Year", 'error');
        return;
      }

      let fileUrls = [];
      if (assignmentFiles.length > 0) {
        fileUrls = await uploadAssignmentFiles(assignmentFiles);
      }

      const assignmentData = {
        course_id: newAssignment.course_id,
        lecturer_id: profile.id,
        title: newAssignment.title.trim(),
        description: newAssignment.description?.trim() || null,
        instructions: newAssignment.instructions?.trim() || null,
        due_date: newAssignment.due_date,
        total_marks: Number(newAssignment.total_marks) || 100,
        submission_type: newAssignment.submission_type || "file",
        max_file_size: Number(newAssignment.max_file_size) || 10,
        allowed_formats: newAssignment.allowed_formats || ["pdf", "doc", "docx", "zip"],
        file_urls: fileUrls,
        status: "published",
        academic_year: selectedCohort.academic_year.trim(),
        year_of_study: selectedCohort.year_of_study,
        semester: selectedCohort.semester,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("assignments")
        .insert([assignmentData]);

      if (error) throw error;

      showToast("✅ Assignment created successfully!", 'success');
      
      setShowAssignmentModal(false);
      setAssignmentFiles([]);
      setNewAssignment({
        course_id: "",
        title: "",
        description: "",
        instructions: "",
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        total_marks: 100,
        submission_type: "file",
        max_file_size: 10,
        allowed_formats: ["pdf", "doc", "docx", "zip"],
        file_urls: [],
      });
      setSelectedCohort({ academic_year: "", year_of_study: 1, semester: 1 });
      
      fetchMyAssignments();
    } catch (error) {
      console.error("Error creating assignment:", error);
      showToast("Error: " + error.message, 'error');
    }
  };

  // ===== DELETE ASSIGNMENT =====
  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm("⚠️ Permanently delete this assignment?\n\nAll submissions will be lost. This cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", assignmentId)
        .eq("lecturer_id", profile.id);

      if (error) throw error;

      showToast("Assignment deleted successfully!", 'success');
      fetchMyAssignments();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      showToast("Failed to delete: " + error.message, 'error');
    }
  };

  // ===== UPDATE ASSIGNMENT STATUS =====
  const handleUpdateStatus = async (assignmentId, status) => {
    try {
      const { error } = await supabase
        .from("assignments")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", assignmentId)
        .eq("lecturer_id", profile.id);

      if (error) throw error;

      showToast(`Assignment status updated to "${status}"`, 'success');
      fetchMyAssignments();
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("Failed to update status: " + error.message, 'error');
    }
  };

  // ==================== RENDER ====================
  
  if (selectedAssignment) {
    return (
      <div className="lecturer-tab-content">
        <div className="lecturer-tab-header">
          <div>
            <h2>📝 Grade Submissions</h2>
            <p style={{ fontSize: "14px", color: "#1976d2", fontWeight: "500" }}>
              {selectedAssignment.title} - {selectedAssignment.courses?.course_code || "N/A"}
            </p>
          </div>
          <button 
            className="lecturer-cancel-btn" 
            onClick={() => {
              setSelectedAssignment(null);
              setAssignmentSubmissions([]);
              setSelectedSubmissions([]);
              setGradeForm({});
            }}
          >
            ← Back to Assignments
          </button>
        </div>

        <div style={{ 
          display: "flex", 
          gap: "20px", 
          marginBottom: "20px",
          padding: "15px",
          background: "#f8f9fa",
          borderRadius: "8px",
          flexWrap: "wrap"
        }}>
          <span><strong>📊 Total Marks:</strong> {selectedAssignment.total_marks}</span>
          <span><strong>📝 Submissions:</strong> {assignmentSubmissions.length}</span>
          <span><strong>📅 Due:</strong> {new Date(selectedAssignment.due_date).toLocaleString()}</span>
        </div>

        {assignmentSubmissions.length === 0 ? (
          <div className="lecturer-empty-state" style={{ background: "white", padding: "60px", borderRadius: "12px", textAlign: "center" }}>
            <p>No submissions yet for this assignment</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
              {selectedSubmissions.length > 0 && (
                <button
                  className="lecturer-confirm-btn"
                  onClick={handleBulkGrade}
                  disabled={gradingInProgress}
                  style={{ background: "#28a745" }}
                >
                  {gradingInProgress ? "Grading..." : `✅ Bulk Grade (${selectedSubmissions.length})`}
                </button>
              )}
              <button
                className="lecturer-course-btn"
                onClick={downloadSubmissionsCSV}
                style={{ background: "#6f42c1", color: "white" }}
              >
                📥 Export CSV
              </button>
              <button
                className="lecturer-course-btn"
                onClick={downloadAllSubmissions}
                disabled={batchDownloading}
                style={{ background: "#17a2b8", color: "white" }}
              >
                {batchDownloading ? `Downloading ${batchProgress.current}/${batchProgress.total}...` : "📦 Download All Files"}
              </button>
            </div>

            <div className="lecturer-table-container" style={{ overflowX: "auto" }}>
              <table className="lecturer-data-table" style={{ minWidth: "1200px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={
                          selectedSubmissions.length === assignmentSubmissions.filter(s => s.status === "submitted").length &&
                          assignmentSubmissions.filter(s => s.status === "submitted").length > 0
                        }
                        onChange={handleSelectAllSubmissions}
                        title="Select all ungraded"
                      />
                    </th>
                    <th>Student</th>
                    <th>Registration</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                    <th>Files</th>
                    <th>Marks</th>
                    <th>Feedback</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentSubmissions.map((submission) => (
                    <tr key={submission.submission_id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedSubmissions.includes(submission.submission_id)}
                          onChange={() => handleToggleSubmissionSelection(submission.submission_id)}
                          disabled={submission.status === "graded"}
                        />
                      </td>
                      <td>
                        <strong>{submission.student_name || "Unknown Student"}</strong>
                        <br />
                        <span style={{ fontSize: "11px", color: "#999" }}>{submission.student_email || "No email"}</span>
                      </td>
                      <td>{submission.registration_number || "N/A"}</td>
                      <td>
                        {submission.submission_date ? (
                          <>
                            {new Date(submission.submission_date).toLocaleDateString()}
                            <br />
                            <span style={{ fontSize: "11px", color: "#999" }}>
                              {new Date(submission.submission_date).toLocaleTimeString()}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: "#999" }}>Not submitted</span>
                        )}
                      </td>
                      <td>
                        <span className={`lecturer-status-badge ${submission.status || "submitted"}`}>
                          {submission.status === "graded" ? "✅ Graded" : "📤 Submitted"}
                        </span>
                      </td>
                      <td>
                        {submission.file_download_urls && submission.file_download_urls.length > 0 ? (
                          <div>
                            {submission.file_download_urls.map((url, idx) => {
                              const displayName = `File ${idx + 1}`;
                              return (
                                <button
                                  key={idx}
                                  className="lecturer-course-btn"
                                  onClick={() => downloadFile(url, `${submission.student_name}_${displayName}`, submission.submission_id)}
                                  style={{ fontSize: "11px", padding: "2px 10px", margin: "2px", background: "#1976d2", color: "white" }}
                                >
                                  📥 {displayName}
                                </button>
                              );
                            })}
                            {submission.file_download_urls.length > 1 && (
                              <button
                                className="lecturer-course-btn"
                                onClick={() => downloadAllFilesForSubmission(submission)}
                                disabled={batchDownloading}
                                style={{ fontSize: "11px", padding: "2px 10px", margin: "2px", background: "#28a745", color: "white" }}
                              >
                                📦 All
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#999", fontSize: "12px" }}>No files</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={selectedAssignment.total_marks}
                          step="0.5"
                          value={gradeForm[submission.submission_id]?.marks || ""}
                          onChange={(e) => setGradeForm(prev => ({
                            ...prev,
                            [submission.submission_id]: { ...prev[submission.submission_id], marks: e.target.value }
                          }))}
                          placeholder="Marks"
                          style={{
                            width: "70px",
                            padding: "4px 8px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={gradeForm[submission.submission_id]?.feedback || ""}
                          onChange={(e) => setGradeForm(prev => ({
                            ...prev,
                            [submission.submission_id]: { ...prev[submission.submission_id], feedback: e.target.value }
                          }))}
                          placeholder="Feedback"
                          style={{
                            width: "120px",
                            padding: "4px 8px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            fontSize: "12px",
                          }}
                        />
                      </td>
                      <td>
                        {(submission.status === "submitted" || submission.status === "graded") && (
                          <button
                            className="lecturer-confirm-btn"
                            onClick={() => {
                              const marks = parseFloat(gradeForm[submission.submission_id]?.marks);
                              if (isNaN(marks)) {
                                showToast("Please enter valid marks", 'error');
                                return;
                              }
                              handleGradeSubmission(
                                submission.submission_id,
                                marks,
                                gradeForm[submission.submission_id]?.feedback || ""
                              );
                            }}
                            disabled={gradingInProgress}
                            style={{ fontSize: "12px", padding: "6px 14px" }}
                          >
                            {submission.status === "graded" ? "Update" : "Grade"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  // ==================== ASSIGNMENT LIST VIEW ====================
  
  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <h2>📝 My Assignments</h2>
        <button className="lecturer-add-btn" onClick={() => setShowAssignmentModal(true)}>
          + Create Assignment
        </button>
      </div>

      <div className="lecturer-stats-grid" style={{ marginBottom: "24px" }}>
        <div className="lecturer-stat-card" style={{ padding: "16px" }}>
          <h3 style={{ fontSize: "22px" }}>{myAssignments.length}</h3>
          <p>Total Assignments</p>
        </div>
        <div className="lecturer-stat-card lecturer-stat-warning" style={{ padding: "16px" }}>
          <h3 style={{ fontSize: "22px" }}>{myAssignments.reduce((sum, a) => sum + a.pending_count, 0)}</h3>
          <p>Pending Grading</p>
        </div>
        <div className="lecturer-stat-card lecturer-stat-success" style={{ padding: "16px" }}>
          <h3 style={{ fontSize: "22px" }}>{myAssignments.reduce((sum, a) => sum + a.graded_count, 0)}</h3>
          <p>Graded Submissions</p>
        </div>
      </div>

      {loading ? (
        <div className="lecturer-loading-content">
          <div className="lecturer-spinner"></div>
          <p>Loading assignments...</p>
        </div>
      ) : myAssignments.length === 0 ? (
        <div className="lecturer-empty-state" style={{ background: "white", padding: "60px", borderRadius: "12px", textAlign: "center" }}>
          <p>No assignments created yet</p>
          <button className="lecturer-add-btn" onClick={() => setShowAssignmentModal(true)}>
            Create Your First Assignment
          </button>
        </div>
      ) : (
        <div className="lecturer-table-container">
          <table className="lecturer-data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Course</th>
                <th>Due Date</th>
                <th>Marks</th>
                <th>Status</th>
                <th>Cohort</th>
                <th>Submissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    <strong>{assignment.title}</strong>
                    {assignment.description && (
                      <p className="lecturer-course-description" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>
                        {assignment.description.substring(0, 60)}...
                      </p>
                    )}
                  </td>
                  <td>
                    {assignment.courses?.course_code}
                    <br />
                    <span className="lecturer-dept-badge">{assignment.courses?.department_code}</span>
                  </td>
                  <td>
                    {new Date(assignment.due_date).toLocaleDateString()}
                    <br />
                    <span style={{ fontSize: "11px", color: "#999" }}>
                      {new Date(assignment.due_date).toLocaleTimeString()}
                    </span>
                  </td>
                  <td>{assignment.total_marks}</td>
                  <td>
                    <span className={`lecturer-status-badge ${assignment.status}`}>
                      {assignment.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "12px" }}>
                    {assignment.academic_year || "N/A"}
                    <br />
                    Y{assignment.year_of_study || "?"} S{assignment.semester || "?"}
                  </td>
                  <td>
                    <div style={{ fontSize: "13px" }}>
                      <span style={{ color: "#28a745" }}>📤 {assignment.submitted_count || 0}</span>
                      <br />
                      <span style={{ color: "#1976d2" }}>✅ {assignment.graded_count || 0}</span>
                      {assignment.pending_count > 0 && (
                        <>
                          <br />
                          <span style={{ color: "#ef6c00" }}>⏳ {assignment.pending_count}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <button 
                        className="lecturer-course-btn"
                        onClick={() => handleViewSubmissions(assignment)}
                        style={{ 
                          background: "#6f42c1", 
                          color: "white", 
                          fontSize: "12px", 
                          padding: "4px 12px",
                          width: "100%"
                        }}
                      >
                        {assignment.pending_count > 0 ? `📝 Grade (${assignment.pending_count})` : "📝 View Submissions"}
                      </button>
                      
                      {/* Status Actions Dropdown */}
                      <div className="lecturer-actions-dropdown" style={{ width: "100%" }}>
                        <button className="lecturer-actions-toggle" style={{ width: "100%", fontSize: "12px" }}>
                          Actions ▼
                        </button>
                        <div className="lecturer-actions-menu">
                          <button 
                            className="lecturer-action-item" 
                            onClick={() => handleUpdateStatus(assignment.id, "published")}
                            disabled={assignment.status === "published"}
                          >
                            📤 Publish
                          </button>
                          <button 
                            className="lecturer-action-item" 
                            onClick={() => handleUpdateStatus(assignment.id, "draft")}
                            disabled={assignment.status === "draft"}
                          >
                            📝 Draft
                          </button>
                          <button 
                            className="lecturer-action-item" 
                            onClick={() => handleUpdateStatus(assignment.id, "closed")}
                            disabled={assignment.status === "closed"}
                          >
                            🔒 Close
                          </button>
                          <button 
                            className="lecturer-action-item" 
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            style={{ color: "#dc3545" }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ==================== CREATE ASSIGNMENT MODAL ==================== */}
      {showAssignmentModal && (
        <div className="lecturer-modal-overlay" onClick={() => setShowAssignmentModal(false)}>
          <div className="lecturer-modal" style={{ maxWidth: "700px", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3>Create New Assignment</h3>

            <div style={{ background: "#f0fff4", padding: "16px", borderRadius: "10px", marginBottom: "20px", border: "2px solid #388e3c" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#388e3c" }}>🎯 Target Cohort</h4>
              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Academic Year *</label>
                  <input
                    type="text"
                    value={selectedCohort.academic_year}
                    onChange={(e) => setSelectedCohort({ ...selectedCohort, academic_year: e.target.value.trim() })}
                    placeholder="e.g. 2025/2029"
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Year *</label>
                  <select
                    value={selectedCohort.year_of_study}
                    onChange={(e) => setSelectedCohort({ ...selectedCohort, year_of_study: parseInt(e.target.value) })}
                    className="lecturer-form-select"
                  >
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Semester *</label>
                  <select
                    value={selectedCohort.semester}
                    onChange={(e) => setSelectedCohort({ ...selectedCohort, semester: parseInt(e.target.value) })}
                    className="lecturer-form-select"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>
              {cohortError && <p style={{ color: "#d32f2f", marginTop: "8px" }}>⚠️ {cohortError}</p>}
            </div>

            <div className="lecturer-modal-form">
              <div className="lecturer-form-group">
                <label>Course *</label>
                <select
                  value={newAssignment.course_id}
                  onChange={(e) => setNewAssignment({ ...newAssignment, course_id: e.target.value })}
                  className="lecturer-form-select"
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lecturer-form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  placeholder="Assignment title"
                  className="lecturer-form-input"
                />
              </div>

              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Due Date *</label>
                  <input
                    type="datetime-local"
                    value={newAssignment.due_date}
                    onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Total Marks *</label>
                  <input
                    type="number"
                    value={newAssignment.total_marks}
                    onChange={(e) => setNewAssignment({ ...newAssignment, total_marks: parseInt(e.target.value) || 100 })}
                    min="1"
                    className="lecturer-form-input"
                  />
                </div>
              </div>

              <div className="lecturer-form-group">
                <label>Description</label>
                <textarea
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                  placeholder="Assignment description"
                  rows="2"
                  className="lecturer-form-textarea"
                />
              </div>

              <div className="lecturer-form-group">
                <label>Instructions</label>
                <textarea
                  value={newAssignment.instructions}
                  onChange={(e) => setNewAssignment({ ...newAssignment, instructions: e.target.value })}
                  placeholder="Instructions for students"
                  rows="2"
                  className="lecturer-form-textarea"
                />
              </div>

              <div className="lecturer-form-group">
                <label>Assignment Files (Optional)</label>
                <div
                  className="lecturer-file-upload-area"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed #1976d2",
                    padding: "30px",
                    textAlign: "center",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: "#f8f9fa"
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={(e) => setAssignmentFiles(Array.from(e.target.files || []))}
                    style={{ display: "none" }}
                  />
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📤</div>
                  <p><strong>Drop files here or click to browse</strong></p>
                  <p style={{ fontSize: "12px", color: "#999" }}>PDF, DOC, DOCX, ZIP, Images</p>
                </div>

                {uploadingFiles && (
                  <div className="lecturer-upload-progress" style={{ marginTop: "12px" }}>
                    <div className="lecturer-progress-bar" style={{ background: "#e0e0e0", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                      <div className="lecturer-progress-fill" style={{ width: `${uploadProgress}%`, background: "#1976d2", height: "100%", transition: "width 0.3s" }}></div>
                    </div>
                    <p style={{ textAlign: "center", marginTop: "4px", fontSize: "13px" }}>{uploadProgress}%</p>
                  </div>
                )}

                {assignmentFiles.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <h4 style={{ fontSize: "14px" }}>Selected Files ({assignmentFiles.length})</h4>
                    {assignmentFiles.map((file, index) => (
                      <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "#f1f3f5", borderRadius: "6px", marginBottom: "4px" }}>
                        <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button onClick={() => setAssignmentFiles(prev => prev.filter((_, i) => i !== index))} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lecturer-modal-actions">
                <button className="lecturer-cancel-btn" onClick={() => setShowAssignmentModal(false)}>
                  Cancel
                </button>
                <button className="lecturer-confirm-btn" onClick={handleCreateAssignment}>
                  Create Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerAssignmentsManager;