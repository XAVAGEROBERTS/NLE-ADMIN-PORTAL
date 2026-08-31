import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
  LineChart, Line, AreaChart, Area, ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ComposedChart, Scatter
} from 'recharts';
import {
  Download, Filter, Calendar, TrendingUp, DollarSign, AlertCircle, CheckCircle, Clock,
  FileText, Users, CreditCard, RefreshCw, Search, Eye, Edit, Trash2, Plus, ChevronDown,
  ChevronUp, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon,
  TrendingDown, User, Mail, Phone, BookOpen, Award, CalendarDays, FileSpreadsheet,
  Printer, Settings, Bell, LogOut, MoreVertical, Loader2, AlertTriangle, Check,
  X, ChevronRight, ChevronLeft, FilterX, Home, Database, Activity, Shield,
  CreditCard as Card, Wallet, Banknote, Receipt, QrCode, Send, Upload,
  ArrowUpRight, ArrowDownRight, Percent, Target, Zap, Sparkles, Layers,
  Package, Globe, ShieldCheck, History, FileCheck, AlertOctagon, File
} from 'lucide-react';
import './FinanceDashboard.css';
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval, addDays, subDays, eachMonthOfInterval } from 'date-fns';
import * as XLSX from 'xlsx';

const FinanceDashboard = ({ profile, signOut }) => {
  const navigate = useNavigate();
  
  // State Management
  const [activeTab, setActiveTab] = useState('overview');
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [financialRecords, setFinancialRecords] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [feeCategories, setFeeCategories] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [studentFeeAssignments, setStudentFeeAssignments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loading, setLoading] = useState({
    dashboard: false,
    students: false,
    transactions: false,
    analytics: false,
    reports: false
  });
  
  const [filters, setFilters] = useState({
    dateRange: 'all',
    paymentStatus: 'all',
    amountRange: { min: 0, max: 100000 },
    program: 'all',
    academicYear: 'all',
    semester: 'all'
  });
  
  const [newPayment, setNewPayment] = useState({
    student_id: '',
    amount: '',
    description: '',
    due_date: '',
    category: '',
    academic_year: new Date().getFullYear().toString(),
    semester: 1,
    receipt_number: '',
    payment_method: 'bank_transfer'
  });
  
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    totalStudents: 0,
    clearedStudents: 0,
    collectionRate: 0
  });
  
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date()
  });

  // Fetch all necessary data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch data based on active tab
  useEffect(() => {
    switch (activeTab) {
      case 'overview':
        fetchDashboardData();
        break;
      case 'students':
        fetchStudents();
        break;
      case 'transactions':
        fetchAllTransactions();
        break;
      case 'student-detail':
        if (selectedStudent) {
          fetchStudentFinance(selectedStudent.id);
        }
        break;
      case 'reports':
        fetchReportsData();
        break;
    }
  }, [activeTab, filters]);

  // Filter students when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.program?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  const fetchInitialData = async () => {
    try {
      setLoading(prev => ({ ...prev, dashboard: true }));
      
      // Fetch programs
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('*')
        .order('name');
      
      if (programsError) throw programsError;
      if (programsData) setPrograms(programsData);
      
      // Fetch fee categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('fee_categories')
        .select('*')
        .order('priority');
      
      if (categoriesError) throw categoriesError;
      if (categoriesData) {
        setFeeCategories(categoriesData);
        if (categoriesData.length > 0 && !newPayment.category) {
          setNewPayment(prev => ({ ...prev, category: categoriesData[0].category_code }));
        }
      }
      
    } catch (error) {
      console.error('Error fetching initial data:', error);
      alert('Failed to load initial data');
    } finally {
      setLoading(prev => ({ ...prev, dashboard: false }));
    }
  };

  const fetchDashboardData = async () => {
    setLoading(prev => ({ ...prev, analytics: true }));
    
    try {
      // Fetch all students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, student_id, full_name, email, program, academic_year, status')
        .eq('status', 'active')
        .order('full_name');
      
      if (studentsError) throw studentsError;
      
      if (studentsData) {
        setStudents(studentsData);
        setFilteredStudents(studentsData);
        setStats(prev => ({ ...prev, totalStudents: studentsData.length }));
      }
      
   // FIXED: Load ALL transactions for accurate analytics
const { data: transactionsData, error: transactionsError } = await supabase
  .from('financial_records')
  .select(`
    *,
    students (student_id, full_name, program, program_code)
  `)
  .order('created_at', { ascending: false });
// Remove .limit(50) entirely
      
      if (transactionsError) throw transactionsError;
      
      if (transactionsData) {
        setAllTransactions(transactionsData);
        calculateStats(transactionsData);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      alert('Failed to load dashboard data');
    } finally {
      setLoading(prev => ({ ...prev, analytics: false }));
    }
  };

  const fetchStudents = async () => {
    setLoading(prev => ({ ...prev, students: true }));
    
    try {
      let query = supabase
        .from('students')
        .select('id, student_id, full_name, email, program, academic_year, phone, year_of_study, semester, status')
        .order('full_name');
      
      // Apply filters
      if (filters.program !== 'all') {
        query = query.eq('program', filters.program);
      }
      
      if (filters.academicYear !== 'all') {
        query = query.eq('academic_year', filters.academicYear);
      }
      
      if (filters.semester !== 'all') {
        query = query.eq('semester', parseInt(filters.semester));
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setStudents(data || []);
      setFilteredStudents(data || []);
      
    } catch (error) {
      console.error('Error fetching students:', error);
      alert('Failed to load students');
    } finally {
      setLoading(prev => ({ ...prev, students: false }));
    }
  };

  const fetchStudentFinance = async (studentId) => {
    setLoading(prev => ({ ...prev, transactions: true }));
    
    try {
      // Fetch financial records
      const { data: recordsData, error: recordsError } = await supabase
        .from('financial_records')
        .select('*')
        .eq('student_id', studentId)
        .order('due_date', { ascending: true });
      
      if (recordsError) throw recordsError;
      
      if (recordsData) {
        setFinancialRecords(recordsData);
      }
      
      // Fetch fee assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('student_fee_assignments')
        .select(`
          *,
          fee_categories (category_name, category_code),
          program_fee_templates (amount, fee_category_id)
        `)
        .eq('student_id', studentId);
      
      if (assignmentsError) throw assignmentsError;
      
      if (assignmentsData) {
        setStudentFeeAssignments(assignmentsData);
      }
      
    } catch (error) {
      console.error('Error fetching student finance:', error);
      alert('Failed to load financial data');
    } finally {
      setLoading(prev => ({ ...prev, transactions: false }));
    }
  };

  const fetchAllTransactions = async () => {
    setLoading(prev => ({ ...prev, transactions: true }));
    
    try {
      let query = supabase
        .from('financial_records')
        .select(`
          *,
          students (student_id, full_name, program, program_code, academic_year)
        `);
      
      // Apply date filter
      if (filters.dateRange !== 'all') {
        const now = new Date();
        let startDate;
        
        switch (filters.dateRange) {
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'week':
            startDate = subDays(now, 7);
            break;
          case 'month':
            startDate = subDays(now, 30);
            break;
          case 'quarter':
            startDate = subDays(now, 90);
            break;
          case 'year':
            startDate = subDays(now, 365);
            break;
          default:
            break;
        }
        
        if (startDate) {
          query = query.gte('created_at', startDate.toISOString());
        }
      }
      
      // Apply status filter
      if (filters.paymentStatus !== 'all') {
        query = query.eq('status', filters.paymentStatus);
      }
      
      // Apply amount range filter
      if (filters.amountRange.min > 0 || filters.amountRange.max < 100000) {
        query = query.gte('amount', filters.amountRange.min);
        query = query.lte('amount', filters.amountRange.max);
      }
      
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setAllTransactions(data || []);
      
    } catch (error) {
      console.error('Error fetching transactions:', error);
      alert('Failed to load transactions');
    } finally {
      setLoading(prev => ({ ...prev, transactions: false }));
    }
  };

  const fetchReportsData = async () => {
    setLoading(prev => ({ ...prev, reports: true }));
    
    try {
      // Fetch data for various reports
      const { data: revenueByProgram, error: revenueError } = await supabase
        .from('financial_records')
        .select(`
          amount,
          status,
          students!inner (program, program_code)
        `)
        .eq('status', 'paid');
      
      if (revenueError) throw revenueError;
      
      const { data: overdueReport, error: overdueError } = await supabase
        .from('financial_records')
        .select(`
          *,
          students (full_name, student_id, program, email)
        `)
        .eq('status', 'overdue');
      
      if (overdueError) throw overdueError;
      
      // Store report data in state if needed
      
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(prev => ({ ...prev, reports: false }));
    }
  };

  const calculateStats = (transactions) => {
    const paidTransactions = transactions.filter(t => t.status === 'paid');
    const pendingTransactions = transactions.filter(t => t.status === 'pending');
    const overdueTransactions = transactions.filter(t => t.status === 'overdue');
    
    const totalRevenue = paidTransactions.reduce((sum, t) => sum + t.amount, 0);
    const pendingAmount = pendingTransactions.reduce((sum, t) => sum + t.amount, 0);
    const overdueAmount = overdueTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    const totalBilled = totalRevenue + pendingAmount + overdueAmount;
    const collectionRate = totalBilled > 0 ? (totalRevenue / totalBilled) * 100 : 0;
    
    setStats({
      totalRevenue,
      pendingAmount,
      overdueAmount,
      totalStudents: students.length,
      clearedStudents: students.length - overdueTransactions.length,
      collectionRate: parseFloat(collectionRate.toFixed(2))
    });
  };

  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setActiveTab('student-detail');
  };

  const handleUpdatePaymentStatus = async (recordId, newStatus) => {
    if (!window.confirm(`Are you sure you want to mark this as ${newStatus}?`)) return;

    const updates = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    
    if (newStatus === 'paid') {
      updates.payment_date = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'pending' || newStatus === 'overdue') {
      updates.payment_date = null;
    }

    try {
      const { error } = await supabase
        .from('financial_records')
        .update(updates)
        .eq('id', recordId);

      if (error) throw error;
      
      alert('Status updated successfully!');
      
      // Refresh data
      if (selectedStudent) {
        fetchStudentFinance(selectedStudent.id);
      }
      fetchAllTransactions();
      fetchDashboardData();
      
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + error.message);
    }
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    
    if (!newPayment.student_id || !newPayment.amount || !newPayment.description) {
      alert('Please fill in all required fields');
      return;
    }

    const paymentData = {
      ...newPayment,
      amount: parseFloat(newPayment.amount),
      status: 'pending',
      created_at: new Date().toISOString(),
      academic_year: newPayment.academic_year || new Date().getFullYear().toString(),
      semester: parseInt(newPayment.semester) || 1
    };

    // Generate receipt number if not provided
    if (!paymentData.receipt_number) {
      const timestamp = new Date().getTime();
      const random = Math.floor(Math.random() * 1000);
      paymentData.receipt_number = `REC${timestamp}${random}`;
    }

    try {
      const { error } = await supabase
        .from('financial_records')
        .insert([paymentData]);

      if (error) throw error;
      
      alert('Payment record created successfully!');
      setShowNewPaymentModal(false);
      setNewPayment({
        student_id: '',
        amount: '',
        description: '',
        due_date: '',
        category: feeCategories.length > 0 ? feeCategories[0].category_code : '',
        academic_year: new Date().getFullYear().toString(),
        semester: 1,
        receipt_number: '',
        payment_method: 'bank_transfer'
      });
      
      // Refresh data
      if (selectedStudent) {
        fetchStudentFinance(selectedStudent.id);
      }
      fetchAllTransactions();
      fetchDashboardData();
      
    } catch (error) {
      console.error('Error creating payment:', error);
      alert('Error creating payment: ' + error.message);
    }
  };

  const handleExportData = async (type) => {
    try {
      let data = [];
      let filename = '';
      let worksheetData = [];
      
      switch (type) {
        case 'transactions':
          const { data: transactions, error: transactionsError } = await supabase
            .from('financial_records')
            .select(`
              *,
              students (full_name, student_id, program, program_code)
            `)
            .order('created_at', { ascending: false });
          
          if (transactionsError) throw transactionsError;
          
          data = transactions || [];
          filename = `transactions_export_${format(new Date(), 'yyyy-MM-dd')}`;
          
          // Format data for Excel
          worksheetData = data.map(item => ({
            'Receipt Number': item.receipt_number || 'N/A',
            'Date': format(new Date(item.created_at), 'yyyy-MM-dd HH:mm'),
            'Student ID': item.students?.student_id || 'N/A',
            'Student Name': item.students?.full_name || 'Unknown',
            'Program Code': item.students?.program_code || 'N/A',
            'Program': item.students?.program || 'N/A',
            'Description': item.description,
            'Amount': item.amount,
            'Category': item.category || 'N/A',
            'Status': item.status,
            'Payment Method': item.payment_method || 'N/A',
            'Payment Date': item.payment_date ? format(new Date(item.payment_date), 'yyyy-MM-dd') : 'N/A',
            'Due Date': item.due_date ? format(new Date(item.due_date), 'yyyy-MM-dd') : 'N/A',
            'Academic Year': item.academic_year || 'N/A',
            'Semester': item.semester || 'N/A'
          }));
          break;
          
        case 'overdue':
          const { data: overdue, error: overdueError } = await supabase
            .from('financial_records')
            .select(`
              *,
              students (full_name, student_id, program, program_code, email, phone)
            `)
            .eq('status', 'overdue')
            .order('due_date');
          
          if (overdueError) throw overdueError;
          
          data = overdue || [];
          filename = `overdue_payments_${format(new Date(), 'yyyy-MM-dd')}`;
          
          // Format data for Excel
          worksheetData = data.map(item => ({
            'Receipt Number': item.receipt_number || 'N/A',
            'Student ID': item.students?.student_id || 'N/A',
            'Student Name': item.students?.full_name || 'Unknown',
            'Email': item.students?.email || 'N/A',
            'Phone': item.students?.phone || 'N/A',
            'Program Code': item.students?.program_code || 'N/A',
            'Program': item.students?.program || 'N/A',
            'Description': item.description,
            'Amount': item.amount,
            'Due Date': item.due_date ? format(new Date(item.due_date), 'yyyy-MM-dd') : 'N/A',
            'Days Overdue': item.due_date ? 
              Math.max(0, Math.floor((new Date() - new Date(item.due_date)) / (1000 * 60 * 60 * 24))) : 0,
            'Category': item.category || 'N/A',
            'Academic Year': item.academic_year || 'N/A',
            'Semester': item.semester || 'N/A'
          }));
          break;
          
        case 'students':
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .order('full_name');
          
          if (studentsError) throw studentsError;
          
          data = studentsData || [];
          filename = `students_export_${format(new Date(), 'yyyy-MM-dd')}`;
          
          // Format data for Excel
          worksheetData = data.map(item => ({
            'Student ID': item.student_id,
            'Full Name': item.full_name,
            'Email': item.email,
            'Phone': item.phone || 'N/A',
            'Program Code': item.program_code || 'N/A',
            'Program': item.program || 'N/A',
            'Academic Year': item.academic_year || 'N/A',
            'Year of Study': item.year_of_study || 'N/A',
            'Semester': item.semester || 'N/A',
            'Status': item.status || 'active',
            'Intake': item.intake || 'N/A',
            'Date of Birth': item.date_of_birth || 'N/A',
            'Last Login': item.last_login ? format(new Date(item.last_login), 'yyyy-MM-dd HH:mm') : 'Never',
            'Registration Number': item.registration_number || 'N/A'
          }));
          break;
          
        default:
          return;
      }
      
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      
      // Auto-size columns
      const maxWidth = worksheetData.reduce((w, r) => Math.max(w, Object.keys(r).reduce((mw, k) => 
        Math.max(mw, k.length, (r[k] || '').toString().length), 0)), 10);
      
      worksheet['!cols'] = Object.keys(worksheetData[0] || {}).map(() => ({ width: maxWidth + 2 }));
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      
      // Generate Excel file
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      
      alert(`Export completed: ${filename}.xlsx`);
      
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data: ' + error.message);
    }
  };

  const handleGenerateReceipt = async (recordId) => {
    try {
      const { data: record, error } = await supabase
        .from('financial_records')
        .select(`
          *,
          students (full_name, student_id, program, program_code)
        `)
        .eq('id', recordId)
        .single();
      
      if (error) throw error;
      
      if (!record) {
        alert('Record not found');
        return;
      }
      
      // Create receipt HTML content
      const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt ${record.receipt_number || record.id.substring(0, 8)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #2c3e50; }
            .header p { margin: 5px 0; color: #7f8c8d; }
            .section { margin-bottom: 20px; }
            .section h3 { color: #34495e; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            .details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .detail-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #2c3e50; }
            .detail-value { color: #34495e; }
            .amount { font-size: 24px; font-weight: bold; color: #27ae60; text-align: right; }
            .footer { margin-top: 50px; text-align: center; color: #7f8c8d; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>FINANCE RECEIPT</h1>
            <p>University Finance Department</p>
            <p>Official Payment Receipt</p>
          </div>
          
          <div class="section">
            <h3>Receipt Details</h3>
            <div class="details">
              <div class="detail-item">
                <span class="detail-label">Receipt No:</span>
                <span class="detail-value">${record.receipt_number || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${format(new Date(record.created_at), 'dd/MM/yyyy HH:mm')}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Transaction ID:</span>
                <span class="detail-value">${record.id.substring(0, 8)}...</span>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3>Student Details</h3>
            <div class="details">
              <div class="detail-item">
                <span class="detail-label">Name:</span>
                <span class="detail-value">${record.students?.full_name || 'Unknown'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Student ID:</span>
                <span class="detail-value">${record.students?.student_id || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Program:</span>
                <span class="detail-value">${record.students?.program || 'N/A'} (${record.students?.program_code || 'N/A'})</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Academic Year:</span>
                <span class="detail-value">${record.academic_year || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3>Payment Details</h3>
            <div class="details">
              <div class="detail-item">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${record.description}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Category:</span>
                <span class="detail-value">${record.category || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Payment Method:</span>
                <span class="detail-value">${record.payment_method || 'N/A'}</span>
              </div>
              ${record.payment_date ? `
                <div class="detail-item">
                  <span class="detail-label">Payment Date:</span>
                  <span class="detail-value">${format(new Date(record.payment_date), 'dd/MM/yyyy')}</span>
                </div>
              ` : ''}
              ${record.due_date ? `
                <div class="detail-item">
                  <span class="detail-label">Due Date:</span>
                  <span class="detail-value">${format(new Date(record.due_date), 'dd/MM/yyyy')}</span>
                </div>
              ` : ''}
            </div>
          </div>
          
          <div class="section">
            <div class="detail-item" style="border-bottom: 2px solid #000;">
              <span class="detail-label" style="font-size: 18px;">Amount:</span>
              <span class="amount">$${record.amount.toFixed(2)}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="detail-item">
              <span class="detail-label">Status:</span>
              <span class="detail-value" style="color: ${record.status === 'paid' ? '#27ae60' : record.status === 'overdue' ? '#e74c3c' : '#f39c12'}; font-weight: bold;">
                ${record.status.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div class="footer">
            <p>Official Receipt - University Finance Department</p>
            <p>Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            <p>For inquiries, contact: finance@university.edu</p>
          </div>
          
          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Print Receipt
            </button>
          </div>
        </body>
        </html>
      `;
      
      // Open receipt in new window
      const receiptWindow = window.open('', '_blank');
      receiptWindow.document.write(receiptHTML);
      receiptWindow.document.close();
      
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('Error generating receipt: ' + error.message);
    }
  };

  const handleDeleteTransaction = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('financial_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      
      alert('Transaction deleted successfully!');
      
      // Refresh data
      if (selectedStudent) {
        fetchStudentFinance(selectedStudent.id);
      }
      fetchAllTransactions();
      fetchDashboardData();
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Error deleting transaction: ' + error.message);
    }
  };

  const handleRefreshData = () => {
    switch (activeTab) {
      case 'overview':
        fetchDashboardData();
        break;
      case 'students':
        fetchStudents();
        break;
      case 'transactions':
        fetchAllTransactions();
        break;
      case 'student-detail':
        if (selectedStudent) {
          fetchStudentFinance(selectedStudent.id);
        }
        break;
      case 'reports':
        fetchReportsData();
        break;
    }
    alert('Data refreshed successfully!');
  };

  // Analytics Calculations
  const analytics = useMemo(() => {
    // Monthly revenue data
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const monthKey = format(date, 'yyyy-MM');
      
      const monthRevenue = (allTransactions || [])
        .filter(t => {
          if (!t || t.status !== 'paid' || !t.payment_date) return false;
          try {
            const paymentDate = parseISO(t.payment_date);
            return format(paymentDate, 'yyyy-MM') === monthKey;
          } catch (error) {
            return false;
          }
        })
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      return {
        month: format(date, 'MMM'),
        revenue: monthRevenue,
        fullDate: date
      };
    });

    // Revenue by program - USING PROGRAM CODE INSTEAD OF FULL NAME
    const revenueByProgram = (allTransactions || [])
      .filter(t => t && t.status === 'paid')
      .reduce((acc, t) => {
        // Use program_code if available, otherwise use program name
        const programCode = t.students?.program_code || t.students?.program || 'Unknown';
        if (!acc[programCode]) {
          acc[programCode] = 0;
        }
        acc[programCode] += t.amount || 0;
        return acc;
      }, {});

    const programData = Object.entries(revenueByProgram || {})
      .map(([code, value]) => ({ 
        name: code, // Using program code for display
        value,
        programName: programs.find(p => p.code === code)?.name || code // Store full name for tooltip
      }))
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);

    // Payment status distribution
    const statusData = [
      { name: 'Paid', value: (allTransactions || []).filter(t => t && t.status === 'paid').length },
      { name: 'Pending', value: (allTransactions || []).filter(t => t && t.status === 'pending').length },
      { name: 'Overdue', value: (allTransactions || []).filter(t => t && t.status === 'overdue').length },
      { name: 'Cancelled', value: (allTransactions || []).filter(t => t && t.status === 'cancelled').length }
    ];
// Fee category distribution
const categoryDistribution = {};

(allTransactions || []).forEach((t) => {
  if (!t || !t.category) return;
  
  // Clean the category code by converting to lowercase and trimming
  const categoryCode = t.category.toLowerCase().trim();
  
  if (!categoryDistribution[categoryCode]) {
    categoryDistribution[categoryCode] = 0;
  }
  categoryDistribution[categoryCode] += t.amount || 0;
});

const categoryData = Object.entries(categoryDistribution)
  .map(([categoryCode, value]) => {
    // Find the category info - match by category_code in lowercase
    const categoryInfo = feeCategories.find(cat => 
      cat.category_code.toLowerCase() === categoryCode.toLowerCase()
    );
    
    let displayName = categoryCode;
    
    // First check if we have an exact match in feeCategories
    if (categoryInfo) {
      displayName = categoryInfo.category_name || categoryInfo.category_code;
    } 
    // If not found exactly, check for partial matches (like "reg" matching "registration")
    else {
      // Try to find a category that contains this code or vice versa
      const partialMatch = feeCategories.find(cat => 
        categoryCode.includes(cat.category_code.toLowerCase()) ||
        cat.category_code.toLowerCase().includes(categoryCode)
      );
      
      if (partialMatch) {
        displayName = partialMatch.category_name || partialMatch.category_code;
      } else {
        // Common category mapping for known abbreviations
        const commonCategoryMapping = {
          'reg': 'Registration Fees',
          'registration': 'Registration Fees',
          'tuition': 'Tuition Fees',
          'tuiton': 'Tuition Fees', // Common typo
          'functional': 'Functional Fees',
          'func': 'Functional Fees',
          'guild': 'Guild Fees',
          'nche': 'NCHE Fees',
          'semester': 'Semester Fees',
          'fee': 'Miscellaneous Fees'
        };
        
        if (commonCategoryMapping[categoryCode]) {
          displayName = commonCategoryMapping[categoryCode];
        } else {
          // Format to title case with "Fees" suffix if it's likely a fee category
          const isLikelyFee = categoryCode.includes('fee') || 
                              categoryCode.includes('payment') || 
                              categoryCode.includes('charge');
          
          displayName = categoryCode
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
            
          if (isLikelyFee && !displayName.toLowerCase().includes('fee')) {
            displayName += ' Fees';
          }
        }
      }
    }
    
    return {
      name: displayName,
      value: value,
      code: categoryCode
    };
  })
  .sort((a, b) => (b.value || 0) - (a.value || 0));
    // Top students by revenue
    const topStudents = (allTransactions || [])
      .filter(t => t && t.status === 'paid')
      .reduce((acc, t) => {
        if (!t.student_id) return acc;
        const studentId = t.student_id;
        if (!acc[studentId]) {
          acc[studentId] = {
            name: t.students?.full_name || 'Unknown',
            id: t.students?.student_id || 'N/A',
            total: 0
          };
        }
        acc[studentId].total += t.amount || 0;
        return acc;
      }, {});

    const topStudentsData = Object.values(topStudents || {})
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 5);
    
    return {
      monthlyData,
      programData,
      statusData,
      categoryData,
      topStudentsData,
      totalTransactions: (allTransactions || []).length,
      avgTransactionAmount: (allTransactions || []).length > 0 
        ? (allTransactions || []).reduce((sum, t) => sum + (t.amount || 0), 0) / (allTransactions || []).length 
        : 0
    };
  }, [allTransactions, feeCategories, programs]);

  const handleReportPreview = (reportType) => {
    let previewWindow = window.open('', '_blank');
    const reportTitle = {
      'revenue': 'Revenue Analysis Report',
      'overdue': 'Overdue Payments Report',
      'collection': 'Collection Performance Report',
      'statements': 'Monthly Statements Report',
      'profiles': 'Student Financial Profiles Report',
      'audit': 'Audit Trail Report'
    }[reportType];
    
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle || 'Report Preview'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; padding: 20px; }
          .report-header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
          .report-header h1 { color: #1e293b; margin-bottom: 10px; }
          .report-meta { color: #64748b; font-size: 14px; }
          .report-section { margin-bottom: 30px; }
          .report-section h2 { color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
          .placeholder { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 60px 20px; text-align: center; color: #64748b; margin: 20px 0; }
          .placeholder h3 { color: #475569; margin-bottom: 10px; }
          .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
          .data-table th { background: #f1f5f9; color: #1e293b; }
          .footer { margin-top: 50px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          .action-buttons { text-align: center; margin-top: 30px; }
          .action-btn { display: inline-block; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; margin: 0 10px; text-decoration: none; }
          .action-btn:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>${reportTitle || 'Financial Report Preview'}</h1>
          <div class="report-meta">
            Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')} | 
            Finance Department | University
          </div>
        </div>
        
        <div class="report-section">
          <h2>Report Summary</h2>
          <p>This is a preview of the ${reportTitle || 'financial report'}. The actual report would contain detailed financial data based on your selections.</p>
          <p>Use the export buttons below to generate the full report in Excel format for detailed analysis.</p>
        </div>
        
        <div class="report-section">
          <h2>Data Preview</h2>
          <div class="placeholder">
            <h3>📊 Report Data Visualization</h3>
            <p>The actual report would display charts and tables here.</p>
            <p>This preview shows the report format and structure.</p>
          </div>
          
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>Percentage</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Revenue</td>
                <td>$${stats.totalRevenue.toLocaleString()}</td>
                <td>100%</td>
                <td>↗️ +12.5%</td>
              </tr>
              <tr>
                <td>Paid Amount</td>
                <td>$${(stats.totalRevenue - stats.pendingAmount - stats.overdueAmount).toLocaleString()}</td>
                <td>${stats.collectionRate}%</td>
                <td>↗️ +5.2%</td>
              </tr>
              <tr>
                <td>Pending Amount</td>
                <td>$${stats.pendingAmount.toLocaleString()}</td>
                <td>${stats.pendingAmount > 0 ? ((stats.pendingAmount / stats.totalRevenue) * 100).toFixed(1) : 0}%</td>
                <td>⚠️ Needs Action</td>
              </tr>
              <tr>
                <td>Overdue Amount</td>
                <td>$${stats.overdueAmount.toLocaleString()}</td>
                <td>${stats.overdueAmount > 0 ? ((stats.overdueAmount / stats.totalRevenue) * 100).toFixed(1) : 0}%</td>
                <td>🔴 Immediate Action</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="action-buttons">
          <button class="action-btn" onclick="window.print()">🖨️ Print Report</button>
          <a href="#" class="action-btn" onclick="window.close()">✖️ Close Preview</a>
        </div>
        
        <div class="footer">
          <p>University Finance Department | Report Preview | Generated for internal use</p>
          <p>This is a preview only. Export to Excel for full functionality.</p>
        </div>
      </body>
      </html>
    `);
    previewWindow.document.close();
  };

 const confirmLogout = async () => {
  try {
    if (typeof signOut === 'function') {
      await signOut();
    } else {
      // Fallback: manual logout
      localStorage.removeItem('admin_user');
      await supabase.auth.signOut();
    }
    navigate('/login');
  } catch (error) {
    console.error('Logout error:', error);
    // Force navigation even if there's an error
    localStorage.removeItem('admin_user');
    navigate('/login');
  }
};
  // Filter controls component
  const FilterControls = () => (
    <div className="finance-filter-controls">
      <button 
        className="finance-filter-trigger"
        onClick={() => setShowFiltersModal(true)}
      >
        <Filter size={16} />
        Filters
        {Object.values(filters).some(v => v !== 'all' && (typeof v !== 'object' || Object.values(v).some(sv => sv !== 0 && sv !== 100000))) && (
          <span className="finance-filter-indicator"></span>
        )}
      </button>
      
      <div className="finance-quick-filters">
        <select 
          value={filters.dateRange}
          onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
          className="finance-quick-filter"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="quarter">Last Quarter</option>
          <option value="year">Last Year</option>
        </select>
        
        <select 
          value={filters.paymentStatus}
          onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}
          className="finance-quick-filter"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
          <option value="partial">Partial</option>
        </select>
      </div>
    </div>
  );

  // Render loading state
  if (loading.dashboard) {
    return (
      <div className="finance-loading-screen">
        <div className="finance-loading-content">
          <div className="finance-spinner"></div>
          <h2>Loading Finance Dashboard</h2>
          <p>Please wait while we fetch your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="finance-dashboard">
      {/* Header */}
      <header className="finance-dashboard-header">
        <div className="finance-header-content">
          <div className="finance-logo-section">
            <div className="finance-logo-icon">
              <Database size={32} />
            </div>
            <div>
              <h1 className="finance-logo">Finance Management System</h1>
              <p className="finance-tagline">University Financial Operations Dashboard</p>
            </div>
          </div>
          
          <div className="finance-header-right">
            <div className="finance-header-actions">
              <button className="finance-header-btn finance-notification-btn">
                <Bell size={20} />
                <span className="finance-notification-badge">3</span>
              </button>
              <button className="finance-header-btn finance-settings-btn">
                <Settings size={20} />
              </button>
              <div className="finance-user-profile">
                <div className="finance-avatar">
                  <User size={24} />
                </div>
                <div className="finance-user-details">
                  <span className="finance-user-name">{profile?.full_name || 'Finance Officer'}</span>
                  <span className="finance-user-email">{profile?.email || 'finance@university.edu'}</span>
                </div>
                <button 
                  className="finance-logout-btn"
                  onClick={() => setShowLogoutConfirm(true)}
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="finance-header-stats">
          <div className="finance-stat-item">
            <span className="finance-stat-label">Total Revenue</span>
            <span className="finance-stat-value">${stats.totalRevenue.toLocaleString()}</span>
            <span className="finance-stat-change positive">
              <TrendingUp size={14} />
              +12.5%
            </span>
          </div>
          <div className="finance-stat-item">
            <span className="finance-stat-label">Collection Rate</span>
            <span className="finance-stat-value">{stats.collectionRate}%</span>
            <span className="finance-stat-change positive">
              <TrendingUp size={14} />
              +5.2%
            </span>
          </div>
          <div className="finance-stat-item">
            <span className="finance-stat-label">Pending Payments</span>
            <span className="finance-stat-value">${stats.pendingAmount.toLocaleString()}</span>
            <span className="finance-stat-change warning">
              <AlertTriangle size={14} />
              {stats.pendingAmount > 0 ? 'Needs Action' : 'All Clear'}
            </span>
          </div>
          <div className="finance-stat-item">
            <span className="finance-stat-label">Active Students</span>
            <span className="finance-stat-value">{stats.totalStudents}</span>
            <span className="finance-stat-change neutral">
              <Users size={14} />
              {stats.clearedStudents} Active
            </span>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="finance-dashboard-nav">
        <div className="finance-nav-container">
          {[
            { id: 'overview', label: 'Overview', icon: <Home size={20} /> },
            { id: 'students', label: 'Students', icon: <Users size={20} /> },
            { id: 'transactions', label: 'Transactions', icon: <CreditCard size={20} /> },
            { id: 'student-detail', label: 'Student Details', icon: <User size={20} />, disabled: !selectedStudent },
            { id: 'reports', label: 'Reports', icon: <FileSpreadsheet size={20} /> },
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} /> }
          ].map(tab => (
            <button
              key={tab.id}
              className={`finance-nav-item ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
            >
              <span className="finance-nav-icon">{tab.icon}</span>
              <span className="finance-nav-label">{tab.label}</span>
              {activeTab === tab.id && <span className="finance-nav-indicator"></span>}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="finance-dashboard-main">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="finance-tab-content overview-tab">
            <div className="finance-tab-header">
              <h2><Activity size={24} /> Financial Overview</h2>
              <div className="finance-tab-actions">
                <button className="finance-action-btn primary" onClick={() => handleExportData('transactions')}>
                  <File size={16} /> Export Report
                </button>
                <button className="finance-action-btn" onClick={handleRefreshData}>
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="finance-quick-stats-grid">
              <div className="finance-quick-stat-card primary">
                <div className="finance-stat-icon">
                  <DollarSign size={24} />
                </div>
                <div className="finance-stat-content">
                  <h3>Total Revenue</h3>
                  <p className="stat-value">${stats.totalRevenue.toLocaleString()}</p>
                  <p className="finance-stat-trend">
                    <TrendingUp size={14} />
                    +12.5% from last month
                  </p>
                </div>
              </div>

              <div className="finance-quick-stat-card warning">
                <div className="finance-stat-icon">
                  <Clock size={24} />
                </div>
                <div className="finance-stat-content">
                  <h3>Pending Amount</h3>
                  <p className="stat-value">${stats.pendingAmount.toLocaleString()}</p>
                  <p className="finance-stat-detail">
                    <AlertTriangle size={14} />
                    {stats.pendingAmount > 10000 ? 'High Priority' : 'Normal'}
                  </p>
                </div>
              </div>

              <div className="finance-quick-stat-card danger">
                <div className="finance-stat-icon">
                  <AlertOctagon size={24} />
                </div>
                <div className="finance-stat-content">
                  <h3>Overdue Amount</h3>
                  <p className="stat-value">${stats.overdueAmount.toLocaleString()}</p>
                  <p className="finance-stat-detail">
                    <AlertCircle size={14} />
                    Immediate Action Required
                  </p>
                </div>
              </div>

              <div className="finance-quick-stat-card success">
                <div className="finance-stat-icon">
                  <Percent size={24} />
                </div>
                <div className="finance-stat-content">
                  <h3>Collection Rate</h3>
                  <p className="stat-value">{stats.collectionRate}%</p>
                  <p className="finance-stat-trend">
                    <TrendingUp size={14} />
                    +5.2% improvement
                  </p>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="finance-charts-section">
              <div className="finance-chart-row">
                <div className="finance-chart-card">
                  <div className="finance-chart-header">
                    <h3><LineChartIcon size={20} /> Monthly Revenue Trend</h3>
                    <select className="finance-chart-filter" onChange={(e) => {
                      const value = e.target.value;
                    }}>
                      <option>Last 6 Months</option>
                      <option>Last Year</option>
                      <option>Last 2 Years</option>
                    </select>
                  </div>
                  <div className="finance-chart-container">
                    {analytics.monthlyData && analytics.monthlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analytics.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                            labelFormatter={(label) => `Month: ${label}`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="#8884d8" 
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="finance-no-data">
                        <LineChartIcon size={32} />
                        <p>No revenue data available for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="finance-chart-card">
                  <div className="finance-chart-header">
                    <h3><PieChartIcon size={20} /> Revenue by Program</h3>
                  </div>
                  <div className="finance-chart-container">
                    {analytics.programData && analytics.programData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={analytics.programData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            // Display program codes in the pie chart labels
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {analytics.programData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name, props) => [
                              `$${value.toLocaleString()}`, 
                              'Amount'
                            ]}
                            labelFormatter={(label, payload) => {
                              // Show full program name in tooltip
                              const fullName = payload[0]?.payload?.programName || label;
                              return `${fullName} (${label})`;
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="finance-no-data">
                        <PieChartIcon size={32} />
                        <p>No program data available for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="finance-chart-row">
                <div className="finance-chart-card">
                  <div className="finance-chart-header">
                    <h3><BarChart3 size={20} /> Payment Status Distribution</h3>
                  </div>
                  <div className="finance-chart-container">
                    {analytics.statusData && analytics.statusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analytics.statusData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="finance-no-data">
                        <BarChart3 size={32} />
                        <p>No status data available for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>
<div className="finance-chart-card">
  <div className="finance-chart-header">
    <h3><PieChartIcon size={20} /> Fee Category Distribution</h3>
  </div>
  <div className="finance-chart-container">
    {analytics.categoryData && analytics.categoryData.length > 0 ? (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={analytics.categoryData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {analytics.categoryData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B', '#4ECDC4'][index % 7]}
              />
            ))}
          </Pie>

          {/* Tooltip: Shows ONLY category name and amount — NO percentage */}
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '10px',
            }}
            labelStyle={{ fontWeight: 'bold', color: '#333' }}
            formatter={(value) => `$${Number(value).toLocaleString()}`}
          />

          {/* Legend at bottom showing only category names with colors */}
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: '20px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    ) : (
      <div className="finance-no-data">
        <PieChartIcon size={32} />
        <p>No category data available for the selected period.</p>
      </div>
    )}
  </div>
</div>
              </div>
            </div>

            {/* Recent Transactions & Top Students */}
            <div className="finance-data-section">
              <div className="finance-data-column">
                <div className="finance-data-card">
                  <div className="finance-data-header">
                    <h3><History size={20} /> Recent Transactions</h3>
                    <button 
                      className="finance-view-all"
                      onClick={() => setActiveTab('transactions')}
                    >
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="finance-data-table-container">
                    <table className="finance-compact-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Student</th>
                          <th>Amount</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTransactions.slice(0, 5).map(record => (
                          <tr key={record.id}>
                            <td>
                              <div className="finance-date-cell">
                                <Calendar size={12} />
                                {format(new Date(record.created_at), 'MMM dd')}
                              </div>
                            </td>
                            <td>
                              <div className="finance-student-cell">
                                <User size={12} />
                                {record.students?.full_name || 'Unknown'}
                              </div>
                            </td>
                            <td>
                              <span className="finance-amount-cell">
                                ${record.amount.toFixed(2)}
                              </span>
                            </td>
                            <td>
                              <span className="finance-category-badge">
                                {record.category || 'N/A'}
                              </span>
                            </td>
                            <td>
                              <span className={`finance-status-badge ${record.status}`}>
                                {record.status.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="finance-action-icon"
                                onClick={() => handleGenerateReceipt(record.id)}
                                title="Generate Receipt"
                              >
                                <Receipt size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="finance-data-column">
                <div className="finance-data-card">
                  <div className="finance-data-header">
                    <h3><Award size={20} /> Top Paying Students</h3>
                  </div>
                  <div className="finance-top-students-list">
                    {analytics.topStudentsData && analytics.topStudentsData.length > 0 ? (
                      analytics.topStudentsData.map((student, index) => (
                        <div key={student.id || index} className="finance-top-student-item">
                          <div className="finance-student-rank">
                            <span className={`finance-rank-badge rank-${index + 1}`}>
                              #{index + 1}
                            </span>
                          </div>
                          <div className="finance-student-info">
                            <div className="finance-student-name">{student.name}</div>
                            <div className="finance-student-id">ID: {student.id}</div>
                          </div>
                          <div className="finance-student-amount">
                            ${(student.total || 0).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="finance-empty-state" style={{padding: '2rem', textAlign: 'center'}}>
                        <Award size={32} />
                        <p style={{marginTop: '1rem', color: '#666'}}>No top paying student data available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="finance-tab-content students-tab">
            <div className="finance-tab-header">
              <h2><Users size={24} /> Student Management</h2>
              <div className="finance-tab-actions">
                <div className="finance-search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search students by name, ID, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="finance-search-input"
                  />
                  {searchTerm && (
                    <button 
                      className="finance-clear-search"
                      onClick={() => setSearchTerm('')}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <FilterControls />
                <button 
                  className="finance-action-btn primary"
                  onClick={() => setShowNewPaymentModal(true)}
                >
                  <Plus size={16} /> New Invoice
                </button>
              </div>
            </div>

            {/* Student Stats */}
            <div className="finance-student-stats">
              <div className="finance-stat-badge">
                <span className="finance-stat-label">Total Students</span>
                <span className="finance-stat-number">{students.length}</span>
              </div>
              <div className="finance-stat-badge success">
                <span className="finance-stat-label">Fully Paid</span>
                <span className="finance-stat-number">
                  {students.length - allTransactions.filter(t => t.status !== 'paid').length}
                </span>
              </div>
              <div className="finance-stat-badge warning">
                <span className="finance-stat-label">Pending</span>
                <span className="finance-stat-number">
                  {allTransactions.filter(t => t.status === 'pending').length}
                </span>
              </div>
              <div className="finance-stat-badge danger">
                <span className="finance-stat-label">Overdue</span>
                <span className="finance-stat-number">
                  {allTransactions.filter(t => t.status === 'overdue').length}
                </span>
              </div>
            </div>

            {loading.students ? (
              <div className="finance-loading-state">
                <Loader2 className="finance-spinner" size={32} />
                <p>Loading students...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="finance-empty-state">
                <Users size={48} />
                <h3>No Students Found</h3>
                <p>Try adjusting your search or filters</p>
                <button 
                  className="finance-action-btn primary"
                  onClick={() => {
                    setSearchTerm('');
                    setFilters({
                      dateRange: 'all',
                      paymentStatus: 'all',
                      amountRange: { min: 0, max: 100000 },
                      program: 'all',
                      academicYear: 'all',
                      semester: 'all'
                    });
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="finance-table-container">
                <div className="finance-table-info">
                  <span className="finance-total-count">Showing {filteredStudents.length} students</span>
                </div>
                <table className="finance-data-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Program</th>
                      <th>Year/Semester</th>
                      <th>Academic Year</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(student => (
                      <tr key={student.id}>
                        <td>
                          <div className="finance-student-id-cell">
                            <ShieldCheck size={12} />
                            <strong>{student.student_id}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="finance-student-name-cell">
                            <User size={14} />
                            <span>{student.full_name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="finance-program-badge">
                            {student.program || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className="finance-year-semester">
                            Y{student.year_of_study || 1} S{student.semester || 1}
                          </span>
                        </td>
                        <td>{student.academic_year || 'N/A'}</td>
                        <td>
                          <div className="finance-contact-info">
                            <div className="finance-contact-item">
                              <Mail size={12} />
                              <span>{student.email}</span>
                            </div>
                            {student.phone && (
                              <div className="finance-contact-item">
                                <Phone size={12} />
                                <span>{student.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`finance-status-badge ${student.status || 'active'}`}>
                            {student.status?.toUpperCase() || 'ACTIVE'}
                          </span>
                        </td>
                        <td>
                          <div className="finance-action-buttons">
                            <button
                              className="finance-action-btn view"
                              onClick={() => handleViewStudent(student)}
                              title="View Financial Details"
                            >
                              <Eye size={14} /> View
                            </button>
                            <button
                              className="finance-action-btn primary"
                              onClick={() => {
                                setNewPayment(prev => ({ 
                                  ...prev, 
                                  student_id: student.id,
                                  academic_year: student.academic_year || new Date().getFullYear().toString(),
                                  semester: student.semester || 1
                                }));
                                setShowNewPaymentModal(true);
                              }}
                              title="Create Invoice"
                            >
                              <CreditCard size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="finance-tab-content transactions-tab">
            <div className="finance-tab-header">
              <h2><CreditCard size={24} /> All Transactions</h2>
              <div className="finance-tab-actions">
                <div className="finance-transaction-actions">
                  <FilterControls />
                  <div className="finance-export-buttons">
                    <button 
                      className="finance-action-btn primary"
                      onClick={() => handleExportData('transactions')}
                    >
                      <File size={16} /> Export All
                    </button>
                    <button 
                      className="finance-action-btn danger"
                      onClick={() => handleExportData('overdue')}
                    >
                      <AlertTriangle size={16} /> Overdue Report
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Summary */}
            <div className="finance-transaction-summary">
              <div className="finance-summary-card">
                <div className="finance-summary-icon">
                  <Database size={20} />
                </div>
                <div>
                  <h4>Total Transactions</h4>
                  <p className="finance-summary-value">{allTransactions.length}</p>
                </div>
              </div>
              
              <div className="finance-summary-card success">
                <div className="finance-summary-icon">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <h4>Paid Amount</h4>
                  <p className="finance-summary-value">
                    ${allTransactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="finance-summary-card warning">
                <div className="finance-summary-icon">
                  <Clock size={20} />
                </div>
                <div>
                  <h4>Pending Amount</h4>
                  <p className="finance-summary-value">
                    ${allTransactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="finance-summary-card danger">
                <div className="finance-summary-icon">
                  <AlertOctagon size={20} />
                </div>
                <div>
                  <h4>Overdue Amount</h4>
                  <p className="finance-summary-value">
                    ${allTransactions.filter(t => t.status === 'overdue').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {loading.transactions ? (
              <div className="finance-loading-state">
                <Loader2 className="finance-spinner" size={32} />
                <p>Loading transactions...</p>
              </div>
            ) : allTransactions.length === 0 ? (
              <div className="finance-empty-state">
                <CreditCard size={48} />
                <h3>No Transactions Found</h3>
                <p>Try adjusting your filters or create a new transaction</p>
                <button 
                  className="finance-action-btn primary"
                  onClick={() => setShowNewPaymentModal(true)}
                >
                  <Plus size={16} /> Create Transaction
                </button>
              </div>
            ) : (
              <div className="finance-table-container">
                <div className="finance-table-info">
                  <span className="finance-total-count">Showing {allTransactions.length} transactions</span>
                </div>
                <table className="finance-data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Transaction ID</th>
                      <th>Student</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTransactions.map(record => (
                      <tr key={record.id}>
                        <td>
                          <div className="finance-date-cell">
                            <Calendar size={12} />
                            {format(new Date(record.created_at), 'MMM dd, yyyy')}
                          </div>
                        </td>
                        <td>
                          <code className="finance-transaction-id">{record.id.substring(0, 8)}...</code>
                        </td>
                        <td>
                          <div className="finance-student-info-cell">
                            <User size={12} />
                            <div>
                              <div className="finance-student-name">{record.students?.full_name || 'Unknown'}</div>
                              <div className="finance-student-id">{record.students?.student_id || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td>{record.description}</td>
                        <td>
                          <span className="finance-category-badge">
                            {record.category || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className={`finance-amount-cell ${record.status}`}>
                            ${record.amount.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          {record.due_date ? (
                            <div className="finance-date-cell">
                              <CalendarDays size={12} />
                              {format(new Date(record.due_date), 'MMM dd, yyyy')}
                            </div>
                          ) : '—'}
                        </td>
                        <td>
                          <span className={`finance-status-badge ${record.status}`}>
                            {record.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div className="finance-action-buttons compact">
                            {record.status === 'pending' && (
                              <button
                                className="finance-action-btn success small"
                                onClick={() => handleUpdatePaymentStatus(record.id, 'paid')}
                                title="Mark as Paid"
                              >
                                <Check size={12} />
                              </button>
                            )}
                            {record.status === 'paid' && (
                              <button
                                className="finance-action-btn warning small"
                                onClick={() => handleUpdatePaymentStatus(record.id, 'pending')}
                                title="Revert to Pending"
                              >
                                <Clock size={12} />
                              </button>
                            )}
                            <button 
                              className="finance-action-btn small"
                              onClick={() => handleGenerateReceipt(record.id)}
                              title="Generate Receipt"
                            >
                              <Receipt size={12} />
                            </button>
                            <button 
                              className="finance-action-btn danger small"
                              onClick={() => handleDeleteTransaction(record.id)}
                              title="Delete Transaction"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Student Detail Tab */}
        {activeTab === 'student-detail' && selectedStudent && (
          <div className="finance-tab-content student-detail-tab">
            <div className="finance-tab-header">
              <div className="finance-student-header">
                <button
                  className="finance-back-button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setActiveTab('students');
                  }}
                >
                  <ChevronLeft size={16} /> Back to Students
                </button>
                <div className="finance-student-title">
                  <h2>
                    <User size={24} /> {selectedStudent.full_name}
                  </h2>
                  <p className="finance-student-subtitle">
                    {selectedStudent.student_id} • {selectedStudent.program} • 
                    Academic Year: {selectedStudent.academic_year} • 
                    Year {selectedStudent.year_of_study || 1}, Semester {selectedStudent.semester || 1}
                  </p>
                </div>
              </div>
              <div className="finance-tab-actions">
                <button 
                  className="finance-action-btn primary"
                  onClick={() => {
                    setNewPayment(prev => ({ 
                      ...prev, 
                      student_id: selectedStudent.id,
                      academic_year: selectedStudent.academic_year || new Date().getFullYear().toString(),
                      semester: selectedStudent.semester || 1
                    }));
                    setShowNewPaymentModal(true);
                  }}
                >
                  <Plus size={16} /> New Invoice
                </button>
                <button 
                  className="finance-action-btn"
                  onClick={() => handleExportData('transactions')}
                >
                  <File size={16} /> Export History
                </button>
              </div>
            </div>

            {/* Student Financial Summary */}
            <div className="finance-financial-summary-grid">
              <div className="finance-financial-card">
                <div className="finance-card-header">
                  <h3><DollarSign size={20} /> Total Billed</h3>
                </div>
                <div className="finance-card-body">
                  <p className="finance-amount-large">
                    ${financialRecords.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                  </p>
                  <p className="finance-card-subtitle">All time charges</p>
                </div>
              </div>
              
              <div className="finance-financial-card success">
                <div className="finance-card-header">
                  <h3><CheckCircle size={20} /> Total Paid</h3>
                </div>
                <div className="finance-card-body">
                  <p className="finance-amount-large success">
                    ${financialRecords.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                  </p>
                  <p className="finance-card-subtitle">Cleared payments</p>
                </div>
              </div>
              
              <div className="finance-financial-card warning">
                <div className="finance-card-header">
                  <h3><Clock size={20} /> Pending</h3>
                </div>
                <div className="finance-card-body">
                  <p className="finance-amount-large warning">
                    ${financialRecords.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                  </p>
                  <p className="finance-card-subtitle">Awaiting payment</p>
                </div>
              </div>
              
              <div className="finance-financial-card danger">
                <div className="finance-card-header">
                  <h3><AlertOctagon size={20} /> Overdue</h3>
                </div>
                <div className="finance-card-body">
                  <p className="finance-amount-large danger">
                    ${financialRecords.filter(r => r.status === 'overdue').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                  </p>
                  <p className="finance-card-subtitle">Past due payments</p>
                </div>
              </div>
            </div>

            {/* Student Financial Records */}
            {loading.transactions ? (
              <div className="finance-loading-state">
                <Loader2 className="finance-spinner" size={32} />
                <p>Loading financial records...</p>
              </div>
            ) : financialRecords.length === 0 ? (
              <div className="finance-empty-state">
                <FileText size={48} />
                <h3>No Financial Records Found</h3>
                <p>This student doesn't have any financial records yet.</p>
                <button 
                  className="finance-action-btn primary"
                  onClick={() => {
                    setNewPayment(prev => ({ 
                      ...prev, 
                      student_id: selectedStudent.id,
                      academic_year: selectedStudent.academic_year || new Date().getFullYear().toString(),
                      semester: selectedStudent.semester || 1
                    }));
                    setShowNewPaymentModal(true);
                  }}
                >
                  <Plus size={16} /> Create First Invoice
                </button>
              </div>
            ) : (
              <div className="finance-table-container">
                <div className="finance-table-header">
                  <h3>Financial Records</h3>
                  <span className="finance-record-count">{financialRecords.length} records</span>
                </div>
                <table className="finance-data-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Issue Date</th>
                      <th>Due Date</th>
                      <th>Payment Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialRecords.map(record => (
                      <tr key={record.id}>
                        <td>
                          <code className="finance-invoice-number">
                            {record.receipt_number || record.id.substring(0, 8)}
                          </code>
                        </td>
                        <td>{record.description}</td>
                        <td>
                          <span className="finance-category-badge">
                            {record.category || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className={`finance-amount-cell ${record.status}`}>
                            ${record.amount.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          {format(new Date(record.created_at), 'MMM dd, yyyy')}
                        </td>
                        <td>
                          {record.due_date ? (
                            <span className={`finance-due-date ${new Date(record.due_date) < new Date() ? 'overdue' : ''}`}>
                              {format(new Date(record.due_date), 'MMM dd, yyyy')}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {record.payment_date ? (
                            format(new Date(record.payment_date), 'MMM dd, yyyy')
                          ) : '—'}
                        </td>
                        <td>
                          <span className={`finance-status-badge ${record.status}`}>
                            {record.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div className="finance-action-buttons compact">
                            {record.status === 'pending' && (
                              <button
                                className="finance-action-btn success small"
                                onClick={() => handleUpdatePaymentStatus(record.id, 'paid')}
                                title="Mark as Paid"
                              >
                                <Check size={12} />
                              </button>
                            )}
                            {record.status === 'paid' && (
                              <button
                                className="finance-action-btn warning small"
                                onClick={() => handleUpdatePaymentStatus(record.id, 'pending')}
                                title="Revert to Pending"
                              >
                                <Clock size={12} />
                              </button>
                            )}
                            <button 
                              className="finance-action-btn small"
                              onClick={() => handleGenerateReceipt(record.id)}
                              title="Generate Receipt"
                            >
                              <Receipt size={12} />
                            </button>
                            <button 
                              className="finance-action-btn danger small"
                              onClick={() => handleDeleteTransaction(record.id)}
                              title="Delete Record"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Fee Assignments Section */}
            {studentFeeAssignments.length > 0 && (
              <div className="finance-fee-assignments-section">
                <div className="finance-section-header">
                  <h3><Package size={20} /> Fee Assignments</h3>
                </div>
                <div className="finance-fee-assignments-grid">
                  {studentFeeAssignments.map(assignment => (
                    <div key={assignment.id} className="finance-fee-assignment-card">
                      <div className="finance-fee-header">
                        <h4>{assignment.fee_categories?.category_name || 'Fee'}</h4>
                        <span className={`finance-status-badge ${assignment.status}`}>
                          {assignment.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="finance-fee-details">
                        <div className="finance-fee-detail">
                          <span className="finance-label">Amount:</span>
                          <span className="finance-value">${assignment.amount.toFixed(2)}</span>
                        </div>
                        <div className="finance-fee-detail">
                          <span className="finance-label">Due Date:</span>
                          <span className="finance-value">
                            {assignment.due_date ? format(new Date(assignment.due_date), 'MMM dd, yyyy') : 'Not Set'}
                          </span>
                        </div>
                        <div className="finance-fee-detail">
                          <span className="finance-label">Academic Year:</span>
                          <span className="finance-value">{assignment.academic_year}</span>
                        </div>
                        <div className="finance-fee-detail">
                          <span className="finance-label">Semester:</span>
                          <span className="finance-value">{assignment.semester}</span>
                        </div>
                      </div>
                      <div className="finance-fee-actions">
                        <button className="finance-action-btn small">
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="finance-tab-content reports-tab">
            <div className="finance-tab-header">
              <h2><FileSpreadsheet size={24} /> Financial Reports</h2>
              <div className="finance-tab-actions">
                <div className="finance-report-period">
                  <Calendar size={16} />
                  <select className="finance-period-select" defaultValue="Last 30 Days">
                    <option>Last 30 Days</option>
                    <option>This Month</option>
                    <option>Last Month</option>
                    <option>This Quarter</option>
                    <option>This Year</option>
                    <option>Custom Range</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="finance-reports-grid">
              <div className="finance-report-card">
                <div className="finance-report-icon primary">
                  <BarChart3 size={24} />
                </div>
                <div className="finance-report-content">
                  <h3>Revenue Analysis</h3>
                  <p>Detailed revenue breakdown by program, category, and time period</p>
                  <div className="finance-report-actions">
                    <button 
                      className="finance-action-btn"
                      onClick={() => handleReportPreview('revenue')}
                    >
                      <Eye size={16} /> Preview
                    </button>
                    <button 
                      className="finance-action-btn primary"
                      onClick={() => handleExportData('transactions')}
                    >
                      <File size={16} /> Export Excel
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="finance-report-card">
                <div className="finance-report-icon danger">
                  <AlertOctagon size={24} />
                </div>
                <div className="finance-report-content">
                  <h3>Overdue Payments</h3>
                  <p>Comprehensive list of all overdue payments with contact information</p>
                  <div className="finance-report-actions">
                    <button 
                      className="finance-action-btn"
                      onClick={() => handleReportPreview('overdue')}
                    >
                      <Eye size={16} /> Preview
                    </button>
                    <button 
                      className="finance-action-btn danger"
                      onClick={() => handleExportData('overdue')}
                    >
                      <File size={16} /> Export Excel
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="finance-report-card">
                <div className="finance-report-icon success">
                  <TrendingUp size={24} />
                </div>
                <div className="finance-report-content">
                  <h3>Collection Performance</h3>
                  <p>Collection rates and trends analysis across departments and programs</p>
                  <div className="finance-report-actions">
                    <button 
                      className="finance-action-btn"
                      onClick={() => handleReportPreview('collection')}
                    >
                      <Eye size={16} /> Preview
                    </button>
                    <button 
                      className="finance-action-btn success"
                      onClick={() => handleExportData('transactions')}
                    >
                      <File size={16} /> Export Excel
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="finance-report-card">
                <div className="finance-report-icon warning">
                  <CalendarDays size={24} />
                </div>
                <div className="finance-report-content">
                  <h3>Monthly Statements</h3>
                  <p>Generate detailed monthly financial statements and summaries</p>
                  <div className="finance-report-actions">
                    <button 
                      className="finance-action-btn"
                      onClick={() => handleReportPreview('statements')}
                    >
                      <Eye size={16} /> Preview
                    </button>
                    <button className="finance-action-btn warning">
                      <Printer size={16} /> Print
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="finance-report-card">
                <div className="finance-report-icon">
                  <Users size={24} />
                </div>
                <div className="finance-report-content">
                  <h3>Student Financial Profiles</h3>
                  <p>Individual student financial history and payment patterns</p>
                  <div className="finance-report-actions">
                    <button 
                      className="finance-action-btn"
                      onClick={() => handleReportPreview('profiles')}
                    >
                      <Eye size={16} /> Preview
                    </button>
                    <button 
                      className="finance-action-btn"
                      onClick={() => handleExportData('students')}
                    >
                      <File size={16} /> Export Excel
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="finance-report-card">
                <div className="finance-report-icon">
                  <FileCheck size={24} />
                </div>
                <div className="finance-report-content">
                  <h3>Audit Trail</h3>
                  <p>Complete transaction history and modification logs</p>
                  <div className="finance-report-actions">
                    <button 
                      className="finance-action-btn"
                      onClick={() => handleReportPreview('audit')}
                    >
                      <Eye size={16} /> Preview
                    </button>
                    <button 
                      className="finance-action-btn"
                      onClick={() => handleExportData('transactions')}
                    >
                      <File size={16} /> Export Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats for Reports */}
            <div className="finance-report-stats">
              <div className="finance-report-stat-item">
                <h4>Total Reports Generated</h4>
                <p className="finance-stat-number">1,247</p>
              </div>
              <div className="finance-report-stat-item">
                <h4>Most Downloaded</h4>
                <p className="finance-stat-number">Overdue Payments</p>
              </div>
              <div className="finance-report-stat-item">
                <h4>Last Generated</h4>
                <p className="finance-stat-number">Today, 10:30 AM</p>
              </div>
              <div className="finance-report-stat-item">
                <h4>Storage Used</h4>
                <p className="finance-stat-number">2.4 GB</p>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="finance-tab-content analytics-tab">
            <div className="finance-tab-header">
              <h2><BarChart3 size={24} /> Advanced Analytics</h2>
              <div className="finance-tab-actions">
                <select className="finance-analytics-period" defaultValue="Last 30 Days">
                  <option>Real-time</option>
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>Last Quarter</option>
                  <option>Last Year</option>
                </select>
                <button className="finance-action-btn primary" onClick={() => handleExportData('transactions')}>
                  <File size={16} /> Export Analytics
                </button>
              </div>
            </div>

            <div className="finance-analytics-grid">
              {/* Performance Metrics */}
              <div className="finance-analytics-card large">
                <div className="finance-card-header">
                  <h3><Activity size={20} /> Performance Metrics</h3>
                </div>
                <div className="finance-metrics-grid">
                  <div className="finance-metric-item">
                    <div className="finance-metric-label">Avg. Collection Time</div>
                    <div className="finance-metric-value">14.2 days</div>
                    <div className="finance-metric-change negative">
                      <TrendingDown size={14} /> 1.3 days longer
                    </div>
                  </div>
                  <div className="finance-metric-item">
                    <div className="finance-metric-label">Payment Success Rate</div>
                    <div className="finance-metric-value">94.7%</div>
                    <div className="finance-metric-change positive">
                      <TrendingUp size={14} /> 2.1% increase
                    </div>
                  </div>
                  <div className="finance-metric-item">
                    <div className="finance-metric-label">Overdue Recovery Rate</div>
                    <div className="finance-metric-value">67.3%</div>
                    <div className="finance-metric-change positive">
                      <TrendingUp size={14} /> 5.4% increase
                    </div>
                  </div>
                  <div className="finance-metric-item">
                    <div className="finance-metric-label">Student Satisfaction</div>
                    <div className="finance-metric-value">8.9/10</div>
                    <div className="finance-metric-change neutral">
                      <TrendingUp size={14} /> 0.2 increase
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue Forecast */}
              <div className="finance-analytics-card">
                <div className="finance-card-header">
                  <h3><TrendingUp size={20} /> Revenue Forecast</h3>
                </div>
                <div className="finance-chart-container">
                  {analytics.monthlyData && analytics.monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={analytics.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Forecast']} />
                        <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="finance-no-data">
                      <TrendingUp size={32} />
                      <p>No forecast data available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method Distribution */}
              <div className="finance-analytics-card">
                <div className="finance-card-header">
                  <h3><CreditCard size={20} /> Payment Methods</h3>
                </div>
                <div className="finance-chart-container">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Bank Transfer', value: 45 },
                          { name: 'Credit Card', value: 30 },
                          { name: 'Mobile Money', value: 15 },
                          { name: 'Cash', value: 8 },
                          { name: 'Check', value: 2 }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                        label
                      >
                        {['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'].map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Program Performance Radar */}
              <div className="finance-analytics-card large">
                <div className="finance-card-header">
                  <h3><Target size={20} /> Program Performance</h3>
                </div>
                <div className="finance-chart-container">
                  {analytics.programData && analytics.programData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={analytics.programData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" />
                        <PolarRadiusAxis />
                        <Radar name="Revenue" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                        <Tooltip 
                          formatter={(value, name, props) => [
                            `$${value.toLocaleString()}`, 
                            'Revenue'
                          ]}
                          labelFormatter={(label, payload) => {
                            const fullName = payload[0]?.payload?.programName || label;
                            return `${fullName} (${label})`;
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="finance-no-data">
                      <Target size={32} />
                      <p>No program performance data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {/* New Payment Modal */}
      {showNewPaymentModal && (
        <div className="finance-modal-overlay">
          <div className="finance-modal finance-payment-modal">
            <div className="finance-modal-header">
              <h3><Plus size={20} /> Create New Invoice</h3>
              <button 
                className="finance-modal-close"
                onClick={() => setShowNewPaymentModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreatePayment}>
              <div className="finance-modal-body">
                <div className="finance-form-section">
                  <h4>Student Information</h4>
                  <div className="finance-form-group">
                    <label>
                      <User size={14} /> Student *
                    </label>
                    <select
                      value={newPayment.student_id}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, student_id: e.target.value }))}
                      required
                      className="finance-form-select"
                    >
                      <option value="">Select a student</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.student_id}) - {s.program}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="finance-form-row">
                  <div className="finance-form-group">
                    <label>
                      <DollarSign size={14} /> Amount ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                      required
                      placeholder="0.00"
                      className="finance-form-input"
                    />
                  </div>
                  
                  <div className="finance-form-group">
                    <label>
                      <Package size={14} /> Category *
                    </label>
                    <select
                      value={newPayment.category}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, category: e.target.value }))}
                      required
                      className="finance-form-select"
                    >
                      <option value="">Select a category</option>
                      {feeCategories.map(category => (
                        <option key={category.id} value={category.category_code}>
                          {category.category_name} ({category.category_code})
                        </option>
                      ))}
                    </select>
                    <small className="finance-form-help">
                      Select category code, not description
                    </small>
                  </div>
                </div>
                
                <div className="finance-form-row">
                  <div className="finance-form-group">
                    <label>
                      <BookOpen size={14} /> Academic Year
                    </label>
                    <input
                      type="text"
                      value={newPayment.academic_year}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, academic_year: e.target.value }))}
                      placeholder="e.g., 2024"
                      className="finance-form-input"
                    />
                  </div>
                  
                  <div className="finance-form-group">
                    <label>
                      <Layers size={14} /> Semester
                    </label>
                    <select
                      value={newPayment.semester}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, semester: e.target.value }))}
                      className="finance-form-select"
                    >
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                      <option value="3">Semester 3</option>
                    </select>
                  </div>
                </div>
                
                <div className="finance-form-group">
                  <label>
                    <FileText size={14} /> Description *
                  </label>
                  <input
                    type="text"
                    value={newPayment.description}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, description: e.target.value }))}
                    required
                    placeholder="Enter payment description (e.g., Tuition Fees Semester 1)"
                    className="finance-form-input"
                  />
                  <small className="finance-form-help">
                    Enter description here. Category should be selected from dropdown above.
                  </small>
                </div>
                
                <div className="finance-form-row">
                  <div className="finance-form-group">
                    <label>
                      <Calendar size={14} /> Due Date
                    </label>
                    <input
                      type="date"
                      value={newPayment.due_date}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, due_date: e.target.value }))}
                      className="finance-form-input"
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                  
                  <div className="finance-form-group">
                    <label>
                      <Banknote size={14} /> Payment Method
                    </label>
                    <select
                      value={newPayment.payment_method}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, payment_method: e.target.value }))}
                      className="finance-form-select"
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                    </select>
                  </div>
                </div>
                
                <div className="finance-form-group">
                  <label>
                    <Receipt size={14} /> Receipt Number
                  </label>
                  <input
                    type="text"
                    value={newPayment.receipt_number}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, receipt_number: e.target.value }))}
                    placeholder="Auto-generate if empty"
                    className="finance-form-input"
                  />
                </div>
              </div>
              
              <div className="finance-modal-footer">
                <button 
                  type="button" 
                  className="finance-action-btn secondary"
                  onClick={() => setShowNewPaymentModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="finance-action-btn primary"
                  disabled={!newPayment.student_id || !newPayment.amount || !newPayment.description || !newPayment.category}
                >
                  <Check size={16} /> Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters Modal */}
      {showFiltersModal && (
        <div className="finance-modal-overlay">
          <div className="finance-modal finance-filters-modal">
            <div className="finance-modal-header">
              <h3><Filter size={20} /> Advanced Filters</h3>
              <button 
                className="finance-modal-close"
                onClick={() => setShowFiltersModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="finance-modal-body">
              <div className="finance-filter-section">
                <h4>Date Range</h4>
                <div className="finance-filter-options">
                  {['all', 'today', 'week', 'month', 'quarter', 'year'].map(range => (
                    <button
                      key={range}
                      className={`finance-filter-option ${filters.dateRange === range ? 'active' : ''}`}
                      onClick={() => setFilters(prev => ({ ...prev, dateRange: range }))}
                    >
                      {range.charAt(0).toUpperCase() + range.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="finance-filter-section">
                <h4>Payment Status</h4>
                <div className="finance-filter-options">
                  {['all', 'pending', 'paid', 'overdue', 'cancelled', 'partial'].map(status => (
                    <button
                      key={status}
                      className={`finance-filter-option status-${status} ${filters.paymentStatus === status ? 'active' : ''}`}
                      onClick={() => setFilters(prev => ({ ...prev, paymentStatus: status }))}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="finance-filter-section">
                <h4>Amount Range</h4>
                <div className="finance-range-slider">
                  <div className="finance-range-labels">
                    <span>${filters.amountRange.min}</span>
                    <span>${filters.amountRange.max}</span>
                  </div>
                  <div className="finance-range-inputs">
                    <input
                      type="range"
                      min="0"
                      max="100000"
                      step="1000"
                      value={filters.amountRange.min}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        amountRange: { ...prev.amountRange, min: parseInt(e.target.value) }
                      }))}
                      className="finance-range-input"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100000"
                      step="1000"
                      value={filters.amountRange.max}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        amountRange: { ...prev.amountRange, max: parseInt(e.target.value) }
                      }))}
                      className="finance-range-input"
                    />
                  </div>
                </div>
              </div>
              
              <div className="finance-filter-section">
                <h4>Program</h4>
                <select
                  value={filters.program}
                  onChange={(e) => setFilters(prev => ({ ...prev, program: e.target.value }))}
                  className="finance-filter-select"
                >
                  <option value="all">All Programs</option>
                  {programs.map(program => (
                    <option key={program.id} value={program.code}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="finance-modal-footer">
              <button 
                className="finance-action-btn secondary"
                onClick={() => {
                  setFilters({
                    dateRange: 'all',
                    paymentStatus: 'all',
                    amountRange: { min: 0, max: 100000 },
                    program: 'all',
                    academicYear: 'all',
                    semester: 'all'
                  });
                }}
              >
                <FilterX size={16} /> Clear All
              </button>
              <button 
                className="finance-action-btn primary"
                onClick={() => {
                  setShowFiltersModal(false);
                  if (activeTab === 'transactions') {
                    fetchAllTransactions();
                  } else if (activeTab === 'students') {
                    fetchStudents();
                  }
                }}
              >
                <Check size={16} /> Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="finance-modal-overlay">
          <div className="finance-modal finance-logout-modal">
            <div className="finance-modal-icon warning">
              <AlertTriangle size={48} />
            </div>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout from the Finance Dashboard?</p>
            <div className="finance-modal-actions">
              <button 
                className="finance-action-btn secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="finance-action-btn danger"
                onClick={confirmLogout}
              >
                <LogOut size={16} /> Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="finance-toast-container">
        {/* Toast messages would go here */}
      </div>
    </div>
  );
};

export default FinanceDashboard;