// pages/index.js
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Swal from 'sweetalert2';
import { Container, Card, Button, Form, Table, Spinner, ProgressBar } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as XLSX from 'xlsx'; // สำหรับการสร้างไฟล์ Excel ใน Frontend (ถ้ามี)
import { saveAs } from 'file-saver'; // สำหรับการดาวน์โหลดไฟล์

// --- DataTables CSS Imports ---
import 'datatables.net-dt/css/dataTables.dataTables.css';
import 'datatables.net-bs5/css/dataTables.bootstrap5.css';

// --- DataTables Library Imports (ต้องติดตั้ง yarn add jquery datatables.net datatables.net-dt ...) ---
import $ from 'jquery';
import 'datatables.net';
import 'datatables.net-bs5'; 

// ----------------------------------------------------------------------
// Function: Convert JSON to CSV String
// ----------------------------------------------------------------------
const convertToCSV = (arr) => {
    if (arr.length === 0) return '';
    const header = Object.keys(arr[0]).join(',');
    const rows = arr.map(row => 
        Object.values(row).map(value => {
            if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
            return value;
        }).join(',')
    );
    return [header, ...rows].join('\n');
};

// ----------------------------------------------------------------------
// Component: DataPreview (แสดงข้อมูลทั้งหมดที่อัปโหลดด้วย DataTables)
// ----------------------------------------------------------------------
const DataPreview = ({ data }) => {
    const tableRef = useRef(null); 
    
    useEffect(() => {
        if (data.length === 0) return;

        // 1. ทำลาย DataTables เดิมก่อนสร้างใหม่
        if ($.fn.DataTable.isDataTable(tableRef.current)) {
            $(tableRef.current).DataTable().destroy();
            $(tableRef.current).empty(); 
            $(tableRef.current).append(`
                <thead class="table-dark">
                    <tr><th>Sender</th><th>Text</th></tr>
                </thead>
            `);
        }
        
        // 2. กำหนดตารางเป็น DataTables
        const dataTable = $(tableRef.current).DataTable({
            paging: true,
            searching: true,
            ordering: true,
            info: true,
            responsive: true,
            lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "All"]],
            language: { 
                search: "ค้นหา:",
                lengthMenu: "แสดง _MENU_ รายการ",
                info: "แสดง _START_ ถึง _END_ จากทั้งหมด _TOTAL_ รายการ",
                paginate: { previous: "ก่อนหน้า", next: "ถัดไป" }
            },
            dom: 'lfrtip', // DataTables Standard Layout
            data: data,
            columns: [
                { data: 'sender' },
                { data: 'text', className: 'text-start' }
            ],
        });

        return () => {
            dataTable.destroy();
        };
    }, [data]);

    if (!data || data.length === 0) return null;

    return (
        <Card className="mt-3 shadow-sm border-light">
            <Card.Header className="bg-light">
                <h5 className="mb-0 text-dark">
                    <i className="bi bi-eye-fill me-2"></i> 
                    ตัวอย่างข้อมูลที่อัปโหลด (Preview)
                </h5>
            </Card.Header>
            <Card.Body>
                <div className="table-responsive">
                    <Table 
                        ref={tableRef} 
                        striped 
                        bordered 
                        hover 
                        size="sm"
                        className="text-center w-100"
                    >
                        <thead className="table-secondary">
                            <tr>
                                <th>Sender</th>
                                <th>Text</th>
                            </tr>
                        </thead>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
};

