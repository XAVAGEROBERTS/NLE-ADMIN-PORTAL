// LecturerExamsManager.jsx - COMPLETE WITH TEXT ANSWERS MODAL (USING COURSE ALLOCATIONS)
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';

const LecturerExamsManager = ({ profile, courses, programs, programsLoading, showToast }) => {
  // ==================== STATE ====================
  
  // Exam list
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Exam creation
  const [showExamsModal, setShowExamsModal] = useState(false);
  const [examFiles, setExamFiles] = useState([]);
  const [uploadingExamFiles, setUploadingExamFiles] = useState(false);
  const [examUploadProgress, setExamUploadProgress] = useState(0);
  const examFileInputRef = useRef(null);
  
  // ===== TIME VALIDATION STATE =====
  const [timeValidationError, setTimeValidationError] = useState("");
  const [editTimeValidationError, setEditTimeValidationError] = useState("");
  
  // New Exam Form
  const [newExam, setNewExam] = useState({
    course_id: "",
    title: "",
    description: "",
    exam_type: "written",
    submission_type: "both",
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 16),
    total_marks: 100,
    venue: "",
    status: "published",
  });
  
  // Exam targeting
  const [examTargetProgram, setExamTargetProgram] = useState("");
  const [examTargetCohort, setExamTargetCohort] = useState({
    academic_year: "",
    year_of_study: 1,
    semester: 1,
  });
  const [examCohortError, setExamCohortError] = useState("");
  const [examFilteredCourses, setExamFilteredCourses] = useState([]);
  
  // ===== GRADING STATES =====
  const [selectedExamForGrading, setSelectedExamForGrading] = useState(null);
  const [examSubmissions, setExamSubmissions] = useState([]);
  const [examGradeForm, setExamGradeForm] = useState({});
  const [examGradingInProgress, setExamGradingInProgress] = useState(false);
  
  // ===== TEXT ANSWERS MODAL =====
  const [selectedTextAnswer, setSelectedTextAnswer] = useState(null);
  const [showTextAnswersModal, setShowTextAnswersModal] = useState(false);
  const [exportingTextAnswers, setExportingTextAnswers] = useState(false);
  
  // ===== EDIT EXAM =====
  const [editingExam, setEditingExam] = useState(null);
  const [editExam, setEditExam] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    venue: "",
    status: "",
    total_marks: 100,
    exam_type: "online",
    submission_type: "both",
  });
  
  // ===== FILE DOWNLOAD =====
  const [downloadingFile, setDownloadingFile] = useState(null);

  // ==================== EFFECTS ====================
  
  // Load exams when component mounts or profile changes
  useEffect(() => {
    if (profile?.id) {
      fetchExams();
    }
  }, [profile?.id]);

