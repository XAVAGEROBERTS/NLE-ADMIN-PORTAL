// src/utils/studentHelper.js
import { supabase } from '../supabaseClient'; // Adjust import path as needed

export const generateStudentData = async (studentData) => {
  try {
    // 1. Get program details
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('*')
      .eq('id', studentData.program_id)
      .single();

    if (programError || !program) {
      throw new Error('Program not found');
    }

    // 2. Auto-generate email from name
    const fullName = studentData.full_name.trim();
    const nameParts = fullName.toLowerCase().split(' ');
    let emailName = '';
    
    if (nameParts.length >= 2) {
      // Use last name + first name
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      emailName = lastName + firstName;
    } else {
      emailName = nameParts[0];
    }
    
    // Remove special characters
    emailName = emailName.replace(/[^a-zA-Z]/g, '');
    const email = `${emailName}@nle.university.com`;

    // 3. Calculate academic year
    const currentYear = new Date().getFullYear();
    const endYear = currentYear + program.years;
    const academicYear = `${currentYear}/${endYear}`;

    // 4. Determine semester based on current month
    const currentMonth = new Date().getMonth();
    const semester = (currentMonth >= 1 && currentMonth <= 6) ? 2 : 1;
    const intake = semester === 1 ? 'August' : 'January';

    // 5. Get count for student ID generation
    const { count, error: countError } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // 6. Generate student ID
    const yearPrefix = String(currentYear).slice(-2);
    const studentNumber = String((count || 0) + 1).padStart(4, '0');
    const studentId = `${program.department_code}${yearPrefix}${studentNumber}`;

    // 7. Generate registration number
    const regNumber = `${program.department_code}-${currentYear}-${studentId.split('-')[1] || studentNumber}`;

    // 8. Return complete student data
    return {
      full_name: fullName,
      email: email,
      student_id: studentId,
      registration_number: regNumber,
      program: program.name,
      program_code: program.code,
      program_id: program.id,
      department: program.department_name,
      department_code: program.department_code,
      year_of_study: 1,
      semester: semester,
      academic_year: academicYear,
      program_duration_years: program.years,
      program_total_semesters: program.total_semesters,
      status: 'active',
      intake: intake,
      phone: studentData.phone || '',
      date_of_birth: studentData.date_of_birth || null,
      password_hash: studentData.password_hash || 'Test1234',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error generating student data:', error);
    throw error;
  }
};

export const addStudent = async (studentData) => {
  try {
    const newStudent = await generateStudentData(studentData);
    
    const { data, error } = await supabase
      .from('students')
      .insert([newStudent])
      .select();

    if (error) throw error;

    return {
      success: true,
      data: data[0],
      message: 'Student added successfully!',
      auto_filled: {
        email: newStudent.email,
        student_id: newStudent.student_id,
        registration_number: newStudent.registration_number,
        academic_year: newStudent.academic_year,
        department: newStudent.department,
        department_code: newStudent.department_code,
        semester: newStudent.semester,
        year_of_study: newStudent.year_of_study
      }
    };

  } catch (error) {
    console.error('Error adding student:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};