// ----------------------------------------------------------------------
// Component: ResultTable (แสดงผลลัพธ์การคัดกรอง)
// ----------------------------------------------------------------------
const ResultTable = ({ data }) => {
    const tableRef = useRef(null); 
    
    // --- ฟังก์ชันดาวน์โหลด (ใช้ logic จาก DataTables Buttons แต่เราเรียกใช้เอง) ---
    const handleDownload = (format) => {
        if (!data || data.length === 0) {
            Swal.fire('Error', 'No data to download.', 'error');
            return;
        }

        if (format === 'csv') {
            const csvData = convertToCSV(data);
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            // ใช้ Download Button ของ HTML แทน saveAs เพื่อลด dependency (saveAs ต้องติดตั้ง file-saver)
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', 'sms_screening_results.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else if (format === 'xlsx') {
            // สร้างไฟล์ Excel โดยใช้ XLSX (ถ้ามีการติดตั้ง library)
            try {
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Screening Results");
                XLSX.writeFile(wb, "sms_screening_results.xlsx");
            } catch (e) {
                Swal.fire('Error', 'Excel library (xlsx) not available or error generating file. Please use CSV.', 'error');
            }
        }
    };

    useEffect(() => {
        if (data.length === 0) return;

        // 1. ทำลาย DataTables เดิมก่อนสร้างใหม่
        if ($.fn.DataTable.isDataTable(tableRef.current)) {
            $(tableRef.current).DataTable().destroy();
            $(tableRef.current).empty(); 
            $(tableRef.current).append(`
                <thead class="table-dark">
                    <tr><th>Sender</th><th>Text</th><th>Case</th><th>Category</th><th>Note</th></tr>
                </thead>
            `);
        }

        const dataTable = $(tableRef.current).DataTable({
            paging: true,
            searching: true,
            ordering: true,
            info: true,
            responsive: true,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            language: { 
                search: "ค้นหา:",
                lengthMenu: "แสดง _MENU_ รายการ",
                info: "แสดง _START_ ถึง _END_ จากทั้งหมด _TOTAL_ รายการ",
                paginate: { previous: "ก่อนหน้า", next: "ถัดไป" }
            },
            
            // 🚨 แก้ไข: ลบ 'B' (Buttons) ออกจาก dom เพื่อไม่ให้ปุ่มปรากฏในตาราง
            dom: 'lfrtip', 
            
            data: data,
            columns: [
                { data: 'sender' },
                { data: 'text', className: 'text-start' },
                { 
                    data: 'case',
                    render: function (data) {
                        return `<span class="fw-bold">${data.toUpperCase()}</span>`;
                    }
                },
                { data: 'category' },
                { data: 'note' }
            ],
            
            "createdRow": function (row, data) {
                if (data.case === 'pass') {
                    $(row).addClass('table-success');
                } else if (data.case === 'not pass') {
                    $(row).addClass('table-danger');
                } else if (data.case === 'error') {
                    $(row).addClass('table-warning');
                }
            }
        });

        return () => {
            dataTable.destroy();
        };
    }, [data]);

    return (
        <Card className="mt-4 shadow-lg">
            <Card.Header className="bg-primary text-white">
                <h4 className="mb-0">3. ผลลัพธ์การคัดกรอง</h4>
            </Card.Header>
            <Card.Body>
                {/* 3.1 ตาราง DataTables */}
                <div className="table-responsive">
                    <Table 
                        ref={tableRef} 
                        striped 
                        bordered 
                        hover 
                        className="text-center w-100" 
                    >
                        <thead className="table-dark">
                            <tr>
                                <th>Sender</th>
                                <th>Text</th>
                                <th>Case</th>
                                <th>Category</th>
                                <th>Note</th>
                            </tr>
                        </thead>
                    </Table>
                </div>
                
                {/* 3.2. หัวข้อ 4 ดาวน์โหลด (แยกออกมา) */}
                <h4 className="mt-4">4. ดาวน์โหลดผลลัพธ์</h4>
                <div className="d-flex gap-2">
                    <Button variant="success" onClick={() => handleDownload('csv')}>
                        <i className="bi bi-file-earmark-spreadsheet-fill me-2"></i> 📥 Download CSV
                    </Button>
                    <Button variant="info" onClick={() => handleDownload('xlsx')}>
                        <i className="bi bi-file-earmark-excel-fill me-2"></i> 📥 Download Excel
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
};


// ----------------------------------------------------------------------
// Component: Home (หน้าหลัก)
// ----------------------------------------------------------------------
export default function Home() {
    const [file, setFile] = useState(null);
    const [originalData, setOriginalData] = useState([]); 
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0); 
    const [results, setResults] = useState([]);
    const [processedCount, setProcessedCount] = useState(0); 

    const handleFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        setFile(null); 
        setOriginalData([]);
        setResults([]);
        setProcessedCount(0);
        setProgress(0);

        if (!selectedFile) return;

        const fileName = selectedFile.name.toLowerCase();
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
            Swal.fire('Invalid File', 'Please upload a CSV or Excel (.xlsx) file.', 'error');
            return;
        }

        setIsLoading(true);
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        try {
            const response = await fetch('/api/upload-and-read', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Server error during file reading.');
            }

            const data = await response.json();
            
            if (data.data.length === 0) {
                 throw new Error('File is empty or could not be parsed. Check column headers (sender, text).');
            }

            setFile(selectedFile);
            setOriginalData(data.data); 
            Swal.fire('Success', `Loaded ${data.data.length} rows from ${selectedFile.name}`, 'success');

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: '❌ Error reading file',
                text: error.message || 'An unknown error occurred during file reading.',
            });
             setFile(null); 
             setOriginalData([]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleProcess = async () => {
        if (originalData.length === 0) {
            Swal.fire('Error', 'No data to process. Please upload a valid file first.', 'warning');
            return;
        }

        setIsLoading(true);
        setResults([]);
        setProgress(0);
        setProcessedCount(0);

        const processedData = [];
        const totalRows = originalData.length;

        try {
            for (let i = 0; i < totalRows; i++) {
                const row = originalData[i];
                const textToAnalyze = String(row.text);
                const sender = String(row.sender);

                const response = await fetch('/api/process-one', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sender, text: textToAnalyze }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Error processing row ${i + 1}: ${errorData.message}`);
                }

                const result = await response.json();

                processedData.push(result.data);
                setResults([...processedData]); 

                setProcessedCount(i + 1);
                const currentProgress = ((i + 1) / totalRows) * 100;
                setProgress(Math.round(currentProgress));
            }

            Swal.fire({
                icon: 'success',
                title: '🎉 ประมวลผลเสร็จสิ้น!',
                text: `ประมวลผลข้อความทั้งหมด ${totalRows} รายการ`,
            });

        } catch (error) {
            console.error('Processing error:', error);
            Swal.fire({
                icon: 'error',
                title: '❌ เกิดข้อผิดพลาด',
                text: error.message || 'An unknown error occurred during processing.',
            });
        } finally {
            setIsLoading(false);
            setProgress(0);
        }
    };


    return (
        <>
            <Head>
                <title>ระบบคัดกรองข้อความ SMS ด้วย AI - Next.js</title>
                {/* NOTE: ต้องสร้าง pages/_document.js และย้าย <link> ของ Bootstrap Icons ไปที่นั่น */}
            </Head>
            
            <Container className="my-5">
                <header className="text-center mb-5">
                    <h1 className="display-4 fw-bold text-primary">
                        ระบบคัดกรองข้อความ SMS ด้วย AI 
                    </h1>
                    <p className="lead">วิเคราะห์และจัดประเภทข้อความ SMS ที่อาจเป็นสแปมหรือหลอกลวง โดยใช้  AI</p>
                </header>
                
                {/* 1. อัปโหลดและแสดงตัวอย่าง */}
                <Card className="shadow-lg mb-4">
                    <Card.Header className="bg-light">
                        <h4 className="mb-0 text-dark">1. อัปโหลดไฟล์ (CSV หรือ Excel)</h4>
                    </Card.Header>
                    <Card.Body>
                        <Form>
                            <Form.Group controlId="formFile" className="mb-3">
                                <Form.Label className="fw-bold">
                                    <i className="bi bi-upload me-2"></i> 
                                    กรุณาอัปโหลดไฟล์ CSV หรือ Excel (.xlsx) ที่มีคอลัมน์ sender และ text
                                </Form.Label>
                                <Form.Control 
                                    type="file" 
                                    accept=".csv, .xlsx" 
                                    onChange={handleFileChange}
                                    disabled={isLoading}
                                />
                                <Form.Text className="text-muted">
                                    ไฟล์ที่รองรับ: .csv, .xlsx เท่านั้น (Header ต้องเป็น 'sender' และ 'text')
                                </Form.Text>
                            </Form.Group>
                        </Form>
                        
                        {/* แสดงรายละเอียดไฟล์ที่อัปโหลด และ Data Preview */}
                        {file && originalData.length > 0 && (
                            <>
                                <Card className="mt-3 p-3 border-info shadow-sm">
                                    <Card.Title className="text-info mb-2">
                                        <i className="bi bi-file-earmark-check-fill me-2"></i> 
                                        รายละเอียดไฟล์ที่พร้อมประมวลผล
                                    </Card.Title>
                                    <p className="mb-1">
                                        ชื่อไฟล์ : {file.name}
                                    </p>
                                    <p className="mb-0">
                                        จำนวนข้อความ : <span className="fw-bold text-success">{originalData.length}</span> แถว
                                    </p>
                                </Card>
                                <DataPreview data={originalData} />
                            </>
                        )}
                    </Card.Body>
                </Card>

                {/* 2. เริ่มต้นการประมวลผล */}
                <Card className="shadow-lg">
                    <Card.Header className="bg-secondary text-white">
                        <h4 className="mb-0">2. เริ่มต้นการประมวลผล</h4>
                    </Card.Header>
                    <Card.Body className="text-center">
                        <Button 
                            variant="warning" 
                            size="lg" 
                            onClick={handleProcess} 
                            disabled={originalData.length === 0 || isLoading}
                        >
                            {isLoading && progress === 0 ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    กำลังโหลดไฟล์...
                                </>
                            ) : isLoading ? (
                                 <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    กำลังประมวลผล ({progress}%)
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-rocket-takeoff-fill me-2"></i> 🚀 เริ่มประมวลผลด้วย  AI
                                </>
                            )}
                        </Button>
                        
                        {/* Progress Bar ขณะประมวลผล */}
                        {isLoading && progress > 0 && (
                            <div className="mt-3 text-start">
                                <p className="mb-1 text-muted">ความคืบหน้า: {processedCount} / {originalData.length} รายการ</p>
                                <ProgressBar 
                                    animated 
                                    variant="primary" 
                                    now={progress} 
                                    label={`${progress}%`}
                                    className="shadow-sm" 
                                />
                            </div>
                        )}
                        {!file && <p className="mt-2 text-muted">กรุณาอัปโหลดไฟล์ก่อนเริ่มการประมวลผล</p>}
                    </Card.Body>
                </Card>

                {/* 3. ส่วนแสดงผลลัพธ์ DataTables (มีหัวข้อ 4 ดาวน์โหลดอยู่ภายใน) */}
                {results.length > 0 && <ResultTable data={results} />}
                
            </Container>
            
            <footer className="footer mt-auto py-3 bg-light border-top">
                <Container className="text-center">
                    <span className="text-muted">© Copyright <strong><span>SUN-SYSTEMS</span></strong> All Rights Reserved</span>
                </Container>
            </footer>
        </>
    );
}