// Filter courses when program changes - USING ALLOCATIONS (FIXED)
useEffect(() => {
  const fetchAllocatedCourses = async () => {
    if (!examTargetProgram || !profile?.id) {
      setExamFilteredCourses([]);
      return;
    }

    try {
      // Get the selected program
      const selectedProg = programs.find((p) => p.id === examTargetProgram);
      if (!selectedProg) {
        console.error("❌ Selected program not found");
        setExamFilteredCourses([]);
        return;
      }

      console.log(`🔍 Fetching allocated courses for lecturer ${profile.id}`);
      console.log(`📋 Selected program:`, selectedProg);

      // First, get the course allocations
      const { data: allocations, error: allocError } = await supabase
        .from("course_allocations")
        .select(`
          id,
          course_id,
          academic_year,
          semester,
          status,
          lecturer_id,
          courses:course_id (
            id,
            course_code,
            course_name,
            department_code,
            program,
            program_code,
            is_active,
            credits,
            year,
            semester
          )
        `)
        .eq("lecturer_id", profile.id)
        .eq("status", "approved");

      if (allocError) {
        console.error("❌ Error fetching allocations:", allocError);
        setExamFilteredCourses([]);
        return;
      }

      if (!allocations || allocations.length === 0) {
        console.log("⚠️ No approved allocations found");
        setExamFilteredCourses([]);
        return;
      }

      console.log(`📋 Found ${allocations.length} approved allocations`);
      console.log(`📋 Allocations details:`, allocations);

      // Extract all courses from allocations
      const allAllocatedCourses = allocations
        .map(a => a.courses)
        .filter(course => course && course.is_active);

      console.log(`📚 All active allocated courses (${allAllocatedCourses.length}):`, 
        allAllocatedCourses.map(c => ({
          id: c.id,
          code: c.course_code,
          name: c.course_name,
          program: c.program,
          program_code: c.program_code,
          dept: c.department_code
        }))
      );

      // If no program filtering is possible, show all allocated courses
      if (!allAllocatedCourses.length) {
        setExamFilteredCourses([]);
        return;
      }

      // Check if courses have program information
      const hasProgramInfo = allAllocatedCourses.some(c => c.program || c.program_code);
      
      if (!hasProgramInfo) {
        console.log("ℹ️ Courses don't have program info, showing all allocated courses");
        setExamFilteredCourses(allAllocatedCourses);
        return;
      }

      // Try to match by program - check multiple possible fields
      const filteredCourses = allAllocatedCourses.filter(course => {
        // Check all possible program fields
        const courseProgram = course.program || course.program_code || '';
        const selectedProgramName = selectedProg.name || '';
        const selectedProgramCode = selectedProg.code || '';
        
        // Case-insensitive comparison
        const courseProgramLower = courseProgram.toLowerCase();
        const selectedNameLower = selectedProgramName.toLowerCase();
        const selectedCodeLower = selectedProgramCode.toLowerCase();
        
        return courseProgramLower === selectedNameLower || 
               courseProgramLower === selectedCodeLower ||
               courseProgramLower.includes(selectedCodeLower) ||
               selectedNameLower.includes(courseProgramLower);
      });

      console.log(`🎯 Filtered to ${filteredCourses.length} courses matching program ${selectedProg.code}`);
      
      // If filtering resulted in no courses, show all allocated courses instead
      if (filteredCourses.length === 0) {
        console.log("⚠️ No courses match the selected program, showing all allocated courses");
        setExamFilteredCourses(allAllocatedCourses);
      } else {
        setExamFilteredCourses(filteredCourses);
      }
      
    } catch (err) {
      console.error("❌ Error in fetchAllocatedCourses:", err);
      setExamFilteredCourses([]);
    }
  };

  fetchAllocatedCourses();
}, [examTargetProgram, profile?.id, programs]);
  // ===== REAL-TIME TIME VALIDATION FOR NEW EXAM =====
  useEffect(() => {
    validateTimes(newExam.start_time, newExam.end_time, setTimeValidationError);
  }, [newExam.start_time, newExam.end_time]);

  // ===== REAL-TIME TIME VALIDATION FOR EDIT EXAM =====
  useEffect(() => {
    if (editingExam) {
      validateTimes(editExam.start_time, editExam.end_time, setEditTimeValidationError);
    }
  }, [editExam.start_time, editExam.end_time, editingExam]);

  // ===== VALIDATION HELPER =====
  const validateTimes = (startTime, endTime, setErrorFn) => {
    if (!startTime || !endTime) {
      setErrorFn("");
      return;
    }
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (end <= start) {
      setErrorFn("❌ End time must be after start time!");
    } else {
      setErrorFn("");
    }
  };

  // ==================== FETCH EXAMS (USING COURSE ALLOCATIONS) ====================
  const fetchExams = async () => {
    if (!profile?.id) {
      console.warn("⚠️ No profile ID available");
      return;
    }
    
    setLoading(true);
    console.log("🔍 Fetching exams for lecturer:", profile.id);

    try {
      // STEP 1: Get approved course allocations for this lecturer
      const { data: allocations, error: allocationsError } = await supabase
        .from("course_allocations")
        .select(`
          id,
          course_id,
          status,
          academic_year,
          semester,
          courses:course_id (
            id,
            course_code,
            course_name,
            department_code,
            is_active,
            program_code,
            credits
          )
        `)
        .eq("lecturer_id", profile.id)
        .eq("status", "approved");

      if (allocationsError) {
        console.error("❌ Error fetching course allocations:", allocationsError);
        setExams([]);
        setLoading(false);
        return;
      }

      console.log(`📚 Course allocations found: ${allocations?.length || 0}`);

      if (!allocations || allocations.length === 0) {
        console.warn("⚠️ No approved course allocations found for this lecturer");
        setExams([]);
        setLoading(false);
        return;
      }

      // Extract course IDs from allocations
      const courseIds = allocations
        .map(a => a.course_id)
        .filter(id => id);

      console.log(`📋 Course IDs from allocations:`, courseIds);

      if (courseIds.length === 0) {
        console.warn("⚠️ No valid course IDs found in allocations");
        setExams([]);
        setLoading(false);
        return;
      }

      // STEP 2: Fetch exams for those courses
      const { data: examsData, error: examsError } = await supabase
        .from("examinations")
        .select(`
          *,
          courses:course_id (
            id,
            course_code,
            course_name,
            department_code,
            program_code
          )
        `)
        .in("course_id", courseIds);

      if (examsError) {
        console.error("❌ Error fetching exams:", examsError);
        setExams([]);
        setLoading(false);
        return;
      }

      console.log(`📝 Exams found: ${examsData?.length || 0}`);

      if (!examsData || examsData.length === 0) {
        console.log("ℹ️ No exams found for these courses");
        setExams([]);
        setLoading(false);
        return;
      }

      // STEP 3: Get submission stats for each exam
      const examIds = examsData.map((e) => e.id);
      const { data: submissions, error: submissionsError } = await supabase
        .from("exam_submissions")
        .select("exam_id, status")
        .in("exam_id", examIds);

      if (submissionsError) {
        console.warn("⚠️ Error fetching submission stats:", submissionsError);
      }

      const statsMap = {};
      examIds.forEach((id) => {
        statsMap[id] = { submitted: 0, graded: 0, pending: 0 };
      });

      (submissions || []).forEach((sub) => {
        const stats = statsMap[sub.exam_id];
        if (stats) {
          if (sub.status === "submitted" || sub.status === "graded") {
            stats.submitted++;
          }
          if (sub.status === "graded") {
            stats.graded++;
          }
          stats.pending = stats.submitted - stats.graded;
        }
      });

      // STEP 4: Process exams with stats and status
      const now = new Date();
      const processedExams = examsData.map((exam) => {
        const startDate = new Date(exam.start_time);
        const endDate = new Date(exam.end_time);
        const isActive = now >= startDate && now <= endDate;

        // Find the allocation for this course
        const allocation = allocations.find(a => a.course_id === exam.course_id);

        return {
          ...exam,
          courses: exam.courses || {},
          exam_id: exam.id,
          isActive: isActive,
          _startDate: startDate,
          _endDate: endDate,
          submitted: statsMap[exam.id]?.submitted || 0,
          graded: statsMap[exam.id]?.graded || 0,
          pending: statsMap[exam.id]?.pending || 0,
          // Include allocation info
          allocation_academic_year: allocation?.academic_year,
          allocation_semester: allocation?.semester,
          allocation_status: allocation?.status,
        };
      });

      // STEP 5: Sort exams - active first, then by start time (latest first)
      const sortedExams = processedExams.sort((a, b) => {
        // Active exams first
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        
        // Then sort by start time - latest first
        return new Date(b.start_time) - new Date(a.start_time);
      });

      console.log(`✅ Successfully loaded ${sortedExams.length} exams`);
      console.log(`📊 Exam status breakdown:`, {
        total: sortedExams.length,
        active: sortedExams.filter(e => e.isActive).length,
        upcoming: sortedExams.filter(e => !e.isActive && new Date(e.start_time) > now).length,
        ended: sortedExams.filter(e => !e.isActive && new Date(e.end_time) < now).length
      });
      
      setExams(sortedExams);
      
    } catch (error) {
      console.error("❌ Unexpected error in fetchExams:", error);
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  // ==================== FETCH EXAM SUBMISSIONS ====================
  
  const fetchExamSubmissions = async (examId) => {
    if (!examId) {
      setExamSubmissions([]);
      return;
    }
    
    try {
      console.log("📝 Fetching submissions for exam:", examId);
      
      // Fetch submissions
      const { data: submissions, error } = await supabase
        .from("exam_submissions")
        .select("*")
        .eq("exam_id", examId)
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("Error fetching submissions:", error);
        setExamSubmissions([]);
        return;
      }

      if (!submissions || submissions.length === 0) {
        console.log("No submissions found for this exam");
        setExamSubmissions([]);
        return;
      }

      // Get unique student UUIDs
      const studentUuids = [...new Set(submissions.map((s) => s.student_id))];
      console.log(`Found ${submissions.length} submissions from ${studentUuids.length} students`);

      // Fetch student details
      const { data: students, error: studentError } = await supabase
        .from("students")
        .select("id, full_name, email, student_id")
        .in("id", studentUuids);

      if (studentError) {
        console.error("Error fetching students:", studentError);
      }

      const studentMap = {};
      students?.forEach((stu) => {
        studentMap[stu.id] = {
          full_name: stu.full_name || "Unknown Student",
          email: stu.email || "No email",
          registration_number: stu.student_id || "N/A",
        };
      });

      // Process submissions with student info and generate download URLs
      const processed = submissions.map((sub) => {
        const student = studentMap[sub.student_id] || {
          full_name: "Unknown Student",
          email: "No email",
          registration_number: "N/A",
        };

        // Generate download URLs for answer files
        const answerFileUrls = (sub.answer_files || [])
          .map((filePath) => {
            if (!filePath) return null;
            if (filePath.startsWith("http")) return filePath;
            
            const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
            try {
              const { data: urlData } = supabase.storage
                .from("Student exam")
                .getPublicUrl(cleanPath);
              return urlData.publicUrl;
            } catch (err) {
              console.warn("Error generating URL for:", filePath, err);
              return null;
            }
          })
          .filter((url) => url);

        return {
          id: sub.id,
          student_name: student.full_name,
          student_email: student.email,
          registration_number: student.registration_number,
          submitted_at: sub.submitted_at,
          status: sub.status || "submitted",
          answer_files: sub.answer_files || [],
          file_download_urls: answerFileUrls,
          answer_text: sub.answer_text || "",
          total_marks_obtained: sub.total_marks_obtained || null,
          feedback: sub.feedback || "",
          graded_at: sub.graded_at || null,
        };
      });

      setExamSubmissions(processed);
      console.log(`✅ Processed ${processed.length} submissions`);

      // Initialize grading form
      const initialForm = {};
      processed.forEach((sub) => {
        initialForm[sub.id] = {
          marks: sub.total_marks_obtained?.toString() || "",
          feedback: sub.feedback || "",
        };
      });
      setExamGradeForm(initialForm);
      
    } catch (err) {
      console.error("Error in fetchExamSubmissions:", err);
      setExamSubmissions([]);
    }
  };

  // ==================== FILE DOWNLOAD ====================
  
  const downloadFile = async (fileUrl, fileName, submissionId = null, bucket = null) => {
    try {
      const downloadKey = submissionId ? `${submissionId}_${fileName}` : fileName;
      setDownloadingFile(downloadKey);

      console.log("📥 Download attempt:", { fileUrl, fileName, submissionId, bucket });

      // If fileUrl is already a full URL, open it directly
      if (fileUrl.startsWith("http")) {
        console.log("🔗 File is already a full URL, opening directly");
        window.open(fileUrl, "_blank");
        setDownloadingFile(null);
        return;
      }

      // Determine which bucket to use
      let bucketName = bucket || "assignments";
      let filePath = fileUrl;

      if (bucket) {
        bucketName = bucket;
      } else if (fileUrl.includes("/storage/v1/object/public/")) {
        const match = fileUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
        if (match) {
          bucketName = match[1];
          filePath = match[2];
        }
      } else if (fileUrl.includes("Student exam/")) {
        bucketName = "Student exam";
        const match = fileUrl.match(/Student exam\/(.*)/);
        if (match && match[1]) filePath = match[1];
      } else if (fileUrl.includes("Lecturer exam/")) {
        bucketName = "Lecturer exam";
        const match = fileUrl.match(/Lecturer exam\/(.*)/);
        if (match && match[1]) filePath = match[1];
      }

      // Clean the file path
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

      console.log(`📂 Final: bucket=${bucketName}, path=${filePath}`);

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      console.log("🌐 Generated public URL:", publicUrl);

      // Try to download using the public URL
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
          showToast(`Downloaded: ${fileName}`, 'success');
          setDownloadingFile(null);
          return;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (fetchError) {
        console.warn("⚠️ Fetch error, trying storage API:", fetchError.message);
        
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
            showToast(`Downloaded: ${fileName}`, 'success');
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

  // ==================== TEXT ANSWERS EXPORT ====================
  
  const exportTextAnswersToWord = async () => {
    const textSubmissions = examSubmissions.filter(
      (sub) => sub.answer_text && sub.answer_text.length > 0
    );

    if (textSubmissions.length === 0) {
      showToast("No text answers found to export.", 'info');
      return;
    }

    setExportingTextAnswers(true);

    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `Exam Text Answers - ${selectedExamForGrading?.title || "Exam"}`,
                  size: 28,
                  bold: true,
                  font: "Arial",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Course: ${selectedExamForGrading?.courses?.course_code || "N/A"} - ${selectedExamForGrading?.courses?.course_name || "N/A"}`,
                  size: 22,
                  font: "Arial",
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Total Submissions with Text: ${textSubmissions.length}`,
                  size: 22,
                  font: "Arial",
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "=".repeat(80),
                  size: 18,
                  font: "Arial",
                }),
              ],
              spacing: { after: 400 },
            }),
            ...textSubmissions.flatMap((sub, index) => {
              const children = [];

              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${index + 1}. ${sub.student_name || "Unknown Student"}`,
                      size: 24,
                      bold: true,
                      font: "Arial",
                    }),
                  ],
                  spacing: { before: 400, after: 100 },
                })
              );

              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `   Registration: ${sub.registration_number || "N/A"}  |  Email: ${sub.student_email || "N/A"}  |  Submitted: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "N/A"}`,
                      size: 18,
                      font: "Arial",
                      color: "666666",
                    }),
                  ],
                  spacing: { after: 200 },
                })
              );

              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `   Answer:`,
                      size: 20,
                      bold: true,
                      font: "Arial",
                    }),
                  ],
                  spacing: { after: 100 },
                })
              );

              const answerLines = (sub.answer_text || "").split("\n");
              answerLines.forEach((line) => {
                if (line.trim() === "") {
                  children.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "",
                          size: 20,
                          font: "Arial",
                        }),
                      ],
                      spacing: { after: 50 },
                    })
                  );
                } else {
                  children.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `   ${line}`,
                          size: 20,
                          font: "Arial",
                        }),
                      ],
                      spacing: { after: 50 },
                    })
                  );
                }
              });

              const statusText = sub.status === "graded" 
                ? `✓ Graded (${sub.total_marks_obtained || 0} marks)` 
                : "⏳ Pending Grading";
              
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `   Status: ${statusText}`,
                      size: 18,
                      font: "Arial",
                      color: sub.status === "graded" ? "00aa00" : "cc8800",
                    }),
                  ],
                  spacing: { before: 100, after: 200 },
                })
              );

              if (index < textSubmissions.length - 1) {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "-".repeat(60),
                        size: 16,
                        font: "Arial",
                        color: "cccccc",
                      }),
                    ],
                    spacing: { before: 200, after: 200 },
                  })
                );
              }

              return children;
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated on: ${new Date().toLocaleString()}`,
                  size: 16,
                  font: "Arial",
                  color: "999999",
                }),
              ],
              spacing: { before: 600, after: 100 },
              alignment: AlignmentType.CENTER,
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Text_Answers_${selectedExamForGrading?.title || "exam"}_${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      showToast(`✅ ${textSubmissions.length} text answers exported successfully!`, 'success');

    } catch (error) {
      console.error("Error exporting Word document:", error);
      
      // Fallback: Try a simpler approach using Blob
      try {
        console.log("Trying fallback export method...");
        let content = `Exam Text Answers - ${selectedExamForGrading?.title || "Exam"}\n`;
        content += `${"=".repeat(60)}\n\n`;
        content += `Course: ${selectedExamForGrading?.courses?.course_code || "N/A"} - ${selectedExamForGrading?.courses?.course_name || "N/A"}\n`;
        content += `Total Submissions: ${textSubmissions.length}\n\n`;
        content += `${"-".repeat(60)}\n\n`;

        textSubmissions.forEach((sub, index) => {
          content += `${index + 1}. ${sub.student_name || "Unknown Student"}\n`;
          content += `   Registration: ${sub.registration_number || "N/A"}\n`;
          content += `   Email: ${sub.student_email || "N/A"}\n`;
          content += `   Submitted: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "N/A"}\n`;
          content += `   Answer:\n   ${sub.answer_text || "No answer provided"}\n\n`;
          content += `   Status: ${sub.status === "graded" ? "Graded" : "Pending Grading"}\n`;
          content += `\n${"-".repeat(40)}\n\n`;
        });

        content += `\nGenerated on: ${new Date().toLocaleString()}`;

        const blob = new Blob([content], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Text_Answers_${selectedExamForGrading?.title || "exam"}_${new Date().toISOString().split("T")[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        showToast(`✅ ${textSubmissions.length} text answers exported as TXT file!`, 'success');
      } catch (fallbackError) {
        console.error("Fallback export also failed:", fallbackError);
        showToast("Failed to export. Please try again.", 'error');
      }
    } finally {
      setExportingTextAnswers(false);
    }
  };

  // ==================== EXAM CRUD OPERATIONS ====================
  
  const uploadExamFiles = async (files) => {
    if (!files || files.length === 0) return [];
    const uploadedPaths = [];
    setUploadingExamFiles(true);
    setExamUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const originalName = file.name;
        const timestamp = Date.now();
        const safeName = originalName.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `${timestamp}_${safeName}`;
        const filePath = `exams/${profile.id}/${fileName}`;

        setExamUploadProgress(Math.round(((i + 1) / files.length) * 100));

        const { error } = await supabase.storage
          .from("Lecturer exam")
          .upload(filePath, file, {
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });

        if (error) {
          console.error(`Failed to upload ${originalName}:`, error);
          showToast(`Failed to upload "${originalName}"`, 'error');
          continue;
        }

        uploadedPaths.push(filePath);
      }
      showToast(`✅ Uploaded ${uploadedPaths.length} exam file(s)!`, 'success');
      return uploadedPaths;
    } catch (error) {
      console.error("Exam upload error:", error);
      showToast("Upload failed: " + error.message, 'error');
      return [];
    } finally {
      setUploadingExamFiles(false);
      setExamUploadProgress(0);
    }
  };

  // ===== VALIDATE END TIME (must be after start time) =====
  const validateExamTimes = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (end <= start) {
      showToast("❌ End time must be after start time!", 'error');
      return false;
    }
    return true;
  };

  // ===== HANDLE ADD EXAM =====
  const handleAddExam = async () => {
    // ===== VALIDATION =====
    if (!examTargetProgram) {
      setExamCohortError("Please select a Program");
      return;
    }
    if (!examTargetCohort.academic_year.trim()) {
      setExamCohortError("Please enter Academic Year (e.g. 2025/2029)");
      return;
    }
    if (!newExam.course_id) {
      showToast("Please select a Course", "error");
      return;
    }
    if (!newExam.title?.trim()) {
      showToast("Please enter an exam title", "error");
      return;
    }
    if (!newExam.start_time || !newExam.end_time) {
      showToast("Please set both start and end time", "error");
      return;
    }

    // ===== VERIFY COURSE ALLOCATION =====
    try {
      const { data: allocation, error: allocationError } = await supabase
        .from("course_allocations")
        .select("id, status, academic_year, semester")
        .eq("course_id", newExam.course_id)
        .eq("lecturer_id", profile.id)
        .eq("status", "approved")
        .maybeSingle();

      if (allocationError) {
        console.error("Error checking allocation:", allocationError);
        showToast("Failed to verify course allocation", "error");
        return;
      }

      if (!allocation) {
        showToast("⚠️ You are not allocated to teach this course. Please contact the HOD.", "error");
        return;
      }

      console.log("✅ Verified allocation:", allocation);

    } catch (err) {
      console.error("Error in allocation verification:", err);
      showToast("Error verifying course allocation", "error");
      return;
    }

    // ===== VALIDATE END TIME IS AFTER START TIME =====
    if (!validateExamTimes(newExam.start_time, newExam.end_time)) {
      return;
    }

    try {
      // Upload files if needed
      let uploadedExamFiles = [];
      if (newExam.submission_type === "file" || newExam.submission_type === "both") {
        if (examFiles.length > 0) {
          uploadedExamFiles = await uploadExamFiles(examFiles);
        }
      }

      // Calculate duration
      const start = new Date(newExam.start_time);
      const end = new Date(newExam.end_time);
      const durationMinutes = Math.round((end - start) / 60000);

      if (durationMinutes <= 0) {
        showToast("End time must be after start time", "error");
        return;
      }

      // ===== BUILD PAYLOAD =====
      const examData = {
        course_id: newExam.course_id,
        title: newExam.title.trim(),
        start_time: new Date(newExam.start_time).toISOString(),
        end_time: new Date(newExam.end_time).toISOString(),
        duration_minutes: durationMinutes,
        total_marks: Number(newExam.total_marks) || 100,
        description: newExam.description?.trim() || null,
        instructions: "Complete all questions within the given time frame.",
        exam_type: newExam.exam_type || "written",
        submission_type: newExam.submission_type || "both",
        status: "published",
        venue: newExam.venue?.trim() || null,
        location: newExam.venue?.trim() || null,
        passing_marks: Math.round((Number(newExam.total_marks) || 100) * 0.4),
        target_academic_year: examTargetCohort.academic_year.trim(),
        target_year_of_study: Number(examTargetCohort.year_of_study) || 1,
        target_semester: Number(examTargetCohort.semester) || 1,
        target_program_id: examTargetProgram,
        exam_files: uploadedExamFiles.length > 0 ? uploadedExamFiles : [],
      };

      console.log("📤 Sending exam data:", examData);

      const { data, error } = await supabase
        .from("examinations")
        .insert([examData])
        .select()
        .single();

      if (error) {
        console.error("❌ Supabase insert error:", error);
        showToast("Error: " + (error.message || error.details || "Failed to schedule exam"), "error");
        return;
      }

      console.log("✅ Exam created successfully:", data);
      showToast("✅ Exam scheduled successfully!", "success");

      // Reset form
      setShowExamsModal(false);
      setNewExam({
        course_id: "",
        title: "",
        description: "",
        exam_type: "written",
        submission_type: "both",
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 16),
        total_marks: 100,
        venue: "",
        status: "published",
      });
      setExamFiles([]);
      setExamTargetProgram("");
      setExamTargetCohort({ academic_year: "", year_of_study: 1, semester: 1 });
      setExamCohortError("");
      setTimeValidationError("");
      
      fetchExams();

    } catch (error) {
      console.error("Error scheduling exam:", error);
      showToast("Error: " + error.message, "error");
    }
  };

  // ===== HANDLE EDIT EXAM =====
  const handleEditExam = async () => {
    if (!editingExam) return;
    
    try {
      if (!editExam.title?.trim()) {
        showToast("Please enter a title", 'error');
        return;
      }
      
      // ===== VALIDATE END TIME IS AFTER START TIME =====
      if (!validateExamTimes(editExam.start_time, editExam.end_time)) {
        return;
      }
      
      const start = new Date(editExam.start_time);
      const end = new Date(editExam.end_time);
      const durationMinutes = Math.round((end - start) / 60000);
      
      if (durationMinutes <= 0) {
        showToast("End time must be after start time", 'error');
        return;
      }

      const { error } = await supabase
        .from("examinations")
        .update({
          title: editExam.title.trim(),
          description: editExam.description?.trim() || "",
          start_time: editExam.start_time,
          end_time: editExam.end_time,
          total_marks: parseInt(editExam.total_marks) || 100,
          venue: editExam.venue?.trim() || "",
          exam_type: editExam.exam_type || "online",
          status: editExam.status || "published",
          submission_type: editExam.submission_type || "both",
          duration_minutes: durationMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingExam.id);

      if (error) throw error;

      setEditingExam(null);
      fetchExams();
      showToast("✅ Exam updated successfully!", 'success');
    } catch (error) {
      console.error("Error updating exam:", error);
      showToast("Error updating exam: " + error.message, 'error');
    }
  };

  // ===== HANDLE DELETE EXAM =====
  const handleDeleteExam = async (examId) => {
    const examToDelete = exams.find(e => e.id === examId);
    const status = examToDelete ? getExamStatus(examToDelete) : "unknown";
    
    let confirmMessage = "Are you sure you want to delete this exam?";
    if (status === "active") {
      confirmMessage = "⚠️ This exam is currently ONGOING! Deleting it will remove all submissions. Are you sure you want to continue?";
    } else if (status === "upcoming") {
      confirmMessage = "⚠️ This exam is SCHEDULED. Deleting it will remove all associated data. Are you sure?";
    }
    
    if (!window.confirm(confirmMessage)) return;

    try {
      // First check if there are submissions
      const { data: submissions, error: subError } = await supabase
        .from("exam_submissions")
        .select("id")
        .eq("exam_id", examId);

      if (subError) {
        console.warn("Error checking submissions:", subError);
      }

      // Delete submissions first if they exist (foreign key constraint)
      if (submissions && submissions.length > 0) {
        console.log(`Deleting ${submissions.length} submissions for exam ${examId}`);
        const { error: deleteSubError } = await supabase
          .from("exam_submissions")
          .delete()
          .eq("exam_id", examId);
          
        if (deleteSubError) {
          console.error("Error deleting submissions:", deleteSubError);
          showToast("Failed to delete exam submissions: " + deleteSubError.message, 'error');
          return;
        }
      }

      // Delete the exam
      const { error } = await supabase
        .from("examinations")
        .delete()
        .eq("id", examId);

      if (error) throw error;
      
      showToast("✅ Exam deleted successfully!", 'success');
      fetchExams();
    } catch (error) {
      console.error("Error deleting exam:", error);
      showToast("Error deleting exam: " + error.message, 'error');
    }
  };

  // ==================== GRADING FUNCTIONS ====================
  
  const handleViewExamSubmissions = (exam) => {
    console.log("🎯 Viewing submissions for exam:", {
      exam_id: exam.id,
      title: exam.title,
    });

    setSelectedExamForGrading(exam);
    setExamSubmissions([]);
    setExamGradeForm({});
    fetchExamSubmissions(exam.id);
  };

  const handleGradeSubmission = async (submissionId, marks, feedback) => {
    try {
      setExamGradingInProgress(true);
      
      const selectedExam = exams.find(e => e.id === selectedExamForGrading?.id);
      const totalMarks = selectedExam?.total_marks || 100;
      const percentage = ((marks / totalMarks) * 100).toFixed(2);
      const letterGrade = getGradeFromMarks(marks);
      const gradePoints = getGradePoints(letterGrade);

      const { error } = await supabase
        .from("exam_submissions")
        .update({
          total_marks_obtained: marks,
          percentage: percentage,
          grade: letterGrade,
          grade_points: gradePoints,
          feedback: feedback,
          status: "graded",
          graded_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      showToast(`✅ Graded! → ${letterGrade} (${gradePoints.toFixed(2)} GP)`, 'success');
      fetchExamSubmissions(selectedExamForGrading.id);
      fetchExams(); // Refresh stats
      
    } catch (error) {
      console.error("Error grading submission:", error);
      showToast("Grading failed: " + error.message, 'error');
    } finally {
      setExamGradingInProgress(false);
    }
  };

  const getGradeFromMarks = (marks) => {
    if (!marks && marks !== 0) return "N/A";
    const numericMarks = parseFloat(marks);
    if (isNaN(numericMarks)) return "N/A";

    if (numericMarks >= 90) return "A+";
    if (numericMarks >= 80) return "A";
    if (numericMarks >= 75) return "B+";
    if (numericMarks >= 70) return "B";
    if (numericMarks >= 65) return "C+";
    if (numericMarks >= 60) return "C";
    if (numericMarks >= 55) return "D+";
    if (numericMarks >= 50) return "D";
    return "F";
  };

  const getGradePoints = (grade) => {
    if (!grade) return 0.0;
    const gradeMap = {
      "A+": 5.0, "A": 5.0,
      "B+": 4.5, "B": 4.0,
      "C+": 3.5, "C": 3.0,
      "D+": 2.5, "D": 2.0,
      "F": 0.0,
    };
    return gradeMap[grade.toUpperCase()] || 0.0;
  };

  // ==================== TEXT ANSWERS MODAL FUNCTIONS ====================
  
  const openTextAnswersModal = () => {
    const textSubmissions = examSubmissions.filter(
      (sub) => sub.answer_text && sub.answer_text.length > 0
    );
    
    if (textSubmissions.length === 0) {
      showToast("No text answers found to view.", 'info');
      return;
    }
    
    setShowTextAnswersModal(true);
  };

  // ==================== RENDER HELPERS ====================
  
  const getExamStatus = (exam) => {
    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(exam.end_time);

    if (now >= start && now <= end) return "active";
    if (now < start) return "upcoming";
    return "ended";
  };

  // ==================== MAIN RENDER ====================
  
  // If an exam is selected for grading, show the grading view
  if (selectedExamForGrading) {
    const textSubmissions = examSubmissions.filter(
      (sub) => sub.answer_text && sub.answer_text.length > 0
    );

    return (
      <div className="lecturer-tab-content">
        <div className="lecturer-tab-header">
          <div>
            <h2>📝 Grade Exam Submissions</h2>
            <p style={{ fontSize: "14px", color: "#1976d2", fontWeight: "500" }}>
              {selectedExamForGrading.title} - {selectedExamForGrading.courses?.course_code || "N/A"}
            </p>
          </div>
          <button 
            className="lecturer-cancel-btn" 
            onClick={() => {
              setSelectedExamForGrading(null);
              setExamSubmissions([]);
              setExamGradeForm({});
              setShowTextAnswersModal(false);
              setSelectedTextAnswer(null);
            }}
          >
            ← Back to Exams
          </button>
        </div>

        {/* Exam Info */}
        <div style={{ 
          display: "flex", 
          gap: "20px", 
          marginBottom: "20px",
          padding: "15px",
          background: "#f8f9fa",
          borderRadius: "8px",
          flexWrap: "wrap"
        }}>
          <span><strong>📊 Total Marks:</strong> {selectedExamForGrading.total_marks}</span>
          <span><strong>📝 Submissions:</strong> {examSubmissions.length}</span>
          <span><strong>📅 Start:</strong> {new Date(selectedExamForGrading.start_time).toLocaleString()}</span>
          <span><strong>📅 End:</strong> {new Date(selectedExamForGrading.end_time).toLocaleString()}</span>
          {selectedExamForGrading.exam_files?.length > 0 && (
            <span>
              <strong>📎 Exam Files:</strong> {selectedExamForGrading.exam_files.length} file(s)
            </span>
          )}
        </div>

        {/* Exam Files Download */}
        {selectedExamForGrading.exam_files?.length > 0 && (
          <div style={{ 
            marginBottom: "20px", 
            padding: "12px 16px", 
            background: "#e3f2fd", 
            borderRadius: "8px",
            borderLeft: "4px solid #1976d2"
          }}>
            <strong style={{ color: "#1976d2" }}>📎 Exam Paper Files:</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px" }}>
              {selectedExamForGrading.exam_files.map((filePath, idx) => {
                const fileName = filePath.split('/').pop() || `Exam_File_${idx + 1}`;
                const { data: urlData } = supabase.storage
                  .from("Lecturer exam")
                  .getPublicUrl(filePath);
                return (
                  <button
                    key={idx}
                    className="lecturer-course-btn"
                    onClick={() => downloadFile(urlData.publicUrl, fileName, null, "Lecturer exam")}
                    style={{ fontSize: "12px", padding: "6px 14px" }}
                  >
                    📄 {fileName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Submissions Table */}
        {examSubmissions.length === 0 ? (
          <div className="lecturer-empty-state" style={{ background: "white", padding: "60px", borderRadius: "12px", textAlign: "center" }}>
            <p>No submissions yet for this exam</p>
          </div>
        ) : (
          <>
            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
              <button 
                className="lecturer-course-btn" 
                onClick={openTextAnswersModal}
                disabled={textSubmissions.length === 0}
                style={{ 
                  background: textSubmissions.length > 0 ? "#6f42c1" : "#ccc",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <span>📝</span>
                View Text Answers ({textSubmissions.length})
              </button>
              
              {textSubmissions.length > 0 && (
                <button 
                  className="lecturer-course-btn" 
                  onClick={exportTextAnswersToWord}
                  disabled={exportingTextAnswers}
                  style={{ 
                    background: "#2b579a",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <span>📄</span>
                  {exportingTextAnswers ? "Exporting..." : "Export to Word"}
                </button>
              )}
            </div>

            <div className="lecturer-table-container" style={{ overflowX: "auto" }}>
              <table className="lecturer-data-table" style={{ minWidth: "1000px" }}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Registration</th>
                    <th>Submitted At</th>
                    <th>Status</th>
                    <th>Answers</th>
                    <th>Marks</th>
                    <th>Feedback</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {examSubmissions.map((submission) => (
                    <tr key={submission.id}>
                      <td><strong>{submission.student_name}</strong></td>
                      <td>{submission.registration_number}</td>
                      <td>{submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "N/A"}</td>
                      <td>
                        <span className={`lecturer-status-badge ${submission.status}`}>
                          {submission.status === "graded" ? "✅ Graded" : "📤 Submitted"}
                        </span>
                      </td>
                      <td>
                        {/* Student Answer Files */}
                        {submission.file_download_urls && submission.file_download_urls.length > 0 && (
                          <div style={{ marginBottom: "6px" }}>
                            <div style={{ fontSize: "11px", color: "#28a745", fontWeight: "bold" }}>📤 Files:</div>
                            {submission.file_download_urls.map((url, idx) => {
                              const fileName = submission.answer_files?.[idx]?.split('/').pop() || `Answer_${idx + 1}`;
                              return (
                                <button
                                  key={idx}
                                  className="lecturer-course-btn"
                                  onClick={() => downloadFile(url, `${submission.student_name}_${fileName}`, submission.id, "Student exam")}
                                  style={{ fontSize: "11px", padding: "2px 10px", margin: "2px", background: "#28a745", color: "white" }}
                                >
                                  📥 {fileName}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Text Answer Preview */}
                        {submission.answer_text && submission.answer_text.length > 0 && (
                          <div 
                            style={{ 
                              fontSize: "12px", 
                              color: "#6f42c1",
                              cursor: "pointer",
                              padding: "6px 10px",
                              background: "#f8f0ff",
                              borderRadius: "4px",
                              border: "1px solid #d4b8e0",
                              marginTop: "4px",
                              maxWidth: "250px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}
                            onClick={() => {
                              setSelectedTextAnswer(submission);
                              setShowTextAnswersModal(true);
                            }}
                            title="Click to view full text"
                          >
                            <span>📝</span> {submission.answer_text.length > 80 ? submission.answer_text.substring(0, 80) + "..." : submission.answer_text}
                          </div>
                        )}
                        
                        {!submission.file_download_urls?.length && !submission.answer_text && (
                          <span style={{ color: "#999", fontSize: "12px" }}>No answers</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={selectedExamForGrading.total_marks}
                          step="0.5"
                          value={examGradeForm[submission.id]?.marks || ""}
                          onChange={(e) => setExamGradeForm(prev => ({
                            ...prev,
                            [submission.id]: { ...prev[submission.id], marks: e.target.value }
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
                          value={examGradeForm[submission.id]?.feedback || ""}
                          onChange={(e) => setExamGradeForm(prev => ({
                            ...prev,
                            [submission.id]: { ...prev[submission.id], feedback: e.target.value }
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
                        <button
                          className="lecturer-confirm-btn"
                          onClick={() => {
                            const marks = parseFloat(examGradeForm[submission.id]?.marks);
                            if (isNaN(marks)) {
                              showToast("Please enter valid marks", 'error');
                              return;
                            }
                            handleGradeSubmission(
                              submission.id,
                              marks,
                              examGradeForm[submission.id]?.feedback || ""
                            );
                          }}
                          disabled={examGradingInProgress}
                          style={{ fontSize: "12px", padding: "6px 14px" }}
                        >
                          {submission.status === "graded" ? "Update" : "Grade"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== TEXT ANSWERS MODAL ===== */}
        {showTextAnswersModal && (
          <div className="lecturer-modal-overlay" onClick={() => {
            if (!exportingTextAnswers) {
              setShowTextAnswersModal(false);
              setSelectedTextAnswer(null);
            }
          }}>
            <div className="lecturer-modal" style={{ 
              maxWidth: "900px", 
              maxHeight: "90vh", 
              overflow: "hidden",
              padding: 0
            }} onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                padding: "16px 24px",
                borderBottom: "2px solid #e9ecef",
                backgroundColor: "#f8f9fa",
                borderRadius: "12px 12px 0 0"
              }}>
                <div>
                  <h3 style={{ margin: 0, color: "#2c3e50" }}>
                    <span style={{ marginRight: "10px" }}>📝</span>
                    Text Answers
                  </h3>
                  <p style={{ margin: "4px 0 0 0", color: "#6c757d", fontSize: "14px" }}>
                    {selectedExamForGrading?.title || "Exam"} - {selectedExamForGrading?.courses?.course_code || "N/A"}
                    <span style={{ marginLeft: "15px", fontWeight: "bold" }}>
                      ({textSubmissions.length} text submissions)
                    </span>
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  {!selectedTextAnswer && textSubmissions.length > 0 && (
                    <button 
                      className="lecturer-course-btn"
                      onClick={exportTextAnswersToWord}
                      disabled={exportingTextAnswers}
                      style={{ 
                        background: "#2b579a",
                        color: "white",
                        fontSize: "13px",
                        padding: "8px 16px"
                      }}
                    >
                      📄 {exportingTextAnswers ? "Exporting..." : "Export All to Word"}
                    </button>
                  )}
                  <button 
                    className="lecturer-cancel-btn"
                    onClick={() => {
                      setShowTextAnswersModal(false);
                      setSelectedTextAnswer(null);
                    }}
                    style={{ padding: "8px 16px" }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
              
              {/* Modal Body */}
              <div style={{ 
                padding: "20px 24px", 
                overflowY: "auto", 
                maxHeight: "calc(90vh - 150px)",
                backgroundColor: "white"
              }}>
                {selectedTextAnswer ? (
                  // === SINGLE ANSWER VIEW ===
                  <div>
                    <button 
                      className="lecturer-cancel-btn"
                      onClick={() => setSelectedTextAnswer(null)}
                      style={{ marginBottom: "16px", fontSize: "13px", padding: "4px 12px" }}
                    >
                      ← Back to all answers
                    </button>
                    
                    <div style={{ 
                      background: "#f8f9fa", 
                      padding: "16px 20px", 
                      borderRadius: "8px", 
                      marginBottom: "20px",
                      border: "1px solid #e9ecef"
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "#999", marginBottom: "4px" }}>STUDENT NAME</div>
                          <div style={{ fontSize: "16px", fontWeight: "bold", color: "#2c3e50" }}>
                            {selectedTextAnswer.student_name || "Unknown Student"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "12px", color: "#999", marginBottom: "4px" }}>REGISTRATION NUMBER</div>
                          <div style={{ fontSize: "16px", fontWeight: "bold", color: "#2c3e50" }}>
                            {selectedTextAnswer.registration_number || "N/A"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "12px", color: "#999", marginBottom: "4px" }}>EMAIL</div>
                          <div style={{ fontSize: "16px", fontWeight: "bold", color: "#2c3e50" }}>
                            {selectedTextAnswer.student_email || "N/A"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "12px", color: "#999", marginBottom: "4px" }}>SUBMITTED AT</div>
                          <div style={{ fontSize: "16px", fontWeight: "bold", color: "#2c3e50" }}>
                            {selectedTextAnswer.submitted_at ? new Date(selectedTextAnswer.submitted_at).toLocaleString() : "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div style={{ marginBottom: "16px", display: "flex", gap: "10px", alignItems: "center" }}>
                      <span style={{
                        padding: "4px 16px",
                        borderRadius: "20px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        backgroundColor: selectedTextAnswer.status === "graded" ? "#4caf50" : "#ff9800",
                        color: "white"
                      }}>
                        {selectedTextAnswer.status === "graded" ? "✓ GRADED" : "⏳ PENDING"}
                      </span>
                      {selectedTextAnswer.status === "graded" && selectedTextAnswer.total_marks_obtained !== null && (
                        <span style={{
                          padding: "4px 16px",
                          borderRadius: "20px",
                          fontSize: "13px",
                          fontWeight: "bold",
                          backgroundColor: "#1976d2",
                          color: "white"
                        }}>
                          Score: {selectedTextAnswer.total_marks_obtained}/{selectedExamForGrading?.total_marks || 100}
                        </span>
                      )}
                    </div>

                    {/* Answer Text - Full View */}
                    <div style={{
                      padding: "20px 24px",
                      backgroundColor: "white",
                      borderRadius: "8px",
                      border: "2px solid #e0e0e0",
                      minHeight: "200px"
                    }}>
                      <div style={{
                        fontSize: "13px",
                        color: "#999",
                        marginBottom: "12px",
                        fontWeight: "bold",
                        letterSpacing: "1px",
                        borderBottom: "1px solid #e9ecef",
                        paddingBottom: "8px"
                      }}>
                        📝 ANSWER TEXT
                      </div>
                      <div style={{
                        fontSize: "16px",
                        lineHeight: "2",
                        color: "#333",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word"
                      }}>
                        {selectedTextAnswer.answer_text}
                      </div>
                    </div>

                    {/* Feedback if graded */}
                    {selectedTextAnswer.status === "graded" && selectedTextAnswer.feedback && (
                      <div style={{
                        marginTop: "16px",
                        padding: "12px 20px",
                        backgroundColor: "#e8f5e9",
                        borderRadius: "8px",
                        borderLeft: "4px solid #4caf50"
                      }}>
                        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#2e7d32" }}>
                          💬 Feedback:
                        </div>
                        <div style={{ fontSize: "15px", color: "#333", marginTop: "4px", lineHeight: "1.6" }}>
                          {selectedTextAnswer.feedback}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button
                        className="lecturer-course-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedTextAnswer.answer_text)
                            .then(() => showToast("Answer text copied to clipboard!", 'success'))
                            .catch(() => showToast("Failed to copy", 'error'));
                        }}
                        style={{ background: "#28a745", color: "white" }}
                      >
                        📋 Copy Text
                      </button>
                    </div>
                  </div>
                ) : (
                  // === LIST OF ALL TEXT ANSWERS ===
                  <div>
                    {textSubmissions.length === 0 ? (
                      <div className="lecturer-empty-state" style={{ padding: "40px", textAlign: "center" }}>
                        <p>No text answers found</p>
                      </div>
                    ) : (
                      textSubmissions.map((sub, index) => (
                        <div key={sub.id} style={{ 
                          marginBottom: "16px", 
                          padding: "16px 20px", 
                          background: "#f8f9fa", 
                          borderRadius: "8px",
                          border: "1px solid #e9ecef",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                        onClick={() => setSelectedTextAnswer(sub)}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = "#6f42c1"}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = "#e9ecef"}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div>
                              <strong>{index + 1}. {sub.student_name}</strong>
                              <span style={{ marginLeft: "12px", fontSize: "13px", color: "#666" }}>
                                ({sub.registration_number})
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                              <span style={{ fontSize: "12px", color: "#999" }}>
                                {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "N/A"}
                              </span>
                              <span style={{
                                padding: "2px 12px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "bold",
                                backgroundColor: sub.status === "graded" ? "#d4edda" : "#fff3cd",
                                color: sub.status === "graded" ? "#155724" : "#856404"
                              }}>
                                {sub.status === "graded" ? "Graded" : "Pending"}
                              </span>
                              <span style={{ color: "#6f42c1", fontSize: "13px" }}>→</span>
                            </div>
                          </div>
                          <div style={{ 
                            padding: "10px 14px", 
                            background: "white", 
                            borderRadius: "4px",
                            border: "1px solid #e0e0e0",
                            maxHeight: "80px",
                            overflow: "hidden",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: "14px",
                            color: "#555"
                          }}>
                            {sub.answer_text.length > 200 ? sub.answer_text.substring(0, 200) + "..." : sub.answer_text}
                          </div>
                          {sub.status === "graded" && sub.total_marks_obtained !== null && (
                            <div style={{ marginTop: "6px", fontSize: "13px", color: "#28a745" }}>
                              ✅ {sub.total_marks_obtained} marks
                              {sub.feedback && ` - ${sub.feedback}`}
                            </div>
                          )}
                          <div style={{ marginTop: "6px", fontSize: "12px", color: "#6f42c1" }}>
                            Click to view full answer
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== EXAM LIST VIEW ====================
  
  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <h2>🎯 Exam Management</h2>
        <button className="lecturer-add-btn" onClick={() => setShowExamsModal(true)}>
          + Schedule Exam
        </button>
      </div>

      {loading ? (
        <div className="lecturer-loading-content">
          <div className="lecturer-spinner"></div>
          <p>Loading exams...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="lecturer-empty-state" style={{ background: "white", padding: "60px", borderRadius: "12px", textAlign: "center" }}>
          <p>No exams scheduled</p>
          <button className="lecturer-add-btn" onClick={() => setShowExamsModal(true)}>
            Schedule Your First Exam
          </button>
        </div>
      ) : (
        <div className="lecturer-courses-grid">
          {exams.map((exam) => {
            const status = getExamStatus(exam);
            const startDate = new Date(exam.start_time);
            const now = new Date();
            const daysUntil = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
            const isPast = startDate < now;
            
            // Format relative time
            let timeLabel = "";
            if (status === "active") {
              timeLabel = "🔴 ONGOING NOW";
            } else if (isPast) {
              timeLabel = `📅 ${startDate.toLocaleDateString()}`;
            } else if (daysUntil === 0) {
              timeLabel = "📅 TODAY";
            } else if (daysUntil === 1) {
              timeLabel = "📅 TOMORROW";
            } else if (daysUntil < 7) {
              timeLabel = `📅 In ${daysUntil} days`;
            } else {
              timeLabel = `📅 ${startDate.toLocaleDateString()}`;
            }

            return (
              <div key={exam.id} className="lecturer-course-card">
                <div className="lecturer-course-header">
                  <div>
                    <h3>{exam.title}</h3>
                    <p style={{ fontSize: "14px", color: "#666", margin: "4px 0" }}>
                      {exam.courses?.course_code} - {exam.courses?.course_name}
                    </p>
                  </div>
                  <span className={`lecturer-status-badge ${status}`}>
                    {status.toUpperCase()}
                  </span>
                </div>
                
                {/* Time label */}
                <div style={{ 
                  fontSize: "13px", 
                  fontWeight: "bold",
                  color: status === "active" ? "#d32f2f" : "#1976d2",
                  margin: "4px 0 8px 0",
                  padding: "4px 12px",
                  background: status === "active" ? "#ffebee" : "#e3f2fd",
                  borderRadius: "4px",
                  display: "inline-block"
                }}>
                  {timeLabel}
                </div>
                
                <p style={{ margin: "8px 0", color: "#555" }}>{exam.description}</p>

                <div className="lecturer-course-details">
                  <span>⏰ {startDate.toLocaleTimeString()} - {new Date(exam.end_time).toLocaleTimeString()}</span>
                  <span>📊 {exam.total_marks} marks</span>
                  <span>📍 {exam.venue || "Online"}</span>
                </div>

                <div style={{ fontSize: "13px", color: "#666", margin: "8px 0" }}>
                  <span>🎯 Y{exam.target_year_of_study || "?"} S{exam.target_semester || "?"}</span>
                  <span style={{ marginLeft: "15px" }}>
                    📝 {exam.submission_type === "text" ? "Text" : exam.submission_type === "file" ? "File" : "Both"}
                  </span>
                  {exam.exam_files?.length > 0 && (
                    <span style={{ marginLeft: "15px", color: "#1976d2" }}>
                      📎 {exam.exam_files.length} file(s)
                    </span>
                  )}
                </div>

                <div style={{ 
                  fontSize: "13px", 
                  margin: "8px 0", 
                  padding: "6px 12px", 
                  background: "#f8f9fa", 
                  borderRadius: "6px" 
                }}>
                  <span>📤 Submitted: <strong>{exam.submitted || 0}</strong></span>
                  <span style={{ marginLeft: "12px" }}>✅ Graded: <strong>{exam.graded || 0}</strong></span>
                  {exam.pending > 0 && (
                    <span style={{ marginLeft: "12px", color: "#ef6c00" }}>
                      ⏳ Pending: <strong>{exam.pending}</strong>
                    </span>
                  )}
                </div>

                <div className="lecturer-course-actions">
                  {exam.submitted > 0 && (
                    <button
                      className="lecturer-course-btn"
                      onClick={() => handleViewExamSubmissions(exam)}
                      style={{ background: "#6f42c1", color: "white" }}
                    >
                      📝 Grade Submissions ({exam.submitted})
                    </button>
                  )}
                  <button
                    className="lecturer-course-btn"
                    onClick={() => {
                      setEditingExam(exam);
                      setEditExam({
                        title: exam.title || "",
                        description: exam.description || "",
                        start_time: exam.start_time || "",
                        end_time: exam.end_time || "",
                        venue: exam.venue || "",
                        status: exam.status || "published",
                        total_marks: exam.total_marks || 100,
                        exam_type: exam.exam_type || "online",
                        submission_type: exam.submission_type || "both",
                      });
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="lecturer-course-btn"
                    onClick={() => handleDeleteExam(exam.id)}
                    style={{ background: "#dc3545", color: "white" }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== SCHEDULE EXAM MODAL ==================== */}
      {showExamsModal && (
        <div className="lecturer-modal-overlay" onClick={() => setShowExamsModal(false)}>
          <div className="lecturer-modal" style={{ maxWidth: "700px", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3>Schedule New Exam</h3>

            {/* Target Cohort */}
            <div style={{ background: "#ffebee", padding: "16px", borderRadius: "10px", marginBottom: "20px", border: "2px solid #c62828" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#c62828" }}>🎯 Target Cohort</h4>
              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Program *</label>
                  <select
                    value={examTargetProgram}
                    onChange={(e) => {
                      setExamTargetProgram(e.target.value);
                      setNewExam({ ...newExam, course_id: "" });
                    }}
                    className="lecturer-form-select"
                  >
                    <option value="">Select Program</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Academic Year *</label>
                  <input
                    type="text"
                    value={examTargetCohort.academic_year}
                    onChange={(e) => setExamTargetCohort({ ...examTargetCohort, academic_year: e.target.value.trim() })}
                    placeholder="e.g. 2025/2029"
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Year *</label>
                  <select
                    value={examTargetCohort.year_of_study}
                    onChange={(e) => setExamTargetCohort({ ...examTargetCohort, year_of_study: parseInt(e.target.value) })}
                    className="lecturer-form-select"
                  >
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Semester *</label>
                  <select
                    value={examTargetCohort.semester}
                    onChange={(e) => setExamTargetCohort({ ...examTargetCohort, semester: parseInt(e.target.value) })}
                    className="lecturer-form-select"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>
              {examCohortError && <p style={{ color: "#d32f2f", marginTop: "8px" }}>⚠️ {examCohortError}</p>}
            </div>

            <div className="lecturer-modal-form">
              <div className="lecturer-form-group">
                <label>Course *</label>
                <select
                  value={newExam.course_id}
                  onChange={(e) => setNewExam({ ...newExam, course_id: e.target.value })}
                  className="lecturer-form-select"
                  disabled={!examTargetProgram}
                >
                  <option value="">
                    {examTargetProgram ? (examFilteredCourses.length === 0 ? "No courses available" : "Select Course") : "Select Program first"}
                  </option>
                  {examFilteredCourses.map(course => (
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
                  value={newExam.title}
                  onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                  placeholder="e.g. Midterm Examination"
                  className="lecturer-form-input"
                />
              </div>

              <div className="lecturer-form-group">
                <label>Description</label>
                <textarea
                  value={newExam.description}
                  onChange={(e) => setNewExam({ ...newExam, description: e.target.value })}
                  placeholder="Brief description"
                  rows="2"
                  className="lecturer-form-textarea"
                />
              </div>

              {/* Time Inputs with Real-Time Validation */}
              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newExam.start_time}
                    onChange={(e) => setNewExam({ ...newExam, start_time: e.target.value })}
                    className="lecturer-form-input"
                    style={{
                      borderColor: timeValidationError ? "#dc3545" : undefined,
                    }}
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>End Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newExam.end_time}
                    onChange={(e) => setNewExam({ ...newExam, end_time: e.target.value })}
                    className="lecturer-form-input"
                    style={{
                      borderColor: timeValidationError ? "#dc3545" : undefined,
                    }}
                  />
                </div>
              </div>

              {/* Real-Time Error Message */}
              {timeValidationError && (
                <div style={{
                  backgroundColor: "#f8d7da",
                  color: "#721c24",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  border: "1px solid #f5c6cb",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "14px",
                  fontWeight: "bold"
                }}>
                  <span style={{ fontSize: "20px" }}>⛔</span>
                  {timeValidationError}
                </div>
              )}

              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Total Marks *</label>
                  <input
                    type="number"
                    value={newExam.total_marks}
                    onChange={(e) => setNewExam({ ...newExam, total_marks: parseInt(e.target.value) || 100 })}
                    min="1"
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Venue</label>
                  <input
                    type="text"
                    value={newExam.venue}
                    onChange={(e) => setNewExam({ ...newExam, venue: e.target.value })}
                    placeholder="e.g. Main Hall, Online"
                    className="lecturer-form-input"
                  />
                </div>
              </div>

              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Exam Type</label>
                  <select
                    value={newExam.exam_type}
                    onChange={(e) => setNewExam({ ...newExam, exam_type: e.target.value })}
                    className="lecturer-form-select"
                  >
                    <option value="written">Written</option>
                    <option value="practical">Practical</option>
                    <option value="online">Online</option>
                    <option value="oral">Oral</option>
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Submission Type</label>
                  <select
                    value={newExam.submission_type}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewExam({ ...newExam, submission_type: value });
                      if (value === 'text') setExamFiles([]);
                    }}
                    className="lecturer-form-select"
                  >
                    <option value="text">📝 Text Answer Only</option>
                    <option value="file">📎 File Upload Only</option>
                    <option value="both">📝 Text + File Upload</option>
                  </select>
                </div>
              </div>

              {newExam.submission_type !== "text" && (
                <div className="lecturer-form-group">
                  <label>Exam Files</label>
                  <div
                    className="lecturer-file-upload-area"
                    onClick={() => examFileInputRef.current?.click()}
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
                      ref={examFileInputRef}
                      multiple
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                      onChange={(e) => setExamFiles(Array.from(e.target.files || []))}
                      style={{ display: "none" }}
                    />
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>📤</div>
                    <p><strong>Upload exam papers</strong></p>
                    <p style={{ fontSize: "12px", color: "#999" }}>PDF, Word, PPT, ZIP</p>
                  </div>

                  {uploadingExamFiles && (
                    <div className="lecturer-upload-progress" style={{ marginTop: "12px" }}>
                      <div className="lecturer-progress-bar" style={{ background: "#e0e0e0", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                        <div className="lecturer-progress-fill" style={{ width: `${examUploadProgress}%`, background: "#1976d2", height: "100%", transition: "width 0.3s" }}></div>
                      </div>
                      <p style={{ textAlign: "center", marginTop: "4px", fontSize: "13px" }}>{examUploadProgress}%</p>
                    </div>
                  )}

                  {examFiles.length > 0 && (
                    <div style={{ marginTop: "12px" }}>
                      <h4 style={{ fontSize: "14px" }}>Selected Files ({examFiles.length})</h4>
                      {examFiles.map((file, index) => (
                        <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "#f1f3f5", borderRadius: "6px", marginBottom: "4px" }}>
                          <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          <button onClick={() => setExamFiles(prev => prev.filter((_, i) => i !== index))} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer" }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="lecturer-modal-actions">
                <button 
                  className="lecturer-cancel-btn" 
                  onClick={() => {
                    setShowExamsModal(false);
                    setTimeValidationError("");
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="lecturer-confirm-btn" 
                  onClick={handleAddExam}
                  disabled={!!timeValidationError}
                  style={{
                    opacity: timeValidationError ? 0.5 : 1,
                    cursor: timeValidationError ? "not-allowed" : "pointer"
                  }}
                >
                  Schedule Exam
                </button>
              </div>
              {timeValidationError && (
                <p style={{ color: "#dc3545", fontSize: "13px", textAlign: "center", marginTop: "8px" }}>
                  ⚠️ Please fix the time error before scheduling
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT EXAM MODAL ==================== */}
      {editingExam && (
        <div className="lecturer-modal-overlay" onClick={() => setEditingExam(null)}>
          <div className="lecturer-modal" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <h3>✏️ Edit Exam</h3>
            <p style={{ color: "#666", marginBottom: "15px" }}>
              Editing: <strong>{editingExam.title}</strong>
            </p>

            <div className="lecturer-modal-form">
              <div className="lecturer-form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={editExam.title || ""}
                  onChange={(e) => setEditExam({ ...editExam, title: e.target.value })}
                  className="lecturer-form-input"
                />
              </div>

              <div className="lecturer-form-group">
                <label>Description</label>
                <textarea
                  value={editExam.description || ""}
                  onChange={(e) => setEditExam({ ...editExam, description: e.target.value })}
                  rows="2"
                  className="lecturer-form-textarea"
                />
              </div>

              {/* Edit Time Inputs with Real-Time Validation */}
              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={editExam.start_time || ""}
                    onChange={(e) => setEditExam({ ...editExam, start_time: e.target.value })}
                    className="lecturer-form-input"
                    style={{
                      borderColor: editTimeValidationError ? "#dc3545" : undefined,
                    }}
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>End Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={editExam.end_time || ""}
                    onChange={(e) => setEditExam({ ...editExam, end_time: e.target.value })}
                    className="lecturer-form-input"
                    style={{
                      borderColor: editTimeValidationError ? "#dc3545" : undefined,
                    }}
                  />
                </div>
              </div>

              {/* Real-Time Error Message for Edit */}
              {editTimeValidationError && (
                <div style={{
                  backgroundColor: "#f8d7da",
                  color: "#721c24",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  border: "1px solid #f5c6cb",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "14px",
                  fontWeight: "bold"
                }}>
                  <span style={{ fontSize: "20px" }}>⛔</span>
                  {editTimeValidationError}
                </div>
              )}

              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Total Marks *</label>
                  <input
                    type="number"
                    value={editExam.total_marks || 100}
                    onChange={(e) => setEditExam({ ...editExam, total_marks: parseInt(e.target.value) || 100 })}
                    min="1"
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Venue</label>
                  <input
                    type="text"
                    value={editExam.venue || ""}
                    onChange={(e) => setEditExam({ ...editExam, venue: e.target.value })}
                    placeholder="e.g. Main Hall, Online"
                    className="lecturer-form-input"
                  />
                </div>
              </div>

              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Exam Type</label>
                  <select
                    value={editExam.exam_type || "online"}
                    onChange={(e) => setEditExam({ ...editExam, exam_type: e.target.value })}
                    className="lecturer-form-select"
                  >
                    <option value="written">Written</option>
                    <option value="practical">Practical</option>
                    <option value="online">Online</option>
                    <option value="oral">Oral</option>
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Submission Type</label>
                  <select
                    value={editExam.submission_type || "both"}
                    onChange={(e) => setEditExam({ ...editExam, submission_type: e.target.value })}
                    className="lecturer-form-select"
                  >
                    <option value="text">📝 Text Answer Only</option>
                    <option value="file">📎 File Upload Only</option>
                    <option value="both">📝 Text + File Upload</option>
                  </select>
                </div>
              </div>

              <div className="lecturer-form-group">
                <label>Status</label>
                <select
                  value={editExam.status || "published"}
                  onChange={(e) => setEditExam({ ...editExam, status: e.target.value })}
                  className="lecturer-form-select"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="lecturer-modal-actions">
                <button 
                  className="lecturer-cancel-btn" 
                  onClick={() => {
                    setEditingExam(null);
                    setEditTimeValidationError("");
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="lecturer-confirm-btn" 
                  onClick={handleEditExam}
                  disabled={!!editTimeValidationError}
                  style={{
                    opacity: editTimeValidationError ? 0.5 : 1,
                    cursor: editTimeValidationError ? "not-allowed" : "pointer"
                  }}
                >
                  ✅ Update Exam
                </button>
              </div>
              {editTimeValidationError && (
                <p style={{ color: "#dc3545", fontSize: "13px", textAlign: "center", marginTop: "8px" }}>
                  ⚠️ Please fix the time error before updating
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerExamsManager;