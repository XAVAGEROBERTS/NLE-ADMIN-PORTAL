import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export const useLecturerDepartments = (lecturerId) => {
  const [departments, setDepartments] = useState([]);
  const [departmentCodes, setDepartmentCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!lecturerId) {
      console.log('No lecturerId provided to hook');
      setLoading(false);
      return;
    }

    console.log('Hook fetching for lecturerId:', lecturerId);
    fetchLecturerDepartments();
  }, [lecturerId]);

  const fetchLecturerDepartments = async () => {
    try {
      setLoading(true);
      console.log('Fetching departments for lecturer:', lecturerId);
      
      // Query lecturer_departments table
      const { data: lecturerDepartments, error } = await supabase
        .from('lecturer_departments')
        .select('department_code, department_name, is_active, id')
        .eq('lecturer_id', lecturerId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching lecturer departments:', error);
        throw error;
      }

      console.log('Raw department data:', lecturerDepartments);

      if (lecturerDepartments && lecturerDepartments.length > 0) {
        console.log('Found departments:', lecturerDepartments);
        setDepartments(lecturerDepartments);
        const codes = lecturerDepartments.map(dept => dept.department_code);
        console.log('Department codes:', codes);
        setDepartmentCodes(codes);
        setHasAccess(true);
      } else {
        console.log('No active departments found for lecturer');
        setDepartments([]);
        setDepartmentCodes([]);
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error in fetchLecturerDepartments:', error);
      setDepartments([]);
      setDepartmentCodes([]);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Filter functions for lecturer access
  const filterCourses = (courses) => {
    if (!hasAccess || departmentCodes.length === 0) {
      console.log('No access or no department codes for filtering courses');
      return [];
    }
    
    console.log('Filtering courses with department codes:', departmentCodes);
    const filtered = courses.filter(course => 
      course.department_code && 
      departmentCodes.includes(course.department_code)
    );
    console.log('Filtered courses:', filtered.length, 'of', courses.length);
    return filtered;
  };

  const filterStudents = (students) => {
    if (!hasAccess || departmentCodes.length === 0) {
      console.log('No access or no department codes for filtering students');
      return [];
    }
    
    console.log('Filtering students with department codes:', departmentCodes);
    const filtered = students.filter(student => 
      student.program && 
      departmentCodes.includes(student.program)
    );
    console.log('Filtered students:', filtered.length, 'of', students.length);
    return filtered;
  };

  return {
    departments,
    departmentCodes,
    loading,
    hasAccess,
    filterCourses,
    filterStudents,
    refreshDepartments: fetchLecturerDepartments
  };
};